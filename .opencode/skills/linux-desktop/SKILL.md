---
name: linux-desktop
description: GlowSnap is Linux-only — the intentional Linux-native integrations (D-Bus portals, WebKitGTK, GTK, Wayland/X11, xdg-open, clipboard tools, unix.Statx) and the build/packaging tooling (scripts/, AppImage, Flatpak). Use before changing native integration, build, or packaging code.
---

# Linux Desktop Development for GlowSnap

## Purpose

Explain that GlowSnap is a Linux-only desktop app and document the native Linux
integrations and packaging that must not be replaced or abstracted away merely
for portability.

## When to use

- Working on D-Bus portal calls, windowing, clipboard, `xdg-open`, or file
  metadata.
- Changing build scripts, the Dockerfile, AppImage, or Flatpak packaging.
- Deciding whether to add cross-platform support (do not without an explicit
  request).

## Architecture / Context

GlowSnap relies on the Linux desktop stack; it is not portable and is not
intended to be:

- **D-Bus portals** — `org.freedesktop.portal.Screenshot` (capture) and
  `org.freedesktop.portal.ScreenRecorder` (recording) via `godbus/dbus/v5` in
  `services/screenshot` and `services/screencast`.
- **WebKitGTK 4.1 + GTK3** — Wails renders the frontend in a WebKitGTK window;
  these are required build/runtime libraries (see `scripts/install-deps.sh`).
- **Window/compositor** — Wayland and X11 behavior; `main.go` uses
  `WebviewGpuPolicy`, translucent window, and `--socket=wayland`/`fallback-x11`
  in the Flatpak manifest.
- **System tools** — `xdg-open` (open after capture),
  `wl-copy`/`xclip`/`xsel` (clipboard), `pactl` (audio), `gst-launch-1.0`
  (recording), `unix.Statx` (file birth time for sorting screenshots).
- **Build tag** — Go builds/tests use `webkit2_41` (or `webkit2gtk_4_1` in the
  Flatpak build), matching CI and `scripts/`.

### Packaging

- **Scripts** (`scripts/`): `dev.sh`, `build.sh` (frontend → `wails build`),
  `build-appimage.sh`, `release.sh`, `install.sh`, `clean.sh`,
  `install-deps.sh`. See `scripts/README.md`.
- **AppImage** — `build-appimage.sh` builds via `build.sh`, then packages the
  binary, icon, `.desktop`, and hicolor icon theme with `appimagetool` into
  `build/AppImage/`. `VERSION`/`RELEASE_TYPE` (stable|alpha|beta|nightly)
  control the artifact name.
- **Flatpak** — `packaging/io.github.libreglow.glowsnap.yml`: GNOME runtime,
  `--socket=wayland`/`fallback-x11`, `--talk-name=org.freedesktop.portal.Desktop`
  and `Notifications`, filesystem access to `xdg-pictures`/`xdg-videos`; builds
  with `GOFLAGS=-mod=vendor` and `wails build -tags webkit2gtk_4_1`.
- **Dockerfile** — reproducible Linux build + test container (install WebKitGTK
  4.1 deps, `npm ci`, frontend build, `go test -tags webkit2_41`). It only
  builds/tests; it does not run the GUI.

## Rules

- **Do not replace Linux-native integrations with cross-platform alternatives
  merely for portability** (e.g. no cross-platform screen-capture/clipboard
  libraries for the sake of supporting Windows/macOS).
- **Do not add Windows/macOS support unless explicitly requested.**
- Keep D-Bus portal/GTK/WebKitGTK/`xdg-open`/clipboard/`unix.Statx` as
  intentional dependencies.
- Do not assume a different desktop environment (GNOME/KDE/etc.) behaves a
  certain way unless the repository documents it.
- Require WebKitGTK 4.1 + GTK3 dev libraries to build locally; use
  `scripts/install-deps.sh --install` for supported distros.
- Preserve the `webkit2_41` tag across Go build/test commands.

## Workflow

1. Read `scripts/README.md` before touching build or packaging.
2. Keep native calls in `services/` (D-Bus, audio, gst-launch) and lifecycle in
  `app.go`.
3. For build changes, extend the relevant script/Dockerfile/Flatpak rather than
  duplicating build logic.
4. Validate Go with `go test -tags webkit2_41 ./...` and gofmt; frontend with
  `npm run build` in `frontend/`.

## Common mistakes

- Abstracting D-Bus/portal/clipboard/libx11 behind a portability layer.
- Adding OS-conditional code paths for non-Linux platforms.
- Forgetting the `webkit2_41` build tag.
- Building the app without installing WebKitGTK 4.1/GTK dev libraries.
- Duplicating build logic between scripts and packaging manifests.

## Validation

- Go toolchain requires `-tags webkit2_41`; verify `install-deps.sh` lists the
  needed packages.
- AppImage/Flatpak packaging steps match `scripts/` and `packaging/`.
- No cross-platform abstraction was introduced for portability's sake.