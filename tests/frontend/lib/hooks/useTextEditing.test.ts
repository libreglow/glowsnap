import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTextEditing } from "@/lib/hooks/useTextEditing";
import type { ShapeConfig } from "@/types/types";

function textShape(id: string, text = "hello"): ShapeConfig {
  return { id, type: "text", x: 0, y: 0, text };
}

function setup() {
  const updateShape = vi.fn();
  const { result } = renderHook(() => useTextEditing(updateShape));
  return { updateShape, result };
}

describe("useTextEditing", () => {
  it("is idle by default", () => {
    const h = setup();
    expect(h.result.current.editingTextId).toBeNull();
    expect(h.result.current.editingTextValue).toBe("");
  });

  it("starts editing a shape and seeds the value from it", () => {
    const h = setup();
    act(() => h.result.current.startEditing(textShape("t1", "original")));
    expect(h.result.current.editingTextId).toBe("t1");
    expect(h.result.current.editingTextValue).toBe("original");
  });

  it("treats a shape without text as empty", () => {
    const h = setup();
    act(() => h.result.current.startEditing({ id: "t1", type: "text", x: 0, y: 0 }));
    expect(h.result.current.editingTextValue).toBe("");
  });

  it("switches to another shape", () => {
    const h = setup();
    act(() => h.result.current.startEditing(textShape("t1", "one")));
    act(() => h.result.current.startEditing(textShape("t2", "two")));
    expect(h.result.current.editingTextId).toBe("t2");
    expect(h.result.current.editingTextValue).toBe("two");
  });

  it("pushes each keystroke into the shape without saving history", () => {
    const h = setup();
    act(() => h.result.current.startEditing(textShape("t1", "a")));
    act(() => h.result.current.updateEditingText("ab"));
    expect(h.updateShape).toHaveBeenLastCalledWith("t1", { text: "ab" }, false);
    expect(h.result.current.editingTextValue).toBe("ab");
  });

  it("does not push updates when nothing is being edited", () => {
    const h = setup();
    act(() => h.result.current.updateEditingText("x"));
    expect(h.updateShape).not.toHaveBeenCalled();
    expect(h.result.current.editingTextValue).toBe("x");
  });

  it("setEditingText only changes the local value", () => {
    const h = setup();
    act(() => h.result.current.startEditing(textShape("t1", "a")));
    h.updateShape.mockClear();
    act(() => h.result.current.setEditingText("typed"));
    expect(h.result.current.editingTextValue).toBe("typed");
    expect(h.updateShape).not.toHaveBeenCalled();
  });

  it("commits the edited value and ends editing", () => {
    const h = setup();
    act(() => h.result.current.startEditing(textShape("t1", "a")));
    act(() => h.result.current.setEditingText("final"));
    act(() => h.result.current.commitEditing());

    expect(h.updateShape).toHaveBeenLastCalledWith("t1", { text: "final" }, true);
    expect(h.result.current.editingTextId).toBeNull();
  });

  it("commits extra attributes alongside the text", () => {
    const h = setup();
    act(() => h.result.current.startEditing(textShape("t1", "a")));
    act(() => h.result.current.setEditingText("final"));
    act(() => h.result.current.commitEditing({ fontSize: 48, align: "center" }));

    expect(h.updateShape).toHaveBeenLastCalledWith(
      "t1",
      { text: "final", fontSize: 48, align: "center" },
      true,
    );
  });

  it("lets an extra text attribute win over the edited value", () => {
    const h = setup();
    act(() => h.result.current.startEditing(textShape("t1", "a")));
    act(() => h.result.current.setEditingText("final"));
    act(() => h.result.current.commitEditing({ text: "override" }));
    expect(h.updateShape).toHaveBeenLastCalledWith(
      "t1",
      { text: "override" },
      true,
    );
  });

  it("does nothing when committing while idle", () => {
    const h = setup();
    act(() => h.result.current.commitEditing());
    expect(h.updateShape).not.toHaveBeenCalled();
  });

  it("restores the original text when cancelling", () => {
    const h = setup();
    act(() => h.result.current.startEditing(textShape("t1", "original")));
    act(() => h.result.current.updateEditingText("changed"));
    act(() => h.result.current.cancelEditing());

    expect(h.updateShape).toHaveBeenLastCalledWith("t1", { text: "original" }, false);
    expect(h.result.current.editingTextId).toBeNull();
  });

  it("restores the previous shape's text only for the shape being edited", () => {
    const h = setup();
    act(() => h.result.current.startEditing(textShape("t1", "one")));
    act(() => h.result.current.updateEditingText("one edited"));
    act(() => h.result.current.startEditing(textShape("t2", "two")));
    act(() => h.result.current.updateEditingText("two edited"));
    h.updateShape.mockClear();

    act(() => h.result.current.cancelEditing());
    expect(h.updateShape).toHaveBeenCalledTimes(1);
    expect(h.updateShape).toHaveBeenCalledWith("t2", { text: "two" }, false);
  });

  it("does nothing when cancelling while idle", () => {
    const h = setup();
    act(() => h.result.current.cancelEditing());
    expect(h.updateShape).not.toHaveBeenCalled();
  });

  it("restores an empty string when the shape started empty", () => {
    const h = setup();
    act(() => h.result.current.startEditing({ id: "t1", type: "text", x: 0, y: 0 }));
    act(() => h.result.current.updateEditingText("typed"));
    act(() => h.result.current.cancelEditing());
    expect(h.updateShape).toHaveBeenLastCalledWith("t1", { text: "" }, false);
  });

  it("commits an emptied value", () => {
    const h = setup();
    act(() => h.result.current.startEditing(textShape("t1", "text")));
    act(() => h.result.current.updateEditingText(""));
    act(() => h.result.current.commitEditing());
    expect(h.updateShape).toHaveBeenLastCalledWith("t1", { text: "" }, true);
  });

  it("can be reopened after committing", () => {
    const h = setup();
    act(() => h.result.current.startEditing(textShape("t1", "one")));
    act(() => h.result.current.setEditingText("two"));
    act(() => h.result.current.commitEditing());
    act(() => h.result.current.startEditing(textShape("t1", "two")));
    expect(h.result.current.editingTextValue).toBe("two");
  });
});