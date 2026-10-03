package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// TestListScreenshotsMetadata verifies that ListScreenshots reads the real
// filesystem (HOME redirected to a temp dir) and returns rich metadata:
// filename, full path, size, and a primary date with a recorded source.
// On Linux ext4/btrfs the birth time is available (DateSource == "birth"); on
// filesystems without it the code falls back to mtime ("mtime").
func TestListScreenshotsMetadata(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)
	shotsDir := filepath.Join(tmp, "Pictures", "Screenshots")
	if err := os.MkdirAll(shotsDir, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	for _, name := range []string{"shot_a.png", "shot_b.jpg", "ignore.txt", "photo.gif"} {
		if err := os.WriteFile(filepath.Join(shotsDir, name), []byte("contents-"+name), 0o644); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}

	app := &App{}
	files, err := app.ListScreenshots()
	if err != nil {
		t.Fatalf("ListScreenshots: %v", err)
	}

	// Only supported image extensions are returned.
	names := make([]string, 0, len(files))
	for _, f := range files {
		names = append(names, f.Name)
		if f.Path == "" {
			t.Errorf("%s: empty Path", f.Name)
		}
		if filepath.Dir(f.Path) != shotsDir {
			t.Errorf("%s: Path dir = %q, want %q", f.Name, filepath.Dir(f.Path), shotsDir)
		}
		if f.Size <= 0 {
			t.Errorf("%s: non-positive Size %d", f.Name, f.Size)
		}
		if f.Date <= 0 {
			t.Errorf("%s: non-positive Date %d", f.Name, f.Date)
		}
		if f.DateSource != "birth" && f.DateSource != "mtime" {
			t.Errorf("%s: bad DateSource %q", f.Name, f.DateSource)
		}
		// When birth time is available it must equal the primary Date.
		if f.DateSource == "birth" && f.CreatedAt != f.Date {
			t.Errorf("%s: birth source but CreatedAt(%d) != Date(%d)", f.Name, f.CreatedAt, f.Date)
		}
		// Fallback case: Date must equal ModifiedAt.
		if f.DateSource == "mtime" && f.ModifiedAt != f.Date {
			t.Errorf("%s: mtime source but ModifiedAt(%d) != Date(%d)", f.Name, f.ModifiedAt, f.Date)
		}
	}
	if len(names) != 2 {
		t.Fatalf("got %d files %v, want 2 (png+jpg only)", len(names), names)
	}

	// JSON shape must use the camelCase tags the frontend expects.
	b, err := json.Marshal(files[0])
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	s := string(b)
	for _, key := range []string{`"name"`, `"path"`, `"size"`, `"createdAt"`, `"modifiedAt"`, `"date"`, `"dateSource"`} {
		if !contains(s, key) {
			t.Errorf("json missing %s: %s", key, s)
		}
	}
}

// TestListScreenshotsEmptyNeverNil ensures an empty directory yields a non-nil
// slice (so Wails encodes [] not null and the frontend never spreads null).
func TestListScreenshotsEmptyNeverNil(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)
	if err := os.MkdirAll(filepath.Join(tmp, "Pictures", "Screenshots"), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	files, err := (&App{}).ListScreenshots()
	if err != nil {
		t.Fatalf("ListScreenshots: %v", err)
	}
	if files == nil {
		t.Fatal("got nil slice, want non-nil (would JSON-encode as null)")
	}
	b, _ := json.Marshal(files)
	if string(b) != "[]" {
		t.Errorf("empty dir json = %s, want []", string(b))
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
