import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useShapes } from "@/lib/hooks/useShapes";
import type { ShapeConfig } from "@/types/types";

function rect(id: string, x = 0): ShapeConfig {
  return { id, type: "rect", x, y: 0, width: 10, height: 10 };
}

describe("useShapes", () => {
  it("starts with no shapes and no selection", () => {
    const { result } = renderHook(() => useShapes());
    expect(result.current.shapes).toEqual([]);
    expect(result.current.selectedId).toBeNull();
  });

  it("adds a shape and selects it", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a")));
    expect(result.current.shapes.map((s) => s.id)).toEqual(["a"]);
    expect(result.current.selectedId).toBe("a");
  });

  it("can add a shape without selecting it", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a"), false));
    expect(result.current.shapes).toHaveLength(1);
    expect(result.current.selectedId).toBeNull();
  });

  it("appends in order", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a")));
    act(() => result.current.addShape(rect("b")));
    act(() => result.current.addShape(rect("c")));
    expect(result.current.shapes.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("updates only the matching shape", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a", 1)));
    act(() => result.current.addShape(rect("b", 2)));
    act(() => result.current.updateShape("b", { x: 99 }));
    expect(result.current.shapes.find((s) => s.id === "a")?.x).toBe(1);
    expect(result.current.shapes.find((s) => s.id === "b")?.x).toBe(99);
  });

  it("leaves the list length unchanged when updating", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a")));
    act(() => result.current.updateShape("a", { x: 3 }));
    expect(result.current.shapes).toHaveLength(1);
  });

  it("merges partial attributes instead of replacing the shape", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a")));
    act(() => result.current.updateShape("a", { fill: "#00ff00" }));
    const shape = result.current.shapes[0];
    expect(shape.fill).toBe("#00ff00");
    expect(shape.width).toBe(10);
    expect(shape.type).toBe("rect");
  });

  it("ignores updates for an unknown id", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a")));
    const before = result.current.shapes;
    act(() => result.current.updateShape("missing", { x: 5 }));
    expect(result.current.shapes).toEqual(before);
  });

  it("deletes a shape and clears the selection", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a")));
    act(() => result.current.addShape(rect("b")));
    act(() => result.current.deleteShape("a"));
    expect(result.current.shapes.map((s) => s.id)).toEqual(["b"]);
    expect(result.current.selectedId).toBeNull();
  });

  it("clears the selection even when the deleted id is unknown", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a")));
    act(() => result.current.deleteShape("missing"));
    expect(result.current.shapes.map((s) => s.id)).toEqual(["a"]);
    expect(result.current.selectedId).toBeNull();
  });

  it("sets the selection directly", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a")));
    act(() => result.current.setSelectedId("a"));
    expect(result.current.selectedId).toBe("a");
    act(() => result.current.setSelectedId(null));
    expect(result.current.selectedId).toBeNull();
  });

  it("replaces the whole list through setShapes", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a")));
    act(() => result.current.setShapes([rect("x"), rect("y")]));
    expect(result.current.shapes.map((s) => s.id)).toEqual(["x", "y"]);
  });

  it("undoes an add", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a")));
    act(() => result.current.addShape(rect("b")));
    act(() => result.current.handleUndo());
    expect(result.current.shapes.map((s) => s.id)).toEqual(["a"]);
  });

  it("redoes an add", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a")));
    act(() => result.current.addShape(rect("b")));
    act(() => result.current.handleUndo());
    act(() => result.current.handleRedo());
    expect(result.current.shapes.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("undoes an update", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a", 1)));
    act(() => result.current.updateShape("a", { x: 50 }));
    expect(result.current.shapes[0].x).toBe(50);
    act(() => result.current.handleUndo());
    expect(result.current.shapes[0].x).toBe(1);
  });

  it("undoes a delete", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a")));
    act(() => result.current.addShape(rect("b")));
    act(() => result.current.deleteShape("a"));
    expect(result.current.shapes.map((s) => s.id)).toEqual(["b"]);
    act(() => result.current.handleUndo());
    expect(result.current.shapes.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("undo does nothing before any history exists", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a"), false, false));
    const before = result.current.shapes;
    act(() => result.current.handleUndo());
    expect(result.current.shapes).toEqual(before);
  });

  it("skips history for unsaved adds until they are committed", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a"), false, false));
    act(() => result.current.addShape(rect("b"), false, false));
    act(() => result.current.handleUndo());
    expect(result.current.shapes.map((s) => s.id)).toEqual(["a", "b"]);

    // commitShapes snapshots [a, b] as the first entry, and the first entry is
    // the undo floor, so the shapes stay put.
    act(() => result.current.commitShapes());
    act(() => result.current.handleUndo());
    expect(result.current.shapes.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("restores the previous snapshot when unsaved shapes are committed", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a")));
    act(() => result.current.addShape(rect("b"), false, false));
    act(() => result.current.commitShapes());
    act(() => result.current.handleUndo());
    expect(result.current.shapes.map((s) => s.id)).toEqual(["a"]);
  });

  it("leaves an unsaved update in place when there is nothing to undo", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a", 1)));
    act(() => result.current.updateShape("a", { x: 7 }, false));
    act(() => result.current.handleUndo());
    expect(result.current.shapes[0].x).toBe(7);
  });

  it("undo jumps over unsaved updates to the last saved snapshot", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a", 1)));
    act(() => result.current.updateShape("a", { x: 7 }, false));
    act(() => result.current.updateShape("a", { x: 8 }));
    act(() => result.current.handleUndo());
    expect(result.current.shapes[0].x).toBe(1);
  });

  it("discards the redo branch after a new change", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a")));
    act(() => result.current.addShape(rect("b")));
    act(() => result.current.handleUndo());
    act(() => result.current.addShape(rect("c")));
    expect(result.current.shapes.map((s) => s.id)).toEqual(["a", "c"]);
    act(() => result.current.handleUndo());
    expect(result.current.shapes.map((s) => s.id)).toEqual(["a"]);
  });

  it("does not share shape references with undo results", () => {
    const { result } = renderHook(() => useShapes());
    act(() => result.current.addShape(rect("a", 1)));
    act(() => result.current.addShape(rect("b", 2)));
    act(() => result.current.handleUndo());
    result.current.shapes[0].x = 777;
    act(() => result.current.handleRedo());
    expect(result.current.shapes.find((s) => s.id === "a")?.x).toBe(1);
  });
});