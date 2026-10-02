package screencast

import (
	"fmt"
	"os"
	"time"

	"glowsnap/services/settings"

	"github.com/godbus/dbus/v5"
)

type StreamInfo struct {
	NodeID     uint32
	MediaType  uint32
	Properties map[string]dbus.Variant
}

type ScreenCastService struct {
	conn             *dbus.Conn
	recorder         Recorder
	sessionHandle    dbus.ObjectPath
	videoNode        uint32
	recording        bool
	stopRequested    bool
	outputPath       string
	finished         chan struct{}
	mu               chan struct{}
	onRecordingEnd   func()
	onRecordingStart func()
	captureMic       bool
	captureSystem    bool
	micDevice        string
	systemDevice     string
	micEnabled       bool
	systemEnabled    bool
}

func NewScreenCastService(conn *dbus.Conn) *ScreenCastService {
	return &ScreenCastService{
		conn:     conn,
		recorder: NewGstLauncher(),
		mu:       make(chan struct{}, 1),
	}
}

func (s *ScreenCastService) lock()   { s.mu <- struct{}{} }
func (s *ScreenCastService) unlock() { <-s.mu }

func (s *ScreenCastService) SetOnRecordingEnd(fn func()) {
	s.lock()
	s.onRecordingEnd = fn
	s.unlock()
}

func (s *ScreenCastService) SetOnRecordingStart(fn func()) {
	s.lock()
	s.onRecordingStart = fn
	s.unlock()
}

func (s *ScreenCastService) notifyRecordingEnd() {
	s.lock()
	fn := s.onRecordingEnd
	s.unlock()
	if fn != nil {
		fn()
	}
}

func (s *ScreenCastService) notifyRecordingStart() {
	s.lock()
	recording := s.recording
	fn := s.onRecordingStart
	s.unlock()
	if !recording {
		return
	}
	if fn != nil {
		fn()
	}
}

func (s *ScreenCastService) SetMicEnabled(enabled bool) error {
	s.lock()
	recording := s.recording
	captureMic := s.captureMic
	device := s.micDevice
	s.unlock()
	if !recording || !captureMic {
		return fmt.Errorf("no microphone recording active")
	}
	if device == "" {
		return fmt.Errorf("microphone device unavailable")
	}
	return setSourceMute(device, !enabled)
}

func (s *ScreenCastService) SetSystemEnabled(enabled bool) error {
	s.lock()
	recording := s.recording
	captureSystem := s.captureSystem
	device := s.systemDevice
	s.unlock()
	if !recording || !captureSystem {
		return fmt.Errorf("no system audio recording active")
	}
	if device == "" {
		return fmt.Errorf("system audio device unavailable")
	}
	return setSourceMute(device, !enabled)
}

const (
	cursorModeHidden   uint32 = 1
	cursorModeEmbedded uint32 = 2
)

func (s *ScreenCastService) StartRecording(captureMic, captureSystem, showMouse bool, micDevice string) (string, error) {
	s.lock()
	if s.recording {
		s.unlock()
		return "", fmt.Errorf("a recording is already active")
	}
	s.unlock()

	outPath, err := NewOutputPath()
	if err != nil {
		return "", fmt.Errorf("unable to resolve videos directory: %w", err)
	}

	portal := s.conn.Object("org.freedesktop.portal.Desktop", "/org/freedesktop/portal/desktop")

	s.closeStaleSession()
	sessionHandle, err := s.createSession(portal)
	if err != nil {
		return "", fmt.Errorf("CreateSession error: %w", err)
	}
	s.sessionHandle = sessionHandle

	if err := s.selectSources(portal, sessionHandle, showMouse); err != nil {
		s.closeSession()
		return "", fmt.Errorf("SelectSources error: %w", err)
	}

	streams, err := s.startSession(portal, sessionHandle)
	if err != nil {
		s.closeSession()
		return "", fmt.Errorf("Start error: %w", err)
	}

	videoNode, err := findVideoNode(streams)
	if err != nil {
		s.closeSession()
		return "", err
	}

	cfg := settings.Load()
	opts := RecordingOptions{
		OutputPath:   outPath,
		Resolution:   cfg.Recording.Resolution,
		CustomWidth:  cfg.Recording.CustomWidth,
		CustomHeight: cfg.Recording.CustomHeight,
	}

	if micDevice == "" {
		micDevice = DefaultMicrophone()
	}
	if micDevice != "" {
		opts.CaptureMic = true
		opts.MicDevice = micDevice
	}
	if device, err := SystemAudioDevice(); err == nil && device != "" {
		opts.CaptureSystem = true
		opts.SystemDevice = device
	}

	if err := s.recorder.Start(videoNode, opts); err != nil {
		s.closeSession()
		return "", err
	}

	if opts.CaptureMic {
		_ = setSourceMute(opts.MicDevice, !captureMic)
	}
	if opts.CaptureSystem {
		_ = setSourceMute(opts.SystemDevice, !captureSystem)
	}

	s.lock()
	s.videoNode = videoNode
	s.outputPath = outPath
	s.recording = true
	s.stopRequested = false
	s.finished = make(chan struct{})
	s.captureMic = opts.CaptureMic
	s.captureSystem = opts.CaptureSystem
	s.micDevice = opts.MicDevice
	s.systemDevice = opts.SystemDevice
	s.micEnabled = captureMic
	s.systemEnabled = captureSystem
	finished := s.finished
	s.unlock()

	go s.monitor(finished)
	go s.monitorCaptureStart(outPath)

	return outPath, nil
}

func (s *ScreenCastService) monitorCaptureStart(outputPath string) {
	const pollInterval = 50 * time.Millisecond
	const timeout = 30 * time.Second

	deadline := time.Now().Add(timeout)
	var lastSize int64 = -1

	for time.Now().Before(deadline) {
		if info, err := os.Stat(outputPath); err == nil {
			size := info.Size()
			if lastSize == -1 {
				lastSize = size
			} else if size > lastSize {
				s.notifyRecordingStart()
				return
			} else {
				lastSize = size
			}
		}
		time.Sleep(pollInterval)
	}

	s.notifyRecordingStart()
}

func (s *ScreenCastService) monitor(finished chan struct{}) {
	<-s.recorder.WaitDone()
	waitErr := s.recorder.WaitErr()

	s.lock()
	recording := s.recording
	stopRequested := s.stopRequested
	s.recording = false
	s.videoNode = 0
	s.outputPath = ""
	s.finished = nil
	s.captureMic = false
	s.captureSystem = false
	s.micDevice = ""
	s.systemDevice = ""
	s.micEnabled = false
	s.systemEnabled = false
	close(finished)
	s.unlock()

	s.closeSession()

	if recording && !stopRequested && waitErr != nil {
		fmt.Printf("screencast: gst-launch exited unexpectedly: %v\n", waitErr)
	}

	s.notifyRecordingEnd()
}

func (s *ScreenCastService) PauseRecording() error {
	s.lock()
	recording := s.recording
	s.unlock()
	if !recording {
		return fmt.Errorf("no active recording")
	}
	return s.recorder.Pause()
}

func (s *ScreenCastService) ResumeRecording() error {
	s.lock()
	recording := s.recording
	s.unlock()
	if !recording {
		return fmt.Errorf("no active recording")
	}
	return s.recorder.Resume()
}

func (s *ScreenCastService) StopRecording() (string, error) {
	s.lock()
	if !s.recording {
		s.unlock()
		return "", fmt.Errorf("no active recording")
	}
	path := s.outputPath
	finished := s.finished
	s.stopRequested = true
	s.unlock()

	if err := s.recorder.Stop(); err != nil {
		return "", fmt.Errorf("failed to stop recording: %w", err)
	}

	if finished != nil {
		<-finished
	}
	return path, nil
}

func (s *ScreenCastService) CancelRecording() error {
	s.lock()
	if !s.recording {
		s.unlock()
		return fmt.Errorf("no active recording")
	}
	path := s.outputPath
	finished := s.finished
	s.stopRequested = true
	s.unlock()

	_ = s.recorder.Cancel()

	if finished != nil {
		<-finished
	}
	if path != "" {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("failed to discard canceled recording: %w", err)
		}
	}
	return nil
}

func (s *ScreenCastService) Cleanup() {
	s.lock()
	if !s.recording {
		s.unlock()
		return
	}
	path := s.outputPath
	finished := s.finished
	s.stopRequested = true
	s.unlock()

	if s.recorder != nil {
		s.recorder.Cancel()
	}
	if finished != nil {
		<-finished
	}
	if path != "" {
		os.Remove(path)
	}
}

func findVideoNode(streams []StreamInfo) (uint32, error) {
	for _, st := range streams {
		if st.MediaType == 1 {
			return st.NodeID, nil
		}
	}
	return 0, fmt.Errorf("no video stream found")
}

func (s *ScreenCastService) closeStaleSession() {
	s.closeSession()
}

func (s *ScreenCastService) createSession(portal dbus.BusObject) (dbus.ObjectPath, error) {
	token := fmt.Sprintf("glowsnap_%d", time.Now().UnixNano())
	options := map[string]dbus.Variant{
		"handle_token":         dbus.MakeVariant(token),
		"session_handle_token": dbus.MakeVariant(token + "_session"),
		"persist_mode":         dbus.MakeVariant(uint32(2)),
	}

	call := portal.Call("org.freedesktop.portal.ScreenCast.CreateSession", 0, options)
	if call.Err != nil {
		return "", fmt.Errorf("CreateSession call failed: %w", call.Err)
	}

	var requestHandle dbus.ObjectPath
	if err := call.Store(&requestHandle); err != nil {
		return "", fmt.Errorf("failed to get request handle: %w", err)
	}

	resp, err := s.waitForResponse(requestHandle, 10*time.Second)
	if err != nil {
		return "", err
	}

	var responseCode uint32
	var results map[string]dbus.Variant
	if err := dbus.Store(resp.Body, &responseCode, &results); err != nil {
		return "", fmt.Errorf("invalid CreateSession response: %w", err)
	}
	if responseCode != 0 {
		return "", fmt.Errorf("CreateSession rejected with code %d", responseCode)
	}

	handleVar, ok := results["session_handle"]
	if !ok {
		return "", fmt.Errorf("missing session_handle in response")
	}
	handleStr, ok := handleVar.Value().(string)
	if !ok {
		return "", fmt.Errorf("invalid session_handle type")
	}
	return dbus.ObjectPath(handleStr), nil
}

func (s *ScreenCastService) selectSources(portal dbus.BusObject, sessionHandle dbus.ObjectPath, showMouse bool) error {
	token := fmt.Sprintf("glowsnap_sel_%d", time.Now().UnixNano())
	selectOptions := map[string]dbus.Variant{
		"handle_token": dbus.MakeVariant(token),
		"types":        dbus.MakeVariant(uint32(1 | 2)),
		"multiple":     dbus.MakeVariant(false),
	}
	if mode := s.cursorModeForShow(portal, showMouse); mode != 0 {
		selectOptions["cursor_mode"] = dbus.MakeVariant(mode)
	}

	call := portal.Call("org.freedesktop.portal.ScreenCast.SelectSources", 0, sessionHandle, selectOptions)
	if call.Err != nil {
		return fmt.Errorf("SelectSources call failed: %w", call.Err)
	}

	var requestHandle dbus.ObjectPath
	if err := call.Store(&requestHandle); err != nil {
		return fmt.Errorf("failed to get request handle: %w", err)
	}

	resp, err := s.waitForResponse(requestHandle, 30*time.Second)
	if err != nil {
		return fmt.Errorf("SelectSources wait failed: %w", err)
	}

	var responseCode uint32
	var results map[string]dbus.Variant
	if err := dbus.Store(resp.Body, &responseCode, &results); err != nil {
		return fmt.Errorf("invalid SelectSources response: %w", err)
	}
	if responseCode != 0 {
		return fmt.Errorf("SelectSources rejected with code %d", responseCode)
	}
	return nil
}

func (s *ScreenCastService) startSession(portal dbus.BusObject, sessionHandle dbus.ObjectPath) ([]StreamInfo, error) {
	token := fmt.Sprintf("glowsnap_start_%d", time.Now().UnixNano())
	startOptions := map[string]dbus.Variant{
		"handle_token": dbus.MakeVariant(token),
	}

	call := portal.Call("org.freedesktop.portal.ScreenCast.Start", 0, sessionHandle, "", startOptions)
	if call.Err != nil {
		return nil, fmt.Errorf("Start call failed: %w", call.Err)
	}

	var requestHandle dbus.ObjectPath
	if err := call.Store(&requestHandle); err != nil {
		return nil, fmt.Errorf("failed to get request handle: %w", err)
	}

	resp, err := s.waitForResponse(requestHandle, 10*time.Second)
	if err != nil {
		return nil, fmt.Errorf("Start response wait failed: %w", err)
	}

	var responseCode uint32
	var results map[string]dbus.Variant
	if err := dbus.Store(resp.Body, &responseCode, &results); err != nil {
		return nil, fmt.Errorf("invalid Start response: %w", err)
	}
	if responseCode != 0 {
		return nil, fmt.Errorf("Start rejected with code %d", responseCode)
	}

	streamsVar, ok := results["streams"]
	if !ok {
		return nil, fmt.Errorf("no 'streams' in Start response")
	}
	return parseStreams(streamsVar)
}

func (s *ScreenCastService) getAvailableCursorModes(portal dbus.BusObject) uint32 {
	var modes uint32
	err := portal.Call("org.freedesktop.DBus.Properties.Get", 0,
		"org.freedesktop.portal.ScreenCast",
		"AvailableCursorModes",
	).Store(&modes)
	if err != nil {
		return cursorModeHidden | cursorModeEmbedded
	}
	return modes
}

func (s *ScreenCastService) cursorModeForShow(portal dbus.BusObject, showMouse bool) uint32 {
	available := s.getAvailableCursorModes(portal)
	if showMouse {
		if available&cursorModeEmbedded != 0 {
			return cursorModeEmbedded
		}
		return 0
	}
	if available&cursorModeHidden != 0 {
		return cursorModeHidden
	}
	return 0
}

func (s *ScreenCastService) closeSession() {
	s.lock()
	if s.sessionHandle == "" {
		s.unlock()
		return
	}
	handle := s.sessionHandle
	s.sessionHandle = ""
	s.unlock()

	sessionObj := s.conn.Object("org.freedesktop.portal.Desktop", handle)
	call := sessionObj.Call("org.freedesktop.portal.Session.Close", 0)
	if call.Err != nil {
		fmt.Printf("Warning: failed to close portal session: %v\n", call.Err)
	}
}

func (s *ScreenCastService) waitForResponse(requestPath dbus.ObjectPath, timeout time.Duration) (*dbus.Signal, error) {
	matchRule := fmt.Sprintf("type='signal',interface='org.freedesktop.portal.Request',member='Response',path='%s'", requestPath)
	if err := s.addMatch(matchRule); err != nil {
		return nil, err
	}
	defer s.removeMatch(matchRule)

	signalCh := make(chan *dbus.Signal, 1)
	s.conn.Signal(signalCh)
	defer s.conn.RemoveSignal(signalCh)

	select {
	case sig := <-signalCh:
		return sig, nil
	case <-time.After(timeout):
		return nil, fmt.Errorf("timeout waiting for response")
	}
}

func (s *ScreenCastService) addMatch(rule string) error {
	return s.conn.BusObject().Call("org.freedesktop.DBus.AddMatch", 0, rule).Err
}

func (s *ScreenCastService) removeMatch(rule string) {
	s.conn.BusObject().Call("org.freedesktop.DBus.RemoveMatch", 0, rule)
}

func parseStreams(streamsVar dbus.Variant) ([]StreamInfo, error) {
	raw := streamsVar.Value()

	slice, ok := raw.([][]interface{})
	if !ok {
		return nil, fmt.Errorf("unexpected streams type %T", raw)
	}

	streams := make([]StreamInfo, 0, len(slice))

	for _, parts := range slice {
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid stream entry: %#v", parts)
		}

		nodeID, ok := parts[0].(uint32)
		if !ok {
			return nil, fmt.Errorf("invalid node id type %T", parts[0])
		}

		props, ok := parts[1].(map[string]dbus.Variant)
		if !ok {
			return nil, fmt.Errorf("invalid properties type %T", parts[1])
		}

		mediaType := uint32(1)
		if v, ok := props["media_type"]; ok {
			if t, ok := v.Value().(uint32); ok {
				mediaType = t
			}
		}

		streams = append(streams, StreamInfo{
			NodeID:     nodeID,
			MediaType:  mediaType,
			Properties: props,
		})
	}

	return streams, nil
}
