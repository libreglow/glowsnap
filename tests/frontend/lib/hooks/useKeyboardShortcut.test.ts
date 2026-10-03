import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import useKeyboardShortcut from "@/lib/hooks/useKeyboardShortcut";

describe("useKeyboardShortcut", () => {
  let callback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    callback = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function press(key: string, init: KeyboardEventInit = {}) {
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key, ...init }));
    });
  }

  it("invokes the callback for a matching key", () => {
    renderHook(() => useKeyboardShortcut({ key: "k" }, callback));
    press("k");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("ignores other keys", () => {
    renderHook(() => useKeyboardShortcut({ key: "k" }, callback));
    press("j");
    expect(callback).not.toHaveBeenCalled();
  });

  it("matches case-insensitively", () => {
    renderHook(() => useKeyboardShortcut({ key: "k" }, callback));
    press("K");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("matches case-insensitively in the other direction", () => {
    renderHook(() => useKeyboardShortcut({ key: "K" }, callback));
    press("k");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("requires ctrl when the binding asks for it", () => {
    renderHook(() => useKeyboardShortcut({ key: "k", ctrl: true }, callback));
    press("k");
    expect(callback).not.toHaveBeenCalled();
    press("k", { ctrlKey: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("requires alt when the binding asks for it", () => {
    renderHook(() => useKeyboardShortcut({ key: "k", alt: true }, callback));
    press("k");
    expect(callback).not.toHaveBeenCalled();
    press("k", { altKey: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("requires ctrl+alt together", () => {
    renderHook(() => useKeyboardShortcut({ key: "k", ctrl: true, alt: true }, callback));
    press("k", { ctrlKey: true });
    expect(callback).not.toHaveBeenCalled();
    press("k", { altKey: true });
    expect(callback).not.toHaveBeenCalled();
    press("k", { ctrlKey: true, altKey: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("rejects a ctrl or alt press the binding does not ask for", () => {
    renderHook(() => useKeyboardShortcut({ key: "k" }, callback));
    press("k", { ctrlKey: true });
    press("k", { altKey: true });
    expect(callback).not.toHaveBeenCalled();
  });

  it("ignores shift and meta when matching", () => {
    // Only alt and ctrl take part in the comparison for this hook.
    renderHook(() => useKeyboardShortcut({ key: "k" }, callback));
    press("k", { shiftKey: true });
    press("k", { metaKey: true });
    press("k", { shiftKey: true, metaKey: true });
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("prevents the default browser action", () => {
    renderHook(() => useKeyboardShortcut({ key: "k" }, callback));
    const event = new KeyboardEvent("keydown", {
      key: "k",
      cancelable: true,
    });
    const prevented = vi.spyOn(event, "preventDefault");
    act(() => {
      window.dispatchEvent(event);
    });
    expect(prevented).toHaveBeenCalled();
  });

  it("does not prevent the default for a non-matching key", () => {
    renderHook(() => useKeyboardShortcut({ key: "k" }, callback));
    const event = new KeyboardEvent("keydown", {
      key: "j",
      cancelable: true,
    });
    const prevented = vi.spyOn(event, "preventDefault");
    act(() => {
      window.dispatchEvent(event);
    });
    expect(prevented).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", () => {
    const { unmount } = renderHook(() =>
      useKeyboardShortcut({ key: "k" }, callback),
    );
    unmount();
    press("k");
    expect(callback).not.toHaveBeenCalled();
  });

  it("uses the latest callback after a rerender", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ cb }) => useKeyboardShortcut({ key: "k" }, cb),
      { initialProps: { cb: first } },
    );
    press("k");
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ cb: second });
    press("k");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("only keeps one listener when the binding object changes identity", () => {
    const { rerender } = renderHook(() =>
      useKeyboardShortcut({ key: "k" }, callback),
    );
    rerender();
    rerender();
    press("k");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("stops matching a key the new binding replaces", () => {
    const { rerender } = renderHook(
      ({ key }) => useKeyboardShortcut({ key }, callback),
      { initialProps: { key: "k" } },
    );
    press("k");
    expect(callback).toHaveBeenCalledTimes(1);

    rerender({ key: "j" });
    press("k");
    expect(callback).toHaveBeenCalledTimes(1);
    press("j");
    expect(callback).toHaveBeenCalledTimes(2);
  });
});