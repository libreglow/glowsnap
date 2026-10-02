package screencast

import (
	"fmt"
	"glowsnap/services/settings"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"
)

type RecordingOptions struct {
	OutputPath    string
	CaptureMic    bool
	MicDevice     string
	CaptureSystem bool
	SystemDevice  string
	Resolution    string
	CustomWidth   int
	CustomHeight  int
}

type Recorder interface {
	Start(videoNode uint32, opts RecordingOptions) error
	Stop() error
	Cancel() error
	Pause() error
	Resume() error
	WaitDone() <-chan struct{}
	WaitErr() error
	IsRunning() bool
}

type gstLauncher struct {
	mu      sync.Mutex
	cmd     *exec.Cmd
	paused  bool
	done    chan struct{}
	waitErr error
	waitSet bool
}

var gstLaunchBinary = "gst-launch-1.0"

func NewGstLauncher() Recorder {
	return &gstLauncher{}
}

func (g *gstLauncher) Start(videoNode uint32, opts RecordingOptions) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.cmd != nil {
		return fmt.Errorf("recording already active")
	}

	args, err := buildPipelineArgs(videoNode, opts)
	if err != nil {
		return err
	}

	cmd := exec.Command(gstLaunchBinary, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start gst-launch: %w", err)
	}

	g.cmd = cmd
	g.paused = false
	done := make(chan struct{})
	g.done = done

	go func() {
		waitErr := cmd.Wait()
		g.mu.Lock()
		g.waitErr = waitErr
		g.waitSet = true
		g.cmd = nil
		g.paused = false
		g.done = nil
		g.mu.Unlock()
		close(done)
	}()

	return nil
}

func (g *gstLauncher) Stop() error {
	if err := g.signalStop(); err != nil {
		return err
	}
	return g.awaitExit(5 * time.Second)
}

func (g *gstLauncher) Cancel() error {
	g.mu.Lock()
	var proc *os.Process
	if g.cmd != nil && g.cmd.Process != nil {
		proc = g.cmd.Process
	}
	g.mu.Unlock()
	if proc != nil {
		proc.Kill()
	}
	return g.awaitExit(2 * time.Second)
}

func (g *gstLauncher) Pause() error {
	g.mu.Lock()
	if g.cmd == nil || g.cmd.Process == nil {
		g.mu.Unlock()
		return fmt.Errorf("no active recording")
	}
	if g.paused {
		g.mu.Unlock()
		return nil
	}
	g.paused = true
	proc := g.cmd.Process
	g.mu.Unlock()
	return proc.Signal(syscall.SIGSTOP)
}

func (g *gstLauncher) Resume() error {
	g.mu.Lock()
	if g.cmd == nil || g.cmd.Process == nil {
		g.mu.Unlock()
		return fmt.Errorf("no active recording")
	}
	if !g.paused {
		g.mu.Unlock()
		return nil
	}
	g.paused = false
	proc := g.cmd.Process
	g.mu.Unlock()
	return proc.Signal(syscall.SIGCONT)
}

func (g *gstLauncher) WaitDone() <-chan struct{} {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.done == nil {
		closed := make(chan struct{})
		close(closed)
		return closed
	}
	return g.done
}

func (g *gstLauncher) WaitErr() error {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.waitSet {
		return g.waitErr
	}
	return fmt.Errorf("recorder still running")
}

func (g *gstLauncher) IsRunning() bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.cmd != nil && g.cmd.Process != nil
}

func (g *gstLauncher) signalStop() error {
	g.mu.Lock()
	if g.cmd == nil || g.cmd.Process == nil {
		g.mu.Unlock()
		return fmt.Errorf("no active recording")
	}
	paused := g.paused
	g.paused = false
	proc := g.cmd.Process
	g.mu.Unlock()

	if paused {
		proc.Signal(syscall.SIGCONT)
		time.Sleep(100 * time.Millisecond)
	}
	return proc.Signal(os.Interrupt)
}

func (g *gstLauncher) awaitExit(timeout time.Duration) error {
	done := g.WaitDone()
	select {
	case <-done:
		return g.WaitErr()
	case <-time.After(timeout):
		g.mu.Lock()
		var proc *os.Process
		if g.cmd != nil && g.cmd.Process != nil {
			proc = g.cmd.Process
		}
		g.mu.Unlock()
		if proc != nil {
			proc.Kill()
		}
		<-done
		return g.WaitErr()
	}
}

func buildPipelineArgs(videoNode uint32, opts RecordingOptions) ([]string, error) {
	if opts.OutputPath == "" {
		return nil, fmt.Errorf("output path is required")
	}

	profile := resolutionProfile(opts.Resolution, opts.CustomWidth, opts.CustomHeight)
	audioBitrate := profile.AudioBitrate

	args := []string{
		"-e",
		"pipewiresrc", fmt.Sprintf("path=%d", videoNode),
		"!", "videoconvert",
		"!", "videoscale", "add-borders=true",
		"!", fmt.Sprintf("video/x-raw,width=%d,height=%d", profile.Width, profile.Height),
		"!", "videoconvert",
		"!", "openh264enc",
		fmt.Sprintf("bitrate=%d", profile.VideoBitrate),
		fmt.Sprintf("complexity=%d", profile.Complexity),
		fmt.Sprintf("qp-min=%d", profile.QPMin),
		fmt.Sprintf("qp-max=%d", profile.QPMax),
		fmt.Sprintf("gop-size=%d", profile.GopSize),
		"!", "h264parse",
		"!", "queue", "max-size-time=2000000000",
		"!", "mp4mux", "name=mux",
		"!", "filesink", "location=" + opts.OutputPath,
	}

	var audioSources []string
	if opts.CaptureMic && opts.MicDevice != "" {
		audioSources = append(audioSources, opts.MicDevice)
	}
	if opts.CaptureSystem && opts.SystemDevice != "" {
		audioSources = append(audioSources, opts.SystemDevice)
	}

	if len(audioSources) == 1 {
		args = append(args,
			"pulsesrc", "device="+audioSources[0], "provide-clock=false",
			"!", "queue", "max-size-time=2000000000", "max-size-buffers=0", "max-size-bytes=0", "leaky=2",
			"!", "audioconvert",
			"!", "audioresample",
			"!", "queue", "max-size-time=2000000000", "max-size-buffers=0", "max-size-bytes=0",
			"!", "avenc_aac", fmt.Sprintf("bitrate=%d", audioBitrate),
			"!", "aacparse",
			"!", "queue", "max-size-time=2000000000", "max-size-buffers=0", "max-size-bytes=0",
			"!", "mux.audio_0")
	} else if len(audioSources) > 1 {
		for idx, src := range audioSources {
			if idx == 0 {
				args = append(args,
					"pulsesrc", "device="+src, "provide-clock=false",
					"!", "queue", "max-size-time=2000000000", "max-size-buffers=0", "max-size-bytes=0", "leaky=2",
					"!", "audioconvert",
					"!", "audioresample",
					"!", "audiomixer", "name=mix", "start-time-selection=zero", "alignment-threshold=40000000",
					"!", "queue", "max-size-time=2000000000", "max-size-buffers=0", "max-size-bytes=0",
					"!", "avenc_aac", fmt.Sprintf("bitrate=%d", audioBitrate),
					"!", "aacparse",
					"!", "queue", "max-size-time=2000000000", "max-size-buffers=0", "max-size-bytes=0",
					"!", "mux.audio_0")
			} else {
				args = append(args,
					"pulsesrc", "device="+src, "provide-clock=false",
					"!", "queue", "max-size-time=2000000000", "max-size-buffers=0", "max-size-bytes=0", "leaky=2",
					"!", "audioconvert",
					"!", "audioresample",
					"!", "mix.")
			}
		}
	}

	return args, nil
}

type encodingProfile struct {
	Width        int
	Height       int
	VideoBitrate int
	AudioBitrate int
	Complexity   int
	QPMin        int
	QPMax        int
	GopSize      int
}

func resolutionProfile(resolution string, customWidth, customHeight int) encodingProfile {
	width, height, ok := settings.OutputDimensions(resolution, customWidth, customHeight)
	if !ok {
		width, height, _ = settings.ResolutionDimensions(settings.DefaultResolution)
	}
	return encodingProfileForSize(width, height)
}

func encodingProfileForSize(width, height int) encodingProfile {
	profile := encodingProfile{Width: width, Height: height, GopSize: 60}

	switch pixels := width * height; {
	case pixels <= 854*480:
		profile.VideoBitrate = 800000
		profile.AudioBitrate = 96000
		profile.Complexity = 0
		profile.QPMin = 32
		profile.QPMax = 48
	case pixels <= 1280*720:
		profile.VideoBitrate = 2000000
		profile.AudioBitrate = 128000
		profile.Complexity = 1
		profile.QPMin = 24
		profile.QPMax = 44
	case pixels <= 1920*1080:
		profile.VideoBitrate = 6000000
		profile.AudioBitrate = 192000
		profile.Complexity = 2
		profile.QPMin = 16
		profile.QPMax = 38
	case pixels <= 2560*1440:
		profile.VideoBitrate = 12000000
		profile.AudioBitrate = 192000
		profile.Complexity = 2
		profile.QPMin = 16
		profile.QPMax = 38
	default:
		profile.VideoBitrate = 24000000
		profile.AudioBitrate = 192000
		profile.Complexity = 2
		profile.QPMin = 16
		profile.QPMax = 38
	}

	return profile
}
