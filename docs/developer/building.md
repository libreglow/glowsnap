# Building & Releasing

## Build the application

```bash
./scripts/build.sh
```

The script builds the frontend first and then the Wails backend:

```bash
cd frontend && npm run build          # -> frontend/dist
wails build -tags webkit2_41 -clean -trimpath \
  -ldflags "-X main.appVersion=$VERSION"
```

The result is `build/bin/glowsnap`.

> The frontend **must** be built before the Go binary: `main.go` embeds
> `frontend/dist` with `//go:embed all:frontend/dist`.

Set the version string through the environment:

```bash
VERSION=1.2.0 ./scripts/build.sh
```

---

## Build in Docker

The `Dockerfile` provides a reproducible build environment.

```bash
# Build the binary and run the test suite
docker build -t glowsnap:build .

# Export only the binary
docker build --target artifacts -o out/ .
./out/glowsnap --version

# Run the backend checks in the container
docker build --target builder -t glowsnap:builder .
docker run --rm glowsnap:builder go test -tags webkit2_41 ./...

# Custom version string
docker build --build-arg VERSION=1.1.0 -t glowsnap:build .
```

Stages:

| Stage | What it does |
| ----- | ------------ |
| `frontend` | `npm ci`, type-check, test and build the frontend into `/app/dist` |
| `builder` | Installs the GTK/WebKitGTK toolchain, copies the sources, runs the backend checks and compiles the binary |
| `artifacts` | A `scratch` image containing only `/glowsnap` |

> The binary is reproducible but **not** portable across distributions: it
> links dynamically against GTK/WebKitGTK. Use the AppImage for a
> self-contained artifact.

---

## Package as an AppImage

```bash
./scripts/build-appimage.sh

# With a version and a release channel
VERSION=1.2.0 RELEASE_TYPE=stable ./scripts/build-appimage.sh
```

`RELEASE_TYPE` must be one of `stable`, `alpha`, `beta` or `nightly`.

The script delegates to `build.sh`, assembles an AppDir and packages it with
`appimagetool` (downloaded automatically on the first run):

```text
glowsnap.AppDir/
├── AppRun
├── glowsnap.desktop
├── glowsnap.png
└── usr/
    ├── bin/glowsnap
    └── share/icons/hicolor/<size>/apps/glowsnap.png
```

The artifact lands in `build/AppImage/` and is named:

```text
Glowsnap-<VERSION>-<RELEASE_TYPE>-x86_64.AppImage
Glowsnap-x86_64.AppImage            # when no VERSION is given
```

---

## Install into your desktop environment

```bash
./scripts/build.sh
./scripts/install.sh                          # user-local (~/.local)
sudo PREFIX=/usr/local ./scripts/install.sh   # system-wide
```

The script installs:

| Artefact | Destination (with the default `PREFIX=$HOME/.local`) |
| -------- | ----------------------------------------------------- |
| `build/bin/glowsnap` | `$PREFIX/bin/glowsnap` |
| `build/glowsnap.desktop` | `$PREFIX/share/applications/glowsnap.desktop` |
| `build/icons/hicolor/*` | `$PREFIX/share/icons/hicolor/` |

It also refreshes the icon and desktop caches when `gtk-update-icon-cache` and
`update-desktop-database` are available.

---

## Prepare a release

```bash
./scripts/release.sh v1.2.0 stable
```

This builds the app and the AppImage, then collects the artefacts:

```text
release/1.2.0/
├── GlowSnap-1.2.0-stable-x86_64.AppImage
├── glowsnap-1.2.0-stable-linux-amd64
└── SHA256SUMS
```

Nothing is pushed to GitHub — the script only prepares the directory.

---

## The GitHub release pipeline

`.github/workflows/release.yml` runs on tags matching `v*`:

1. Installs the dependencies, Go, Node and the Wails CLI.
2. Derives the release channel from the tag name (`-alpha`, `-beta`,
   `-nightly`, otherwise `stable`).
3. Runs `./scripts/release.sh <tag> <channel>`.
4. Publishes the AppImage, the raw binary and `SHA256SUMS` as a GitHub
   release, marking pre-releases as such.
5. Posts a message to Discord.

---

## Flatpak

`packaging/io.github.libreglow.glowsnap.yml` is a Flatpak manifest:

| Field | Value |
| ----- | ----- |
| App ID | `io.github.libreglow.glowsnap` |
| Runtime | `org.gnome.Platform` 50 |
| SDK | `org.gnome.Sdk` |
| SDK extensions | `org.freedesktop.Sdk.Extension.golang`, `org.freedesktop.Sdk.Extension.node22` |

Finish arguments:

```text
--share=ipc --socket=wayland --socket=fallback-x11 --device=dri
--share=network
--talk-name=org.freedesktop.portal.Desktop
--talk-name=org.freedesktop.Notifications
--filesystem=xdg-pictures --filesystem=xdg-videos
```

The two portal permissions are what make capture and notifications work inside
the sandbox.

Build it with `flatpak-builder`:

```bash
flatpak-builder --user --install --force-clean build-dir \
  packaging/io.github.libreglow.glowsnap.yml
flatpak run io.github.libreglow.glowsnap
```

> **Known inconsistency:** the manifest builds with the tag
> `webkit2gtk_4_1`, while every script and the Dockerfile use `webkit2_41`.
> It also assumes a vendored module tree (`GOFLAGS=-mod=vendor`) that the
> repository does not contain — the repository uses a `replace` directive
> pointing at `third_party/wails`. Fix the manifest before relying on it.

---

## Clean up

```bash
./scripts/clean.sh
```

Removes `build/bin`, `build/AppImage`, `frontend/dist`, the temporary
`glowsnap.AppDir` / `squashfs-root` directories and the local `release/`
output. Source files are never touched.

---

## Versioning

| Variable | Meaning |
| -------- | ------- |
| `VERSION` | Any string, e.g. `1.2.0` or `v1.2.0`. A leading `v` is stripped from generated file names. Passed to Go as `-ldflags "-X main.appVersion=$VERSION"` |
| `RELEASE_TYPE` | `stable` (default), `alpha`, `beta` or `nightly` |

The version is exposed to the frontend through `App.GetAppVersion()` and shown
in **Settings → About**.
