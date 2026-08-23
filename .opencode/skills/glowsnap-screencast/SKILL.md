---
name: glowsnap-screencast
description: How GlowSnap records the screen, including the org.freedesktop.portal.ScreenRecorder D-Bus session flow, the gst-launch-1.0 video/audio pipeline (pipewiresrc, openh264enc, mp4mux, pulsesrc/audiomixer, avenc_aac), pause/resume, cursor modes, audio source discovery, and quality profiles. Use when working on the recording service or audio handling.
---

# GlowSnap Screencast

## Purpose

Document GlowSnap's actual screen-recording implementation so changes preserve
the existing ScreenRecorder portal + GStreamer pipeline and its concurrency
model.

## When to use

- Modifying `services/screencast/` (`screencast.go`, `recorder.go`, `audio.go`,
  `paths.go`, `settings.go`).
- Working on recording start/stop/pause/resume, cursor handling, audio capture,
  or video encoding.
- Changing recording quality defaults or output naming.

## Architecture / Context

Recording is a plain-Go `services/screencast` package (no Wails). It combines
the **org.freedesktop.portal.ScreenRecorder** portal (source selection + stream
handoff) with an external `gst-launch-1.0` process (encoding/muxing).

### Portal session flow (`screencast.go`)

`ScreenCastService.StartRecording(captureMic, captureSystem, showMouse,
micDevice)` runs:

1. `NewOutputPath()` → `screencast_<date>.mp4` under `RecordingSaveDir()`.
2. `closeStaleSession()`, then `createSession(portal)` — calls
   `ScreenCast.CreateSession` with `persist_mode` 2 and a request token, waits
   up to 10s for the `Response` signal (`waitForResponse`).
3. `selectSources(portal, sessionHandle, showMouse)` — calls
   `ScreenCast.SelectSources` with `types` = monitor|window (1|2),
   `multiple=false`, and sets `cursor_mode` when available
   (`cursorModeForShow`: hidden=1, embedded=2, else unset).
4. `startSession(portal, sessionHandle)` — `ScreenCast.Start`, parses the
   returned `streams` into `[]StreamInfo` via `parseStreams`.
5. `findVideoNode(streams)` to get the video pipewire node id.
6. Build `RecordingOptions` (quality from `settings.Load().Recording.Quality`,
   mic/system devices), then `recorder.Start(videoNode, opts)`.
7. Apply initial mute state to mic/system sources via `setSourceMute`.
8. Set `recording=true` and start two goroutines: `monitor(finished)` (waits on
   the recorder, resets state, closes the session) and
   `monitorCaptureStart(outPath)` (polls the output file size every 50ms to
   detect real capture start, then calls the `recording-started` callback).

The frontend reaches this through `app.go` bindings (`StartRecording`,
`StopRecording`, `PauseRecording`, `ResumeRecording`, `CancelRecording`,
`SetMicEnabled`, `SetSystemEnabled`, `ListMicrophones`, `GetSystemAudioInfo`,
### GStreamer pipeline (`recorder.go`)

`gstLauncher` wraps the `gst-launch-1.0` binary. `buildPipelineArgs` builds:

- **Video:** `pipewiresrc path=<videoNode> ! videoconvert ! openh264enc
  bitrate=… complexity=… qp-min=… qp-max=… gop-size=… ! h264parse ! queue
  max-size-time=2000000000 ! mp4mux name=mux ! filesink location=<out>`.
- **One audio source:** `pulsesrc device=… provide-clock=false ! queue
  (leaky=2) ! audioconvert ! audioresample ! queue ! avenc_aac bitrate=…
  ! aacparse ! queue ! mux.audio_0`.
- **Two audio sources:** first source → `audiomixer name=mix
  start-time-selection=zero alignment-threshold=40000000`, then `avenc_aac … !
  aacparse ! mux.audio_0`; second source → into `mix.`.

Encoding quality comes from `qualityProfile` keyed by `settings…Quality`
(`low` | `medium` | `high`):

| Profile | VideoBitrate | AudioBitrate | Complexity | QP range | GopSize |
|---|---|---|---|---|---|
| low | 800000 | 96000 | 0 | 32–48 | 60 |
| medium (default) | 2000000 | 128000 | 1 | 24–44 | 60 |
| high | 6000000 | 192000 | 2 | 16–38 | 60 |

### Pause / resume

`gstLauncher.Pause`/`Resume` send `SIGSTOP`/`SIGCONT` to the `gst-launch-1.0`
process — no pipeline teardown. `Stop` sends a stop signal then awaits exit
(5s); `Cancel` kills the process and awaits exit (2s). These run outside the
recorder's lock so they can interrupt in-flight pipeline work.

### Audio discovery (`audio.go`)

Uses `pactl` (PulseAudio/PipeWire): `ListMicrophones` parses `pactl list
sources` excluding `.monitor` entries; `DefaultMicrophone` uses
`get-default-source`; system audio is the default sink's `.monitor` source via
`SystemAudioDevice`/`SystemAudioSupported`. Mute toggling uses
`pactl set-source-mute`.

## Rules

- Keep the portal session and GStreamer orchestration in `screencast`;
  `app.go` only bridges and maps settings/events.
- Do not replace `gst-launch-1.0` with a different encoder/mux approach unless
  explicitly required, and keep the `openh264enc`/`mp4mux`/`pulsesrc` path.
- Preserve one-recorder-at-a-time via the channel-semaphore lock (`mu chan
  struct{}`) and the `finished` channel used by `monitor`.
- Cursor show/hide is the portal's `cursor_mode` (embedded/hidden); do not
  inject cursors into the video stream.
- Keep Pause/Resume as process signals, and Stop/Cancel with their timeout
  awaits. Do not add a second concurrency scheme.
- Mute/audio enabling must keep going through `pactl set-source-mute`
  (`setSourceMute`), mirroring `SetMicEnabled`/`SetSystemEnabled`.

## Workflow

1. Read the relevant `screencast/*.go` file before changing behavior.
2. Add reusable logic to the service; expose thin bindings + events via
   `app.go`.
3. For new source/device handling, extend `audio.go` and wire through the
   recording session, not `app.go` directly.
4. Validate with `go test -tags webkit2_41 ./...` and `gofmt -l .`.

## Common mistakes

- Adding a second video/audio pipeline instead of extending
  `buildPipelineArgs`.
- Reaching for portal D-Bus calls from `app.go`.
- Not closing/restoring the portal session on every error path.
- Ignoring the 10–30s `waitForResponse` timeouts and match-rule cleanup.
- Forgetting that Pause/Resume are SIGSTOP/SIGCONT (they must not teardown).
- Hardcoding device/source names instead of `pactl` discovery.
- Treating the `bun.lock` as authoritative (use `frontend/package-lock.json`).

## Validation

- Start/stop produces a valid MP4 (H.264 + AAC) in the recording save dir.
- Pause and resume suspend/render frames correctly; stop exits cleanly.
- Mic/system audio mute via `SetMicEnabled`/`SetSystemEnabled` applies live via
  `pactl set-source-mute`.
- Only one recording is accepted at a time; `monitor` clears state on end.
- `gofmt -l .` empty and Go packages compile.
and recording-defaults saving). Backend→frontend event callbacks are registered
in `app.go` startup and emit `recording-started` / `recording-ended`.