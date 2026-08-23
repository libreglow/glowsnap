---
name: glowsnap-settings
description: GlowSnap's settings system — the settings structs, defaults, normalization, atomic JSON persistence at ~/.config/glowsnap/settings.json, and how to add a new setting safely through the existing mechanism. Use when adding or changing a user-configurable option.
---

# GlowSnap Settings

## Purpose

Document how GlowSnap stores and loads configuration so agents add new settings
through the existing system rather than introducing a second persistence
mechanism.

## When to use

- Adding a new user-configurable option (screenshot, recording, editor,
  advanced, shortcuts).
- Modifying `services/settings/settings.go` or the settings UI components
  (`frontend/src/components/SettingsPanel.tsx`,
  `frontend/src/components/settings/`).
- Changing defaults, load/save behavior, or settings normalization.

## Architecture / Context

Settings are a plain-Go `services/settings` package (no Wails) persisted to
`~/.config/glowsnap/settings.json`. Load and save are triggered from `app.go`
via the generated bindings `GetSettings` / `UpdateSettings` / `ResetSettings`
(and shortcut/mic/recording-default helpers).

### Structure

- `Settings` (in `settings.go`) groups sub-structs: `General`, `Screenshot`,
  `Recording`, `Editor`, `Advanced`, `Shortcuts`, plus a
  `CustomShortcuts map[string]string`.
- JSON tags are camelCase and match the frontend-facing shape
  (e.g. `Screenshot.SaveDir` ↔ `"saveDir"`). The Go struct is the source of
  truth; the frontend `AppSettings` type re-exports it from
  `frontend/wailsjs/go/models`.
- `Defaults()` returns a fully-populated set of default values.
  `DefaultScreenshotSaveDir()` / `DefaultRecordingSaveDir()` derive paths from
  `$HOME` (and XDG user dirs for videos).

### Load, merge, normalize, save

- `Load()`: reads the file; on any error returns `Defaults()`. Otherwise it
  unmarshals, runs `mergeDefaults` (fills any missing group/key from defaults),
  backports a legacy `microphone` top-level field, then `normalize`.
- `Save(s)`: `normalize`, `json.MarshalIndent`, writes to `<path>.tmp`, then
  `os.Rename(tmp, path)` (atomic replace). `ResetToDefaults` removes the file.
- `normalize()` clamps ranges (e.g. delay 0–60, font size 4–200, stroke width
  1–50, opacity 0–1), resolves `~`/relative save dirs via `normalizeDir`, and
  validates choices like recording `quality` (`low|medium|high`).

### Frontend

`SettingsPanel.tsx` and `src/components/settings/` render sections bound to
these fields and call `UpdateSettings` to persist. Shortcuts use
`src/lib/shortcut.ts` and are stored via the `Shortcuts`/`CustomShortcuts`
groups.

## Rules

- **Do not introduce a second settings system.** All app configuration lives in
  this JSON file via `services/settings`.
- Fields are camelCase in JSON and defined in the `Settings` Go struct; keep
  frontend types and struct tags in sync.
- Set sensible defaults in `Defaults()` and preserve the defaults-merge +
  normalization so old/corrupt files still produce valid settings.
- Prefer narrowing delegated: put file I/O and normalization in
  `services/settings`; call it from `app.go`. Do not parse JSON in `app.go`.

## How to add a new setting safely

1. Add a field to the relevant sub-struct in `settings.go`, with a `json:`
   camelCase tag, and set a safe default in `Defaults()`.
2. Add normalization for it in `normalize()` (range/clamp or
   fallback-to-default) so `UpdateSettings` cannot persist invalid values.
3. If it must be preserved through `mergeDefaults` (new field on an existing
   struct), it’s covered automatically since missing keys fall back to
   defaults; keep the merge logic consistent.
4. Expose it to the UI via the existing `GetSettings`/`UpdateSettings` bindings
   (no new binding needed for a plain field); add a control in the appropriate
   settings section.
5. Add a setter convenience only if the field needs its own app.go method (rare;
   e.g. recording defaults got `SaveRecordingDefaults`).

## Workflow

1. Read `services/settings/settings.go` and the relevant settings panel.
2. Update the Go struct, `Defaults()`, and `normalize()`.
3. Update the frontend settings UI/type if the value is surfaced.
4. Validate with `go test -tags webkit2_41 ./...`, `gofmt -l .`, and `npm run
   build` (in `frontend/`).

## Common mistakes

- Creating a new config file or DB instead of extending the existing system.
- Storing settings in `app.go` state without persisting to JSON.
- Not clamping/normalizing values, so invalid inputs persist.
- Changing the on-disk JSON shape without updating `mergeDefaults`/frontend
  types, breaking existing user configs.
- Adding a Wails binding when `GetSettings`/`UpdateSettings` already cover the
  field.

## Validation

- After change, `Load()` returns valid settings for a missing, empty, or
  legacy-config file.
- `Save()` writes atomically (tmp + rename) with proper JSON.
- Ranges are enforced by `normalize()`.
- `npm run build` passes and `gofmt -l .` is empty.