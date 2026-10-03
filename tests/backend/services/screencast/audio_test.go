package screencast

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// defaultPath is appended after the fake pactl directory so `sh` stays findable.
const defaultPath = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

// withPactl puts a fake `pactl` first on PATH so the audio helpers run
// against the given script instead of the real system daemon.
func withPactl(t *testing.T, script string) {
	t.Helper()
	if _, err := exec.LookPath("sh"); err != nil {
		t.Skip("sh not available")
	}
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "pactl"), []byte("#!/bin/sh\n"+script+"\n"), 0o755); err != nil {
		t.Fatalf("write fake pactl: %v", err)
	}
	t.Setenv("PATH", dir+":"+defaultPath)
}

// TestListMicrophonesSkipsMonitorSources verifies monitor sources are excluded.
func TestListMicrophonesSkipsMonitorSources(t *testing.T) {
	withPactl(t, `
case "$1" in
  list)
    cat <<'OUT'
Source #0
	Name: alsa_input.pci-0000_00_1f.3.analog-stereo
	Description: Built-in Mic
Source #1
	Name: alsa_output.pci-0000_00_1f.3.analog-stereo.monitor
	Description: Monitor of Built-in Audio
OUT
    ;;
esac
`)

	mics, err := ListMicrophones()
	if err != nil {
		t.Fatalf("ListMicrophones: %v", err)
	}
	if len(mics) != 1 {
		t.Fatalf("got %d microphones, want 1: %+v", len(mics), mics)
	}
	if mics[0].Name != "alsa_input.pci-0000_00_1f.3.analog-stereo" {
		t.Fatalf("unexpected microphone %+v", mics[0])
	}
	if mics[0].Description != "Built-in Mic" {
		t.Fatalf("unexpected description %q", mics[0].Description)
	}
}

// TestListMicrophonesEmptyIsNotNil verifies the result is an empty slice, not nil.
func TestListMicrophonesEmptyIsNotNil(t *testing.T) {
	withPactl(t, `exit 0`)

	mics, err := ListMicrophones()
	if err != nil {
		t.Fatalf("ListMicrophones: %v", err)
	}
	if mics == nil {
		t.Fatal("ListMicrophones returned nil, want empty slice")
	}
	if len(mics) != 0 {
		t.Fatalf("got %+v, want empty", mics)
	}
}

// TestDefaultMicrophoneUsesPactl verifies the default source is returned when
// pactl reports a non-monitor source.
func TestDefaultMicrophoneUsesPactl(t *testing.T) {
	withPactl(t, `
case "$1" in
  get-default-source) echo "alsa_input.usb-Generic_USB_Audio-00.mono" ;;
esac
`)

	if got := DefaultMicrophone(); got != "alsa_input.usb-Generic_USB_Audio-00.mono" {
		t.Fatalf("DefaultMicrophone = %q", got)
	}
}

// TestDefaultMicrophoneIgnoresMonitorDefault verifies a monitor default source
// is rejected instead of being used as a microphone.
func TestDefaultMicrophoneIgnoresMonitorDefault(t *testing.T) {
	withPactl(t, `
case "$1" in
  get-default-source) echo "alsa_output.pci-0000_00_1f.3.analog-stereo.monitor" ;;
  list)
    cat <<'OUT'
Source #0
	Name: alsa_input.pci-0000_00_1f.3.analog-stereo
	Description: Built-in Mic
OUT
    ;;
esac
`)

	if got := DefaultMicrophone(); got != "alsa_input.pci-0000_00_1f.3.analog-stereo" {
		t.Fatalf("DefaultMicrophone = %q, want the first non-monitor source", got)
	}
}

// TestSystemAudioDeviceRequiresMonitor verifies that a sink without a matching
// monitor source is reported as unsupported by the caller.
func TestSystemAudioDeviceRequiresMonitor(t *testing.T) {
	withPactl(t, `
case "$1" in
  get-default-sink) echo "alsa_output.pci-0000_00_1f.3.analog-stereo" ;;
  list)
    cat <<'OUT'
Source #0
	Name: alsa_input.pci-0000_00_1f.3.analog-stereo
	Description: Built-in Mic
OUT
    ;;
esac
`)

	if _, err := SystemAudioDevice(); err == nil {
		t.Fatal("SystemAudioDevice should fail without a monitor source")
	}
}

// TestSystemAudioDeviceReturnsMonitor verifies the sink monitor source name.
func TestSystemAudioDeviceReturnsMonitor(t *testing.T) {
	withPactl(t, `
case "$1" in
  get-default-sink) echo "alsa_output.pci-0000_00_1f.3.analog-stereo" ;;
  list)
    cat <<'OUT'
Source #0
	Name: alsa_output.pci-0000_00_1f.3.analog-stereo.monitor
	Description: Monitor of Built-in Audio
OUT
    ;;
esac
`)

	device, err := SystemAudioDevice()
	if err != nil {
		t.Fatalf("SystemAudioDevice: %v", err)
	}
	if device != "alsa_output.pci-0000_00_1f.3.analog-stereo.monitor" {
		t.Fatalf("SystemAudioDevice = %q", device)
	}
}

// TestGetSystemAudioInfoReportsMessage verifies the info struct mirrors
// SystemAudioSupported.
func TestGetSystemAudioInfoReportsMessage(t *testing.T) {
	withPactl(t, `exit 1`)

	info := GetSystemAudioInfo()
	if info.Supported {
		t.Skip("system audio is genuinely available in this environment")
	}
	if info.Message == "" {
		t.Fatal("expected an explanatory message when unsupported")
	}
}
