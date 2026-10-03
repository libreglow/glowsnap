package screencast

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// TestThumbnailFileName verifies the video extension is swapped for .jpg.
func TestThumbnailFileName(t *testing.T) {
	cases := map[string]string{
		"screencast_2026-01-02_03-04-05.mp4": "screencast_2026-01-02_03-04-05.jpg",
		"clip.mp4":                           "clip.jpg",
		"noextension":                        "noextension.jpg",
		"archive.tar.gz":                     "archive.tar.jpg",
	}
	for in, want := range cases {
		if got := ThumbnailFileName(in); got != want {
			t.Fatalf("ThumbnailFileName(%q) = %q, want %q", in, got, want)
		}
	}
}

// TestThumbnailExistsMissing verifies a missing thumbnail reports false.
func TestThumbnailExistsMissing(t *testing.T) {
	dir := t.TempDir()
	video := filepath.Join(dir, "clip.mp4")
	if err := os.WriteFile(video, []byte("video"), 0o644); err != nil {
		t.Fatalf("write video: %v", err)
	}

	name, ok := ThumbnailExists(video)
	if ok {
		t.Fatalf("ThumbnailExists reported true for %q", video)
	}
	if name != "clip.jpg" {
		t.Fatalf("name = %q, want clip.jpg", name)
	}
}

// TestThumbnailExistsPresent verifies an existing thumbnail is detected.
func TestThumbnailExistsPresent(t *testing.T) {
	dir := t.TempDir()
	video := filepath.Join(dir, "clip.mp4")
	if err := os.WriteFile(video, []byte("video"), 0o644); err != nil {
		t.Fatalf("write video: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "clip.jpg"), []byte("thumb"), 0o644); err != nil {
		t.Fatalf("write thumbnail: %v", err)
	}

	name, ok := ThumbnailExists(video)
	if !ok {
		t.Fatal("ThumbnailExists reported false for an existing thumbnail")
	}
	if name != "clip.jpg" {
		t.Fatalf("name = %q, want clip.jpg", name)
	}
}

// TestGenerateThumbnailAsyncUsesExistingFile verifies that an existing
// thumbnail short-circuits ffmpeg and calls back with its name.
func TestGenerateThumbnailAsyncUsesExistingFile(t *testing.T) {
	dir := t.TempDir()
	video := filepath.Join(dir, "clip.mp4")
	if err := os.WriteFile(video, []byte("video"), 0o644); err != nil {
		t.Fatalf("write video: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "clip.jpg"), []byte("thumb"), 0o644); err != nil {
		t.Fatalf("write thumbnail: %v", err)
	}

	done := make(chan string, 1)
	GenerateThumbnailAsync(video, func(name string, err error) {
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
		done <- name
	})

	select {
	case name := <-done:
		if name != "clip.jpg" {
			t.Fatalf("callback name = %q, want clip.jpg", name)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("callback was not invoked")
	}
}

// TestGenerateThumbnailAsyncNilCallback verifies a nil callback does not panic.
func TestGenerateThumbnailAsyncNilCallback(t *testing.T) {
	dir := t.TempDir()
	video := filepath.Join(dir, "clip.mp4")
	if err := os.WriteFile(video, []byte("video"), 0o644); err != nil {
		t.Fatalf("write video: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "clip.jpg"), []byte("thumb"), 0o644); err != nil {
		t.Fatalf("write thumbnail: %v", err)
	}

	GenerateThumbnailAsync(video, nil)
}

// TestGenerateThumbnailAsyncFailureReportsError verifies the callback receives an
// error when no thumbnail can be produced.
func TestGenerateThumbnailAsyncFailureReportsError(t *testing.T) {
	dir := t.TempDir()
	// Point PATH at an empty dir so ffmpeg cannot be found.
	t.Setenv("PATH", dir)

	errCh := make(chan error, 1)
	GenerateThumbnailAsync(filepath.Join(dir, "missing.mp4"), func(_ string, err error) {
		errCh <- err
	})

	select {
	case err := <-errCh:
		if err == nil {
			t.Fatal("expected an error when ffmpeg is unavailable")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("callback was not invoked")
	}
}
