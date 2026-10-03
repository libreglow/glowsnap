import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Palette from "@/components/Palette";

function setup(props: Partial<Record<string, unknown>> = {}) {
  const handlers = {
    onTakeScreenshot: vi.fn(),
    onTakeAreaScreenshot: vi.fn(),
    onSwitchToStudio: vi.fn(),
    onClose: vi.fn(),
    onStartRecording: vi.fn(),
    onOpenSettings: vi.fn(),
  };
  const customShortcuts = props.customShortcuts as
    | Record<string, string>
    | undefined;
  const view = render(
    <Palette {...handlers} {...props} customShortcuts={customShortcuts} />,
  );
  return { ...handlers, unmount: view.unmount };
}

function press(key: string, init: KeyboardEventInit = {}, target?: EventTarget) {
  const event = new KeyboardEvent("keydown", {
    key,
    cancelable: true,
    bubbles: true,
    ...init,
  });
  (target ?? window).dispatchEvent(event);
  return event;
}

describe("Palette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the capture tools, Studio and settings", () => {
    setup();
    expect(screen.getByText(/Full Screen/)).toBeInTheDocument();
    expect(screen.getByText(/Select Area/)).toBeInTheDocument();
    expect(screen.getByText(/Record/)).toBeInTheDocument();
    expect(screen.getByText("Studio")).toBeInTheDocument();
    expect(screen.getByTitle("Settings")).toBeInTheDocument();
  });

  it("takes a full screen screenshot from the button", async () => {
    const h = setup();
    await userEvent.click(screen.getByText(/Full Screen/));
    expect(h.onTakeScreenshot).toHaveBeenCalledTimes(1);
  });

  it("takes an area screenshot from the button", async () => {
    const h = setup();
    await userEvent.click(screen.getByText(/Select Area/));
    expect(h.onTakeAreaScreenshot).toHaveBeenCalledTimes(1);
  });

  it("starts recording from the button", async () => {
    const h = setup();
    await userEvent.click(screen.getByText(/Record/));
    expect(h.onStartRecording).toHaveBeenCalledTimes(1);
  });

  it("opens the studio from the button", async () => {
    const h = setup();
    await userEvent.click(screen.getByText("Studio"));
    expect(h.onSwitchToStudio).toHaveBeenCalledTimes(1);
  });

  it("opens settings from the button", async () => {
    const h = setup();
    await userEvent.click(screen.getByTitle("Settings"));
    expect(h.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("runs the full-screen shortcut Alt+1", () => {
    const h = setup();
    press("1", { altKey: true });
    expect(h.onTakeScreenshot).toHaveBeenCalledTimes(1);
  });

  it("runs the area shortcut Alt+2", () => {
    const h = setup();
    press("2", { altKey: true });
    expect(h.onTakeAreaScreenshot).toHaveBeenCalledTimes(1);
  });

  it("runs the record shortcut Alt+3", () => {
    const h = setup();
    press("3", { altKey: true });
    expect(h.onStartRecording).toHaveBeenCalledTimes(1);
  });

  it("runs the studio shortcut Alt+4", () => {
    const h = setup();
    press("4", { altKey: true });
    expect(h.onSwitchToStudio).toHaveBeenCalledTimes(1);
  });

  it("does not fire without Alt", () => {
    const h = setup();
    press("1");
    expect(h.onTakeScreenshot).not.toHaveBeenCalled();
  });

  it("does not fire when another modifier is also held", () => {
    const h = setup();
    press("1", { altKey: true, ctrlKey: true });
    expect(h.onTakeScreenshot).not.toHaveBeenCalled();
  });

  it("runs only the first matching action for one key press", () => {
    const h = setup();
    press("1", { altKey: true });
    expect(h.onTakeScreenshot).toHaveBeenCalledTimes(1);
    expect(h.onTakeAreaScreenshot).not.toHaveBeenCalled();
  });

  it("prevents the default browser action for a shortcut", () => {
    setup();
    const event = press("1", { altKey: true });
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not prevent the default for an unrelated key", () => {
    setup();
    const event = press("q");
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores shortcuts typed into a text field", () => {
    const h = setup();
    const input = document.createElement("input");
    document.body.appendChild(input);
    press("1", { altKey: true }, input);
    expect(h.onTakeScreenshot).not.toHaveBeenCalled();
    input.remove();
  });

  it("ignores shortcuts typed into a textarea", () => {
    const h = setup();
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    press("3", { altKey: true }, textarea);
    expect(h.onStartRecording).not.toHaveBeenCalled();
    textarea.remove();
  });

  it("uses a custom shortcut override", () => {
    const h = setup({ customShortcuts: { "palette-full-screen": "Ctrl+Alt+S" } });
    press("1", { altKey: true });
    expect(h.onTakeScreenshot).not.toHaveBeenCalled();

    press("s", { ctrlKey: true, altKey: true });
    expect(h.onTakeScreenshot).toHaveBeenCalledTimes(1);
  });

  it("shows the overridden combo in the tooltip", () => {
    setup({ customShortcuts: { "palette-record": "Ctrl+Alt+R" } });
    expect(screen.getByText("Ctrl+Alt+R")).toBeInTheDocument();
    expect(screen.queryByText("Alt+3")).not.toBeInTheDocument();
  });

  it("keeps default hints for actions without an override", () => {
    setup({ customShortcuts: { "palette-record": "Ctrl+Alt+R" } });
    expect(screen.getByText("Alt+1")).toBeInTheDocument();
    expect(screen.getByText("Alt+2")).toBeInTheDocument();
  });

  it("shows all default hints when no overrides are given", () => {
    setup();
    expect(screen.getByText("Alt+1")).toBeInTheDocument();
    expect(screen.getByText("Alt+2")).toBeInTheDocument();
    expect(screen.getByText("Alt+3")).toBeInTheDocument();
  });

  it("stops listening after unmount", () => {
    const h = setup();
    h.unmount();
    press("1", { altKey: true });
    expect(h.onTakeScreenshot).not.toHaveBeenCalled();
  });

  it("renders with no handlers wired", async () => {
    render(<Palette />);
    await expect(userEvent.click(screen.getByText("Studio"))).resolves.not.toThrow();
  });
});