import { describe, it, expect } from "vitest";
import {
  ALL_SHORTCUTS,
  APP_SHORTCUTS,
  EDITOR_SHORTCUTS,
  PALETTE_SHORTCUTS,
  TOOL_SHORTCUTS,
  TOOL_SHORTCUT_KEYS,
  applyShortcutOverrides,
  comboFromEvent,
  findShortcut,
  getToolForShortcut,
  isEditableTarget,
  matchesShortcut,
  parseCombo,
  type ShortcutDef,
} from "@/lib/shortcut";

function keyEvent(init: KeyboardEventInit & { key: string }): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

describe("shortcut tables", () => {
  it("assigns unique ids across every category", () => {
    const ids = ALL_SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every shortcut a label, a key and a keys display string", () => {
    for (const s of ALL_SHORTCUTS) {
      expect(s.label, `${s.id} label`).not.toBe("");
      expect(s.key, `${s.id} key`).not.toBe("");
      expect(s.keys, `${s.id} keys`).not.toBe("");
    }
  });

  it("keeps every category tag accurate", () => {
    for (const s of EDITOR_SHORTCUTS) expect(s.category).toBe("editor");
    for (const s of TOOL_SHORTCUTS) expect(s.category).toBe("tool");
    for (const s of PALETTE_SHORTCUTS) expect(s.category).toBe("palette");
    for (const s of APP_SHORTCUTS) expect(s.category).toBe("app");
  });

  it("exposes the documented palette bindings", () => {
    const byAction = Object.fromEntries(
      PALETTE_SHORTCUTS.map((s) => [s.action, s.keys]),
    );
    expect(byAction).toEqual({
      "full-screen": "Alt+1",
      "select-area": "Alt+2",
      record: "Alt+3",
      studio: "Alt+4",
    });
  });

  it("exposes the documented app binding", () => {
    expect(APP_SHORTCUTS.map((s) => s.keys)).toEqual(["Ctrl+Alt+S"]);
  });

  it("maps each editor action to at least one shortcut", () => {
    const actions = new Set(EDITOR_SHORTCUTS.map((s) => s.action));
    for (const action of [
      "edit-text",
      "delete",
      "undo",
      "redo",
      "export",
      "copy",
      "paste",
      "duplicate",
      "deselect",
      "zoom-in",
      "zoom-out",
    ]) {
      expect(actions.has(action as never), action).toBe(true);
    }
  });

  it("supports undo, redo and zoom with alternate bindings", () => {
    const combosFor = (action: string) =>
      EDITOR_SHORTCUTS.filter((s) => s.action === action).map((s) => s.keys);
    expect(combosFor("undo")).toEqual(["Ctrl+Z"]);
    expect(combosFor("redo")).toEqual(["Ctrl+Shift+Z", "Ctrl+Y"]);
    expect(combosFor("delete")).toEqual(["Delete", "Backspace"]);
    expect(combosFor("zoom-in").length).toBeGreaterThanOrEqual(3);
    expect(combosFor("zoom-out")).toEqual(["Ctrl+-", "Ctrl+Num -"]);
  });

  it("generates a tool shortcut per tool key", () => {
    expect(TOOL_SHORTCUTS).toHaveLength(Object.keys(TOOL_SHORTCUT_KEYS).length);
    for (const s of TOOL_SHORTCUTS) {
      expect(s.id).toBe(`tool-${s.tool}`);
      expect(s.keys).toBe(s.key.toUpperCase());
      expect(s.label).toBe(`Select ${s.tool[0].toUpperCase()}${s.tool.slice(1)} tool`);
    }
  });
});

describe("findShortcut", () => {
  it("finds shortcuts by id", () => {
    const undo = findShortcut("editor-undo");
    expect(undo && "action" in undo ? undo.action : undefined).toBe("undo");

    const record = findShortcut("palette-record");
    expect(record && "action" in record ? record.action : undefined).toBe("record");

    const crop = findShortcut("tool-crop");
    expect(crop && "tool" in crop ? crop.tool : undefined).toBe("crop");
  });

  it("returns undefined for unknown ids", () => {
    expect(findShortcut("nope")).toBeUndefined();
    expect(findShortcut("")).toBeUndefined();
  });
});

describe("getToolForShortcut", () => {
  it("maps keys to tools case-insensitively", () => {
    expect(getToolForShortcut("v")).toBe("select");
    expect(getToolForShortcut("V")).toBe("select");
    expect(getToolForShortcut("c")).toBe("crop");
    expect(getToolForShortcut("R")).toBe("rectangle");
  });

  it("returns undefined for unknown keys", () => {
    expect(getToolForShortcut("z")).toBeUndefined();
    expect(getToolForShortcut("")).toBeUndefined();
  });

  it("does not bind the n key to a removed number tool", () => {
    expect(getToolForShortcut("n")).toBeUndefined();
  });

  it("covers every declared tool key", () => {
    for (const [key, tool] of Object.entries(TOOL_SHORTCUT_KEYS)) {
      expect(getToolForShortcut(key)).toBe(tool);
    }
  });
});

describe("matchesShortcut", () => {
  const undo = EDITOR_SHORTCUTS.find((s) => s.action === "undo")!;

  it("matches the exact modifier combination", () => {
    expect(matchesShortcut(undo, keyEvent({ key: "z", ctrlKey: true }))).toBe(true);
  });

  it("rejects extra modifiers", () => {
    expect(
      matchesShortcut(
        undo,
        keyEvent({ key: "z", ctrlKey: true, shiftKey: true }),
      ),
    ).toBe(false);
    expect(
      matchesShortcut(
        undo,
        keyEvent({ key: "z", ctrlKey: true, altKey: true }),
      ),
    ).toBe(false);
  });

  it("rejects missing modifiers", () => {
    expect(matchesShortcut(undo, keyEvent({ key: "z" }))).toBe(false);
  });

  it("is case insensitive for the compared key", () => {
    const shortcut: ShortcutDef = {
      id: "x",
      label: "x",
      keys: "Ctrl+K",
      key: "k",
      ctrl: true,
      category: "editor",
    };
    expect(matchesShortcut(shortcut, keyEvent({ key: "K", ctrlKey: true }))).toBe(true);
  });

  it("treats the space bar as space", () => {
    const shortcut: ShortcutDef = {
      id: "space",
      label: "space",
      keys: "Space",
      key: " ",
      category: "editor",
    };
    expect(matchesShortcut(shortcut, keyEvent({ key: " " }))).toBe(true);
  });

  it("distinguishes zoom-in from zoom-out", () => {
    const zoomIn = EDITOR_SHORTCUTS.filter((s) => s.action === "zoom-in");
    const zoomOut = EDITOR_SHORTCUTS.filter((s) => s.action === "zoom-out");
    expect(zoomIn.some((s) => matchesShortcut(s, keyEvent({ key: "=", ctrlKey: true })))).toBe(true);
    expect(zoomOut.some((s) => matchesShortcut(s, keyEvent({ key: "=", ctrlKey: true })))).toBe(false);
  });

  it("distinguishes redo bindings from undo", () => {
    const undoDefs = EDITOR_SHORTCUTS.filter((s) => s.action === "undo");
    const redoDefs = EDITOR_SHORTCUTS.filter((s) => s.action === "redo");
    const event = keyEvent({ key: "z", ctrlKey: true, shiftKey: true });
    expect(undoDefs.some((s) => matchesShortcut(s, event))).toBe(false);
    expect(redoDefs.some((s) => matchesShortcut(s, event))).toBe(true);
  });

  it("matches every palette binding", () => {
    const cases: Array<[number, string]> = [
      [1, "full-screen"],
      [2, "select-area"],
      [3, "record"],
      [4, "studio"],
    ];
    for (const [num, action] of cases) {
      const matched = PALETTE_SHORTCUTS.filter((s) =>
        matchesShortcut(s, keyEvent({ key: String(num), altKey: true })),
      );
      expect(matched.map((s) => s.action)).toEqual([action]);
    }
  });
});

describe("comboFromEvent", () => {
  it("builds a combo in Ctrl, Alt, Shift, Meta order", () => {
    const e = keyEvent({
      key: "k",
      metaKey: true,
      shiftKey: true,
      altKey: true,
      ctrlKey: true,
    });
    expect(comboFromEvent(e)).toBe("Ctrl+Alt+Shift+Meta+K");
  });

  it("uppercases single character keys", () => {
    expect(comboFromEvent(keyEvent({ key: "s" }))).toBe("S");
    expect(comboFromEvent(keyEvent({ key: "s", ctrlKey: true }))).toBe("Ctrl+S");
  });

  it("keeps named keys as-is", () => {
    expect(comboFromEvent(keyEvent({ key: "Enter" }))).toBe("Enter");
    expect(comboFromEvent(keyEvent({ key: "Backspace" }))).toBe("Backspace");
    expect(comboFromEvent(keyEvent({ key: "ArrowUp", ctrlKey: true }))).toBe("Ctrl+ArrowUp");
  });

  it("maps the space bar to Space", () => {
    expect(comboFromEvent(keyEvent({ key: " " }))).toBe("Space");
    expect(comboFromEvent(keyEvent({ key: " ", ctrlKey: true }))).toBe("Ctrl+Space");
  });

  it("ignores bare modifier presses", () => {
    for (const key of ["Control", "Alt", "Shift", "Meta", "CapsLock", "Tab", "OS", "Escape"]) {
      expect(comboFromEvent(keyEvent({ key, ctrlKey: true, shiftKey: true })), key).toBe("");
    }
  });

  it("ignores function keys used only as record targets", () => {
    for (const key of ["F1", "F6", "F12"]) {
      expect(comboFromEvent(keyEvent({ key })), key).toBe("");
    }
  });

  it("round-trips through parseCombo", () => {
    const combos = ["Ctrl+Alt+S", "Ctrl+Shift+Z", "Alt+1", "Enter", "Ctrl+Space", "Meta+K"];
    for (const combo of combos) {
      expect(comboFromEvent(keyEvent(parseComboAsEventInit(combo))), combo).toBe(combo);
    }
  });
});

function parseComboAsEventInit(combo: string): KeyboardEventInit & { key: string } {
  const parsed = parseCombo(combo);
  return {
    key: parsed.key === "Space" ? " " : parsed.key,
    ctrlKey: parsed.ctrl,
    altKey: parsed.alt,
    shiftKey: parsed.shift,
    metaKey: parsed.meta,
  };
}

describe("parseCombo", () => {
  it("returns an empty match for blank input", () => {
    expect(parseCombo("")).toEqual({ key: "", alt: false, ctrl: false, shift: false, meta: false });
    expect(parseCombo("   ")).toEqual({ key: "", alt: false, ctrl: false, shift: false, meta: false });
  });

  it("parses modifiers in any case", () => {
    expect(parseCombo("ctrl+shift+k")).toEqual({
      key: "k",
      alt: false,
      ctrl: true,
      shift: true,
      meta: false,
    });
  });

  it("accepts aliases and symbols for modifiers", () => {
    expect(parseCombo("Control+a").ctrl).toBe(true);
    expect(parseCombo("option+a").alt).toBe(true);
    expect(parseCombo("⌥+a").alt).toBe(true);
    expect(parseCombo("⇧+a").shift).toBe(true);
    expect(parseCombo("⌃+a").ctrl).toBe(true);
    for (const alias of ["meta", "cmd", "command", "super", "win", "⌘"]) {
      expect(parseCombo(`${alias}+a`).meta, alias).toBe(true);
    }
  });

  it("keeps minus-sign keys", () => {
    expect(parseCombo("Ctrl+-").key).toBe("-");
    expect(parseCombo("-")).toEqual({
      key: "-",
      alt: false,
      ctrl: false,
      shift: false,
      meta: false,
    });
  });

  it("drops a bare plus, so plus cannot be recorded as a combo", () => {
    // "+" is the separator, so "Ctrl++" and "+" carry no key at all.
    expect(parseCombo("Ctrl++")).toEqual({
      key: "",
      alt: false,
      ctrl: true,
      shift: false,
      meta: false,
    });
    expect(parseCombo("+")).toEqual({
      key: "",
      alt: false,
      ctrl: false,
      shift: false,
      meta: false,
    });
  });

  it("rejects a plus override so it is dropped instead of half applied", () => {
    const result = applyShortcutOverrides(EDITOR_SHORTCUTS, {
      "editor-zoom-in": "Ctrl++",
    });
    expect(result.find((s) => s.id === "editor-zoom-in")).toBe(
      EDITOR_SHORTCUTS.find((s) => s.id === "editor-zoom-in"),
    );
  });

  it("ignores empty segments", () => {
    expect(parseCombo("Ctrl++Alt+a")).toEqual({
      key: "a",
      alt: true,
      ctrl: true,
      shift: false,
      meta: false,
    });
  });

  it("keeps the last non-modifier segment as the key", () => {
    expect(parseCombo("Ctrl+a").key).toBe("a");
  });
});

describe("applyShortcutOverrides", () => {
  it("returns the original definitions when there are no overrides", () => {
    expect(applyShortcutOverrides(EDITOR_SHORTCUTS)).toBe(EDITOR_SHORTCUTS);
    expect(applyShortcutOverrides(EDITOR_SHORTCUTS, {})).not.toBe(EDITOR_SHORTCUTS);
    expect(applyShortcutOverrides(EDITOR_SHORTCUTS, {})[0]).toBe(EDITOR_SHORTCUTS[0]);
  });

  it("rewrites keys and modifiers for an overridden id", () => {
    const result = applyShortcutOverrides(EDITOR_SHORTCUTS, {
      "editor-undo": "Ctrl+Alt+U",
    });
    const undo = result.find((s) => s.id === "editor-undo")!;
    expect(undo.keys).toBe("Ctrl+Alt+U");
    expect(undo.key).toBe("U");
    expect(undo.ctrl).toBe(true);
    expect(undo.alt).toBe(true);
    expect(undo.shift).toBe(false);
  });

  it("leaves untouched ids alone", () => {
    const result = applyShortcutOverrides(EDITOR_SHORTCUTS, {
      "editor-undo": "Ctrl+Alt+U",
    });
    const redo = result.find((s) => s.id === "editor-redo")!;
    expect(redo).toBe(EDITOR_SHORTCUTS.find((s) => s.id === "editor-redo"));
  });

  it("clears modifiers that are not part of the override", () => {
    const result = applyShortcutOverrides(EDITOR_SHORTCUTS, {
      "editor-undo": "U",
    });
    const undo = result.find((s) => s.id === "editor-undo")!;
    expect(undo.ctrl).toBe(false);
    expect(undo.shift).toBe(false);
    expect(undo.alt).toBe(false);
    expect(undo.meta).toBe(false);
  });

  it("ignores overrides without a key", () => {
    const result = applyShortcutOverrides(EDITOR_SHORTCUTS, {
      "editor-undo": "Ctrl+",
    });
    expect(result.find((s) => s.id === "editor-undo")).toBe(
      EDITOR_SHORTCUTS.find((s) => s.id === "editor-undo"),
    );
  });

  it("keeps the action and label intact", () => {
    const result = applyShortcutOverrides(EDITOR_SHORTCUTS, {
      "editor-undo": "Ctrl+Alt+U",
    });
    const undo = result.find((s) => s.id === "editor-undo")!;
    expect(undo.action).toBe("undo");
    expect(undo.label).toBe("Undo");
    expect(undo.category).toBe("editor");
  });

  it("does not mutate the input array", () => {
    const original = EDITOR_SHORTCUTS[0];
    applyShortcutOverrides(EDITOR_SHORTCUTS, { [original.id]: "Ctrl+Alt+Q" });
    expect(EDITOR_SHORTCUTS[0]).toBe(original);
    expect(original.keys).toBe("Enter");
  });
});

describe("isEditableTarget", () => {
  it("detects form fields", () => {
    for (const tag of ["input", "textarea", "select"]) {
      const el = document.createElement(tag);
      expect(isEditableTarget(el), tag).toBe(true);
    }
  });

  it("detects contenteditable elements", () => {
    // jsdom does not implement isContentEditable, so it is provided here to
    // match what a real browser reports for contenteditable="true".
    const el = document.createElement("div");
    expect(isEditableTarget(el)).toBeFalsy();
    el.setAttribute("contenteditable", "true");
    Object.defineProperty(el, "isContentEditable", { value: true });
    expect(isEditableTarget(el)).toBe(true);
  });

  it("returns a falsy value for other elements", () => {
    expect(isEditableTarget(document.createElement("div"))).toBeFalsy();
    expect(isEditableTarget(document.createElement("button"))).toBeFalsy();
  });

  it("returns false for null and non-element targets", () => {
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(document.createTextNode("t"))).toBe(false);
  });
});