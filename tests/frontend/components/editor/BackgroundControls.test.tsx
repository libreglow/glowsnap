import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BackgroundControls from "@/components/editor/BackgroundControls";
import type { BackgroundSettings } from "@/lib/hooks/useBackground";

function bg(overrides: Partial<BackgroundSettings> = {}): BackgroundSettings {
  return {
    enabled: true,
    type: "linear",
    startColor: "#111111",
    endColor: "#222222",
    angle: 45,
    padding: 32,
    ...overrides,
  };
}

function handlers() {
  return {
    onToggle: vi.fn(),
    onTypeChange: vi.fn(),
    onStartColor: vi.fn(),
    onEndColor: vi.fn(),
    onAngle: vi.fn(),
    onPadding: vi.fn(),
  };
}

function renderControls(settings = bg()) {
  const props = handlers();
  const view = render(<BackgroundControls bg={settings} {...props} />);
  return { ...props, ...view };
}

const colorInputs = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('input[type="color"]')) as HTMLInputElement[];

const ranges = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('input[type="range"]')) as HTMLInputElement[];

describe("BackgroundControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always renders the toggle", () => {
    renderControls(bg({ enabled: false }));
    expect(screen.getByTitle("Toggle Background")).toBeInTheDocument();
  });

  it("hides the settings while the background is disabled", () => {
    renderControls(bg({ enabled: false }));
    expect(screen.queryByText("Start")).not.toBeInTheDocument();
    expect(screen.queryByText("Linear")).not.toBeInTheDocument();
    expect(screen.queryByText("Angle")).not.toBeInTheDocument();
    expect(screen.queryByText("Pad")).not.toBeInTheDocument();
  });

  it("shows the settings while the background is enabled", () => {
    renderControls();
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("End")).toBeInTheDocument();
    expect(screen.getByText("Angle")).toBeInTheDocument();
    expect(screen.getByText("Pad")).toBeInTheDocument();
  });

  it("mirrors the enabled state on the toggle", () => {
    renderControls(bg({ enabled: true }));
    expect(screen.getByTitle("Toggle Background")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("requests a toggle", async () => {
    const { onToggle } = renderControls(bg({ enabled: true }));
    await userEvent.click(screen.getByTitle("Toggle Background"));
    expect(onToggle).toHaveBeenCalled();
  });

  it("offers both gradient types", () => {
    renderControls();
    expect(screen.getByRole("button", { name: /Linear/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Radial/ })).toBeInTheDocument();
  });

  it("highlights the active gradient type", () => {
    renderControls(bg({ type: "radial" }));
    expect(screen.getByRole("button", { name: /Radial/ }).className).toContain(
      "bg-white/20",
    );
    expect(screen.getByRole("button", { name: /Linear/ }).className).not.toContain(
      "bg-white/20",
    );
  });

  it("switches to a linear gradient", async () => {
    const { onTypeChange } = renderControls(bg({ type: "radial" }));
    await userEvent.click(screen.getByRole("button", { name: /Linear/ }));
    expect(onTypeChange).toHaveBeenCalledWith("linear");
  });

  it("switches to a radial gradient", async () => {
    const { onTypeChange } = renderControls(bg({ type: "linear" }));
    await userEvent.click(screen.getByRole("button", { name: /Radial/ }));
    expect(onTypeChange).toHaveBeenCalledWith("radial");
  });

  it("shows both gradient colours", () => {
    const { container } = renderControls();
    const inputs = colorInputs(container);
    expect(inputs.map((i) => i.value)).toEqual(["#111111", "#222222"]);
  });

  it("reports a start colour change", () => {
    const { container, onStartColor } = renderControls();
    fireEvent.change(colorInputs(container)[0], { target: { value: "#abcdef" } });
    expect(onStartColor).toHaveBeenCalledWith("#abcdef");
  });

  it("reports an end colour change", () => {
    const { container, onEndColor } = renderControls();
    fireEvent.change(colorInputs(container)[1], { target: { value: "#fedcba" } });
    expect(onEndColor).toHaveBeenCalledWith("#fedcba");
  });

  it("formats the angle to one decimal", () => {
    renderControls(bg({ angle: 90 }));
    expect(screen.getByText("90.0°")).toBeInTheDocument();
  });

  it("keeps the angle as a number", () => {
    renderControls(bg({ angle: 12.34 }));
    expect(screen.getByText("12.3°")).toBeInTheDocument();
  });

  it("exposes the angle slider with its bounds", () => {
    const { container } = renderControls(bg({ angle: 30 }));
    const slider = ranges(container)[0];
    expect(slider).toHaveAttribute("aria-valuenow", "30");
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "360");
  });

  it("shows the padding in pixels", () => {
    renderControls(bg({ padding: 64 }));
    expect(screen.getByText("64px")).toBeInTheDocument();
  });

  it("exposes the padding slider with its bounds", () => {
    const { container } = renderControls(bg({ padding: 64 }));
    const slider = ranges(container)[1];
    expect(slider).toHaveAttribute("aria-valuenow", "64");
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "200");
  });

  it("renders one slider per numeric setting", () => {
    const { container } = renderControls();
    expect(ranges(container)).toHaveLength(2);
  });

  it("keeps the background toggle usable with zero padding", () => {
    const { container } = renderControls(bg({ padding: 0, angle: 0 }));
    expect(ranges(container).map((r) => r.getAttribute("aria-valuenow"))).toEqual([
      "0",
      "0",
    ]);
    expect(screen.getByText("0.0°")).toBeInTheDocument();
    expect(screen.getByText("0px")).toBeInTheDocument();
  });
});