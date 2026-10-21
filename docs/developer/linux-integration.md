# Linux Integration

GlowSnap is Linux-only, and that is intentional. The D-Bus portals, WebKitGTK,
GTK, the Wayland/X11 handling and the small Linux command-line utilities are
part of the product, not workarounds.

Do not replace them with cross-platform alternatives unless the project
explicitly asks for it.

---

## The pieces

| Need | Mechanism |
| ---- | --------- |
| Screenshot capture | `org.freedesktop.portal.Screenshot` over D-Bus |
| Screen recording | `org.freedesktop.portal.ScreenCast` over D-Bus |
| PipeWire video | `pipewiresrc` in the GStreamer pipeline |
| Audio devices | `pactl` (PulseAudio / PipeWire) |
| Clipboard | `wl-copy`, `xclip`, `xsel` |
| Open a file | `xdg-open` |
| Notifications | `org.freedesktop.Notifications` over D-Bus |
| File birth time | `unix.Statx` with `STATX_BTIME` |
| Desktop entry | `build/glowsnap.desktop` + `packaging/*.desktop` |

---

## The D-Bus session bus

GlowSnap talks to the **session** bus, not the system bus:

```go
conn, err := dbus.SessionBus()
```

The portal objects all live on:

```text
Bus name : org.freedesktop.portal.Desktop
Object   : /org/freedesktop/portal/desktop
```

### Portal request/response protocol

Every portal call is asynchronous:

1. Call the method with a `handle_token` option. It returns an object path
   (`o`).
2. Subscribe to the `Request` signal on that path:

   ```text
   type='signal',interface='org.freedesktop.portal.Request',member='Response',path='<handle>'
   ```

3. The signal body is `(uint32 response, map[string]dbus.Variant results)`.
   `response == 0` means success; anything else is an error code.
4. Remove the match rule when you are done.

The `handle_token` must be unique per request, so it is derived from the
current timestamp:

```go
fmt.Sprintf("glowsnap_%d", time.Now().UnixNano())
```

### Permissions

Under Flatpak the portal needs explicit permissions:

```text
--talk-name=org.freedesktop.portal.Desktop
--talk-name=org.freedesktop.Notifications
```

Without them the portal cannot even be reached from inside the sandbox.

---

## Wayland and X11

GlowSnap does not implement its own screen grab. It delegates to the portal,
which lets the compositor decide what is captured and how the permission
dialog is presented. That is what makes the app work on both Wayland and X11
without a compositor-specific code path.

What does differ is the clipboard. The backend tries the tools in this order
and uses the first one that is installed:

```bash
wl-copy --type image/png
xclip -selection clipboard -t image/png
xsel --clipboard --input --mimetype image/png
```

`wl-copy` only works on Wayland, `xclip`/`xsel` only on X11. The order is
therefore a preference, not a correctness guarantee — on a Wayland session with
`xclip` installed but no `wl-clipboard`, the X11 tool may exist but fail.
Install `wl-clipboard` on Wayland.

---

## Audio

Audio is handled entirely through PulseAudio/PipeWire with `pactl`:

| Task | Command |
| ---- | ------- |
| List sources | `pactl list sources` |
| Default microphone | `pactl get-default-source` |
| Default output | `pactl get-default-sink` |
| System audio | the `.monitor` source of the default sink |
| Mute/unmute during a recording | `pactl set-source-mute <source> 0\|1` |

A source whose name contains `.monitor` is treated as a system-audio source;
everything else is a microphone candidate.

System audio is therefore *what you hear*, captured from the output monitor —
it is not a separate portal audio stream.

If `pactl` is missing, or the default sink has no monitor source, the system
audio toggle is disabled in the UI with an explanatory message.

---

## Notifications

Notifications use the freedesktop specification directly:

```text
org.freedesktop.Notifications.Notify
```

The capture is attached twice:

- `image-path` — the absolute path, so the notification server can load it
  lazily,
- `image-data` — the raw pixels as an `(iiibiiay)` tuple, scaled so the
  longest side is at most 1024 px and converted to RGBA8.

If the call fails because of the hints, the notification is retried without
them so the message still reaches the user.

Recording-end notifications use Wails' own `runtime.SendNotification` instead.

---

## GStreamer

Recording shells out to `gst-launch-1.0`:

```text
gst-launch-1.0 -e
  pipewiresrc path=<node id> ! videoconvert ! videoscale add-borders=true
  ! video/x-raw,width=W,height=H ! videoconvert
  ! openh264enc ... ! h264parse ! queue max-size-time=2000000000
  ! mp4mux name=mux ! filesink location=<output>
```

The required elements are `pipewiresrc`, `videoscale`, `openh264enc`,
`h264parse`, `mp4mux`, `filesink`, `pulsesrc`, `audioconvert`, `audioresample`,
`audiomixer`, `avenc_aac` and `aacparse`. On Debian/Ubuntu these come from
`gstreamer1.0-plugins-base`, `gstreamer1.0-plugins-good`,
`gstreamer1.0-plugins-bad` and `gstreamer1.0-plugins-ugly`.

Pause and resume are implemented with `SIGSTOP`/`SIGCONT` on the child process,
and stopping sends `SIGINT` so GStreamer finalises the MP4 container.

---

## ffmpeg

Recording thumbnails are generated with `ffmpeg`:

```bash
ffmpeg -y -ss 1 -i <video> -frames:v 1 -vf scale=480:-1 -q:v 5 <video>.jpg
```

`ffmpeg` is optional: when it is missing, the gallery simply shows the
placeholder icon instead of a thumbnail.

---

## The desktop entry

`build/glowsnap.desktop` is used for the AppImage and for `install.sh`:

```ini
[Desktop Entry]
Type=Application
Name=Glowsnap
Exec=glowsnap
Icon=glowsnap
StartupWMClass=glowsnap
Categories=Graphics;Utility;
```

`StartupWMClass=glowsnap` matches the GTK `prgname` that `main.go` sets
through `linux.Options{ProgramName: "glowsnap"}`. If the two ever diverge, the
running window no longer matches the desktop entry and the taskbar shows a
generic icon.

The Flatpak variant (`packaging/io.github.libreglow.glowsnap.desktop`) uses the
app ID as the icon name and adds `GenericName` and `Keywords`.

---

## Troubleshooting portal problems

### "portal rejected the request with code 2"

1. Check that `xdg-desktop-portal` and a matching backend
   (`xdg-desktop-portal-gtk`, `xdg-desktop-portal-kde`, …) are installed.
2. Check that you are in a graphical session — a raw TTY has no portal.
3. Log out and back in; the portal is started per session.
4. Watch the logs:

   ```bash
   journalctl --user -f | grep -i portal
   ```

5. On Wayland, some compositors only accept the request from a window mapped
   on the same output.

### The capture is delayed or shows the GlowSnap window

- `HidePanelBeforeCapture` hides the window for 250 ms before the capture.
- `Capture delay` adds a configurable wait.
- Both are in **Settings → Screenshots**.
