# Screen Recording

GlowSnap records your screen through the `xdg-desktop-portal` ScreenCast
interface, so it works on Wayland and X11 alike and respects the permissions
your desktop has granted.

---

## Starting a recording

1. Click **Record** in the palette (or press `Alt+3`).
2. The **Recording Settings** panel opens with the options for this recording.
3. Press **Start Recording**.

The panel shows:

| Option | Notes |
| ------ | ----- |
| **Record Microphone** | Off by default only if you turned it off in the settings. When more than one input device is present you must pick one before you can start. |
| **Record System Audio** | Captures the monitor of your default output device. Greyed out with an explanation when system audio is not available. |
| **Show Mouse Cursor** | Draws the pointer into the recording. |
| **Save Location** | Where the file will be written. |
| **Output Format** | Always MP4. |
| **Resolution** | The preset or custom size that will be used. |

The desktop's own source picker may appear first — that is the portal asking
which screen or window to record. Choose one and continue.

---

## While recording

The palette is replaced by a compact recording bar:

| Element | Action |
| ------- | ------ |
| **Timer** | Elapsed time, `MM:SS` |
| **⏸ / ▶** | Pause and resume the recording |
| **■** | Stop and save the recording |
| **✕** | Cancel the recording (the file is deleted) |
| **Mic** | Mute/unmute the microphone without stopping |
| **System** | Mute/unmute system audio without stopping |

Muting is applied live — the audio track keeps running but goes silent.

When you stop, GlowSnap returns to the palette. If **Notify when recording
ends** is enabled in the settings, a desktop notification is shown.

---

## Output

| Property | Value |
| -------- | ----- |
| Container | MP4 |
| Video | H.264 |
| Audio | AAC |
| File name | `screencast_<YYYY-MM-DD_HH-MM-SS>.mp4` |
| Default folder | `~/Videos/Screencasts` (honours `XDG_VIDEOS_DIR`) |

---

## Resolution

Pick a preset in **Settings → Recording → Resolution**:

| Preset | Size |
| ------ | ---- |
| 360p | 640 × 360 |
| 480p | 854 × 480 |
| 720p | 1280 × 720 |
| 1080p (default) | 1920 × 1080 |
| 1440p | 2560 × 1440 |
| 2160p (4K) | 3840 × 2160 |
| Custom | any even size between 16×16 and 3840×2160 |

Recordings are scaled to the chosen size with letterboxing so nothing is
distorted.

---

## Audio sources

GlowSnap uses PulseAudio/PipeWire through `pactl`:

- **Microphone** — any capture source that is not a monitor source.
- **System audio** — the `.monitor` source of your default sink, i.e. exactly
  what you hear.

If system audio is unavailable (no `pactl`, or no monitor source for the
default output), the toggle is disabled and the reason is shown underneath it.

---

## Reviewing your recordings

Open **Studio** and switch to the **Record** tab. There you can:

- browse all recordings in your recordings folder,
- search and sort them,
- star them as favourites,
- rename them (the thumbnail follows the rename),
- delete them,
- play them in the built-in video player.

Thumbnails are generated automatically in the background the first time a
recording is listed, so the grid fills in shortly after opening the tab.
