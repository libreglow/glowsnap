# Frontend

The frontend is a React 19 + TypeScript application. It is strict TypeScript,
styled with Tailwind CSS v4 and shadcn/ui primitives, and renders a Konva
canvas for the editor.

---

## Stack

| Concern | Choice |
| ------- | ------ |
| UI runtime | React 19 |
| Language | TypeScript 5.9 (`strict: true`) |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 + CSS variables in `src/index.css` |
| Components | shadcn/ui (`base-nova`, backed by `@base-ui/react`) |
| Canvas | Konva + react-konva |
| Motion | framer-motion |
| Icons | lucide-react |
| Tests | Vitest + Testing Library (jsdom) |

---

## Conventions

- Feature components live in `src/components/<feature>/`; shared primitives live
  in `src/components/ui/`.
- Reusable logic lives in custom hooks in `src/lib/hooks/`. There is **no
  global state store** — do not introduce one for an isolated problem.
- Types are centralised in `src/types/types.ts`. Wails model types are
  re-exported from `frontend/wailsjs/go/models`.
- Primitives use `cva` (class-variance-authority) plus `cn()` from
  `src/lib/utils.ts`.
- Backend calls are imported from `frontend/wailsjs/go/main/App`; runtime
  helpers and events come from `frontend/wailsjs/runtime/runtime`.
- Never hand-edit `frontend/wailsjs`.

---

## The window mode machine

`src/App.tsx` owns the top-level state:

```ts
const [mode, setMode] = useState<WindowMode>("palette");
```

`WindowMode` is a union type:

```ts
type WindowMode =
  | "palette" | "studio" | "record" | "recording"
  | "settings" | "preferences" | "overlay" | "closed";
```

Each mode renders exactly one component, animated with `AnimatePresence`:

| Mode | Component | Backend resize call |
| ---- | --------- | ------------------ |
| `palette` | `Palette` | `ResizeToPalette()` |
| `studio` | `Studio` | `ResizeToStudio()` |
| `record` | `Record` | `ResizeToRecord()` |
| `recording` | `RecordingBar` | `ResizeToPalette()` |
| `settings` | `RecordingSettings` | `ResizeToSettings()` |
| `preferences` | `SettingsPanel` | `ResizeToPreferences()` |
| `overlay` | `Overlay` | `WindowFullscreen()` + `WindowShow()` |

`App.tsx` also owns:

- the global `keydown` listener for the application-level shortcut
  (`toggle-palette`),
- the Wails event subscriptions (`recording-started`, `recording-ended`),
- the custom shortcut overrides, reloaded whenever the mode changes to or from
  a settings screen.

---

## Calling the backend

```ts
import { ListScreenshots, GetScreenshotsBaseURL } from "../../wailsjs/go/main/App";

const files = await ListScreenshots();
const baseUrl = await GetScreenshotsBaseURL();
```

Binary data never travels over the JSON bridge. Images and videos are loaded
from the loopback HTTP server:

```ts
<img src={`${baseUrl}/${encodeURIComponent(file.name)}`} />
```

---

## The shortcut registry

`src/lib/shortcut.ts` is the single source of truth for keyboard shortcuts:

```ts
export const EDITOR_SHORTCUTS: EditorShortcut[] = [...];
export const TOOL_SHORTCUTS: ToolShortcut[] = [...];
export const PALETTE_SHORTCUTS: PaletteShortcut[] = [...];
export const APP_SHORTCUTS: AppShortcut[] = [...];
export const ALL_SHORTCUTS: AnyShortcut[] = [...];
```

Each shortcut has a stable `id` (`editor-undo`, `tool-arrow`,
`palette-full-screen`, …). The user's rebindings are stored in
`settings.customShortcuts` as a map from that id to a combo string, and are
applied with:

```ts
const shortcuts = applyShortcutOverrides(EDITOR_SHORTCUTS, customShortcuts);
```

The matching helper compares modifier flags exactly:

```ts
e.altKey === !!shortcut.alt && e.ctrlKey === !!shortcut.ctrl && ...
```

`comboFromEvent(e)` turns a key event into a `Ctrl+Alt+Shift+Key` string for
the rebinding UI, and `parseCombo(combo)` parses it back.

`isEditableTarget(target)` prevents shortcuts from firing while the user types
in an input.

---

## The editor

### Canvas

`src/components/editor/Canvas.tsx` renders the Konva `Stage`. It owns:

- the image node and its transform,
- the selection state,
- the pointer interactions for each tool (drawing, dragging, resizing,
  rotating),
- the crop rectangle.

Coordinates are converted between screen space and stage space through the
zoom/pan helpers in `src/lib/viewport.ts`:

```ts
const newPan = panForPointerZoom(pointer, pan, zoom, newZoom, width, height);
const clampedPan = clampPanSoft(newPan, { ... });
```

### Shape model

```ts
interface ShapeConfig {
  id: string;
  type: "rect" | "circle" | "arrow" | "text" | "line" | "pen";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  stroke?: string;
  fill?: string;
  fillEnabled?: boolean;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  textDecoration?: string;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  text?: string;
  points?: number[];
}
```

### Hooks

| Hook | Responsibility |
| ---- | -------------- |
| `useShapes` | The shape list, the selection, add/update/delete and the history integration |
| `useHistory` | The undo/redo stacks |
| `useDrawing` | Pointer state while drawing |
| `useCrop` | The crop rectangle and its apply/cancel logic |
| `useTextEditing` | The inline text editing session |
| `useBackground` | The gradient background settings |
| `useKeyboardShortcut` | A small helper for component-level shortcuts |

### Text editing

Konva cannot host a real text caret, so the editor renders a DOM overlay
(`InlineTextEditor.tsx`) positioned over the selected text shape. The editor
measures the overlay (`onMetrics`) so the shape can be resized to fit the
content when the edit is committed.

### Export

```ts
const uri = stage.toDataURL({ pixelRatio: 2 });
```

The stage is temporarily reset to its identity transform before the export so
the output is not affected by zoom or pan, then restored. The PNG bytes are
handed to the backend through `SaveFileDialog` + `WriteFile`.

---

## The gallery

`Studio.tsx` (screenshots) and `Record.tsx` (recordings) share the same shape:

- `ListScreenshots()` / `ListRecordings()` to read the folders,
- `GetScreenshotsBaseURL()` / `GetRecordingsBaseURL()` for the asset URLs,
- a debounced search box,
- a sort order (`newest`, `oldest`, `az`, `za`),
- favourites (screenshots in `localStorage`, recordings in the settings file),
- rename and delete through `MediaCard`,
- pagination of 50 items per page.

Screenshot dates come from the file's birth time when the filesystem exposes
it (`unix.Statx` with `STATX_BTIME`), falling back to the modification time.

---

## Styling

- Tailwind utilities plus CSS variables defined in `src/index.css`.
- The UI is dark-first: black/white with a red accent (`#ff3b30` by default).
- Frameless windows need `wails-drag` on the draggable areas and `wails-no-drag`
  on the interactive ones — see `App.tsx` and `Overlay.tsx`.
