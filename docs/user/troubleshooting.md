# Troubleshooting

This page covers the problems users hit most often.

---

## "The portal rejected the request with code 2"

This is the most common screenshot error on Linux. It means the
`xdg-desktop-portal` implementation refused the capture request.

**Why it happens**

- The portal is not installed or is not running (common on minimal desktops and
  in nested sessions).
- The portal does not implement `org.freedesktop.portal.Screenshot` — some
  minimal portals only support screen recording.
- The request was made from a session the portal does not manage, for example
  a raw TTY, a nested X session or a container without the desktop portal
  service.
- The permission dialog was dismissed or denied.

**What to do**

1. Make sure `xdg-desktop-portal` is installed and the matching backend
   package is present (for example `xdg-desktop-portal-gtk` on GNOME and
   `xdg-desktop-portal-kde` on Plasma).
2. Make sure you are running inside a graphical session, not a plain TTY.
3. Log out and back in after installing a portal backend — the portal is
   started per session.
4. Check the portal logs for more detail:

   ```bash
   journalctl --user -f | grep -i portal
   ```

5. On Wayland, some compositors require the screenshot request to come from a
   window that is mapped on the same output. Try again with the GlowSnap
   palette focused.

---

## Nothing happens when I press the capture button

- The capture may have been delayed — check **Settings → Screenshots → Capture
  delay**.
- The portal permission dialog may be waiting behind another window.
- GlowSnap hides its own window before capturing; give it a moment.

---

## The screenshot is missing my mouse cursor

**Settings → Screenshots → Show mouse cursor** controls this. It is passed to
the portal as `include_cursor`, so some compositors ignore it and always draw
the pointer.

---

## The clipboard is empty after "Copy to clipboard"

GlowSnap copies the image using the first clipboard tool it finds on your
system, in this order:

1. `wl-copy` (Wayland)
2. `xclip` (X11)
3. `xsel` (X11)

Install one of them if none is present, for example:

```bash
sudo apt install wl-clipboard      # Debian / Ubuntu
sudo dnf install wl-clipboard      # Fedora
sudo pacman -S wl-clipboard        # Arch
```

> `wl-copy` only works on Wayland and `xclip`/`xsel` only on X11. Installing the
> wrong one for your session is the usual cause.

---

## "System audio is not supported"

System audio is captured through PulseAudio/PipeWire (`pactl`). The toggle is
disabled when:

- `pactl` is not installed (`pulseaudio-utils` on Debian/Ubuntu,
  `pulseaudio-utils` on Fedora, `libpulse` on Arch), or
- no monitor source exists for your default output device (you have no
  output device, or your sink is not running).

The message under the toggle tells you which of the two applies.

---

## No microphones are listed

The microphone list comes from `pactl list sources`. If it is empty:

- make sure `pactl` is installed,
- make sure your microphone is not exclusively owned by another application
  (for example a conferencing app),
- check `pactl list sources` in a terminal to see what PulseAudio reports.

---

## The recording has no sound

- Check the **Mic** and **System** buttons on the recording bar — a muted
  source stays silent for the rest of the recording.
- Verify the device you picked in the recording settings.
- Some browsers and applications play audio through a null sink; the monitor
  of a null sink is silence.

---

## Recordings are larger or smaller than expected

Recordings are always scaled to the configured resolution. Pick a smaller
preset, or a custom size, in **Settings → Recording → Resolution**.

---

## The palette does not appear

- The palette is always on top but it is still a normal window — check your
  window manager's workspace rules.
- If the app was started from a terminal, look at the terminal output for
  errors.
- On Wayland, some compositors require the window to be explicitly focused
  before it can be shown.

---

## The editor feels slow with very large screenshots

The editor keeps the whole image in memory as a canvas. Very large captures
(e.g. 4K or multi-monitor full-desktop shots) use considerably more memory.
Cropping the image first reduces the size a lot.

---

## Still stuck?

- Turn on **Settings → Advanced → Verbose logging** and watch the console
  output for extra diagnostics.
- Search the [issue tracker](https://github.com/libreglow/glowsnap/issues) —
  many portal problems are already documented there.
- When reporting a problem, include your distribution, desktop environment,
  session type (Wayland or X11) and the exact error message.
