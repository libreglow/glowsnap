# Settings Reference

Open the preferences panel with the **⚙** button in the palette. The window
shows the version, the two save directories, and a set of grouped sections.

Changes are applied and saved immediately — there is no "Save" button.

---

## General

| Setting | Default | Description |
| ------- | ------- | ----------- |
| **Confirm before deleting** | On | Ask for confirmation before removing a screenshot or recording from the gallery. |

---

## Screenshots

| Setting | Default | Description |
| ------- | ------- | ----------- |
| **Save location** | `~/Pictures/Screenshots` | Where new screenshots are stored. Pick the folder with the native file dialog. |
| **Filename pattern** | `screenshot_{date}` | The name of new files. `{date}` is replaced with a timestamp such as `2026-10-21_17-05-42`. Characters that are not allowed in file names are replaced automatically. |
| **Capture delay** | `0` s | Seconds to wait before the capture happens (0–60). |
| **Hide panel before screenshot** | On | Briefly hide the GlowSnap window before capturing so it does not appear in the image. |
| **Show mouse cursor** | On | Include the mouse pointer in the capture. |
| **Copy to clipboard** | Off | Also copy the captured image to the clipboard. |
| **Open after capture** | Off | Open the saved screenshot in your default image viewer. |
| **Notify on capture** | Off | Show a desktop notification (with a preview of the capture) after each screenshot. |

---

## Recording

| Setting | Default | Description |
| ------- | ------- | ----------- |
| **Save location** | `~/Videos/Screencasts` | Where new recordings are stored. |
| **Resolution** | `1080p` | Output size of new recordings. See [Screen recording](./recording.md). |
| **Custom size** | 1920 × 1080 | Only shown when the resolution is set to *Custom*. Both dimensions must be even numbers, between 16×16 and 3840×2160. |
| **System audio on by default** | On | Start new recordings with system audio enabled. |
| **Show mouse cursor** | On | Include the mouse pointer in screen recordings. |
| **Notify when recording ends** | Off | Show a notification when a recording finishes. |

---

## Microphone

| Setting | Default | Description |
| ------- | ------- | ----------- |
| **Default microphone** | *(system default)* | The device that will be used if you do not pick one when starting a recording. |
| **Enable microphone by default** | On | Start new recordings with the microphone enabled. |

---

## Editor

These are the defaults applied every time the editor opens.

| Setting | Default | Description |
| ------- | ------- | ----------- |
| **Default tool** | Select | The tool that is active when the editor opens. |
| **Default font** | Inter | Font family for new text shapes. |
| **Default font size** | 24 px | Size for new text. |
| **Default color** | `#ff3b30` | Fill/stroke color for new shapes. |
| **Default stroke width** | 3 px | Stroke width for new shapes. |
| **Default opacity** | 100% | Opacity applied to new shapes. |

---

## Shortcuts

Every shortcut can be rebound.

1. Click the shortcut you want to change — it turns red and shows *Press keys…*.
2. Press the new key combination.
3. The change is saved immediately.

Press `Escape` while recording to cancel without changing anything. Click the
**✕** next to a shortcut to restore its default.

The categories are **Palette**, **Tools**, **Editor** and **Application**. The
default bindings are listed in the [shortcut reference](./shortcuts.md).

---

## Advanced

| Setting | Default | Description |
| ------- | ------- | ----------- |
| **Verbose logging** | Off | Log extra diagnostic information to the console. Useful when reporting a bug. |

---

## Where the settings are stored

All settings live in a single JSON file:

```
~/.config/glowsnap/settings.json
```

The file is written atomically, so an interrupted write can never corrupt it.
Deleting it restores the defaults on the next start.
