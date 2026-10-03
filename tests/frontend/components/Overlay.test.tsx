import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Overlay from "@/components/Overlay";
import type { OverlayRect } from "@/types/types";

const IMAGE_URL = "http://127.0.0.1:34116/shot.png";

function loadImage(naturalWidth = 1024, naturalHeight = 768) {
  const img = screen.getByAltText("") as HTMLImageElement;
  Object.defineProperty(img, "naturalWidth", {
    configurable: true,
    value: naturalWidth,
  });
  Object.defineProperty(img, "naturalHeight", {
    configurable: true,
    value: naturalHeight,
  });
  fireEvent.load(img);
  return img;
}

function rootOf(container: HTMLElement) {
  return container.querySelector(".cursor-crosshair") as HTMLElement;
}

function selectionOf(container: HTMLElement) {
  return container.querySelector(".bg-red-500\\/20") as HTMLElement | null;
}

function sizeLabel() {
  return screen.getByText(/×/).textContent;
}

function drag(target: Element, from: { x: number; y: number }, to: { x: number; y: number }) {
  fireEvent.mouseDown(target, { button: 0, clientX: from.x, clientY: from.y });
  fireEvent.mouseMove(window, { clientX: to.x, clientY: to.y });
  fireEvent.mouseUp(window, { clientX: to.x, clientY: to.y });
}

describe("Overlay", () => {
  let onComplete: ReturnType<typeof vi.fn<(rect: OverlayRect) => void>>;
  let originalWidth: number;
  let originalHeight: number;

  beforeEach(() => {
    onComplete = vi.fn();
    originalWidth = window.innerWidth;
    originalHeight = window.innerHeight;
  });

  afterEach(() => {
    window.innerWidth = originalWidth;
    window.innerHeight = originalHeight;
  });

  it("renders the captured image as the selection backdrop", () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    const img = screen.getByAltText("") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(IMAGE_URL);
    expect(rootOf(container)).toBeTruthy();
  });

  it("starts with no selection", () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    expect(selectionOf(container)).toBeNull();
    expect(screen.getByText("Drag to select an area")).toBeInTheDocument();
  });

  it("creates a selection on drag", async () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    drag(rootOf(container), { x: 10, y: 20 }, { x: 110, y: 120 });

    const selection = await waitFor(() => selectionOf(container));
    expect(selection?.style.left).toBe("10px");
    expect(selection?.style.top).toBe("20px");
    expect(selection?.style.width).toBe("100px");
    expect(selection?.style.height).toBe("100px");
    expect(sizeLabel()).toBe("100 × 100");
    expect(screen.getByText("Selection ready")).toBeInTheDocument();
  });

  it("normalises a drag that goes up and to the left", async () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    drag(rootOf(container), { x: 200, y: 200 }, { x: 100, y: 150 });

    await waitFor(() => expect(selectionOf(container)).not.toBeNull());
    expect(selectionOf(container)?.style.left).toBe("100px");
    expect(selectionOf(container)?.style.top).toBe("150px");
    expect(selectionOf(container)?.style.width).toBe("100px");
    expect(selectionOf(container)?.style.height).toBe("50px");
  });

  it("clamps the selection to the viewport", async () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    drag(rootOf(container), { x: 10, y: 10 }, { x: 5000, y: 5000 });

    await waitFor(() => expect(selectionOf(container)).not.toBeNull());
    const selection = selectionOf(container) as HTMLElement;
    expect(selection.style.width).toBe(`${window.innerWidth - 10}px`);
    expect(selection.style.height).toBe(`${window.innerHeight - 10}px`);
  });

  it("ignores non-primary mouse buttons", async () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    fireEvent.mouseDown(rootOf(container), { button: 2, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 100, clientY: 100 });
    expect(selectionOf(container)).toBeNull();
  });

  it("ignores moves before a drag starts", () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    fireEvent.mouseMove(window, { clientX: 100, clientY: 100 });
    expect(selectionOf(container)).toBeNull();
  });

  it("replaces the selection when a new drag starts", async () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    drag(rootOf(container), { x: 0, y: 0 }, { x: 100, y: 100 });
    await waitFor(() => expect(selectionOf(container)).not.toBeNull());

    drag(rootOf(container), { x: 300, y: 300 }, { x: 400, y: 350 });
    await waitFor(() =>
      expect(selectionOf(container)?.style.left).toBe("300px"),
    );
    expect(sizeLabel()).toBe("100 × 50");
  });

  it("completes the selection with Enter", async () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    loadImage();
    drag(rootOf(container), { x: 10, y: 20 }, { x: 110, y: 120 });
    await waitFor(() => expect(selectionOf(container)).not.toBeNull());

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({
      x: 10,
      y: 20,
      width: 100,
      height: 100,
    });
  });

  it("ignores Enter without a selection", () => {
    render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("rejects a selection smaller than two pixels", async () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    loadImage();
    drag(rootOf(container), { x: 50, y: 50 }, { x: 50, y: 51 });
    await waitFor(() => expect(selectionOf(container)).not.toBeNull());

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("ignores other keys", async () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    loadImage();
    drag(rootOf(container), { x: 10, y: 10 }, { x: 100, y: 100 });
    await waitFor(() => expect(selectionOf(container)).not.toBeNull());

    fireEvent.keyDown(window, { key: "a" });
    fireEvent.keyDown(window, { key: " " });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("scales the result to the natural image size", async () => {
    window.innerWidth = 1024;
    window.innerHeight = 768;
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    loadImage(2048, 1536);
    drag(rootOf(container), { x: 10, y: 10 }, { x: 110, y: 60 });
    await waitFor(() => expect(selectionOf(container)).not.toBeNull());

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onComplete).toHaveBeenCalledWith({
      x: 20,
      y: 20,
      width: 200,
      height: 100,
    });
  });

  it("scales non-integer results to whole pixels", async () => {
    window.innerWidth = 1000;
    window.innerHeight = 1000;
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    loadImage(1024, 1024);
    drag(rootOf(container), { x: 0, y: 0 }, { x: 10, y: 10 });
    await waitFor(() => expect(selectionOf(container)).not.toBeNull());

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onComplete).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
  });

  it("moves the existing selection instead of drawing a new one", async () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    drag(rootOf(container), { x: 10, y: 10 }, { x: 110, y: 110 });
    const selection = (await waitFor(() => selectionOf(container))) as HTMLElement;

    drag(selection, { x: 60, y: 60 }, { x: 160, y: 130 });
    await waitFor(() => expect(selectionOf(container)?.style.left).toBe("110px"));
    expect(selectionOf(container)?.style.top).toBe("80px");
    expect(selectionOf(container)?.style.width).toBe("100px");
    expect(sizeLabel()).toBe("100 × 100");
  });

  it("keeps a moved selection inside the viewport", async () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    drag(rootOf(container), { x: 0, y: 0 }, { x: 100, y: 100 });
    const selection = (await waitFor(() => selectionOf(container))) as HTMLElement;

    drag(selection, { x: 50, y: 50 }, { x: 5000, y: 5000 });
    await waitFor(() =>
      expect(selectionOf(container)?.style.left).toBe(`${window.innerWidth - 100}px`),
    );
    expect(selectionOf(container)?.style.top).toBe(`${window.innerHeight - 100}px`);
  });

  it("resizes from the bottom-right handle", async () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    drag(rootOf(container), { x: 10, y: 10 }, { x: 110, y: 110 });
    const selection = (await waitFor(() => selectionOf(container))) as HTMLElement;
    const handles = selection.querySelectorAll(".bg-white");
    expect(handles).toHaveLength(4);

    drag(handles[3], { x: 110, y: 110 }, { x: 300, y: 200 });
    await waitFor(() => expect(selectionOf(container)?.style.width).toBe("290px"));
    expect(selectionOf(container)?.style.height).toBe("190px");
    expect(selectionOf(container)?.style.left).toBe("10px");
    expect(selectionOf(container)?.style.top).toBe("10px");
  });

  it("resizes from the top-left handle", async () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    drag(rootOf(container), { x: 100, y: 100 }, { x: 200, y: 200 });
    const selection = (await waitFor(() => selectionOf(container))) as HTMLElement;

    drag(selection.querySelectorAll(".bg-white")[0], { x: 100, y: 100 }, { x: 40, y: 20 });
    await waitFor(() => expect(selectionOf(container)?.style.left).toBe("40px"));
    expect(selectionOf(container)?.style.top).toBe("20px");
    expect(selectionOf(container)?.style.width).toBe("160px");
    expect(selectionOf(container)?.style.height).toBe("180px");
  });

  it("resizes from the top-right handle", async () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    drag(rootOf(container), { x: 100, y: 100 }, { x: 200, y: 200 });
    const selection = (await waitFor(() => selectionOf(container))) as HTMLElement;

    drag(selection.querySelectorAll(".bg-white")[1], { x: 200, y: 100 }, { x: 300, y: 60 });
    await waitFor(() => expect(selectionOf(container)?.style.top).toBe("60px"));
    expect(selectionOf(container)?.style.left).toBe("100px");
    expect(selectionOf(container)?.style.width).toBe("200px");
    expect(selectionOf(container)?.style.height).toBe("140px");
  });

  it("resizes from the bottom-left handle", async () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    drag(rootOf(container), { x: 100, y: 100 }, { x: 200, y: 200 });
    const selection = (await waitFor(() => selectionOf(container))) as HTMLElement;

    drag(selection.querySelectorAll(".bg-white")[2], { x: 100, y: 200 }, { x: 50, y: 250 });
    await waitFor(() => expect(selectionOf(container)?.style.left).toBe("50px"));
    expect(selectionOf(container)?.style.top).toBe("100px");
    expect(selectionOf(container)?.style.width).toBe("150px");
    expect(selectionOf(container)?.style.height).toBe("150px");
  });

  it("shows a grabbing cursor while moving", async () => {
    const { container } = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    drag(rootOf(container), { x: 10, y: 10 }, { x: 110, y: 110 });
    const selection = (await waitFor(() => selectionOf(container))) as HTMLElement;

    fireEvent.mouseDown(selection, { button: 0, clientX: 60, clientY: 60 });
    await waitFor(() => expect(selectionOf(container)?.style.cursor).toBe("grabbing"));
    fireEvent.mouseUp(window);
  });

  it("removes the window listeners on unmount", async () => {
    const view = render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    const root = rootOf(view.container);
    drag(root, { x: 10, y: 10 }, { x: 100, y: 100 });
    await waitFor(() => expect(selectionOf(view.container)).not.toBeNull());

    view.unmount();
    expect(() =>
      fireEvent.keyDown(window, { key: "Enter" }),
    ).not.toThrow();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("documents that Escape is handled elsewhere", () => {
    render(<Overlay imageUrl={IMAGE_URL} onComplete={onComplete} />);
    expect(screen.getByText("cancel")).toBeInTheDocument();
  });
});