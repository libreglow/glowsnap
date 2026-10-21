# Contributing

Thanks for your interest in improving GlowSnap! This page describes the
day-to-day workflow. The canonical, shorter version lives in
[`CONTRIBUTING.md`](../../CONTRIBUTING.md) at the repository root.

---

## The workflow

1. **Fork and clone**

   ```bash
   git clone https://github.com/YOUR_USERNAME/glowsnap.git
   cd glowsnap
   ```

2. **Install the dependencies**

   ```bash
   ./scripts/install-deps.sh --install
   cd frontend && npm ci && cd ..
   go mod download
   ```

3. **Create a branch**

   ```bash
   git checkout -b feature/my-feature
   ```

4. **Make your changes** — see the layer rules below.

5. **Validate**

   ```bash
   ./test.sh
   ```

   This is exactly what CI runs, so a green local run means a green pull
   request.

6. **Commit with a conventional message**

   ```bash
   git commit -m "feat: add new feature"
   ```

7. **Push and open a pull request**

   ```bash
   git push origin feature/my-feature
   ```

---

## Commit style

The project uses [conventional commits](https://www.conventionalcommits.org/):

```text
feat: add new feature
fix: fix screenshot bug
refactor: improve code structure
docs: update documentation
```

---

## Code guidelines

- Keep the code simple and readable.
- Follow the existing project patterns instead of introducing new ones.
- Avoid unnecessary dependencies.
- Test your changes before submitting (`./test.sh`).
- Put new tests under `tests/`, not next to the source they cover.
- Write clear commit messages.

### Layer rules

These come from [`AGENTS.md`](../../AGENTS.md) and are not negotiable:

| Rule | Why |
| ---- | --- |
| `app.go` stays a bridge | It orchestrates; it does not accumulate business logic |
| Reusable logic goes in `services/` | Keeps the services testable and reusable |
| `services/` must not import Wails | The services must stay plain Go |
| Do not duplicate service functionality in `app.go` | One implementation, one place to change |
| Add an `App` method only when the frontend needs it | Every method becomes a public binding |
| Never hand-edit `frontend/wailsjs` | The bindings are generated from `app.go` |
| Do not add a global state store | The frontend uses local state and hooks |
| Keep the Linux-native integrations | Portability is not a goal |

---

## Frontend conventions

- Feature folders under `src/components/` (`editor/`, `settings/`, …) plus
  shared primitives in `src/components/ui/`.
- Reusable logic goes into custom hooks in `src/lib/hooks/`.
- Types are centralised in `src/types/types.ts`.
- Primitives use `cva` plus `cn()` from `src/lib/utils.ts`.
- Import generated functions from `frontend/wailsjs/go/main/App` and runtime
  helpers from `frontend/wailsjs/runtime/runtime`.

---

## Backend conventions

- `services/` packages are plain Go and must not depend on the Wails runtime.
- Return `(value, error)` and log failures with `runtime.LogInfo` /
  `runtime.LogError` (Wails layer only).
- Use `sync.Mutex` in `app.go` and the channel semaphore pattern in
  `services/screencast`.
- Reuse the existing settings system; do not introduce a second persistence
  mechanism.

---

## Tests

- Backend tests live in `tests/backend/` and are symlinked into their package
  directory. Edit the file under `tests/backend/`, never the symlink.
- Frontend tests live in `tests/frontend/` and are picked up by
  `frontend/vitest.config.ts`.
- Test sources are type-checked separately with `npm run typecheck:test`.

See [Testing](./testing.md) for the details.

---

## Ways to contribute without writing Go

- **Documentation** — improve the guides in `docs/`, fix typos, add examples.
- **UI/UX** — animations, workflows, icons and layout improvements are all
  welcome. GlowSnap aims for a clean, minimal experience.
- **Translations** — the interface strings live in the React components.
- **Bug reports** — include your distribution, desktop environment, session
  type (Wayland or X11) and the exact error message.
- **Testing new releases** — try the AppImage on your system and report what
  breaks.

---

## Review checklist

Before you open a pull request, confirm that:

- [ ] `./test.sh` passes.
- [ ] `gofmt -l .` prints nothing.
- [ ] No unrelated files were changed (`git status`).
- [ ] New backend methods have regenerated bindings, not hand-written ones.
- [ ] New tests live under `tests/`.
- [ ] The commit message follows the conventional commit style.
