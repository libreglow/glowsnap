# Getting Started

## Prerequisites

| Tool | Version | Notes |
| ---- | ------- | ----- |
| **Go** | `go.mod` declares `go 1.26.0` | https://go.dev/dl/ |
| **Node.js + npm** | Node 22+ | https://nodejs.org |
| **Wails CLI** | `v2.13.0` to match `go.mod` | `go install github.com/wailsapp/wails/v2/cmd/wails@v2.13.0` |
| **WebKitGTK 4.1 + GTK3 dev** | distro packages | installed by `./scripts/install-deps.sh --install` |
| **GStreamer** | 1.x with `openh264enc`, `avenc_aac`, `mp4mux` | only needed for screen recording |
| **ffmpeg** | any recent version | only needed for recording thumbnails |
| **PulseAudio / PipeWire** | with `pactl` | only needed for microphone and system audio |
| **xdg-desktop-portal** | plus a backend (GTK/KDE) | required for every capture |

> The `webkit2_41` build tag is mandatory — Wails needs the WebKitGTK 4.1 API.
> Omitting it fails to compile.

---

## Install the system dependencies

```bash
# Report what is needed (non-destructive, the default)
./scripts/install-deps.sh

# Actually install for the detected distro
./scripts/install-deps.sh --install
```

Supported distros for `--install`: Debian/Ubuntu, Fedora/RHEL/CentOS/Rocky/Alma,
Arch/Manjaro. The script installs the GTK3, WebKitGTK 4.1, AppIndicator, librsvg
and Wayland development packages plus `patchelf`.

On Debian/Ubuntu that is:

```bash
sudo apt-get install -y build-essential libgtk-3-dev libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev librsvg2-dev libwayland-dev patchelf
```

---

## Get the source and the dependencies

```bash
git clone https://github.com/libreglow/glowsnap.git
cd glowsnap

# Frontend dependencies (npm is canonical; package-lock.json is authoritative)
cd frontend && npm ci && cd ..

# Go dependencies
go mod download
```

> The repository vendors a patched Wails fork through a `replace` directive:
>
> ```
> replace github.com/wailsapp/wails/v2 => ./third_party/wails
> ```
>
> Do not remove it and do not run `go mod tidy` blindly — the fork is part of
> the build.

---

## Run the development environment

```bash
./scripts/dev.sh
```

This runs `wails dev -tags webkit2_41`:

- Vite serves the frontend with hot module replacement,
- the Go backend is recompiled and restarted on change,
- the Wails runtime bridge (`window.go`, `runtime`) is injected.

Run `wails dev` directly if you prefer; just remember the build tag.

---

## The development loop

1. **Frontend change** — edit `frontend/src/**`. The browser reloads
   automatically. Types are checked with `npm run typecheck`.
2. **Backend change** — edit `app.go` or `services/**`. The Go binary restarts
   automatically.
3. **New backend method** — add it to `app.go`, let Wails regenerate
   `frontend/wailsjs/go/main/App.*`, then use it from the frontend. Never
   hand-write a binding.
4. **Validate** — run `./test.sh` before you open a pull request.

---

## Useful commands

```bash
# Full validation (exactly what CI runs)
./test.sh
./test.sh frontend
./test.sh backend

# Frontend only, from frontend/
npm run typecheck        # tsc --noEmit (app sources)
npm run typecheck:test   # tsc -p tsconfig.test.json (test sources)
npm test                 # vitest run
npm run test:watch
npm run test:coverage
npm run build            # tsc && vite build

# Backend only, from the root
gofmt -l .                                  # must print nothing
go vet -tags webkit2_41 ./...
go test -count=1 -tags webkit2_41 ./...

# One package or one test
go test -tags webkit2_41 ./services/settings -run TestSupportedResolutions
```

---

## Adding a setting end to end

The settings system is centralised, so a new option touches three files:

1. **`services/settings/settings.go`** — add the field to the relevant struct,
   add the default in `Defaults()`, merge it in `mergeDefaults()` and clamp it
   in `normalize()`.
2. **`frontend/src/components/settings/sections.tsx`** — add a row to the
   matching section component.
3. **`frontend/src/types/types.ts`** — extend the TypeScript type if the shape
   changed.

The Wails model types are generated from the Go structs, so the frontend type
mirrors the Go one.

---

## Troubleshooting the dev environment

| Symptom | Fix |
| ------- | --- |
| `undefined: runtime.EventsOn` | The Wails bindings are stale — rebuild with `wails dev` so `frontend/wailsjs` is regenerated |
| `pkg-config` cannot find `webkit2gtk-4.1` | Install the WebKitGTK 4.1 development package |
| The build fails without a tag | Always build with `-tags webkit2_41` |
| `go: github.com/wailsapp/wails/v2@v2.13.0: missing go.sum entry` | The `replace` directive was removed — restore it |
| Portals reject the capture | See [Linux integration](./linux-integration.md) |
