import { Tool } from "@/types/types";

export type ShortcutCategory = "editor" | "tool" | "palette" | "app";

export interface ShortcutDef {
  id: string;
  label: string;
  keys: string;
  key: string;
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  category: ShortcutCategory;
}

export type EditorAction =
  | "edit-text"
  | "delete"
  | "undo"
  | "redo"
  | "export"
  | "copy"
  | "paste"
  | "duplicate"
  | "deselect"
  | "zoom-in"
  | "zoom-out";

export interface EditorShortcut extends ShortcutDef {
  category: "editor";
  action: EditorAction;
}

export const EDITOR_SHORTCUTS: EditorShortcut[] = [
  {
    id: "editor-edit-text",
    action: "edit-text",
    label: "Edit selected text",
    keys: "Enter",
    key: "Enter",
    category: "editor",
  },
  {
    id: "editor-delete",
    action: "delete",
    label: "Delete selected shape",
    keys: "Delete",
    key: "Delete",
    category: "editor",
  },
  {
    id: "editor-delete-backspace",
    action: "delete",
    label: "Delete selected shape",
    keys: "Backspace",
    key: "Backspace",
    category: "editor",
  },
  {
    id: "editor-undo",
    action: "undo",
    label: "Undo",
    keys: "Ctrl+Z",
    key: "z",
    ctrl: true,
    category: "editor",
  },
  {
    id: "editor-redo",
    action: "redo",
    label: "Redo",
    keys: "Ctrl+Shift+Z",
    key: "z",
    ctrl: true,
    shift: true,
    category: "editor",
  },
  {
    id: "editor-redo-alternate",
    action: "redo",
    label: "Redo (alternate)",
    keys: "Ctrl+Y",
    key: "y",
    ctrl: true,
    category: "editor",
  },
  {
    id: "editor-export",
    action: "export",
    label: "Export image",
    keys: "Ctrl+S",
    key: "s",
    ctrl: true,
    category: "editor",
  },
  {
    id: "editor-copy",
    action: "copy",
    label: "Copy shape",
    keys: "Ctrl+C",
    key: "c",
    ctrl: true,
    category: "editor",
  },
  {
    id: "editor-paste",
    action: "paste",
    label: "Paste shape",
    keys: "Ctrl+V",
    key: "v",
    ctrl: true,
    category: "editor",
  },
  {
    id: "editor-duplicate",
    action: "duplicate",
    label: "Duplicate shape",
    keys: "Ctrl+D",
    key: "d",
    ctrl: true,
    category: "editor",
  },
  {
    id: "editor-deselect",
    action: "deselect",
    label: "Deselect all",
    keys: "Escape",
    key: "Escape",
    category: "editor",
  },
  {
    id: "editor-zoom-in",
    action: "zoom-in",
    label: "Zoom in",
    keys: "Ctrl+=",
    key: "=",
    ctrl: true,
    category: "editor",
  },
  {
    id: "editor-zoom-in-plus",
    action: "zoom-in",
    label: "Zoom in",
    keys: "Ctrl++",
    key: "+",
    ctrl: true,
    shift: true,
    category: "editor",
  },
  {
    id: "editor-zoom-in-plus-direct",
    action: "zoom-in",
    label: "Zoom in",
    keys: "Ctrl++",
    key: "+",
    ctrl: true,
    category: "editor",
  },
  {
    id: "editor-zoom-in-numpad",
    action: "zoom-in",
    label: "Zoom in (numpad)",
    keys: "Ctrl+Num +",
    key: "Add",
    ctrl: true,
    category: "editor",
  },
  {
    id: "editor-zoom-out",
    action: "zoom-out",
    label: "Zoom out",
    keys: "Ctrl+-",
    key: "-",
    ctrl: true,
    category: "editor",
  },
  {
    id: "editor-zoom-out-numpad",
    action: "zoom-out",
    label: "Zoom out (numpad)",
    keys: "Ctrl+Num -",
    key: "Subtract",
    ctrl: true,
    category: "editor",
  },
];

export interface ToolShortcut extends ShortcutDef {
  category: "tool";
  tool: Tool;
}

export const TOOL_SHORTCUT_KEYS: Record<string, Tool> = {
  v: "select",
  c: "crop",
  a: "arrow",
  t: "text",
  n: "number",
  p: "pen",
  r: "rectangle",
  o: "circle",
  e: "eraser",
};

const TOOL_LABELS: Record<Tool, string> = {
  select: "Select",
  crop: "Crop",
  arrow: "Arrow",
  text: "Text",
  number: "Number",
  pen: "Pen",
  rectangle: "Rectangle",
  circle: "Circle",
  eraser: "Eraser",
};

export const TOOL_SHORTCUTS: ToolShortcut[] = (
  Object.keys(TOOL_SHORTCUT_KEYS) as string[]
).map((key) => {
  const tool = TOOL_SHORTCUT_KEYS[key];
  return {
    id: `tool-${tool}`,
    tool,
    label: `Select ${TOOL_LABELS[tool]} tool`,
    keys: key.toUpperCase(),
    key,
    category: "tool" as const,
  };
});

export type PaletteAction = "full-screen" | "select-area" | "record" | "studio";

export interface PaletteShortcut extends ShortcutDef {
  category: "palette";
  action: PaletteAction;
}

export const PALETTE_SHORTCUTS: PaletteShortcut[] = [
  {
    id: "palette-full-screen",
    action: "full-screen",
    label: "Take full screen screenshot",
    keys: "Alt+1",
    key: "1",
    alt: true,
    category: "palette",
  },
  {
    id: "palette-select-area",
    action: "select-area",
    label: "Take area screenshot",
    keys: "Alt+2",
    key: "2",
    alt: true,
    category: "palette",
  },
  {
    id: "palette-record",
    action: "record",
    label: "Take a record from screen",
    keys: "Alt+3",
    key: "3",
    alt: true,
    category: "palette",
  },
  {
    id: "palette-studio",
    action: "studio",
    label: "Open Studio",
    keys: "Alt+4",
    key: "4",
    alt: true,
    category: "palette",
  },
];

export type AppAction = "toggle-palette";

export interface AppShortcut extends ShortcutDef {
  category: "app";
  action: AppAction;
}

export const APP_SHORTCUTS: AppShortcut[] = [
  {
    id: "app-toggle-palette",
    action: "toggle-palette",
    label: "Return to palette",
    keys: "Ctrl+Alt+S",
    key: "s",
    alt: true,
    ctrl: true,
    category: "app",
  },
];

export const ALL_SHORTCUTS: ShortcutDef[] = [
  ...EDITOR_SHORTCUTS,
  ...TOOL_SHORTCUTS,
  ...PALETTE_SHORTCUTS,
  ...APP_SHORTCUTS,
];

export function findShortcut(id: string): ShortcutDef | undefined {
  return ALL_SHORTCUTS.find((s) => s.id === id);
}

export function getToolForShortcut(key: string): Tool | undefined {
  return TOOL_SHORTCUT_KEYS[key.toLowerCase()];
}

export function matchesShortcut(
  shortcut: ShortcutDef,
  e: KeyboardEvent,
): boolean {
  return (
    e.altKey === !!shortcut.alt &&
    e.ctrlKey === !!shortcut.ctrl &&
    e.shiftKey === !!shortcut.shift &&
    e.metaKey === !!shortcut.meta &&
    normalizeCompareKey(e.key) === normalizeCompareKey(shortcut.key)
  );
}

function normalizeCompareKey(key: string): string {
  return key === " " ? "space" : key.toLowerCase();
}

const IGNORED_RECORD_KEYS = new Set([
  "Control",
  "Alt",
  "Shift",
  "Meta",
  "CapsLock",
  "Tab",
  "OS",
  "Escape",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
]);

function canonicalKeyFromEvent(e: KeyboardEvent): string {
  if (e.key === " ") return "Space";
  if (e.key.length === 1) return e.key.toUpperCase();
  return e.key;
}

export function comboFromEvent(e: KeyboardEvent): string {
  if (IGNORED_RECORD_KEYS.has(e.key)) return "";
  const key = canonicalKeyFromEvent(e);
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  parts.push(key);
  return parts.join("+");
}

export interface ComboMatch {
  key: string;
  alt: boolean;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
}

export function parseCombo(combo: string): ComboMatch {
  const parts = combo
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  const result: ComboMatch = {
    key: "",
    alt: false,
    ctrl: false,
    shift: false,
    meta: false,
  };
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control" || lower === "⌃")
      result.ctrl = true;
    else if (lower === "alt" || lower === "option" || lower === "⌥")
      result.alt = true;
    else if (lower === "shift" || lower === "⇧") result.shift = true;
    else if (
      lower === "meta" ||
      lower === "cmd" ||
      lower === "command" ||
      lower === "super" ||
      lower === "win" ||
      lower === "⌘"
    )
      result.meta = true;
    else result.key = part;
  }
  return result;
}

export function applyShortcutOverrides<T extends ShortcutDef>(
  defs: T[],
  overrides?: Record<string, string>,
): T[] {
  if (!overrides) return defs;
  return defs.map((d): T => {
    const combo = overrides[d.id];
    if (!combo) return d;
    const parsed = parseCombo(combo);
    if (!parsed.key) return d;
    return {
      ...d,
      keys: combo,
      key: parsed.key,
      alt: parsed.alt,
      ctrl: parsed.ctrl,
      shift: parsed.shift,
      meta: parsed.meta,
    };
  });
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}
