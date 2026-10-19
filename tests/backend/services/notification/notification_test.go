package notification

import (
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func writePNG(t *testing.T, path string, img image.Image) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create png: %v", err)
	}
	defer f.Close()
	if err := png.Encode(f, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
}

func TestBuildImageData(t *testing.T) {
	path := filepath.Join(t.TempDir(), "shot.png")
	src := image.NewRGBA(image.Rect(0, 0, 40, 30))
	for y := 0; y < 30; y++ {
		for x := 0; x < 40; x++ {
			src.Set(x, y, color.RGBA{R: uint8(x * 3), G: uint8(y * 5), B: 0x40, A: 0xff})
		}
	}
	writePNG(t, path, src)

	data, err := buildImageData(path)
	if err != nil {
		t.Fatalf("buildImageData: %v", err)
	}
	if data.Width != 40 || data.Height != 30 {
		t.Fatalf("size = %dx%d, want 40x30", data.Width, data.Height)
	}
	if data.Rowstride != 160 {
		t.Fatalf("rowstride = %d, want 160", data.Rowstride)
	}
	if !data.HasAlpha {
		t.Fatal("hasAlpha = false, want true")
	}
	if data.BitsPerSample != 8 {
		t.Fatalf("bitsPerSample = %d, want 8", data.BitsPerSample)
	}
	if data.Channels != 4 {
		t.Fatalf("channels = %d, want 4", data.Channels)
	}
	if len(data.Data) != 160*30 {
		t.Fatalf("len(data) = %d, want %d", len(data.Data), 160*30)
	}
	if data.Data[0] != 0 || data.Data[1] != 0 || data.Data[2] != 0x40 || data.Data[3] != 0xff {
		t.Fatalf("first pixel = %v, want [0 0 64 255]", data.Data[:4])
	}
	last := len(data.Data) - 4
	if data.Data[last] != 117 || data.Data[last+1] != 145 || data.Data[last+2] != 0x40 || data.Data[last+3] != 0xff {
		t.Fatalf("last pixel = %v, want [117 145 64 255]", data.Data[last:])
	}
}

func TestBuildImageDataScalesDown(t *testing.T) {
	path := filepath.Join(t.TempDir(), "big.png")
	writePNG(t, path, image.NewRGBA(image.Rect(0, 0, 2000, 1000)))

	data, err := buildImageData(path)
	if err != nil {
		t.Fatalf("buildImageData: %v", err)
	}
	if data.Width != 1024 || data.Height != 512 {
		t.Fatalf("size = %dx%d, want 1024x512", data.Width, data.Height)
	}
	if data.Rowstride != data.Width*4 {
		t.Fatalf("rowstride = %d, want %d", data.Rowstride, data.Width*4)
	}
	if int64(len(data.Data)) != int64(data.Rowstride)*int64(data.Height) {
		t.Fatalf("len(data) = %d, want %d", len(data.Data), int64(data.Rowstride)*int64(data.Height))
	}
}

func TestBuildImageDataMissingFile(t *testing.T) {
	if _, err := buildImageData(filepath.Join(t.TempDir(), "missing.png")); err == nil {
		t.Fatal("expected an error for a missing file")
	}
}

func TestBuildImageDataRejectsNonImage(t *testing.T) {
	path := filepath.Join(t.TempDir(), "broken.png")
	if err := os.WriteFile(path, []byte("not an image"), 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}
	if _, err := buildImageData(path); err == nil {
		t.Fatal("expected an error for an undecodable image")
	}
}

func TestScaleDownKeepsSmallImages(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 64, 48))
	if got := scaleDown(src, maxImageSize); got != src {
		t.Fatal("small image should be returned unchanged")
	}
}

func TestBuildHintsIncludesImage(t *testing.T) {
	path := filepath.Join(t.TempDir(), "shot.png")
	writePNG(t, path, image.NewRGBA(image.Rect(0, 0, 8, 8)))

	hints := buildHints(path)
	pathVar, ok := hints["image-path"]
	if !ok {
		t.Fatal("image-path hint missing")
	}
	if pathVar.Value() != path {
		t.Fatalf("image-path = %v, want %s", pathVar.Value(), path)
	}
	dataVar, ok := hints["image-data"]
	if !ok {
		t.Fatal("image-data hint missing")
	}
	if sig := dataVar.Signature().String(); sig != "(iiibiiay)" {
		t.Fatalf("image-data signature = %q, want (iiibiiay)", sig)
	}
}

func TestBuildHintsMissingImageFile(t *testing.T) {
	hints := buildHints(filepath.Join(t.TempDir(), "missing.png"))
	if _, ok := hints["image-path"]; !ok {
		t.Fatal("image-path hint missing")
	}
	if _, ok := hints["image-data"]; ok {
		t.Fatal("image-data hint should be skipped for a missing file")
	}
}

func TestBuildHintsWithoutImage(t *testing.T) {
	if hints := buildHints(""); len(hints) != 0 {
		t.Fatalf("hints = %v, want none", hints)
	}
}
