import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ToolButton from "@/components/ToolButton";

describe("ToolButton", () => {
  it("renders its label and icon", () => {
    render(
      <ToolButton icon={<svg data-testid="icon" />} label="Full Screen" onClick={() => {}} />,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText(/Full Screen/)).toBeInTheDocument();
  });

  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<ToolButton icon={<span />} label="Record" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows the shortcut hint when one is provided", () => {
    render(<ToolButton icon={<span />} label="Record" shortcut="Alt+3" />);
    expect(screen.getByText("Alt+3")).toBeInTheDocument();
  });

  it("omits the shortcut hint when there is none", () => {
    const { container } = render(<ToolButton icon={<span />} label="Record" />);
    expect(container.textContent).toBe("Record");
  });

  it("stays clickable without an onClick handler", async () => {
    render(<ToolButton icon={<span />} label="Record" />);
    await expect(
      userEvent.click(screen.getByRole("button")),
    ).resolves.not.toThrow();
  });

  it("marks the button as non-draggable for the Wails window", () => {
    render(<ToolButton icon={<span />} label="Record" />);
    expect(screen.getByRole("button").className).toContain("wails-no-drag");
  });
});