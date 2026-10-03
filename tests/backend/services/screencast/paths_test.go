package screencast

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestVideosDirCreatesRecordingDir verifies that VideosDir resolves the
// configured recording directory and creates it when missing.
func TestVideosDirCreatesRecordingDir(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	dir, err := VideosDir()
	if err != nil {
		t.Fatalf("VideosDir: %v", err)
	}
	if dir == "" {
		t.Fatal("VideosDir returned an empty path")
	}
	info, err := os.Stat(dir)
	if err != nil {
		t.Fatalf("stat %s: %v", dir, err)
	}
	if !info.IsDir() {
		t.Fatalf("%s is not a directory", dir)
	}
}

// TestVideosDirIsIdempotent verifies a second call succeeds on an existing dir.
func TestVideosDirIsIdempotent(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	first, err := VideosDir()
	if err != nil {
		t.Fatalf("first VideosDir: %v", err)
	}
	second, err := VideosDir()
	if err != nil {
		t.Fatalf("second VideosDir: %v", err)
	}
	if first != second {
		t.Fatalf("VideosDir is not stable: %q vs %q", first, second)
	}
}

// TestNewOutputPath verifies the generated output path lives in the videos
// directory and carries the generated filename.
func TestNewOutputPath(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	dir, err := VideosDir()
	if err != nil {
		t.Fatalf("VideosDir: %v", err)
	}
	out, err := NewOutputPath()
	if err != nil {
		t.Fatalf("NewOutputPath: %v", err)
	}
	if filepath.Dir(out) != dir {
		t.Fatalf("output dir = %q, want %q", filepath.Dir(out), dir)
	}
	if got := filepath.Base(out); got != GenerateFilename() && !strings.HasPrefix(got, "screencast_") {
		t.Fatalf("unexpected output filename %q", got)
	}
	if ext := filepath.Ext(out); ext != ".mp4" {
		t.Fatalf("output extension = %q, want .mp4", ext)
	}
}
