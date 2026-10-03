import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OptionsBar from "@/components/editor/OptionsBar";
import type { Tool } from "@/types/types";

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

function setters() {
  return {
    setColor: vi.fn(),
    setStrokeWidth: vi.fn(),
    setOpacity: vi.fn(),
    setFontSize: vi.fn(),
    setFontFamily: vi.fn(),
    setIsBold: vi.fn(),
    setIsItalic: vi.fn(),
    setIsUnderline: vi.fn(),
    setIsStrikethrough: vi.fn(),
    setTextAlign: vi.fn(),
    setLineHeight: vi.fn(),
    setLetterSpacing: vi.fn(),
    setFillEnabled: vi.fn(),
  };
}

function renderBar(
  selectedTool: Tool = "rectangle",
  overrides: Record<string, unknown> = {},
) {
  const props = {
    selectedTool,
    color: "#ff0000",
    strokeWidth: 3,
    opacity: 0.5,
    fontSize: 24,
    fontFamily: "Inter",
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    textAlign: "left" as const,
    lineHeight: 1.2,
    letterSpacing: 0,
    fillEnabled: false,
    ...setters(),
    ...overrides,
  };
  return { ...props, ...render(<OptionsBar {...props} />) };
}

const numberInputs = () =>
  screen.getAllByRole("spinbutton") as HTMLInputElement[];

const colorInput = (container: HTMLElement) =>
  container.querySelector('input[type="color"]') as HTMLInputElement;

const rangeInputs = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('input[type="range"]')) as HTMLInputElement[];

describe("OptionsBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([["select"], ["crop"], ["eraser"]] as [Tool][])(
    "renders nothing for the %s tool",
    (tool) => {
      const { container } = render(
        <OptionsBar
          selectedTool={tool}
          color="#fff"
          strokeWidth={1}
          opacity={1}
          fontSize={12}
          fontFamily="Inter"
          isBold={false}
          isItalic={false}
          isUnderline={false}
          isStrikethrough={false}
          textAlign="left"
          lineHeight={1}
          letterSpacing={0}
          fillEnabled={false}
          {...setters()}
        />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("renders the shared controls for drawing tools", () => {
    const { container } = renderBar("rectangle");
    expect(colorInput(container)).toBeTruthy();
    expect(numberInputs()).toHaveLength(2);
  });

  it("reports a colour change", () => {
    const { container, setColor } = renderBar("rectangle");
    fireEvent.change(colorInput(container), {
      target: { value: "#00ff00" },
    });
    expect(setColor).toHaveBeenCalledWith("#00ff00");
  });

  it("shows the current colour", () => {
    const { container } = renderBar("rectangle", { color: "#123456" });
    expect(colorInput(container).value).toBe("#123456");
  });

  it("accepts a raw stroke width while typing", () => {
    const { setStrokeWidth } = renderBar("rectangle");
    fireEvent.change(numberInputs()[0], { target: { value: "42" } });
    expect(setStrokeWidth).toHaveBeenCalledWith(42);
  });

  it("clamps the stroke width on blur", () => {
    const { setStrokeWidth } = renderBar("rectangle");
    fireEvent.blur(numberInputs()[0], { target: { value: "42" } });
    expect(setStrokeWidth).toHaveBeenLastCalledWith(20);
  });

  it("clamps a too small stroke width on blur", () => {
    const { setStrokeWidth } = renderBar("rectangle");
    fireEvent.blur(numberInputs()[0], { target: { value: "0" } });
    expect(setStrokeWidth).toHaveBeenLastCalledWith(1);
  });

  it("keeps an in-range stroke width on blur", () => {
    const { setStrokeWidth } = renderBar("rectangle");
    fireEvent.blur(numberInputs()[0], { target: { value: "7" } });
    expect(setStrokeWidth).toHaveBeenLastCalledWith(7);
  });

  it("reads an emptied stroke width as zero", () => {
    const { setStrokeWidth } = renderBar("rectangle");
    fireEvent.change(numberInputs()[0], { target: { value: "" } });
    expect(setStrokeWidth).toHaveBeenLastCalledWith(0);
  });

  it("clamps an emptied stroke width back to the minimum on blur", () => {
    const { setStrokeWidth } = renderBar("rectangle");
    fireEvent.blur(numberInputs()[0], { target: { value: "" } });
    expect(setStrokeWidth).toHaveBeenLastCalledWith(1);
  });

  it("shows opacity as a percentage", () => {
    renderBar("rectangle", { opacity: 0.75 });
    expect(numberInputs()[1]).toHaveValue(75);
  });

  it("converts an opacity percentage into a fraction", () => {
    const { setOpacity } = renderBar("rectangle");
    fireEvent.change(numberInputs()[1], { target: { value: "40" } });
    expect(setOpacity).toHaveBeenCalledWith(0.4);
  });

  it("clamps opacity on blur", () => {
    const { setOpacity } = renderBar("rectangle");
    fireEvent.blur(numberInputs()[1], { target: { value: "400" } });
    expect(setOpacity).toHaveBeenLastCalledWith(1);

    fireEvent.blur(numberInputs()[1], { target: { value: "0" } });
    expect(setOpacity).toHaveBeenLastCalledWith(0.1);
  });

  it("hides the fill toggle for stroke-only tools", () => {
    renderBar("arrow");
    expect(screen.queryByTitle("No fill")).not.toBeInTheDocument();
  });

  it("offers the fill toggle for rectangles", () => {
    renderBar("rectangle");
    expect(screen.getByTitle("No fill")).toHaveTextContent("No Fill");
  });

  it("offers the fill toggle for circles", () => {
    renderBar("circle");
    expect(screen.getByTitle("No fill")).toBeInTheDocument();
  });

  it("reflects the enabled fill state", () => {
    renderBar("circle", { fillEnabled: true });
    expect(screen.getByTitle("Fill enabled")).toHaveTextContent("Fill");
  });

  it("turns fill on and off", async () => {
    const { setFillEnabled } = renderBar("circle");
    await userEvent.click(screen.getByTitle("No fill"));
    expect(setFillEnabled).toHaveBeenCalledWith(true);
  });

  it("hides text controls for shapes", () => {
    renderBar("rectangle");
    expect(screen.queryByTitle("Bold")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Font family")).not.toBeInTheDocument();
  });

  it("shows all text controls for the text tool", () => {
    renderBar("text");
    expect(screen.getByTitle("Bold")).toBeInTheDocument();
    expect(screen.getByTitle("Italic")).toBeInTheDocument();
    expect(screen.getByTitle("Underline")).toBeInTheDocument();
    expect(screen.getByTitle("Strikethrough")).toBeInTheDocument();
    expect(screen.getByLabelText("Font family")).toBeInTheDocument();
    expect(numberInputs()).toHaveLength(5);
  });

  it.each([
    ["Bold", "setIsBold"],
    ["Italic", "setIsItalic"],
    ["Underline", "setIsUnderline"],
    ["Strikethrough", "setIsStrikethrough"],
  ] as const)("toggles %s", async (label, setter) => {
    const props = renderBar("text");
    await userEvent.click(screen.getByTitle(label));
    expect(props[setter].mock.calls[0][0]).toBe(true);
  });

  it.each([
    ["Bold", "setIsBold"],
    ["Italic", "setIsItalic"],
    ["Underline", "setIsUnderline"],
    ["Strikethrough", "setIsStrikethrough"],
  ] as const)("mirrors the pressed state of %s", (label, setter) => {
    renderBar("text", { [setter.replace("setIs", "is")]: true } as Record<string, unknown>);
    expect(screen.getByTitle(label)).toHaveAttribute("aria-pressed", "true");
  });

  it("cycles the alignment left to center", async () => {
    const { setTextAlign } = renderBar("text");
    await userEvent.click(screen.getByTitle("Align Left (click for center)"));
    expect(setTextAlign).toHaveBeenCalledWith("center");
  });

  it("cycles the alignment center to right", async () => {
    const { setTextAlign } = renderBar("text", { textAlign: "center" });
    await userEvent.click(screen.getByTitle("Align Center (click for right)"));
    expect(setTextAlign).toHaveBeenCalledWith("right");
  });

  it("wraps the alignment back to left", async () => {
    const { setTextAlign } = renderBar("text", { textAlign: "right" });
    await userEvent.click(screen.getByTitle("Align Right (click for left)"));
    expect(setTextAlign).toHaveBeenCalledWith("left");
  });

  it("reports a font family change", async () => {
    const { setFontFamily } = renderBar("text");
    await userEvent.selectOptions(screen.getByLabelText("Font family"), "Georgia");
    expect(setFontFamily).toHaveBeenCalledWith("Georgia");
  });

  it("updates the font size", () => {
    const { setFontSize } = renderBar("text");
    fireEvent.change(numberInputs()[2], { target: { value: "48" } });
    expect(setFontSize).toHaveBeenCalledWith(48);
  });

  it("clamps the font size on blur", () => {
    const { setFontSize } = renderBar("text");
    fireEvent.blur(numberInputs()[2], { target: { value: "99" } });
    expect(setFontSize).toHaveBeenLastCalledWith(72);
    fireEvent.blur(numberInputs()[2], { target: { value: "1" } });
    expect(setFontSize).toHaveBeenLastCalledWith(12);
  });

  it("updates the line height", () => {
    const { setLineHeight } = renderBar("text");
    fireEvent.change(numberInputs()[3], { target: { value: "1.8" } });
    expect(setLineHeight).toHaveBeenCalledWith(1.8);
  });

  it("clamps the line height on blur", () => {
    const { setLineHeight } = renderBar("text");
    fireEvent.blur(numberInputs()[3], { target: { value: "5" } });
    expect(setLineHeight).toHaveBeenLastCalledWith(3);
    fireEvent.blur(numberInputs()[3], { target: { value: "-2" } });
    expect(setLineHeight).toHaveBeenLastCalledWith(0);
  });

  it("updates the letter spacing", () => {
    const { setLetterSpacing } = renderBar("text");
    fireEvent.change(numberInputs()[4], { target: { value: "2.5" } });
    expect(setLetterSpacing).toHaveBeenCalledWith(2.5);
  });

  it("clamps the letter spacing on blur", () => {
    const { setLetterSpacing } = renderBar("text");
    fireEvent.blur(numberInputs()[4], { target: { value: "99" } });
    expect(setLetterSpacing).toHaveBeenLastCalledWith(20);
    fireEvent.blur(numberInputs()[4], { target: { value: "-99" } });
    expect(setLetterSpacing).toHaveBeenLastCalledWith(-10);
  });

  it("renders the pen controls", () => {
    const { container } = renderBar("pen");
    expect(colorInput(container)).toBeTruthy();
    expect(screen.queryByTitle("Bold")).not.toBeInTheDocument();
  });

  it("exposes a slider per numeric control", () => {
    const { container } = renderBar("text");
    expect(rangeInputs(container)).toHaveLength(5);
  });

  it("drives the stroke width slider value", () => {
    const { container } = renderBar("rectangle", { strokeWidth: 12 });
    expect(rangeInputs(container)[0]).toHaveAttribute("aria-valuenow", "12");
  });

  it("scales the opacity slider to a percentage", () => {
    const { container } = renderBar("rectangle", { opacity: 0.75 });
    expect(rangeInputs(container)[1]).toHaveAttribute("aria-valuenow", "75");
  });
});