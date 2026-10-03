import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import InlineTextEditor from "@/components/editor/InlineTextEditor";

function props(overrides: Record<string, unknown> = {}) {
  return {
    value: "hello",
    onChange: vi.fn(),
    onCommit: vi.fn(),
    onCancel: vi.fn(),
    left: 12,
    top: 24,
    rotation: 0,
    fontFamily: "Inter",
    fontSize: 32,
    fontWeight: 400,
    fontStyle: "normal" as const,
    color: "#ff0000",
    lineHeight: 1.2,
    direction: "ltr" as const,
    align: "left" as const,
    maxWidth: 400,
    onMetrics: vi.fn(),
    ...overrides,
  };
}

function renderEditor(overrides: Record<string, unknown> = {}) {
  const p = props(overrides);
  const view = render(<InlineTextEditor {...p} />);
  return { ...p, textarea: screen.getByRole("textbox") as HTMLTextAreaElement, ...view };
}

describe("InlineTextEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the current text", () => {
    const { textarea } = renderEditor();
    expect(textarea.value).toBe("hello");
  });

  it("focuses the textarea on mount", () => {
    const { textarea } = renderEditor();
    expect(document.activeElement).toBe(textarea);
  });

  it("selects the placeholder so typing replaces it", () => {
    renderEditor({ value: "Text" });
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe("Text".length);
  });

  it("puts the caret at the end for existing text", () => {
    renderEditor({ value: "abc" });
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.selectionStart).toBe(3);
    expect(textarea.selectionEnd).toBe(3);
  });

  it("reports every keystroke", () => {
    const { onChange, textarea } = renderEditor();
    fireEvent.change(textarea, { target: { value: "hello!" } });
    expect(onChange).toHaveBeenCalledWith("hello!");
  });

  it("positions the textarea", () => {
    const { textarea } = renderEditor({ left: 5, top: 7 });
    expect(textarea.style.left).toBe("5px");
    expect(textarea.style.top).toBe("7px");
  });

  it("omits the transform without a rotation", () => {
    const { textarea } = renderEditor({ rotation: 0 });
    expect(textarea.style.transform).toBe("");
  });

  it("applies a rotation", () => {
    const { textarea } = renderEditor({ rotation: 15 });
    expect(textarea.style.transform).toBe("rotate(15deg)");
  });

  it("applies the font styling", () => {
    const { textarea } = renderEditor({
      fontFamily: "Georgia",
      fontSize: 18,
      fontWeight: 700,
      fontStyle: "italic",
      lineHeight: 2,
    });
    expect(textarea.style.fontFamily).toBe("Georgia");
    expect(textarea.style.fontSize).toBe("18px");
    expect(textarea.style.fontWeight).toBe("700");
    expect(textarea.style.fontStyle).toBe("italic");
    expect(textarea.style.lineHeight).toBe("2");
  });

  it("accepts a string font weight", () => {
    const { textarea } = renderEditor({ fontWeight: "bold" });
    expect(textarea.style.fontWeight).toBe("bold");
  });

  it("uses the colour for the text and caret", () => {
    const { textarea } = renderEditor({ color: "#00ff00" });
    expect(textarea.style.color).toBe("rgb(0, 255, 0)");
    expect(textarea.style.caretColor).toBe("rgb(0, 255, 0)");
  });

  it("defaults the letter spacing to zero", () => {
    const { textarea } = renderEditor();
    expect(textarea.style.letterSpacing).toBe("0px");
  });

  it("applies a letter spacing", () => {
    const { textarea } = renderEditor({ letterSpacing: 3 });
    expect(textarea.style.letterSpacing).toBe("3px");
  });

  it("defaults the decoration to none", () => {
    const { textarea } = renderEditor();
    expect(textarea.style.textDecoration).toBe("none");
  });

  it("applies a text decoration", () => {
    const { textarea } = renderEditor({ textDecoration: "underline" });
    expect(textarea.style.textDecoration).toBe("underline");
  });

  it("applies direction and alignment", () => {
    const { textarea } = renderEditor({ direction: "rtl", align: "right" });
    expect(textarea.style.direction).toBe("rtl");
    expect(textarea.style.textAlign).toBe("right");
  });

  it("disables browser spellcheck and autocorrect", () => {
    const { textarea } = renderEditor();
    expect(textarea.getAttribute("spellcheck")).toBe("false");
    expect(textarea.getAttribute("autocomplete")).toBe("off");
    expect(textarea.getAttribute("autocorrect")).toBe("off");
    expect(textarea.getAttribute("autocapitalize")).toBe("off");
  });

  it("commits on blur", () => {
    const { onCommit, textarea } = renderEditor();
    fireEvent.blur(textarea);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("commits on Enter", () => {
    const { onCommit, textarea } = renderEditor();
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("does not commit on Shift+Enter", () => {
    const { onCommit, textarea } = renderEditor();
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("cancels on Escape", () => {
    const { onCancel, textarea } = renderEditor();
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not commit on Escape", () => {
    const { onCommit, textarea } = renderEditor();
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("ignores other keys", () => {
    const { onCommit, onCancel, textarea } = renderEditor();
    fireEvent.keyDown(textarea, { key: "a" });
    fireEvent.keyDown(textarea, { key: "Tab" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("reports metrics after layout", () => {
    const { onMetrics } = renderEditor();
    expect(onMetrics).toHaveBeenCalledTimes(1);
    const [width, height] = onMetrics.mock.calls[0];
    expect(width).toBeGreaterThanOrEqual(20);
    expect(typeof height).toBe("number");
  });

  it("re-measures when the text changes", () => {
    const onMetrics = vi.fn();
    const { rerender } = render(<InlineTextEditor {...props({ onMetrics })} />);
    onMetrics.mockClear();

    rerender(
      <InlineTextEditor
        {...props({ value: "a much longer line of text", onMetrics })}
      />,
    );
    expect(onMetrics).toHaveBeenCalled();
  });

  it("re-measures when the font size changes", () => {
    const onMetrics = vi.fn();
    const { rerender } = render(<InlineTextEditor {...props({ onMetrics })} />);
    onMetrics.mockClear();

    rerender(<InlineTextEditor {...props({ fontSize: 64, onMetrics })} />);
    expect(onMetrics).toHaveBeenCalled();
  });

  it("never reports a width below the minimum", () => {
    const onMetrics = vi.fn();
    render(<InlineTextEditor {...props({ value: "", maxWidth: 5, onMetrics })} />);
    expect(onMetrics.mock.calls.at(-1)?.[0]).toBe(20);
  });

  it("uses the wrap width when one is given", () => {
    const onMetrics = vi.fn();
    render(
      <InlineTextEditor {...props({ wrapWidth: 150, maxWidth: 400, onMetrics })} />,
    );
    expect(onMetrics.mock.calls.at(-1)?.[0]).toBe(150);
  });

  it("ignores a zero wrap width", () => {
    const onMetrics = vi.fn();
    render(
      <InlineTextEditor {...props({ wrapWidth: 0, maxWidth: 400, onMetrics })} />,
    );
    expect(onMetrics.mock.calls.at(-1)?.[0]).toBeGreaterThanOrEqual(20);
  });

  it("centres the transform origin on the measured box", () => {
    const onMetrics = vi.fn();
    render(<InlineTextEditor {...props({ wrapWidth: 120, onMetrics })} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.style.transformOrigin).toContain("60px");
  });
});