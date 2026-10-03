package screencast

import (
	"fmt"
	"strings"
	"testing"

	"glowsnap/services/settings"
)

func TestBuildPipelineArgsScalesToSelectedResolution(t *testing.T) {
	cases := []struct {
		name     string
		opts     RecordingOptions
		wantCaps string
	}{
		{name: "360p", opts: RecordingOptions{Resolution: settings.Resolution360p}, wantCaps: "video/x-raw,width=640,height=360"},
		{name: "480p", opts: RecordingOptions{Resolution: settings.Resolution480p}, wantCaps: "video/x-raw,width=854,height=480"},
		{name: "720p", opts: RecordingOptions{Resolution: settings.Resolution720p}, wantCaps: "video/x-raw,width=1280,height=720"},
		{name: "1080p", opts: RecordingOptions{Resolution: settings.Resolution1080p}, wantCaps: "video/x-raw,width=1920,height=1080"},
		{name: "1440p", opts: RecordingOptions{Resolution: settings.Resolution1440p}, wantCaps: "video/x-raw,width=2560,height=1440"},
		{name: "2160p", opts: RecordingOptions{Resolution: settings.Resolution2160p}, wantCaps: "video/x-raw,width=3840,height=2160"},
		{
			name:     "custom",
			opts:     RecordingOptions{Resolution: settings.ResolutionCustom, CustomWidth: 2560, CustomHeight: 1080},
			wantCaps: "video/x-raw,width=2560,height=1080",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			opts := tc.opts
			opts.OutputPath = "/tmp/out.mp4"

			args, err := buildPipelineArgs(7, opts)
			if err != nil {
				t.Fatalf("buildPipelineArgs: %v", err)
			}

			joined := strings.Join(args, " ")
			if !strings.Contains(joined, "videoscale") {
				t.Fatalf("pipeline is missing videoscale: %v", args)
			}
			if !strings.Contains(joined, tc.wantCaps) {
				t.Fatalf("pipeline %q does not contain %q", joined, tc.wantCaps)
			}
		})
	}
}

func TestBuildPipelineArgsFallsBackToDefaultResolution(t *testing.T) {
	width, height, _ := settings.ResolutionDimensions(settings.DefaultResolution)
	want := fmt.Sprintf("video/x-raw,width=%d,height=%d", width, height)

	cases := []struct {
		name string
		opts RecordingOptions
	}{
		{name: "unknown preset", opts: RecordingOptions{Resolution: "bogus"}},
		{name: "invalid custom", opts: RecordingOptions{Resolution: settings.ResolutionCustom, CustomWidth: 0, CustomHeight: -8}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			opts := tc.opts
			opts.OutputPath = "/tmp/out.mp4"

			args, err := buildPipelineArgs(1, opts)
			if err != nil {
				t.Fatalf("buildPipelineArgs: %v", err)
			}
			if !strings.Contains(strings.Join(args, " "), want) {
				t.Fatalf("pipeline does not fall back to default caps %q", want)
			}
		})
	}
}

func TestBuildPipelineArgsRequiresOutputPath(t *testing.T) {
	if _, err := buildPipelineArgs(1, RecordingOptions{Resolution: settings.Resolution720p}); err == nil {
		t.Fatal("expected an error when the output path is empty")
	}
}

func TestResolutionProfileDimensions(t *testing.T) {
	cases := []struct {
		resolution string
		width      int
		height     int
	}{
		{settings.Resolution360p, 640, 360},
		{settings.Resolution480p, 854, 480},
		{settings.Resolution720p, 1280, 720},
		{settings.Resolution1080p, 1920, 1080},
		{settings.Resolution1440p, 2560, 1440},
		{settings.Resolution2160p, 3840, 2160},
	}

	for _, tc := range cases {
		profile := resolutionProfile(tc.resolution, 0, 0)
		if profile.Width != tc.width || profile.Height != tc.height {
			t.Fatalf("%s = %dx%d, want %dx%d", tc.resolution, profile.Width, profile.Height, tc.width, tc.height)
		}
	}
}

func TestResolutionProfileCustomDimensions(t *testing.T) {
	profile := resolutionProfile(settings.ResolutionCustom, 2560, 1080)
	if profile.Width != 2560 || profile.Height != 1080 {
		t.Fatalf("custom = %dx%d, want 2560x1080", profile.Width, profile.Height)
	}
}

func TestResolutionProfileScalesBitrateWithSize(t *testing.T) {
	small := resolutionProfile(settings.Resolution360p, 0, 0)
	medium := resolutionProfile(settings.Resolution1080p, 0, 0)
	large := resolutionProfile(settings.Resolution2160p, 0, 0)

	if !(small.VideoBitrate < medium.VideoBitrate && medium.VideoBitrate < large.VideoBitrate) {
		t.Fatalf("bitrates not increasing with size: %d, %d, %d", small.VideoBitrate, medium.VideoBitrate, large.VideoBitrate)
	}
}
