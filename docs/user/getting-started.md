# Getting Started

## Installation

### Linux

GlowSnap is currently in active development and is distributed for Linux only.

A Flatpak release is coming soon:

```
Coming soon on Flathub
```

If you would rather try the development build right now, build it from source:

```bash
git clone https://github.com/libreglow/glowsnap.git
cd glowsnap
./scripts/build.sh
./scripts/install.sh
```

`install.sh` places the binary, the `.desktop` entry and the icon theme in
`~/.local` by default. Use `sudo PREFIX=/usr/local ./scripts/install.sh` for a
system-wide installation. See the
[developer guide](../developer/building.md) for the full build and packaging
instructions.

---

## The Palette

GlowSnap opens with a small, frameless, always-on-top palette floating above
your desktop. It is the entry point for everything.

<p align="center">
  <img src="../images/res.png" alt="GlowSnap palette">
</p>

| Button | What it does |
| ------ | ------------ |
| **Full Screen** | Captures the entire screen right away |
| **Select Area** | Captures the full screen and lets you drag out a region |
| **Record** | Opens the recording settings panel, then starts recording |
| **Studio** | Opens the screenshot gallery and editor |
| **⚙** | Opens the preferences panel |

The palette never steals focus from the application you are working in, and it
hides itself for a moment before taking a screenshot so it does not appear in
the capture.

---

## Your first screenshot

1. Open GlowSnap (the palette appears on your desktop).
2. Press **Select Area** or `Alt+2`, then drag a rectangle over the region you
   want. Move or resize the selection with the mouse if you need to.
3. Press `Enter` to capture, or `Esc` to cancel.
4. The capture is saved to your screenshot folder. Depending on your settings
   it is also copied to the clipboard, opened in your image viewer, and/or
   announced with a desktop notification.

To open an existing capture in the editor, click **Studio** and pick a
thumbnail.

---

## Where files are stored

| Kind | Default location |
| ---- | ---------------- |
| Screenshots | `~/Pictures/Screenshots` |
| Recordings | `~/Videos/Screencasts` (honours `XDG_VIDEOS_DIR`) |

Both locations are configurable in **Settings → Screenshots / Recording**. See
the [settings reference](./settings.md).

---

## Next steps

- [Features overview](./features.md) — what the app can do
- [Visual Editor](./editor.md) — annotate and export your captures
- [Screen recording](./recording.md) — record your desktop
- [Keyboard shortcuts](./shortcuts.md) — work faster from the keyboard
