package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

const AppName = "glowsnap"

var configDirOverride string

func setConfigDir(dir string) { configDirOverride = dir }

type General struct {
	ConfirmDelete bool `json:"confirmDelete"`
}

type Screenshot struct {
	SaveDir                string `json:"saveDir"`
	FilenamePattern        string `json:"filenamePattern"`
	DelaySeconds           int    `json:"delaySeconds"`
	CopyToClipboard        bool   `json:"copyToClipboard"`
	OpenAfterCapture       bool   `json:"openAfterCapture"`
	NotifyOnCapture        bool   `json:"notifyOnCapture"`
	HidePanelBeforeCapture bool   `json:"hidePanelBeforeCapture"`
	ShowMouseByDefault     bool   `json:"showMouseByDefault"`
}

type Recording struct {
	SaveDir                string `json:"saveDir"`
	Microphone             string `json:"microphone"`
	MicEnabledByDefault    bool   `json:"micEnabledByDefault"`
	SystemEnabledByDefault bool   `json:"systemEnabledByDefault"`
	ShowMouseByDefault     bool   `json:"showMouseByDefault"`
	Quality                string `json:"quality"`
	NotifyOnRecordingEnd   bool   `json:"notifyOnRecordingEnd"`
}

type Editor struct {
	DefaultTool        string  `json:"defaultTool"`
	DefaultFont        string  `json:"defaultFont"`
	DefaultFontSize    int     `json:"defaultFontSize"`
	DefaultColor       string  `json:"defaultColor"`
	DefaultStrokeWidth int     `json:"defaultStrokeWidth"`
	DefaultOpacity     float64 `json:"defaultOpacity"`
}

type Advanced struct {
	VerboseLogging bool `json:"verboseLogging"`
}

type Shortcuts struct {
	TakeScreenshot string `json:"takeScreenshot"`
	StartRecording string `json:"startRecording"`
	StopRecording  string `json:"stopRecording"`
	OpenPalette    string `json:"openPalette"`
	OpenEditor     string `json:"openEditor"`
	Cancel         string `json:"cancel"`
}

type Favorites struct {
	Recordings  []string `json:"recordings"`
	Screenshots []string `json:"screenshots"`
}

type Settings struct {
	General         General           `json:"general"`
	Screenshot      Screenshot        `json:"screenshot"`
	Recording       Recording         `json:"recording"`
	Editor          Editor            `json:"editor"`
	Advanced        Advanced          `json:"advanced"`
	Shortcuts       Shortcuts         `json:"shortcuts"`
	CustomShortcuts map[string]string `json:"customShortcuts"`
	Favorites       Favorites         `json:"favorites"`
}

type legacySettings struct {
	Microphone string `json:"microphone"`
}

func DefaultScreenshotSaveDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Pictures", "Screenshots")
}

func DefaultRecordingSaveDir() string {
	home, _ := os.UserHomeDir()
	if home == "" {
		return "Videos"
	}

	videos := filepath.Join(home, "Videos")
	if d := xdgVideosFromUserDirs(home); d != "" {
		videos = d
	}
	return filepath.Join(videos, "Screencasts")
}

func Defaults() Settings {
	return Settings{
		General: General{ConfirmDelete: true},
		Screenshot: Screenshot{
			SaveDir:                DefaultScreenshotSaveDir(),
			FilenamePattern:        "screenshot_{date}",
			HidePanelBeforeCapture: true,
			ShowMouseByDefault:     true,
		},
		Recording: Recording{
			SaveDir:                DefaultRecordingSaveDir(),
			MicEnabledByDefault:    true,
			SystemEnabledByDefault: true,
			ShowMouseByDefault:     true,
			Quality:                "medium",
		},
		Editor: Editor{
			DefaultTool:        "select",
			DefaultFont:        "Inter",
			DefaultFontSize:    24,
			DefaultColor:       "#ff3b30",
			DefaultStrokeWidth: 3,
			DefaultOpacity:     1,
		},
		Shortcuts: DefaultShortcuts(),
		Favorites: Favorites{
			Recordings:  []string{},
			Screenshots: []string{},
		},
	}
}

func DefaultShortcuts() Shortcuts {
	return Shortcuts{
		TakeScreenshot: "Ctrl+Shift+S",
		StartRecording: "Ctrl+Shift+R",
		StopRecording:  "Ctrl+Shift+X",
		OpenPalette:    "Ctrl+Space",
		OpenEditor:     "Ctrl+Alt+E",
		Cancel:         "",
	}
}

func configDir() (string, error) {
	if configDirOverride != "" {
		if err := os.MkdirAll(configDirOverride, 0o755); err != nil {
			return "", err
		}
		return configDirOverride, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".config", AppName)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

func filePath() (string, error) {
	dir, err := configDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "settings.json"), nil
}

func (s Settings) ScreenshotSaveDir() string {
	if s.Screenshot.SaveDir == "" {
		return DefaultScreenshotSaveDir()
	}
	return s.Screenshot.SaveDir
}

func (s Settings) RecordingSaveDir() string {
	if s.Recording.SaveDir == "" {
		return DefaultRecordingSaveDir()
	}
	return s.Recording.SaveDir
}

func Load() Settings {
	def := Defaults()
	path, err := filePath()
	if err != nil {
		return def
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return def
	}

	var stored Settings
	if err := json.Unmarshal(data, &stored); err != nil {
		return def
	}

	mergeDefaults(def, &stored, data)

	if stored.Recording.Microphone == "" {
		var legacy legacySettings
		_ = json.Unmarshal(data, &legacy)
		stored.Recording.Microphone = legacy.Microphone
	}

	return normalize(stored)
}

func Save(s Settings) error {
	s = normalize(s)
	path, err := filePath()
	if err != nil {
		return err
	}

	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func ResetToDefaults() Settings {
	def := Defaults()
	path, err := filePath()
	if err != nil {
		return def
	}
	_ = os.Remove(path)
	return def
}

func mergeDefaults(def Settings, stored *Settings, data []byte) {
	var groups map[string]json.RawMessage
	_ = json.Unmarshal(data, &groups)
	present := func(group, key string) bool {
		g, ok := groups[group]
		if !ok {
			return false
		}
		var fields map[string]json.RawMessage
		if json.Unmarshal(g, &fields) != nil {
			return false
		}
		_, ok = fields[key]
		return ok
	}

	if !present("general", "confirmDelete") {
		stored.General.ConfirmDelete = def.General.ConfirmDelete
	}

	if !present("screenshot", "saveDir") {
		stored.Screenshot.SaveDir = def.Screenshot.SaveDir
	}
	if !present("screenshot", "filenamePattern") {
		stored.Screenshot.FilenamePattern = def.Screenshot.FilenamePattern
	}
	if !present("screenshot", "delaySeconds") {
		stored.Screenshot.DelaySeconds = def.Screenshot.DelaySeconds
	}
	if !present("screenshot", "copyToClipboard") {
		stored.Screenshot.CopyToClipboard = def.Screenshot.CopyToClipboard
	}
	if !present("screenshot", "openAfterCapture") {
		stored.Screenshot.OpenAfterCapture = def.Screenshot.OpenAfterCapture
	}
	if !present("screenshot", "notifyOnCapture") {
		stored.Screenshot.NotifyOnCapture = def.Screenshot.NotifyOnCapture
	}
	if !present("screenshot", "hidePanelBeforeCapture") {
		stored.Screenshot.HidePanelBeforeCapture = def.Screenshot.HidePanelBeforeCapture
	}
	if !present("screenshot", "showMouseByDefault") {
		stored.Screenshot.ShowMouseByDefault = def.Screenshot.ShowMouseByDefault
	}

	if !present("recording", "saveDir") {
		stored.Recording.SaveDir = def.Recording.SaveDir
	}
	if !present("recording", "microphone") {
		stored.Recording.Microphone = def.Recording.Microphone
	}
	if !present("recording", "micEnabledByDefault") {
		stored.Recording.MicEnabledByDefault = def.Recording.MicEnabledByDefault
	}
	if !present("recording", "systemEnabledByDefault") {
		stored.Recording.SystemEnabledByDefault = def.Recording.SystemEnabledByDefault
	}
	if !present("recording", "showMouseByDefault") {
		stored.Recording.ShowMouseByDefault = def.Recording.ShowMouseByDefault
	}
	if !present("recording", "quality") {
		stored.Recording.Quality = def.Recording.Quality
	}
	if !present("recording", "notifyOnRecordingEnd") {
		stored.Recording.NotifyOnRecordingEnd = def.Recording.NotifyOnRecordingEnd
	}

	if !present("editor", "defaultTool") {
		stored.Editor.DefaultTool = def.Editor.DefaultTool
	}
	if !present("editor", "defaultFont") {
		stored.Editor.DefaultFont = def.Editor.DefaultFont
	}
	if !present("editor", "defaultFontSize") {
		stored.Editor.DefaultFontSize = def.Editor.DefaultFontSize
	}
	if !present("editor", "defaultColor") {
		stored.Editor.DefaultColor = def.Editor.DefaultColor
	}
	if !present("editor", "defaultStrokeWidth") {
		stored.Editor.DefaultStrokeWidth = def.Editor.DefaultStrokeWidth
	}
	if !present("editor", "defaultOpacity") {
		stored.Editor.DefaultOpacity = def.Editor.DefaultOpacity
	}

	if !present("advanced", "verboseLogging") {
		stored.Advanced.VerboseLogging = def.Advanced.VerboseLogging
	}

	if !present("favorites", "recordings") {
		stored.Favorites.Recordings = def.Favorites.Recordings
	}
	if !present("favorites", "screenshots") {
		stored.Favorites.Screenshots = def.Favorites.Screenshots
	}

	if !present("shortcuts", "takeScreenshot") {
		stored.Shortcuts.TakeScreenshot = def.Shortcuts.TakeScreenshot
	}
	if !present("shortcuts", "startRecording") {
		stored.Shortcuts.StartRecording = def.Shortcuts.StartRecording
	}
	if !present("shortcuts", "stopRecording") {
		stored.Shortcuts.StopRecording = def.Shortcuts.StopRecording
	}
	if !present("shortcuts", "openPalette") {
		stored.Shortcuts.OpenPalette = def.Shortcuts.OpenPalette
	}
	if !present("shortcuts", "openEditor") {
		stored.Shortcuts.OpenEditor = def.Shortcuts.OpenEditor
	}
	if !present("shortcuts", "cancel") {
		stored.Shortcuts.Cancel = def.Shortcuts.Cancel
	}
}

func normalize(s Settings) Settings {
	if s.CustomShortcuts == nil {
		s.CustomShortcuts = map[string]string{}
	}
	if s.Favorites.Recordings == nil {
		s.Favorites.Recordings = []string{}
	}
	if s.Favorites.Screenshots == nil {
		s.Favorites.Screenshots = []string{}
	}
	for id, combo := range s.CustomShortcuts {
		s.CustomShortcuts[id] = strings.TrimSpace(combo)
	}
	s.Screenshot.SaveDir = normalizeDir(s.Screenshot.SaveDir, DefaultScreenshotSaveDir())
	s.Recording.SaveDir = normalizeDir(s.Recording.SaveDir, DefaultRecordingSaveDir())
	if strings.TrimSpace(s.Screenshot.FilenamePattern) == "" {
		s.Screenshot.FilenamePattern = Defaults().Screenshot.FilenamePattern
	}
	if s.Screenshot.DelaySeconds < 0 {
		s.Screenshot.DelaySeconds = 0
	}
	if s.Screenshot.DelaySeconds > 60 {
		s.Screenshot.DelaySeconds = 60
	}
	if !validQuality(s.Recording.Quality) {
		s.Recording.Quality = "medium"
	}
	if s.Editor.DefaultFontSize < 4 {
		s.Editor.DefaultFontSize = 4
	}
	if s.Editor.DefaultFontSize > 200 {
		s.Editor.DefaultFontSize = 200
	}
	if s.Editor.DefaultStrokeWidth < 1 {
		s.Editor.DefaultStrokeWidth = 1
	}
	if s.Editor.DefaultStrokeWidth > 50 {
		s.Editor.DefaultStrokeWidth = 50
	}
	if s.Editor.DefaultOpacity < 0 {
		s.Editor.DefaultOpacity = 0
	}
	if s.Editor.DefaultOpacity > 1 {
		s.Editor.DefaultOpacity = 1
	}
	if strings.TrimSpace(s.Editor.DefaultColor) == "" {
		s.Editor.DefaultColor = Defaults().Editor.DefaultColor
	}
	s.Shortcuts.TakeScreenshot = strings.TrimSpace(s.Shortcuts.TakeScreenshot)
	s.Shortcuts.StartRecording = strings.TrimSpace(s.Shortcuts.StartRecording)
	s.Shortcuts.StopRecording = strings.TrimSpace(s.Shortcuts.StopRecording)
	s.Shortcuts.OpenPalette = strings.TrimSpace(s.Shortcuts.OpenPalette)
	s.Shortcuts.OpenEditor = strings.TrimSpace(s.Shortcuts.OpenEditor)
	s.Shortcuts.Cancel = strings.TrimSpace(s.Shortcuts.Cancel)
	return s
}

func validQuality(q string) bool {
	switch q {
	case "low", "medium", "high":
		return true
	}
	return false
}

func normalizeDir(dir, fallback string) string {
	if dir == "" {
		return fallback
	}
	if dir == "~" {
		home, _ := os.UserHomeDir()
		return home
	}
	if strings.HasPrefix(dir, "~/") {
		home, _ := os.UserHomeDir()
		dir = filepath.Join(home, dir[2:])
	}
	abs, err := filepath.Abs(dir)
	if err != nil {
		return fallback
	}
	return abs
}

func xdgVideosFromUserDirs(home string) string {
	data, err := os.ReadFile(filepath.Join(home, ".config", "user-dirs.dirs"))
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "XDG_VIDEOS_DIR=") {
			continue
		}
		val := strings.TrimSpace(strings.TrimPrefix(line, "XDG_VIDEOS_DIR="))
		val = strings.Trim(val, "\"")
		if val == "" {
			return ""
		}
		if strings.HasPrefix(val, "$HOME") {
			return filepath.Join(home, strings.TrimPrefix(val, "$HOME"))
		}
		return val
	}
	return ""
}
