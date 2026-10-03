package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestSupportedResolutions(t *testing.T) {
	want := []struct {
		value  string
		label  string
		width  int
		height int
	}{
		{Resolution360p, "360p", 640, 360},
		{Resolution480p, "480p", 854, 480},
		{Resolution720p, "720p", 1280, 720},
		{Resolution1080p, "1080p", 1920, 1080},
		{Resolution1440p, "1440p", 2560, 1440},
		{Resolution2160p, "2160p (4K)", 3840, 2160},
	}

	got := SupportedResolutions()
	if len(got) != len(want) {
		t.Fatalf("got %d resolutions, want %d", len(got), len(want))
	}
	for i, w := range want {
		if got[i].Value != w.value || got[i].Label != w.label ||
			got[i].Width != w.width || got[i].Height != w.height {
			t.Fatalf("preset %d = %+v, want %+v", i, got[i], w)
		}
	}
}

func TestIsValidResolution(t *testing.T) {
	for _, v := range []string{
		Resolution360p, Resolution480p, Resolution720p,
		Resolution1080p, Resolution1440p, Resolution2160p, ResolutionCustom,
	} {
		if !IsValidResolution(v) {
			t.Errorf("expected %q to be valid", v)
		}
	}
	for _, v := range []string{"", "1080", "4k", "4K", "medium", "high", "low", "custom "} {
		if IsValidResolution(v) {
			t.Errorf("expected %q to be invalid", v)
		}
	}
}

func TestIsPresetResolution(t *testing.T) {
	if !IsPresetResolution(Resolution1080p) {
		t.Fatal("expected 1080p to be a preset")
	}
	if IsPresetResolution(ResolutionCustom) {
		t.Fatal("expected custom not to be a preset")
	}
}

func TestOutputDimensions(t *testing.T) {
	if w, h, ok := OutputDimensions(Resolution1440p, 0, 0); !ok || w != 2560 || h != 1440 {
		t.Fatalf("1440p = %dx%d ok=%v, want 2560x1440", w, h, ok)
	}
	if w, h, ok := OutputDimensions(ResolutionCustom, 2560, 1080); !ok || w != 2560 || h != 1080 {
		t.Fatalf("custom = %dx%d ok=%v, want 2560x1080", w, h, ok)
	}
	if _, _, ok := OutputDimensions(ResolutionCustom, 0, 1080); ok {
		t.Fatal("expected invalid custom dimensions to be rejected")
	}
	if _, _, ok := OutputDimensions("nope", 0, 0); ok {
		t.Fatal("expected unknown resolution to be rejected")
	}
}

func TestValidateCustomResolution(t *testing.T) {
	valid := [][2]int{{640, 360}, {1920, 1080}, {2560, 1440}, {3840, 2160}, {16, 16}}
	for _, d := range valid {
		if err := ValidateCustomResolution(d[0], d[1]); err != nil {
			t.Errorf("expected %dx%d to be valid: %v", d[0], d[1], err)
		}
	}

	invalid := [][2]int{
		{0, 1080},
		{1920, 0},
		{-1920, 1080},
		{1920, -1080},
		{1921, 1080},
		{1920, 1081},
		{8, 8},
		{3842, 2160},
		{3840, 2162},
	}
	for _, d := range invalid {
		if err := ValidateCustomResolution(d[0], d[1]); err == nil {
			t.Errorf("expected %dx%d to be invalid", d[0], d[1])
		}
	}
}

func TestCustomResolutionLimits(t *testing.T) {
	limits := CustomResolutionLimits()
	if limits.MinWidth != MinCustomWidth || limits.MinHeight != MinCustomHeight ||
		limits.MaxWidth != MaxCustomWidth || limits.MaxHeight != MaxCustomHeight {
		t.Fatalf("unexpected limits: %+v", limits)
	}
}

func TestNormalizeCustomResolution(t *testing.T) {
	if w, h := NormalizeCustomResolution(2560, 1080); w != 2560 || h != 1080 {
		t.Fatalf("valid dimensions changed: %dx%d", w, h)
	}
	if w, h := NormalizeCustomResolution(0, -5); w != DefaultCustomWidth || h != DefaultCustomHeight {
		t.Fatalf("invalid dimensions not repaired: %dx%d", w, h)
	}
}

func TestDefaultsUseValidResolution(t *testing.T) {
	def := Defaults()
	if !IsValidResolution(def.Recording.Resolution) {
		t.Fatalf("default resolution %q is not valid", def.Recording.Resolution)
	}
	if err := ValidateCustomResolution(def.Recording.CustomWidth, def.Recording.CustomHeight); err != nil {
		t.Fatalf("default custom dimensions are invalid: %v", err)
	}
}

func TestNormalizeFallsBackToDefaultResolution(t *testing.T) {
	s := Defaults()
	s.Recording.Resolution = "medium"
	if got := normalize(s).Recording.Resolution; got != DefaultResolution {
		t.Fatalf("got %q, want %q", got, DefaultResolution)
	}
}

func TestNormalizeKeepsValidResolution(t *testing.T) {
	for _, value := range []string{Resolution360p, Resolution1440p, Resolution2160p, ResolutionCustom} {
		s := Defaults()
		s.Recording.Resolution = value
		if got := normalize(s).Recording.Resolution; got != value {
			t.Fatalf("got %q, want %q", got, value)
		}
	}
}

func TestNormalizeRepairsInvalidCustomResolution(t *testing.T) {
	s := Defaults()
	s.Recording.Resolution = ResolutionCustom
	s.Recording.CustomWidth = -100
	s.Recording.CustomHeight = 0

	normalized := normalize(s)
	if normalized.Recording.Resolution != ResolutionCustom {
		t.Fatalf("custom selection lost: %q", normalized.Recording.Resolution)
	}
	if normalized.Recording.CustomWidth != DefaultCustomWidth ||
		normalized.Recording.CustomHeight != DefaultCustomHeight {
		t.Fatalf("custom dimensions not repaired: %dx%d",
			normalized.Recording.CustomWidth, normalized.Recording.CustomHeight)
	}
}

func TestLegacyQualityMigratesToResolution(t *testing.T) {
	cases := map[string]string{
		"high":   Resolution1080p,
		"medium": Resolution720p,
		"low":    Resolution480p,
	}

	for quality, want := range cases {
		groups := map[string]json.RawMessage{
			"recording": json.RawMessage(`{"quality":"` + quality + `"}`),
		}
		if got := legacyOrDefaultResolution(groups, DefaultResolution); got != want {
			t.Errorf("quality %q -> %q, want %q", quality, got, want)
		}
	}
}

func TestLegacyOrDefaultResolutionUsesFallback(t *testing.T) {
	if got := legacyOrDefaultResolution(nil, DefaultResolution); got != DefaultResolution {
		t.Fatalf("got %q, want %q", got, DefaultResolution)
	}
	groups := map[string]json.RawMessage{
		"recording": json.RawMessage(`{"quality":"ultra"}`),
	}
	if got := legacyOrDefaultResolution(groups, DefaultResolution); got != DefaultResolution {
		t.Fatalf("got %q, want %q", got, DefaultResolution)
	}
}

func TestSaveLoadRoundTripResolution(t *testing.T) {
	setConfigDir(t.TempDir())
	t.Cleanup(func() { setConfigDir("") })

	s := Defaults()
	s.Recording.Resolution = Resolution480p
	if err := Save(s); err != nil {
		t.Fatalf("Save: %v", err)
	}

	if got := Load().Recording.Resolution; got != Resolution480p {
		t.Fatalf("loaded resolution %q, want %q", got, Resolution480p)
	}
}

func TestSaveLoadRoundTripCustomResolution(t *testing.T) {
	setConfigDir(t.TempDir())
	t.Cleanup(func() { setConfigDir("") })

	s := Defaults()
	s.Recording.Resolution = ResolutionCustom
	s.Recording.CustomWidth = 2560
	s.Recording.CustomHeight = 1080
	if err := Save(s); err != nil {
		t.Fatalf("Save: %v", err)
	}

	loaded := Load()
	if loaded.Recording.Resolution != ResolutionCustom {
		t.Fatalf("loaded resolution %q, want %q", loaded.Recording.Resolution, ResolutionCustom)
	}
	if loaded.Recording.CustomWidth != 2560 || loaded.Recording.CustomHeight != 1080 {
		t.Fatalf("loaded custom dimensions %dx%d, want 2560x1080",
			loaded.Recording.CustomWidth, loaded.Recording.CustomHeight)
	}
}

func TestLoadMigratesLegacyQuality(t *testing.T) {
	dir := t.TempDir()
	setConfigDir(dir)
	t.Cleanup(func() { setConfigDir("") })

	writeSettings := func(t *testing.T, body string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, "settings.json"), []byte(body), 0o644); err != nil {
			t.Fatalf("write settings: %v", err)
		}
	}

	writeSettings(t, `{"recording":{"quality":"high"}}`)
	if got := Load().Recording.Resolution; got != Resolution1080p {
		t.Fatalf("legacy high -> %q, want %q", got, Resolution1080p)
	}

	writeSettings(t, `{"recording":{"quality":"low","resolution":"720p"}}`)
	if got := Load().Recording.Resolution; got != Resolution720p {
		t.Fatalf("explicit resolution ignored: got %q, want %q", got, Resolution720p)
	}

	writeSettings(t, `{"recording":{"resolution":"custom"}}`)
	loaded := Load()
	if loaded.Recording.Resolution != ResolutionCustom {
		t.Fatalf("custom resolution not loaded: got %q", loaded.Recording.Resolution)
	}
	if loaded.Recording.CustomWidth != DefaultCustomWidth || loaded.Recording.CustomHeight != DefaultCustomHeight {
		t.Fatalf("custom defaults not applied: %dx%d",
			loaded.Recording.CustomWidth, loaded.Recording.CustomHeight)
	}
}
