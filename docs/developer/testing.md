# Testing

**The single documented command is `./test.sh`** — it runs the complete
validation and is exactly what CI runs, so local and CI cannot drift apart.

```bash
./test.sh              # frontend + backend
./test.sh frontend     # frontend only
./test.sh backend      # backend only
```

It delegates to two scripts that also work standalone:

| Script | Steps |
| ------ | ----- |
| `scripts/test-frontend.sh` | lint, `tsc` (app), `tsc` (tests), `vitest run`, `vite build` |
| `scripts/test-backend.sh` | `gofmt -l`, `go vet`, `go test` (uncached) |

---

## Where tests live

**All tests live in the top-level `tests/` folder**, not next to the source.
This includes helpers, fixtures, mocks, setup files and test configuration.
Never add a duplicate test file under `frontend/src` or `services/`.

```text
tests/
├── go.mod                     # the tests are their own Go module
├── backend/
│   ├── app_test.go            # symlink -> ../../tests/backend/app_test.go
│   └── services/<pkg>/*_test.go
└── frontend/
    ├── test-setup.ts
    ├── test-support/wails.ts  # shared Wails mocks
    ├── App.test.tsx
    ├── components/
    └── lib/
```

### Backend tests

Go requires a `_test.go` file to sit in the directory of the package it
covers, so each one is a **symlink** from its package directory into
`tests/backend/`:

```text
app_test.go              -> tests/backend/app_test.go
services/screenshot/*_test.go -> tests/backend/services/screenshot/screenshot_test.go
```

> Edit the file under `tests/backend/`, never the symlink. A lost target
> silently degrades to "no test files", so `test-backend.sh` fails fast on
> broken symlinks.

`tests/` is its own Go module (`tests/go.mod`) so the root module's `./...`
pattern does not try to compile the test sources as packages.

### Frontend tests

`tests/frontend/` holds the Vitest suites plus `test-setup.ts` and the shared
Wails mocks in `test-support/wails.ts`. `frontend/vitest.config.ts` points
`include` and `setupFiles` at that folder.

- Import app code with `@/…` and test helpers with `@tests/…`.
- Konva cannot render in jsdom, so `Canvas.test.tsx` mocks `react-konva`. That
  mock only applies because `frontend/vitest.config.ts` aliases `react-konva`
  to an absolute path — without it the bare specifier fails to resolve from
  `tests/frontend` and the real Konva loads.
- Test sources are type-checked by `frontend/tsconfig.test.json`
  (`npm run typecheck:test`), separate from `tsconfig.json`, which only covers
  `frontend/src`.

---

## Running the tests

```bash
# Everything
./test.sh

# Frontend only
./scripts/test-frontend.sh
cd frontend && npm test
cd frontend && npm run test:watch
cd frontend && npm run test:coverage

# Backend only
./scripts/test-backend.sh
go test -count=1 -tags webkit2_41 ./...
go test -tags webkit2_41 ./services/settings -run TestSupportedResolutions
```

Single frontend files and name filters work through Vitest:

```bash
cd frontend
npx vitest run ../tests/frontend/components/editor/Canvas.test.tsx
npx vitest run -t "screencast"
```

---

## What the scripts do

### `scripts/test-frontend.sh`

1. Checks that `node` and `npm` are available.
2. Runs `npm ci` if `frontend/node_modules` is missing.
3. **Lint** — skipped when no ESLint configuration exists. `npm run lint` is a
   placeholder today.
4. **Type check (app)** — `npm run typecheck`.
5. **Type check (tests)** — `npm run typecheck:test`.
6. **Tests** — `npm test`.
7. **Build** — `npm run build` (skip with `SKIP_BUILD=1`).

### `scripts/test-backend.sh`

1. Checks that `go` is available.
2. Fails fast on broken test symlinks.
3. **gofmt** — `gofmt -l .`, excluding `third_party/` (a vendored Wails
   module). This step is read-only; it never rewrites files.
4. **go vet** — `go vet -tags "$BUILD_TAGS" ./...`.
5. **go test** — `go test -count=1 -tags "$BUILD_TAGS" $GO_TEST_FLAGS ./...`.

Environment overrides:

| Variable | Effect |
| -------- | ------ |
| `SKIP_BUILD` | `1` skips the frontend production build |
| `SKIP_LINT` | `1` skips the frontend lint step |
| `BUILD_TAGS` | Backend build tags (default `webkit2_41`) |
| `GO_TEST_FLAGS` | Extra flags passed to `go test` |

---

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and every push to
`main`. It has two independent jobs that execute in parallel and each call the
very same script used locally:

| Job | Runs |
| --- | ---- |
| **Frontend** (TypeScript) | `./scripts/test-frontend.sh` |
| **Backend** (Go) | `./scripts/test-backend.sh` |

Because the scripts are the single source of truth for the validation commands,
local and CI behaviour cannot drift apart.

---

## Running everything in Docker

If you would rather not install the native toolchain locally, the `Dockerfile`
type-checks and tests both halves inside a container:

```bash
docker build -t glowsnap:build .                                  # build + test
docker build --target artifacts -o out/ .                         # export only the binary
docker run --rm glowsnap:builder ./scripts/test-backend.sh        # backend checks in the container
```

The container does **not** run the GUI and does not forward X11/Wayland, D-Bus
or audio.

---

## Writing new tests

### Backend

1. Create the file under `tests/backend/services/<pkg>/<name>_test.go`.
2. Symlink it into `services/<pkg>/`:

   ```bash
   ln -s ../../tests/backend/services/<pkg>/<name>_test.go \
         services/<pkg>/<name>_test.go
   ```

3. Write the test in the package of the code under test so unexported
   identifiers are reachable.

Services are designed to be testable without a desktop: the settings package
takes a config directory override, the screenshot service takes a `*dbus.Conn`,
and the screencast recorder exposes the pipeline as a pure function
(`buildPipelineArgs`) so it can be asserted without running GStreamer.

### Frontend

1. Create the file under `tests/frontend/<area>/<Name>.test.tsx`.
2. Mock the Wails bindings with the helpers in
   `tests/frontend/test-support/wails.ts`.
3. Use Testing Library (`render`, `screen`, `userEvent`) and assert on
   behaviour, not on implementation details.

---

## Do not invent commands

Do not invent test, build, lint or formatting commands; extend the scripts
instead so CI picks the change up.
