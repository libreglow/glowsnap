package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"glowsnap/services/screencast"
	"glowsnap/services/screenshot"
	"glowsnap/services/settings"

	"github.com/godbus/dbus/v5"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/sys/unix"
)

var appVersion = "dev"

const panelHideDelay = 250 * time.Millisecond

type App struct {
	ctx               context.Context
	dbusConn          *dbus.Conn
	screenshotService *screenshot.Service
	screenCastService *screencast.ScreenCastService
	httpServer        *http.Server
	screenshotsURL    string
	screenshotsDir    string
	recordingsURL     string
	recordingsDir     string
	serverMu          sync.Mutex

	overlayMu          sync.Mutex
	pendingOverlayPath string
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	conn, err := dbus.SessionBus()
	if err != nil {
		runtime.LogError(ctx, "Failed to connect to D-Bus: "+err.Error())
		return
	}
	a.dbusConn = conn

	a.screenshotService = screenshot.NewService(conn)
	a.screenCastService = screencast.NewScreenCastService(conn)
	a.screenCastService.SetOnRecordingEnd(func() {
		runtime.EventsEmit(a.ctx, "recording-ended")
		if settings.Load().Recording.NotifyOnRecordingEnd {
			runtime.SendNotification(a.ctx, runtime.NotificationOptions{
				Title: "GlowSnap",
				Body:  "Recording saved.",
			})
		}
	})
	a.screenCastService.SetOnRecordingStart(func() {
		runtime.EventsEmit(a.ctx, "recording-started")
	})

	a.screenshotsDir = settings.Load().ScreenshotSaveDir()
	if err := os.MkdirAll(a.screenshotsDir, 0755); err != nil {
		runtime.LogError(ctx, "Failed to create screenshots directory: "+err.Error())
	}

	a.recordingsDir = settings.Load().RecordingSaveDir()
	if err := os.MkdirAll(a.recordingsDir, 0755); err != nil {
		runtime.LogError(ctx, "Failed to create recordings directory: "+err.Error())
	}

	mux := http.NewServeMux()
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		http.FileServer(http.Dir(a.screenshotsDir)).ServeHTTP(w, r)
	}))
	mux.Handle("/recordings/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		http.StripPrefix("/recordings/", http.FileServer(http.Dir(a.recordingsDir))).ServeHTTP(w, r)
	}))

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		runtime.LogError(ctx, "Failed to start HTTP server: "+err.Error())
		return
	}
	port := listener.Addr().(*net.TCPAddr).Port
	a.screenshotsURL = fmt.Sprintf("http://127.0.0.1:%d", port)
	a.recordingsURL = fmt.Sprintf("http://127.0.0.1:%d/recordings", port)

	a.httpServer = &http.Server{Handler: mux}
	go func() {
		if err := a.httpServer.Serve(listener); err != nil && err != http.ErrServerClosed {
			runtime.LogError(ctx, "HTTP server error: "+err.Error())
		}
	}()

	runtime.LogInfo(ctx, "Screenshots server started at "+a.screenshotsURL)
	runtime.LogInfo(ctx, "Recordings server started at "+a.recordingsURL)
}

func (a *App) shutdown(ctx context.Context) {
	if a.httpServer != nil {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		a.httpServer.Shutdown(shutdownCtx)
	}
	if a.screenCastService != nil {
		a.screenCastService.Cleanup()
	}
	if a.dbusConn != nil {
		a.dbusConn.Close()
	}
}

func (a *App) OpenToolsPalette() {
	cmd := exec.Command("glowsnap", "--palette")
	cmd.Start()
}

func (a *App) ResizeToPalette() {
	runtime.WindowUnfullscreen(a.ctx)
	runtime.WindowShow(a.ctx)
	runtime.WindowSetSize(a.ctx, 520, 100)
	runtime.WindowCenter(a.ctx)
}

func (a *App) ResizeToSettings() {
	runtime.WindowSetSize(a.ctx, 380, 460)
	runtime.WindowCenter(a.ctx)
}

func (a *App) ResizeToPreferences() {
	runtime.WindowSetSize(a.ctx, 520, 640)
	runtime.WindowCenter(a.ctx)
}

func (a *App) TakeScreenshot() {
	if a.screenshotService == nil {
		runtime.LogError(a.ctx, "Screenshot service not initialized")
		return
	}
	cfg := settings.Load()

	if cfg.Screenshot.DelaySeconds > 0 {
		runtime.LogInfo(a.ctx, fmt.Sprintf("Capturing Screenshot in %ds", cfg.Screenshot.DelaySeconds))
		time.Sleep(time.Duration(cfg.Screenshot.DelaySeconds) * time.Second)
	}

	hidden := false
	if cfg.Screenshot.HidePanelBeforeCapture {
		runtime.WindowHide(a.ctx)
		hidden = true
		time.Sleep(panelHideDelay)
	}

	path, err := a.screenshotService.CaptureFullScreen()
	if hidden {
		runtime.WindowShow(a.ctx)
	}
	if err != nil {
		runtime.LogError(a.ctx, "Screenshot failed: "+err.Error())
		return
	}
	a.postProcessCapture(path, "Screenshot", cfg)
}

func (a *App) TakeAreaScreenshot() {
	if a.screenshotService == nil {
		runtime.LogError(a.ctx, "Screenshot service not initialized")
		return
	}
	a.captureAndHandle("Area screenshot", func() (string, error) {
		return a.screenshotService.CaptureArea()
	})
}

func (a *App) StartPaletteAreaCapture() (string, error) {
	if a.screenshotService == nil {
		return "", fmt.Errorf("screenshot service not initialized")
	}

	cfg := settings.Load()
	if cfg.Screenshot.DelaySeconds > 0 {
		runtime.LogInfo(a.ctx, fmt.Sprintf("Capturing area screenshot in %ds", cfg.Screenshot.DelaySeconds))
		time.Sleep(time.Duration(cfg.Screenshot.DelaySeconds) * time.Second)
	}

	hidden := false
	if cfg.Screenshot.HidePanelBeforeCapture {
		runtime.WindowHide(a.ctx)
		hidden = true
		time.Sleep(panelHideDelay)
	}

	path, err := a.screenshotService.CaptureFullScreen()
	if hidden {
		runtime.WindowShow(a.ctx)
	}
	if err != nil {
		runtime.LogError(a.ctx, "Palette area capture failed: "+err.Error())
		return "", err
	}

	a.overlayMu.Lock()
	a.pendingOverlayPath = path
	a.overlayMu.Unlock()

	return a.screenshotsURL + "/" + filepath.Base(path), nil
}
func (a *App) CompletePaletteAreaScreenshot(x, y, width, height int) error {
	path, ok := a.takePendingOverlayPath()
	if !ok {
		return fmt.Errorf("no pending area capture")
	}

	if err := a.screenshotService.CropRegion(path, x, y, width, height); err != nil {
		runtime.LogError(a.ctx, "Area screenshot crop failed: "+err.Error())
		return err
	}

	a.postProcessCapture(path, "Area screenshot", settings.Load())
	return nil
}

func (a *App) CancelPaletteAreaCapture() error {
	path, ok := a.takePendingOverlayPath()
	if !ok {
		return nil
	}
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (a *App) takePendingOverlayPath() (string, bool) {
	a.overlayMu.Lock()
	defer a.overlayMu.Unlock()
	path := a.pendingOverlayPath
	if path == "" {
		return "", false
	}
	a.pendingOverlayPath = ""
	return path, true
}

func (a *App) captureAndHandle(label string, capture func() (string, error)) {
	cfg := settings.Load()

	if cfg.Screenshot.DelaySeconds > 0 {
		runtime.LogInfo(a.ctx, fmt.Sprintf("Capturing %s in %ds", label, cfg.Screenshot.DelaySeconds))
		time.Sleep(time.Duration(cfg.Screenshot.DelaySeconds) * time.Second)
	}

	path, err := capture()
	if err != nil {
		runtime.LogError(a.ctx, label+" failed: "+err.Error())
		return
	}
	a.postProcessCapture(path, label, cfg)
}

func (a *App) postProcessCapture(path, label string, cfg settings.Settings) {
	runtime.LogInfo(a.ctx, label+" saved: "+path)

	if cfg.Screenshot.CopyToClipboard {
		a.copyFileToClipboard(path)
	}
	if cfg.Screenshot.OpenAfterCapture {
		if err := exec.Command("xdg-open", path).Start(); err != nil {
			a.verboseLogf("failed to open screenshot: %v", err)
		}
	}
	if cfg.Screenshot.NotifyOnCapture {
		runtime.SendNotification(a.ctx, runtime.NotificationOptions{
			Title: "GlowSnap",
			Body:  label + " saved.",
		})
	}
}

func (a *App) copyFileToClipboard(path string) {
	f, err := os.Open(path)
	if err != nil {
		a.verboseLogf("clipboard: failed to open %s: %v", path, err)
		return
	}
	defer f.Close()

	for _, args := range [][]string{
		{"wl-copy", "--type", "image/png"},
		{"xclip", "-selection", "clipboard", "-t", "image/png"},
		{"xsel", "--clipboard", "--input", "--mimetype", "image/png"},
	} {
		if _, err := exec.LookPath(args[0]); err != nil {
			continue
		}
		cmd := exec.Command(args[0], args[1:]...)
		cmd.Stdin = f
		if err := cmd.Run(); err != nil {
			a.verboseLogf("clipboard copy failed (%s): %v", args[0], err)
			continue
		}
		return
	}
	a.verboseLogf("clipboard: no supported clipboard tool found")
}

func (a *App) verboseLogf(format string, args ...interface{}) {
	if settings.Load().Advanced.VerboseLogging {
		runtime.LogInfo(a.ctx, fmt.Sprintf("[verbose] "+format, args...))
	}
}

func (a *App) SaveRecordingDefaults(micEnabled, systemEnabled, showMouse bool) error {
	return screencast.SaveRecordingDefaults(micEnabled, systemEnabled, showMouse)
}

func (a *App) StartRecording(captureMic bool, captureSystemAudio bool, showMouse bool, micDevice string) (string, error) {
	if a.screenCastService == nil {
		return "", fmt.Errorf("recording service not initialized")
	}
	return a.screenCastService.StartRecording(captureMic, captureSystemAudio, showMouse, micDevice)
}

func (a *App) PauseRecording() error {
	if a.screenCastService == nil {
		return fmt.Errorf("recording service not initialized")
	}
	return a.screenCastService.PauseRecording()
}

func (a *App) ResumeRecording() error {
	if a.screenCastService == nil {
		return fmt.Errorf("recording service not initialized")
	}
	return a.screenCastService.ResumeRecording()
}

func (a *App) StopRecording() (string, error) {
	if a.screenCastService == nil {
		return "", fmt.Errorf("recording service not initialized")
	}
	return a.screenCastService.StopRecording()
}

func (a *App) CancelRecording() error {
	if a.screenCastService == nil {
		return fmt.Errorf("recording service not initialized")
	}
	return a.screenCastService.CancelRecording()
}

func (a *App) SetMicEnabled(enabled bool) error {
	if a.screenCastService == nil {
		return fmt.Errorf("recording service not initialized")
	}
	return a.screenCastService.SetMicEnabled(enabled)
}

func (a *App) SetSystemEnabled(enabled bool) error {
	if a.screenCastService == nil {
		return fmt.Errorf("recording service not initialized")
	}
	return a.screenCastService.SetSystemEnabled(enabled)
}

func (a *App) GetVideosDir() string {
	dir, err := screencast.VideosDir()
	if err != nil {
		return ""
	}
	return dir
}

func (a *App) ListMicrophones() ([]screencast.AudioDevice, error) {
	return screencast.ListMicrophones()
}

func (a *App) GetSystemAudioSupported() screencast.SystemAudioInfo {
	return screencast.GetSystemAudioInfo()
}

func (a *App) GetSavedMicrophone() string {
	return screencast.LoadSettings().Recording.Microphone
}

func (a *App) SaveMicrophone(name string) error {
	return screencast.SaveMicrophone(name)
}

func (a *App) GetSettings() settings.Settings {
	return settings.Load()
}

func (a *App) UpdateSettings(s settings.Settings) settings.Settings {
	if err := settings.Save(s); err != nil {
		runtime.LogError(a.ctx, "Failed to save settings: "+err.Error())
		return settings.Load()
	}
	saved := settings.Load()
	a.refreshScreenshotsDir(saved)
	return saved
}

func (a *App) ResetSettings() settings.Settings {
	def := settings.ResetToDefaults()
	a.refreshScreenshotsDir(def)
	return def
}

func (a *App) refreshScreenshotsDir(s settings.Settings) {
	if a == nil {
		return
	}
	dir := s.ScreenshotSaveDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		runtime.LogError(a.ctx, "Failed to create screenshots directory: "+err.Error())
		return
	}
	a.screenshotsDir = dir
}

func (a *App) SelectDirectory(title string) (string, error) {
	path, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
	})
	if err != nil {
		return "", err
	}
	return path, nil
}

func (a *App) GetAppVersion() string {
	return appVersion
}

func (a *App) GetHomeDir() string {
	home, _ := os.UserHomeDir()
	return home
}

type ScreenshotInfo struct {
	Name       string `json:"name"`
	Path       string `json:"path"`
	Size       int64  `json:"size"`
	CreatedAt  int64  `json:"createdAt"`
	ModifiedAt int64  `json:"modifiedAt"`
	Date       int64  `json:"date"`
	DateSource string `json:"dateSource"`
}

func birthTime(path string) (int64, string) {
	var stx unix.Statx_t
	if err := unix.Statx(unix.AT_FDCWD, path, 0, unix.STATX_BTIME, &stx); err == nil {
		if stx.Mask&unix.STATX_BTIME != 0 && stx.Btime.Sec > 0 {
			return stx.Btime.Sec, "birth"
		}
	}
	return 0, ""
}

func (a *App) ListScreenshots() ([]ScreenshotInfo, error) {
	dir := settings.Load().ScreenshotSaveDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var files []ScreenshotInfo
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		ext := filepath.Ext(entry.Name())
		switch ext {
		case ".png", ".jpg", ".jpeg", ".webp", ".bmp":
		default:
			continue
		}
		full := filepath.Join(dir, entry.Name())
		info, err := os.Stat(full)
		if err != nil {
			continue
		}
		modTime := info.ModTime().Unix()
		birth, src := birthTime(full)

		var date int64
		var dateSource string
		if birth > 0 {
			date = birth
			dateSource = src
		} else {
			date = modTime
			dateSource = "mtime"
		}

		files = append(files, ScreenshotInfo{
			Name:       entry.Name(),
			Path:       full,
			Size:       info.Size(),
			CreatedAt:  birth,
			ModifiedAt: modTime,
			Date:       date,
			DateSource: dateSource,
		})
	}
	if files == nil {
		files = []ScreenshotInfo{}
	}
	return files, nil
}

func (a *App) GetScreenshotsBaseURL() string {
	return a.screenshotsURL
}

func (a *App) SaveFileDialog(defaultName string) (string, error) {
	filePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Edited Image",
		DefaultFilename: defaultName,
		Filters: []runtime.FileFilter{
			{DisplayName: "PNG Image (*.png)", Pattern: "*.png"},
		},
	})
	if err != nil {
		return "", err
	}
	if filePath == "" {
		return "", fmt.Errorf("no file selected")
	}
	return filePath, nil
}

func (a *App) WriteFile(filePath string, data []byte) error {
	return os.WriteFile(filePath, data, 0644)
}

func (a *App) ResizeToStudio() {
	runtime.WindowMaximise(a.ctx)
}

func (a *App) RenameScreenshot(oldName, newName string) error {
	dir := settings.Load().ScreenshotSaveDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	oldPath := filepath.Join(dir, oldName)
	newPath := filepath.Join(dir, newName)
	return os.Rename(oldPath, newPath)
}

func (a *App) DeleteScreenshot(fileName string) error {
	dir := settings.Load().ScreenshotSaveDir()
	path := filepath.Join(dir, fileName)
	return os.Remove(path)
}

type RecordingInfo struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

func (a *App) ListRecordings() ([]RecordingInfo, error) {
	dir := settings.Load().RecordingSaveDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var files []RecordingInfo
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		ext := filepath.Ext(entry.Name())
		if ext != ".mp4" {
			continue
		}
		full := filepath.Join(dir, entry.Name())
		files = append(files, RecordingInfo{
			Name: entry.Name(),
			Path: full,
		})
	}
	if files == nil {
		files = []RecordingInfo{}
	}
	return files, nil
}

func (a *App) GetRecordingsBaseURL() string {
	return a.recordingsURL
}

func (a *App) ResizeToRecord() {
	runtime.WindowMaximise(a.ctx)
}
