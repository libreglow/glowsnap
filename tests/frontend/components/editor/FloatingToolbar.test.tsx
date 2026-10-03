import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FloatingToolbar from "@/components/editor/FloatingToolbar";
import { shapeEntry } from "@tests/test-support/wails";
import type { ShapeConfig } from "@/types/types";

vi.mock("@/components/editor/FontPicker", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <select
      aria-label="Font family"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="Inter">Inter</option>
      <option value="Georgia">Georgia</option>
    </select>
  ),
}));

const RECT = new DOMRect(0, 100, 800, 600);

function renderToolbar(
  selectedShape: ShapeConfig | null = shapeEntry(),
  overrides: Record<string, unknown> = {},
) {
  const props = {
    visible: true,
    stageContainerRect: RECT,
    stageSize: { width: 800, height: 600 },
    zoom: 1,
    pan: { x: 0, y: 0 },
    onUpdateShape: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    color: "#ff3b30",
    setColor: vi.fn(),
    fontFamily: "Inter",
    setFontFamily: vi.fn(),
    fontSize: 24,
    setFontSize: vi.fn(),
    opacity: 1,
    setOpacity: vi.fn(),
    isBold: false,
    setIsBold: vi.fn(),
    isItalic: false,
    setIsItalic: vi.fn(),
    isUnderline: false,
    setIsUnderline: vi.fn(),
    isStrikethrough: false,
    setIsStrikethrough: vi.fn(),
    textAlign: "left" as const,
    setTextAlign: vi.fn(),
    lineHeight: 1.2,
    setLineHeight: vi.fn(),
    letterSpacing: 0,
    setLetterSpacing: vi.fn(),
    fillEnabled: false,
    setFillEnabled: vi.fn(),
    ...overrides,
    selectedShape,
  };
  const view = render(<FloatingToolbar {...props} />);
  return { ...props, ...view };
}

const numbers = () => screen.getAllByRole("spinbutton") as HTMLInputElement[];
const opacityInput = () => numbers().at(-2) as HTMLInputElement;
const rotationInput = () => numbers().at(-1) as HTMLInputElement;
const ranges = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('input[type="range"]')) as HTMLInputElement[];

describe("FloatingToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing without a selection", () => {
    renderToolbar(null);
    expect(document.querySelector(".absolute")).toBeNull();
  });

  it("renders nothing while hidden", () => {
    renderToolbar(shapeEntry(), { visible: false });
    expect(document.querySelector(".absolute")).toBeNull();
  });

  it("renders the shared controls for a selection", () => {
    renderToolbar();
    expect(screen.getByTitle("Delete")).toBeInTheDocument();
    expect(screen.getByTitle("Duplicate")).toBeInTheDocument();
  });

  it("anchors the toolbar near the shape", () => {
    const { container } = renderToolbar();
    const toolbar = container.querySelector(".absolute") as HTMLElement;
    const stageLeft = window.innerWidth / 2 - 800 / 2;
    expect(toolbar.style.left).toBe(`${stageLeft + 40 + 60}px`);
    expect(toolbar.style.top).toBe(`${100 + 60 - 160}px`);
  });

  it("offsets the toolbar for zoom and pan", () => {
    const { container } = renderToolbar(shapeEntry(), {
      zoom: 2,
      pan: { x: 15, y: -5 },
    });
    const toolbar = container.querySelector(".absolute") as HTMLElement;
    const stageLeft = window.innerWidth / 2 - 800 / 2;
    const zoomOffsetX = (800 * (1 - 2)) / 2;
    const zoomOffsetY = (600 * (1 - 2)) / 2;
    expect(toolbar.style.left).toBe(
      `${stageLeft + zoomOffsetX + 40 * 2 + 15 + 60}px`,
    );
    expect(toolbar.style.top).toBe(
      `${100 + zoomOffsetY + 60 * 2 - 5 - 160}px`,
    );
  });

  it("keeps the toolbar out of the way at a zoomed-out stage", () => {
    const { container } = renderToolbar(shapeEntry(), { zoom: 0.5 });
    const toolbar = container.querySelector(".absolute") as HTMLElement;
    const stageLeft = window.innerWidth / 2 - 800 / 2;
    expect(toolbar.style.left).toBe(`${stageLeft + 200 + 20 + 60}px`);
  });

  it("reports a colour change", () => {
    const { container, setColor } = renderToolbar();
    const color = container.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.change(color, { target: { value: "#00ff00" } });
    expect(setColor).toHaveBeenCalledWith("#00ff00");
  });

  it("duplicates the selected shape", async () => {
    const { onDuplicate } = renderToolbar();
    await userEvent.click(screen.getByTitle("Duplicate"));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDuplicate.mock.calls[0][0].id).toBe("shape-1");
  });

  it("deletes the selected shape", async () => {
    const { onDelete } = renderToolbar();
    await userEvent.click(screen.getByTitle("Delete"));
    expect(onDelete).toHaveBeenCalledWith("shape-1");
  });

  it.each([["rect"], ["circle"]] as const)(
    "offers the fill toggle for a %s",
    (type) => {
      renderToolbar(shapeEntry({ type }));
      expect(screen.getByTitle("No fill")).toBeInTheDocument();
    },
  );

  it("hides the fill toggle for other shapes", () => {
    renderToolbar(shapeEntry({ type: "arrow" }));
    expect(screen.queryByTitle("No fill")).not.toBeInTheDocument();
  });

  it("reflects an enabled fill", () => {
    renderToolbar(shapeEntry({ type: "rect" }), { fillEnabled: true });
    expect(screen.getByTitle("Fill enabled")).toBeInTheDocument();
  });

  it("fills the shape with the current colour when enabled", async () => {
    const { onUpdateShape, setFillEnabled } = renderToolbar(
      shapeEntry({ type: "rect" }),
      { color: "#123456", fillEnabled: false },
    );
    await userEvent.click(screen.getByTitle("No fill"));
    expect(setFillEnabled).toHaveBeenCalledWith(true);
    expect(onUpdateShape).toHaveBeenCalledWith("shape-1", {
      fillEnabled: true,
      fill: "#123456",
    });
  });

  it("clears the fill when disabled", async () => {
    const { onUpdateShape } = renderToolbar(
      shapeEntry({ type: "rect" }),
      { fillEnabled: true },
    );
    await userEvent.click(screen.getByTitle("Fill enabled"));
    expect(onUpdateShape).toHaveBeenCalledWith("shape-1", {
      fillEnabled: false,
      fill: "transparent",
    });
  });

  it("shows text styling for a text", () => {
    renderToolbar(shapeEntry({ type: "text" }));
    expect(screen.getByTitle("Bold")).toBeInTheDocument();
    expect(screen.getByLabelText("Font family")).toBeInTheDocument();
    expect(screen.queryByTitle("No fill")).not.toBeInTheDocument();
  });

  it("hides text styling for shapes", () => {
    renderToolbar(shapeEntry({ type: "rect" }));
    expect(screen.queryByTitle("Bold")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Font family")).not.toBeInTheDocument();
  });

  it.each([
    ["Bold", "setIsBold"],
    ["Italic", "setIsItalic"],
    ["Underline", "setIsUnderline"],
    ["Strikethrough", "setIsStrikethrough"],
  ] as const)("toggles %s for a text shape", async (label, setter) => {
    const props = renderToolbar(shapeEntry({ type: "text" }));
    await userEvent.click(screen.getByTitle(label));
    expect(props[setter].mock.calls[0][0]).toBe(true);
  });

  it("mirrors the pressed text toggles", () => {
    renderToolbar(shapeEntry({ type: "text" }), { isBold: true });
    expect(screen.getByTitle("Bold")).toHaveAttribute("aria-pressed", "true");
  });

  it("cycles the alignment and writes it to the shape", async () => {
    const { onUpdateShape, setTextAlign } = renderToolbar(
      shapeEntry({ type: "text" }),
      { textAlign: "center" },
    );
    await userEvent.click(screen.getByTitle("Align Center (click for right)"));
    expect(setTextAlign).toHaveBeenCalledWith("right");
    expect(onUpdateShape).toHaveBeenCalledWith("shape-1", { align: "right" });
  });

  it("reports a font family change", async () => {
    const { setFontFamily } = renderToolbar(shapeEntry({ type: "text" }));
    await userEvent.selectOptions(screen.getByLabelText("Font family"), "Georgia");
    expect(setFontFamily).toHaveBeenCalledWith("Georgia");
  });

  it("shows the shape font size ahead of the toolbar default", () => {
    renderToolbar(shapeEntry({ type: "text", fontSize: 48 }), { fontSize: 24 });
    expect(numbers()[0]).toHaveValue(48);
  });

  it("falls back to the built-in font size when the shape has none", () => {
    renderToolbar(shapeEntry({ type: "text", fontSize: undefined }), {
      fontSize: 30,
    });
    expect(numbers()[0]).toHaveValue(24);
  });

  it("writes a font size change to the shape", () => {
    const { onUpdateShape, setFontSize } = renderToolbar(
      shapeEntry({ type: "text" }),
    );
    fireEvent.change(numbers()[0], { target: { value: "60" } });
    expect(setFontSize).toHaveBeenCalledWith(60);
    expect(onUpdateShape).toHaveBeenCalledWith("shape-1", { fontSize: 60 });
  });

  it("clamps the font size on blur", () => {
    const { onUpdateShape } = renderToolbar(shapeEntry({ type: "text" }));
    fireEvent.blur(numbers()[0], { target: { value: "400" } });
    expect(onUpdateShape).toHaveBeenLastCalledWith("shape-1", { fontSize: 120 });
  });

  it("writes a line height change to the shape", () => {
    const { onUpdateShape, setLineHeight } = renderToolbar(
      shapeEntry({ type: "text" }),
    );
    fireEvent.change(numbers()[1], { target: { value: "2" } });
    expect(setLineHeight).toHaveBeenCalledWith(2);
    expect(onUpdateShape).toHaveBeenCalledWith("shape-1", { lineHeight: 2 });
  });

  it("clamps the line height on blur", () => {
    const { onUpdateShape } = renderToolbar(shapeEntry({ type: "text" }));
    fireEvent.blur(numbers()[1], { target: { value: "9" } });
    expect(onUpdateShape).toHaveBeenLastCalledWith("shape-1", { lineHeight: 3 });
  });

  it("writes a letter spacing change to the shape", () => {
    const { onUpdateShape, setLetterSpacing } = renderToolbar(
      shapeEntry({ type: "text" }),
    );
    fireEvent.change(numbers()[2], { target: { value: "4" } });
    expect(setLetterSpacing).toHaveBeenCalledWith(4);
    expect(onUpdateShape).toHaveBeenCalledWith("shape-1", { letterSpacing: 4 });
  });

  it("clamps the letter spacing on blur", () => {
    const { onUpdateShape } = renderToolbar(shapeEntry({ type: "text" }));
    fireEvent.blur(numbers()[2], { target: { value: "-40" } });
    expect(onUpdateShape).toHaveBeenLastCalledWith("shape-1", {
      letterSpacing: -10,
    });
  });

  it("shows the opacity as a percentage", () => {
    renderToolbar(shapeEntry({ opacity: 0.4 }));
    expect(opacityInput()).toHaveValue(40);
  });

  it("defaults the opacity to fully opaque", () => {
    renderToolbar(shapeEntry({ opacity: undefined }));
    expect(opacityInput()).toHaveValue(100);
  });

  it("writes an opacity change as a fraction", () => {
    const { onUpdateShape, setOpacity } = renderToolbar();
    fireEvent.change(opacityInput(), { target: { value: "25" } });
    expect(setOpacity).toHaveBeenCalledWith(0.25);
    expect(onUpdateShape).toHaveBeenCalledWith("shape-1", { opacity: 0.25 });
  });

  it("clamps the opacity on blur", () => {
    const { onUpdateShape } = renderToolbar();
    fireEvent.blur(opacityInput(), { target: { value: "500" } });
    expect(onUpdateShape).toHaveBeenLastCalledWith("shape-1", { opacity: 1 });
  });

  it("shows the rotation to one decimal", () => {
    renderToolbar(shapeEntry({ rotation: 30 }));
    expect(rotationInput()).toHaveValue(30);
  });

  it("defaults the rotation to zero", () => {
    renderToolbar(shapeEntry({ rotation: undefined }));
    expect(rotationInput()).toHaveValue(0);
  });

  it("writes a rotation change to the shape", () => {
    const { onUpdateShape } = renderToolbar();
    fireEvent.change(rotationInput(), { target: { value: "-45" } });
    expect(onUpdateShape).toHaveBeenCalledWith("shape-1", { rotation: -45 });
  });

  it("clamps the rotation on blur", () => {
    const { onUpdateShape } = renderToolbar();
    fireEvent.blur(rotationInput(), { target: { value: "900" } });
    expect(onUpdateShape).toHaveBeenLastCalledWith("shape-1", { rotation: 180 });
  });

  it("renders one slider per shape property", () => {
    const { container } = renderToolbar(shapeEntry({ type: "text" }));
    expect(ranges(container)).toHaveLength(5);
  });

  it("exposes the rotation slider bounds", () => {
    const { container } = renderToolbar(shapeEntry({ rotation: 0 }));
    const slider = ranges(container).at(-1) as HTMLInputElement;
    expect(slider).toHaveAttribute("min", "-180");
    expect(slider).toHaveAttribute("max", "180");
  });
});