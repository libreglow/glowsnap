import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useHistory } from "@/lib/hooks/useHistory";
import type { ShapeConfig } from "@/types/types";

function rect(id: string, x = 0): ShapeConfig {
  return { id, type: "rect", x, y: 0, width: 10, height: 10 };
}

describe("useHistory", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useHistory());
    expect(result.current.historyIndex).toBe(-1);
    expect(result.current.historyLength).toBe(0);
  });

  it("returns null when undoing an empty history", () => {
    const { result } = renderHook(() => useHistory());
    expect(result.current.undo()).toBeNull();
  });

  it("returns null when redoing an empty history", () => {
    const { result } = renderHook(() => useHistory());
    expect(result.current.redo()).toBeNull();
  });

  it("records a snapshot and tracks its index", () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.saveHistory([rect("a")]));
    expect(result.current.historyIndex).toBe(0);
    expect(result.current.historyLength).toBe(1);
  });

  it("advances the index on each save", () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.saveHistory([rect("a")]));
    act(() => result.current.saveHistory([rect("a"), rect("b")]));
    expect(result.current.historyIndex).toBe(1);
    expect(result.current.historyLength).toBe(2);
  });

  it("undoes to the previous snapshot", () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.saveHistory([rect("a")]));
    act(() => result.current.saveHistory([rect("a"), rect("b")]));

    let restored: ShapeConfig[] | null = null;
    act(() => {
      restored = result.current.undo();
    });
    expect(restored?.map((s) => s.id)).toEqual(["a"]);
    expect(result.current.historyIndex).toBe(0);
  });

  it("redoes to the snapshot that was undone", () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.saveHistory([rect("a")]));
    act(() => result.current.saveHistory([rect("a"), rect("b")]));
    act(() => {
      result.current.undo();
    });

    let restored: ShapeConfig[] | null = null;
    act(() => {
      restored = result.current.redo();
    });
    expect(restored?.map((s) => s.id)).toEqual(["a", "b"]);
    expect(result.current.historyIndex).toBe(1);
  });

  it("does not undo past the first snapshot", () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.saveHistory([rect("a")]));

    act(() => {
      expect(result.current.undo()).toBeNull();
    });
    expect(result.current.historyIndex).toBe(0);
  });

  it("does not redo past the last snapshot", () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.saveHistory([rect("a")]));
    act(() => {
      expect(result.current.redo()).toBeNull();
    });
    expect(result.current.historyIndex).toBe(0);
  });

  it("walks a multi-step history back and forward", () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.saveHistory([rect("a")]));
    act(() => result.current.saveHistory([rect("a"), rect("b")]));
    act(() => result.current.saveHistory([rect("a"), rect("b"), rect("c")]));

    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.historyIndex).toBe(0);
    act(() => {
      result.current.redo();
    });
    expect(result.current.historyIndex).toBe(1);
    act(() => {
      result.current.redo();
    });
    expect(result.current.historyIndex).toBe(2);
  });

  it("discards the redo branch when saving after an undo", () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.saveHistory([rect("a")]));
    act(() => result.current.saveHistory([rect("a"), rect("b")]));
    act(() => result.current.saveHistory([rect("a"), rect("b"), rect("c")]));
    act(() => {
      result.current.undo();
      result.current.undo();
    });
    expect(result.current.historyIndex).toBe(0);

    act(() => result.current.saveHistory([rect("z")]));
    expect(result.current.historyLength).toBe(2);
    expect(result.current.historyIndex).toBe(1);

    act(() => {
      expect(result.current.redo()).toBeNull();
    });
  });

  it("snapshots the shapes so later mutation cannot rewrite history", () => {
    const { result } = renderHook(() => useHistory());
    const shapes = [rect("a", 5)];
    act(() => result.current.saveHistory(shapes));

    shapes[0].x = 500;
    let restored: ShapeConfig[] | null = null;
    act(() => {
      result.current.saveHistory(shapes);
    });
    act(() => {
      restored = result.current.undo();
    });
    expect(restored?.[0].x).toBe(5);
  });

  it("returns clones, so callers cannot mutate stored history", () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.saveHistory([rect("a", 5)]));

    let first: ShapeConfig[] | null = null;
    act(() => {
      first = result.current.undo();
    });
    expect(first).toBeNull();

    act(() => result.current.saveHistory([rect("a", 7)]));
    act(() => {
      first = result.current.undo();
    });
    (first as ShapeConfig[])[0].x = 1234;

    act(() => {
      const again = result.current.redo();
      expect((again as ShapeConfig[])[0].x).toBe(7);
    });
  });

  it("keeps undo and redo usable across separate renders", () => {
    const { result, rerender } = renderHook(() => useHistory());
    act(() => result.current.saveHistory([rect("a")]));
    rerender();
    act(() => result.current.saveHistory([rect("a"), rect("b")]));
    rerender();

    act(() => {
      const prev = result.current.undo();
      expect(prev?.map((s) => s.id)).toEqual(["a"]);
    });
  });
});