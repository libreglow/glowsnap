# Developer Scripts

A small set of local development and maintenance scripts for developers working
on GlowSnap (Wails + Go backend + React/TypeScript frontend + Linux AppImage
packaging).

All scripts assume they are run from anywhere in the repository - they resolve
the project root themselves. They never modify application source code.

---

## Scripts overview

| Script              | Purpose                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| `dev.sh`            | Start the Wails development environment (Vite HMR + Go hot reload).    |
| `build.sh`          | Build the production application (`build/bin/glowsnap`).               |
| `build-appimage.sh` | Build the app and package it into a Linux AppImage.                    |
| `release.sh`        | Build app + AppImage and collect artifacts under `release/<version>/`. |
| `install.sh`        | Install binary + `.desktop` + hicolor icons into the desktop env.      |
| `clean.sh`          | Remove generated build artifacts and temporary files.                  |
| `install-deps.sh`   | Detect the OS and report/install required dependencies.                |
| `test-frontend.sh`  | Validate the frontend: lint, typecheck, Vitest, production build.      |
| `test-backend.sh`   | Validate the backend: `gofmt`, `go vet`, `go test`.                    |

---

## Usage

### Development

```bash
./scripts/dev.sh
```

Starts `wails dev -tags webkit2_41`. Vite serves the frontend with hot reload
and the Go backend recompiles on changes.

### Build the production app

```bash
./scripts/build.sh
```

Builds the React/TypeScript frontend and then the Wails backend, producing
`build/bin/glowsnap`.

### Build the Linux AppImage

```bash
./scripts/build-appimage.sh
# or with a version / release channel:
VERSION=1.0.0 RELEASE_TYPE=stable ./scripts/build-appimage.sh
```

Delegates the app build to `build.sh`, then packages the binary, icon and a
generated `.desktop` file into an AppImage in `build/AppImage/`. When `VERSION`
is set the artifact is named `Glowsnap-<VERSION>-<RELEASE_TYPE>-x86_64.AppImage`
and the version is written into the `.desktop` entry.

The AppImage is built from the repository's `build/glowsnap.desktop` entry and
`build/icons/hicolor` icon theme, so the packaged layout is:

```
glowsnap.AppDir/
├── AppRun
├── glowsnap.desktop     (Icon=glowsnap, StartupWMClass=glowsnap)
├── glowsnap.png         (512px, used by the AppImage runtime)
└── usr/
    └── share/
        └── icons/
            └── hicolor/
                ├── 16x16/apps/glowsnap.png
                ├── 32x32/apps/glowsnap.png
                ├── ...
                └── 512x512/apps/glowsnap.png
```

### Install into the desktop environment

```bash
./scripts/build.sh
./scripts/install.sh                       # user-local (~/.local)
sudo PREFIX=/usr/local ./scripts/install.sh  # system-wide
```

Installs the binary, `glowsnap.desktop` and the hicolor icon theme so desktop
environments (KDE Plasma, GNOME, ...) show the correct icon in the taskbar and
application launcher and associate the running window with the `glowsnap.desktop`
entry.

The script never touches icon caches. If newly installed icons are not picked up,
refresh the cache manually (or log out and back in), e.g.:

```bash
gtk-update-icon-cache -f ~/.local/share/icons/hicolor
```

### Prepare a local release

```bash
./scripts/release.sh v1.0.0 stable
./scripts/release.sh 1.2.0 beta
```

Builds the app and AppImage, then copies the artifacts into
`release/<version>/`:

```
release/1.0.0/
├── GlowSnap-1.0.0-stable-x86_64.AppImage
├── glowsnap-1.0.0-stable-linux-amd64
└── SHA256SUMS
```

`SHA256SUMS` contains checksums for the two artifacts. Nothing is pushed to
GitHub.

### Clean generated files

```bash
./scripts/clean.sh
```

Removes `build/bin`, `build/AppImage`, `frontend/dist`, the temporary
`glowsnap.AppDir` / `squashfs-root` directories, and local `release/` output.
Source files are never touched. The downloaded `appimagetool-x86_64.AppImage`
is kept so it is not re-downloaded on the next build.

### Run the test suite

The complete validation for the project runs from the repository root:

```bash
./test.sh              # frontend + backend
./test.sh frontend     # frontend only
./test.sh backend      # backend only
```

`./test.sh` is a thin orchestrator; both halves also run standalone and are the
exact scripts GitHub Actions calls (one job each, running in parallel):

```bash
./scripts/test-frontend.sh   # lint, tsc (app), tsc (tests), vitest run, vite build
./scripts/test-backend.sh    # gofmt -l, go vet -tags webkit2_41 ./..., go test
```

All test sources live in `tests/` (`tests/frontend`, `tests/backend`); see the
Testing section of the README for the layout and the standalone `npm`/`go`
commands.

Environment overrides:

| Variable    | Effect                                              |
| ----------- | --------------------------------------------------- |
| `SKIP_BUILD` | `1` skips the frontend production build.            |
| `SKIP_LINT`  | `1` skips the frontend lint step.                   |
| `BUILD_TAGS` | Backend build tags (default `webkit2_41`).          |

### Install dependencies

```bash
./scripts/install-deps.sh            # report only (default, non-destructive)
./scripts/install-deps.sh --install  # install for the detected distro
```

By default it detects the OS (`/etc/os-release`) and prints the exact packages
and commands to copy/paste. Nothing is installed unless `--install` is passed,
and `--install` is only supported on recognized Debian/Ubuntu, Fedora/RHEL, and
Arch distros.

---

## Required dependencies

- **Go** (1.25+) - backend language. See https://go.dev/dl/
- **Wails CLI** - desktop framework CLI:
  `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- **Node.js + npm** - frontend build tooling. See https://nodejs.org
- **WebKitGTK 4.1 + GTK3 dev libraries** - system libraries Wails links against.
  `install-deps.sh` lists the exact package names for your distro.
- **appimagetool** - AppImage packaging (downloaded automatically by
  `build-appimage.sh`; the repo also ships `appimagetool-x86_64.AppImage`).

Verify the toolchain with:

```bash
go version && node --version && npm --version && wails version
```

---

## Conventions

- Each script starts with `set -euo pipefail`, resolves the repo root from its
  own location, and exits with a clear error message on failure.
- Scripts are executable (`chmod +x`).
- `dev.sh` / `build.sh` do **not** run `go mod tidy` - existing dependency
  state is used as-is.

## Version / release-type values

- `VERSION`: any string, e.g. `1.0.0` or `v1.0.0` (a leading `v` is stripped
  from generated filenames).
- `RELEASE_TYPE`: one of `stable`, `alpha`, `beta`, `nightly` (default `stable`).
