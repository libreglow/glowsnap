package screencast

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const ffmpegBinary = "ffmpeg"

func ThumbnailFileName(videoName string) string {
	base := videoName
	if dot := strings.LastIndex(base, "."); dot >= 0 {
		base = base[:dot]
	}
	return base + ".jpg"
}

func EnsureThumbnail(videoPath string) (string, error) {
	dir := filepath.Dir(videoPath)
	name := ThumbnailFileName(filepath.Base(videoPath))
	thumbPath := filepath.Join(dir, name)
	if _, err := os.Stat(thumbPath); err == nil {
		return name, nil
	}
	if _, err := exec.LookPath(ffmpegBinary); err != nil {
		return "", nil
	}

	if err := runThumbnail(videoPath, thumbPath, 1); err != nil {
		os.Remove(thumbPath)
		if retryErr := runThumbnail(videoPath, thumbPath, 0); retryErr != nil {
			os.Remove(thumbPath)
			return "", retryErr
		}
	}
	if _, err := os.Stat(thumbPath); err != nil {
		return "", fmt.Errorf("ffmpeg produced no thumbnail for %s", videoPath)
	}
	return name, nil
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
		return err
	}
	return nil
}
