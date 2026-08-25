package screencast

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

const ffmpegBinary = "ffmpeg"

var (
	inFlightMu sync.Mutex
	inFlight   = map[string]bool{}
)

func ThumbnailFileName(videoName string) string {
	base := videoName
	if dot := strings.LastIndex(base, "."); dot >= 0 {
		base = base[:dot]
	}
	return base + ".jpg"
}

func ThumbnailExists(videoPath string) (string, bool) {
	dir := filepath.Dir(videoPath)
	name := ThumbnailFileName(filepath.Base(videoPath))
	thumbPath := filepath.Join(dir, name)
	if _, err := os.Stat(thumbPath); err == nil {
		return name, true
	}
	return name, false
}

func GenerateThumbnailAsync(videoPath string, onDone func(name string, err error)) {
	dir := filepath.Dir(videoPath)
	name := ThumbnailFileName(filepath.Base(videoPath))
	thumbPath := filepath.Join(dir, name)

	if _, err := os.Stat(thumbPath); err == nil {
		if onDone != nil {
			onDone(name, nil)
		}
		return
	}

	if _, err := exec.LookPath(ffmpegBinary); err != nil {
		if onDone != nil {
			onDone("", fmt.Errorf("ffmpeg not found"))
		}
		return
	}

	inFlightMu.Lock()
	if inFlight[videoPath] {
		inFlightMu.Unlock()
		return
	}
	inFlight[videoPath] = true
	inFlightMu.Unlock()

	go func() {
		defer func() {
			inFlightMu.Lock()
			delete(inFlight, videoPath)
			inFlightMu.Unlock()
		}()

		err := runThumbnail(videoPath, thumbPath, 1)
		if err != nil {
			os.Remove(thumbPath)
			err = runThumbnail(videoPath, thumbPath, 0)
			if err != nil {
				os.Remove(thumbPath)
			}
		}

		if onDone != nil {
			if err != nil {
				onDone("", err)
			} else {
				onDone(name, nil)
			}
		}
	}()
}

func runThumbnail(videoPath, thumbPath string, seekSeconds int) error {
	args := []string{
		"-y",
		"-ss", fmt.Sprintf("%d", seekSeconds),
		"-i", videoPath,
		"-frames:v", "1",
		"-vf", "scale=480:-1",
		"-q:v", "5",
		thumbPath,
	}

	cmd := exec.Command(ffmpegBinary, args...)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ffmpeg failed: %w\n%s", err, out.String())
	}
	return nil
}
