---
name: glowsnap-screenshot
description: How GlowSnap captures and processes screenshots, including the org.freedesktop.portal.Screenshot D-Bus flow, full/area capture, the area-crop overlay, cursor behavior, saving, and serving images to the frontend. Use when working on screenshot capture, the area-select overlay, or screenshot file handling.
---

# GlowSnap Screenshot

## Purpose

Document the actual screenshot pipeline in GlowSnap so changes to capture,
cropping, saving, or image serving preserve the existing D-Bus portal
architecture.

## When to use

- Modifying `services/screenshot/screenshot.go`.
- Working on area selection, the capture overlay, or post-capture options.
- Changing screenshot filenames, save directories, or how images load in the
  frontend (gallery/editor).

## Architecture / Context

Capture lives in the plain-Go `services/screenshot` package (no Wails). It
talks to the **org.freedesktop.portal.Screenshot** portal over D-Bus.

### Capture flow (`screenshot.go`)

- `Service` holds a `*dbus.Conn`. `commonCapture(interactive bool)` drives
  both full and area capture:
  1. Resolve the save dir via `settings.Load().ScreenshotSaveDir()` and create
     it.
  2. Build a destination filename with `buildScreenshotName(pattern)` (default
     `screenshot_{date}`; `{date}` is `2006-01-02_15-04-05`; illegal chars are
     sanitized).
  3. Call `org.freedesktop.portal.Screenshot.Screenshot` with options:
     `handle_token`, `interactive`, and `include_cursor`
     (`settings…ShowMouseByDefault`).
  4. Add a D-Bus match rule, wait for the portal `Response` signal (30s
     timeout), and reject on non-zero response codes.
  5. Parse the returned `file://` URI, then `os.Rename` (or copy) it into the
     save dir.
- `CaptureFullScreen()` → `commonCapture(false)`.
- `CaptureArea()` → `commonCapture(true)` (interactive, portal UI selection).
- `CropRegion(path, x, y, width, height)` decodes the image, intersects the
  requested rect with the image bounds, `SubImage`s (or draws) the region, and
  re-encodes as PNG in place.

### Area selection overlay (frontend)

- `App.StartPaletteAreaCapture()` captures the full screen, stores the path
  under `overlayMu`, and returns an image URL served by the loopback HTTP
  server. The frontend switches to `overlay` mode (`App.tsx`), which renders
  `components/Overlay.tsx`.
- On selection, `App.CompletePaletteAreaScreenshot(x, y, width, height)` crops
  via `CaptureRegion` and post-processes. `CancelPaletteAreaCapture()` deletes
  the temp file.

### Post-capture options (`app.go`)

`postProcessCapture` applies settings: copy to clipboard (`wl-copy`/`xclip`/
`xsel`), `xdg-open` the file, and/or send a notification.

### Serving images to the frontend

`App.startup` starts a loopback `127.0.0.1` HTTP server rooted at the save dir.
The frontend calls `GetScreenshotsBaseURL()` and loads images from
`<baseUrl>/<filename>`. `ListScreenshots`/`RenameScreenshot`/`DeleteScreenshot`
in `app.go` operate on files in that directory; sorting uses file birth time
via `unix.Statx` (falling back to mtime).

## Rules

- Keep D-Bus portal usage in `services/screenshot`; `app.go` only orchestrates
  and reacts.
- Reuse `settings.Load()` for options and save path; do not hardcode paths.
- Preserve the portal `Response` signal wait + timeout handling.
- Cursor visibility is driven by `include_cursor` (screenshots) — do not
  reimplement via recording cursor modes.
- The frontend must keep serving image URLs from the loopback server; do not
  replace it with embedded base64 blobs without a clear reason.

## Workflow

1. Read `services/screenshot/screenshot.go` and the relevant `app.go` handlers.
2. Place capture/transform logic in `services/screenshot`; expose only thin
  orchestration via `app.go`.
3. For new capture options, add fields to `settings.Screenshot` and read them
  via `settings.Load()`.
4. Validate with `go test -tags webkit2_41 ./...` and `npm run build` (in
  `frontend/`) after frontend changes.

## Common mistakes

- Reaching into the portal from `app.go` (belongs in the service).
- Hardcoding the screenshots directory instead of `ScreenshotSaveDir()`.
- Breaking legal-filename sanitation in `buildScreenshotName`.
- Forgetting the 30s portal response timeout / match-rule cleanup.
- Assuming multi-monitor or Wayland coords without verifying the portal's
  returned image dimensions.

## Validation

- Full and area capture produce files in the configured save dir.
- Area capture crops the correct region relative to image bounds.
- Overlay cancel removes the temp file; complete persists the crop.
- `gofmt -l .` empty and Go package tests compile.