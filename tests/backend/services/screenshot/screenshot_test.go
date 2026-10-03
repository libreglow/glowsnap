package screenshot

import (
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestBuildScreenshotNameDefaults verifies an empty pattern falls back to the
// default "screenshot_{date}" template.
func TestBuildScreenshotNameDefaults(t *testing.T) {
	name := buildScreenshotName("")
	if !strings.HasPrefix(name, "screenshot_") {
		t.Fatalf("name = %q, want a screenshot_ prefix", name)
	}
	if strings.Contains(name, "{date}") {
		t.Fatalf("name still contains the {date} placeholder: %q", name)
	}
}

// TestBuildScreenshotNameReplacesDate verifies {date} is substituted.
func TestBuildScreenshotNameReplacesDate(t *testing.T) {
	name := buildScreenshotName("shot_{date}")
	if !strings.HasPrefix(name, "shot_") {
		t.Fatalf("name = %q, want a shot_ prefix", name)
	}
	if strings.Contains(name, "{date}") {
		t.Fatalf("placeholder not replaced: %q", name)
	}
}

// TestBuildScreenshotNameSanitizesSeparators verifies filesystem-unsafe
// characters are replaced with underscores.
func TestBuildScreenshotNameSanitizesSeparators(t *testing.T) {
	name := buildScreenshotName(`a/b\c:d*e?f"g<h>i|j_{date}`)
	for _, bad := range []string{"/", `\`, ":", "*", "?", `"`, "<", ">", "|"} {
		if strings.Contains(name, bad) {
			t.Fatalf("name %q still contains %q", name, bad)
		}
	}
}

// TestCaptureRequiresDbus verifies capture fails cleanly without a connection.
func TestCaptureRequiresDbus(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	svc := NewService(nil)
	if _, err := svc.CaptureFullScreen(); err == nil {
		t.Fatal("CaptureFullScreen should fail without a D-Bus connection")
	}
	if _, err := svc.CaptureArea(); err == nil {
		t.Fatal("CaptureArea should fail without a D-Bus connection")
	}
}

// TestCropRegionRejectsInvalidSize verifies non-positive sizes are rejected
// before touching the filesystem.
func TestCropRegionRejectsInvalidSize(t *testing.T) {
	svc := NewService(nil)
	err := svc.CropRegion(filepath.Join(t.TempDir(), "missing.png"), 0, 0, 0, 10)
	if err == nil {
		t.Fatal("expected an error for a zero-width crop")
	}
}

// TestCropRegionRejectsMissingFile verifies a missing source is reported.
func TestCropRegionRejectsMissingFile(t *testing.T) {
	svc := NewService(nil)
	if err := svc.CropRegion(filepath.Join(t.TempDir(), "missing.png"), 0, 0, 10, 10); err == nil {
		t.Fatal("expected an error for a missing source file")
	}
}

// TestCropRegionRejectsUndecodableFile verifies a non-image file is reported.
func TestCropRegionRejectsUndecodableFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "broken.png")
	if err := os.WriteFile(path, []byte("not an image"), 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}

	svc := NewService(nil)
	if err := svc.CropRegion(path, 0, 0, 10, 10); err == nil {
		t.Fatal("expected an error for an undecodable image")
	}
}

// TestCropRegionTrims verifies the cropped image keeps the requested size and
// is clipped to the source bounds.
func TestCropRegionTrims(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "shot.png")

	src := image.NewRGBA(image.Rect(0, 0, 40, 30))
	for y := 0; y < 30; y++ {
		for x := 0; x < 40; x++ {
			src.Set(x, y, color.RGBA{R: uint8(x * 6), G: uint8(y * 8), B: 0x40, A: 0xff})
		}
	}
	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := png.Encode(f, src); err != nil {
		t.Fatalf("encode: %v", err)
	}
	f.Close()

	svc := NewService(nil)
	if err := svc.CropRegion(path, 10, 5, 20, 15); err != nil {
		t.Fatalf("CropRegion: %v", err)
	}

	out, err := os.Open(path)
	if err != nil {
		t.Fatalf("open cropped: %v", err)
	}
	defer out.Close()
	got, err := png.Decode(out)
	if err != nil {
		t.Fatalf("decode cropped: %v", err)
	}
	if got.Bounds() != image.Rect(0, 0, 20, 15) {
		t.Fatalf("cropped bounds = %v, want 20x15", got.Bounds())
	}
	// Pixel (0,0) of the crop is pixel (10,5) of the source.
	r, _, _, _ := got.At(0, 0).RGBA()
	wantR, _, _, _ := src.At(10, 5).RGBA()
	if r != wantR {
		t.Fatalf("crop origin red = %d, want %d", r, wantR)
	}
}

// TestCropRegionClipsToBounds verifies a crop extending past the image is
// clipped instead of failing.
func TestCropRegionClipsToBounds(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "shot.png")

	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := png.Encode(f, image.NewRGBA(image.Rect(0, 0, 20, 20))); err != nil {
		t.Fatalf("encode: %v", err)
	}
	f.Close()

	svc := NewService(nil)
	if err := svc.CropRegion(path, 10, 10, 100, 100); err != nil {
		t.Fatalf("CropRegion: %v", err)
	}

	out, err := os.Open(path)
	if err != nil {
		t.Fatalf("open cropped: %v", err)
	}
	defer out.Close()
	got, err := png.Decode(out)
	if err != nil {
		t.Fatalf("decode cropped: %v", err)
	}
	if got.Bounds() != image.Rect(0, 0, 10, 10) {
		t.Fatalf("cropped bounds = %v, want 10x10", got.Bounds())
	}
}

// TestCropRegionRejectsOutOfBounds verifies a crop entirely outside the image.
func TestCropRegionRejectsOutOfBounds(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "shot.png")

	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := png.Encode(f, image.NewRGBA(image.Rect(0, 0, 20, 20))); err != nil {
		t.Fatalf("encode: %v", err)
	}
	f.Close()

	svc := NewService(nil)
	if err := svc.CropRegion(path, 100, 100, 10, 10); err == nil {
		t.Fatal("expected an error for a crop outside the image bounds")
	}
}
