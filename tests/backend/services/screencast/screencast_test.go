package screencast

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestGenerateFilename(t *testing.T) {
	now := time.Now()
	name := GenerateFilename()
	prefix := "screencast_" + now.Format("2006-01-02_15-04-05")
	if name != prefix+".mp4" {
		t.Fatalf("unexpected filename %q, want prefix %q", name, prefix)
	}
}

func join(args []string) string {
	return strings.Join(args, " ")
}

func TestBuildPipelineArgsNoAudio(t *testing.T) {
	args, err := buildPipelineArgs(42, RecordingOptions{OutputPath: "/tmp/x.mp4"})
	if err != nil {
		t.Fatal(err)
	}
	s := join(args)
	for _, want := range []string{"pipewiresrc path=42", "openh264enc", "h264parse", "mp4mux name=mux", "filesink location=/tmp/x.mp4"} {
		if !strings.Contains(s, want) {
			t.Errorf("pipeline missing %q: %s", want, s)
		}
	}
	if strings.Contains(s, "pulsesrc") {
		t.Errorf("unexpected pulsesrc in no-audio pipeline: %s", s)
	}
	if !strings.Contains(s, "queue max-size-time=2000000000 ! mp4mux") {
		t.Errorf("missing video decoupling queue: %s", s)
	}
}

func TestBuildPipelineArgsMicOnly(t *testing.T) {
	args, err := buildPipelineArgs(1, RecordingOptions{
		OutputPath: "/tmp/a.mp4",
		CaptureMic: true,
		MicDevice:  "mic1",
	})
	if err != nil {
		t.Fatal(err)
	}
	s := join(args)
	if !strings.Contains(s, "pulsesrc device=mic1") {
		t.Errorf("missing mic pulsesrc: %s", s)
	}
	if !strings.Contains(s, "mux.audio_0") {
		t.Errorf("missing audio pad: %s", s)
	}
	if !strings.Contains(s, "provide-clock=false") {
		t.Errorf("missing pulsesrc provide-clock option: %s", s)
	}
	if strings.Contains(s, "audiomixer") {
		t.Errorf("single audio source should not instantiate audiomixer: %s", s)
	}
	if !strings.Contains(s, "device=mic1 provide-clock=false ! queue") {
		t.Errorf("mic pulsesrc must be followed by provide-clock=false and a queue: %s", s)
	}
	if strings.Contains(s, "device=sys") {
		t.Errorf("unexpected system device: %s", s)
	}
}

func TestBuildPipelineArgsBoth(t *testing.T) {
	args, err := buildPipelineArgs(1, RecordingOptions{
		OutputPath:    "/tmp/b.mp4",
		CaptureMic:    true,
		MicDevice:     "mic1",
		CaptureSystem: true,
		SystemDevice:  "mon0",
	})
	if err != nil {
		t.Fatal(err)
	}
	s := join(args)
	if !strings.Contains(s, "pulsesrc device=mic1") {
		t.Errorf("missing mic pulsesrc: %s", s)
	}
	if !strings.Contains(s, "pulsesrc device=mon0") {
		t.Errorf("missing system pulsesrc: %s", s)
	}
	if !strings.Contains(s, "audiomixer name=mix") {
		t.Errorf("missing audiomixer: %s", s)
	}
	if !strings.Contains(s, "mux.audio_0") {
		t.Errorf("missing audio pad: %s", s)
	}
	if !strings.Contains(s, "mix.") {
		t.Errorf("missing mixer chained source: %s", s)
	}
}

func TestBuildPipelineArgsEmptyPath(t *testing.T) {
	if _, err := buildPipelineArgs(1, RecordingOptions{}); err == nil {
		t.Fatal("expected error for empty output path")
	}
}

func TestMonitorCaptureStartNotifiesWhenFileGrows(t *testing.T) {
	dir := t.TempDir()
	outPath := filepath.Join(dir, "out.mp4")

	notified := make(chan struct{}, 1)
	s := &ScreenCastService{
		recording:        true,
		mu:               make(chan struct{}, 1),
		onRecordingStart: func() { notified <- struct{}{} },
	}

	go s.monitorCaptureStart(outPath)

	if err := os.WriteFile(outPath, nil, 0644); err != nil {
		t.Fatal(err)
	}
	time.Sleep(100 * time.Millisecond)

	f, err := os.OpenFile(outPath, os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.Write([]byte("video-data")); err != nil {
		f.Close()
		t.Fatal(err)
	}
	f.Close()

	select {
	case <-notified:
	case <-time.After(2 * time.Second):
		t.Fatal("expected start notification once the output file began growing")
	}
}

func TestMonitorCaptureStartSuppressedWhenNotRecording(t *testing.T) {
	dir := t.TempDir()
	outPath := filepath.Join(dir, "out.mp4")

	notified := make(chan struct{}, 1)
	s := &ScreenCastService{
		recording: false,
		mu:        make(chan struct{}, 1),
		onRecordingStart: func() {
			select {
			case notified <- struct{}{}:
			default:
			}
		},
	}

	go s.monitorCaptureStart(outPath)

	if err := os.WriteFile(outPath, nil, 0644); err != nil {
		t.Fatal(err)
	}
	time.Sleep(100 * time.Millisecond)
	if err := os.WriteFile(outPath, []byte("data"), 0644); err != nil {
		t.Fatal(err)
	}

	select {
	case <-notified:
		t.Fatal("start notification should be suppressed when recording is no longer active")
	case <-time.After(300 * time.Millisecond):
	}
}
