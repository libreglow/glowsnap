import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import type { ComponentProps } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Canvas from "@/components/editor/Canvas";
import { shapeEntry } from "@tests/test-support/wails";
import type { ShapeConfig, Tool } from "@/types/types";

const konva = vi.hoisted(() => ({
  pointer: { x: 0, y: 0 } as { x: number; y: number } | null,
  intersectionId: null as string | null,
  transformerNodes: [] as unknown[],
  textTransformerNodes: [] as unknown[],
  stageContainer: null as HTMLDivElement | null,
  renderCounts: new Map<string, number>(),
}));

const konvaHandlerRegistry = new WeakMap<
  Element,
  Record<string, (e: unknown) => void>
>();

vi.mock("react-konva", async () => {
  const React = await import("react");

  // Konva nodes expose a large, dynamic surface (getPointerPosition, container,
  // batchDraw, ...) that is attached per node type below, so the test double is
  // intentionally untyped rather than enumerating every member.
  type KonvaNodeMock = Record<string, any>;

  const makeNode = (name: string, props: Record<string, any>): KonvaNodeMock => {
    const node = {
      name,
      props,
      parent: null as unknown,
      nodes: [] as unknown[],
      position: vi.fn(),
      scale: vi.fn(),
      clearCache: vi.fn(),
      cache: vi.fn(),
      destroy: vi.fn(),
      id: () => (props.id ?? ""),
      getClassName: () => name,
      getParent: () => node.parent,
      getStage: () => null,
      getLayer: () => null,
      x: () => Number(props.x ?? 0),
      y: () => Number(props.y ?? 0),
      width: () => Number(props.width ?? 0),
      height: () => Number(props.height ?? 0),
      scaleX: () => Number(props.scaleX ?? 1),
      scaleY: () => Number(props.scaleY ?? 1),
      rotation: () => Number(props.rotation ?? 0),
      getIntersection: () => null,
      to: () => ({ x: 0, y: 0 }),
    };
    return node;
  };

  const create = (name: string) =>
    React.forwardRef((props: Record<string, any>, ref: React.Ref<unknown>) => {
      const node = makeNode(name, props);
      if (props.id) {
        konva.renderCounts.set(
          props.id as string,
          (konva.renderCounts.get(props.id as string) ?? 0) + 1,
        );
      }
      if (name === "Stage") {
        node.getPointerPosition = () => konva.pointer;
        node.getRelativePointerPosition = () => konva.pointer;
        node.getLayer = () => layerNode;
        node.container = () => konva.stageContainer;
        node.findOne = (selector: string) => {
          const id = selector.replace("#", "");
          const found = konva.intersectionId
            ? makeNode("Rect", { id: konva.intersectionId })
            : null;
          return id && found ? found : null;
        };
      }
      if (name === "Layer") {
        node.getStage = () => stageNode;
        node.batchDraw = vi.fn();
        node.getIntersection = () => {
          if (!konva.intersectionId) return null;
          const hit = makeNode("Rect", { id: konva.intersectionId });
          hit.parent = node;
          return hit;
        };
      }
      if (name === "TextTransformer") {
        const store: { list: unknown[] } = { list: [] };
        node.nodes = (value?: unknown[]) => {
          if (value === undefined) return store.list;
          store.list = value;
          return node;
        };
        node.getLayer = () => layerNode;
      }

      React.useImperativeHandle(ref, () => node, []);

      const konvaEvent = (e: any) => {
        let targetObj = node;
        const candidate = e?.target;
        if (candidate && typeof candidate.id === "function") {
          targetObj = candidate;
        }
        return {
          evt: e?.nativeEvent ?? e,
          target: targetObj,
          currentTarget: node,
          cancelBubble: false,
        };
      };

      const handlers = {
        onClick: (e: unknown) => props.onClick?.(konvaEvent(e)),
        onMouseDown: (e: unknown) => props.onMouseDown?.(konvaEvent(e)),
        onMouseUp: (e: unknown) => props.onMouseUp?.(konvaEvent(e)),
        onMouseMove: (e: unknown) => props.onMouseMove?.(konvaEvent(e)),
        onDoubleClick: (e: unknown) => props.onDblClick?.(konvaEvent(e)),
        onDragEnd: (e: any) => props.onDragEnd?.(konvaEvent(e)),
        onTransformEnd: (e: any) => props.onTransformEnd?.(konvaEvent(e)),
        onTransform: (e: any) => props.onTransform?.(konvaEvent(e)),
      };

      return React.createElement("div", {
        ref: (instance: HTMLDivElement | null) => {
          if (instance) konvaHandlerRegistry.set(instance, handlers);
        },
        "data-testid": `konva-${name}`,
        "data-node": name,
        "data-id": props.id ?? "",
        "data-x": props.x ?? "",
        "data-y": props.y ?? "",
        "data-width": props.width ?? "",
        "data-height": props.height ?? "",
        "data-text": props.text ?? "",
        "data-points": props.points ? JSON.stringify(props.points) : "",
        "data-fill": props.fill ?? "",
        "data-stroke": props.stroke ?? "",
        "data-stroke-width": props.strokeWidth ?? "",
        "data-opacity": props.opacity ?? "",
        "data-cursor": props.cursor ?? "",
        "data-rotation": props.rotation ?? "",
        "data-font-size": props.fontSize ?? "",
        "data-listen": props.listening === false ? "false" : "true",
        style: props.style,
        onClick: handlers.onClick,
        onMouseDown: handlers.onMouseDown,
        onMouseUp: handlers.onMouseUp,
        onMouseMove: handlers.onMouseMove,
        onDoubleClick: handlers.onDoubleClick,
        children: props.children,
      });
    });


  const stageNode = makeNode("Stage", {});
  const layerNode = makeNode("Layer", {});
  layerNode.batchDraw = vi.fn();
  stageNode.getLayer = () => layerNode;
  return {
    Stage: create("Stage"),
    Layer: create("Layer"),
    Group: create("Group"),
    Rect: create("Rect"),
    Ellipse: create("Ellipse"),
    Arrow: create("Arrow"),
    Text: create("Text"),
    Line: create("Line"),
    Image: create("Image"),
    Transformer: create("TextTransformer"),
  };
});

const STAGE_SIZE = { width: 400, height: 300 };

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    image: null,
    stageSize: STAGE_SIZE,
    selectedTool: "select" as Tool,
    shapes: [] as ShapeConfig[],
    selectedId: null,
    setSelectedId: vi.fn(),
    addShape: vi.fn(),
    updateShape: vi.fn(),
    deleteShape: vi.fn(),
    commitShapes: vi.fn(),
    color: "#ff0000",
    strokeWidth: 3,
    opacity: 1,
    fillEnabled: true,
    cropMode: false,
    setCropMode: vi.fn(),
    cropRect: null,
    setCropRect: vi.fn(),
    onTextDoubleClick: vi.fn(),
    editingTextId: null,
    backgroundSettings: {
      enabled: false,
      type: "linear" as const,
      startColor: "#111111",
      endColor: "#222222",
      angle: 0,
      padding: 0,
    },
    imageTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    onImageTransform: vi.fn(),
    onChangeTool: vi.fn(),
    onPanChange: vi.fn(),
    ...overrides,
  };
}

function renderCanvas(overrides: Record<string, unknown> = {}) {
  const props = makeProps(overrides);
  const ref = React.createRef<unknown>();
  const view = render(
    <Canvas ref={ref as never} {...(props as ComponentProps<typeof Canvas>)} />,
  );

  const rerenderCanvas = (nextOverrides: Record<string, unknown>) => {
    Object.assign(props, nextOverrides);
    view.rerender(
      <Canvas ref={ref as never} {...(props as ComponentProps<typeof Canvas>)} />,
    );
  };

  return { ...props, ref, rerenderCanvas, ...view };
}

const node = (name: string) => screen.getByTestId(`konva-${name}`);
const nodes = (name: string) =>
  Array.from(document.querySelectorAll(`[data-node="${name}"]`)) as HTMLElement[];

const shapeGroups = () =>
  nodes("Group").filter((g) => g.getAttribute("data-id")) as HTMLElement[];

const fireKonva = (
  element: Element,
  type: string,
  payload: Record<string, unknown>,
) => {
  const key = `on${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  konvaHandlerRegistry.get(element)?.[key]?.(payload);
};

const dragEndWith = (
  element: Element,
  x: number,
  y: number,
  extra: Record<string, unknown> = {},
) => {
  fireKonva(element, "dragEnd", {
    target: {
      id: () => "s1",
      x: () => x,
      y: () => y,
      scaleX: () => 1,
      scaleY: () => 1,
      rotation: () => 0,
      ...extra,
    },
  });
};

const transformEndWith = (
  element: Element,
  values: { x: number; y: number; scaleX: number; scaleY: number },
) => {
  fireKonva(element, "transformEnd", {
    target: {
      id: () => "s1",
      x: () => values.x,
      y: () => values.y,
      scaleX: () => values.scaleX,
      scaleY: () => values.scaleY,
      rotation: () => 0,
    },
  });
};

const groupFor = (shapeId: string) =>
  shapeGroups().find((g) => g.getAttribute("data-id") === shapeId);

function pointer(x: number, y: number) {
  konva.pointer = { x, y };
}

function drag(tool: Tool, from: { x: number; y: number }, to: { x: number; y: number }) {
  pointer(from.x, from.y);
  fireEvent.mouseDown(node("Stage"), { button: 0 });
  pointer(to.x, to.y);
  fireEvent.mouseMove(node("Stage"));
  fireEvent.mouseUp(node("Stage"), { button: 0 });
}

describe("Canvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    konva.pointer = { x: 0, y: 0 };
    konva.intersectionId = null;
    konva.stageContainer = document.createElement("div");
    konva.renderCounts.clear();
  });

  it("renders a single stage and layer", () => {
    renderCanvas();
    expect(nodes("Stage")).toHaveLength(1);
    expect(nodes("Layer")).toHaveLength(1);
  });

  it("sizes the stage from its props", () => {
    renderCanvas({ stageSize: { width: 640, height: 480 } });
    expect(node("Stage").getAttribute("data-width")).toBe("640");
    expect(node("Stage").getAttribute("data-height")).toBe("480");
  });

  it("omits the image until one is loaded", () => {
    renderCanvas();
    expect(nodes("Image")).toHaveLength(0);
  });

  it("renders the loaded image", () => {
    const image = document.createElement("img");
    Object.defineProperty(image, "width", { value: 200 });
    Object.defineProperty(image, "height", { value: 100 });
    renderCanvas({ image, imageTransform: { x: 5, y: 6, scaleX: 0.5, scaleY: 0.5, rotation: 0 } });

    const mainImage = nodes("Image")[0];
    expect(mainImage.getAttribute("data-id")).toBe("main-image");
    expect(mainImage.getAttribute("data-width")).toBe("200");
  });

  it("hides the background by default", () => {
    renderCanvas();
    expect(nodes("Rect")).toHaveLength(0);
  });

  it("draws a linear background", () => {
    renderCanvas({
      backgroundSettings: {
        enabled: true,
        type: "linear",
        startColor: "#111111",
        endColor: "#222222",
        angle: 0,
        padding: 0,
      },
    });
    const background = nodes("Rect")[0];
    expect(background.getAttribute("data-width")).toBe("400");
    expect(background.getAttribute("data-height")).toBe("300");
  });

  it("renders one node per shape", () => {
    renderCanvas({
      shapes: [
        shapeEntry({ id: "s1", type: "rect", width: 100, height: 50 }),
        shapeEntry({ id: "s2", type: "circle" }),
        shapeEntry({ id: "s3", type: "text", text: "hello" }),
      ],
    });
    expect(nodes("Rect")).toHaveLength(1);
    expect(nodes("Ellipse")).toHaveLength(1);
    expect(nodes("Text")).toHaveLength(1);
  });

  it("positions a rectangle inside its own group frame", () => {
    renderCanvas({
      shapes: [shapeEntry({ id: "s1", type: "rect", x: 10, y: 20, width: 100, height: 40 })],
    });
    const group = groupFor("s1")!;
    expect(group.getAttribute("data-x")).toBe("10");
    expect(group.getAttribute("data-y")).toBe("20");
    const rect = nodes("Rect")[0];
    expect(rect.getAttribute("data-x")).toBe("50");
    expect(rect.getAttribute("data-y")).toBe("20");
    expect(rect.getAttribute("data-width")).toBe("100");
  });

  it("uses a default diameter for a circle without a size", () => {
    renderCanvas({
      shapes: [shapeEntry({ id: "s1", type: "circle", x: 5, y: 6, width: undefined, height: undefined })],
    });
    const group = groupFor("s1")!;
    expect(group.getAttribute("data-x")).toBe("5");
    expect(group.getAttribute("data-y")).toBe("6");
    const ellipse = nodes("Ellipse")[0];
    expect(ellipse.getAttribute("data-x")).toBe("40");
    expect(ellipse.getAttribute("data-y")).toBe("40");
  });

  it("keeps a disabled fill transparent", () => {
    renderCanvas({
      shapes: [
        shapeEntry({ id: "s1", type: "rect", width: 40, height: 40, fill: "#ff0000", fillEnabled: false }),
      ],
    });
    expect(nodes("Rect")[0].getAttribute("data-fill")).toBe("transparent");
  });

  it("renders the shape fill when enabled", () => {
    renderCanvas({
      shapes: [
        shapeEntry({
          id: "s1",
          type: "rect",
          width: 40,
          height: 40,
          fill: "#00ff00",
          fillEnabled: true,
        }),
      ],
    });
    expect(nodes("Rect")[0].getAttribute("data-fill")).toBe("#00ff00");
  });

  it("renders an arrow with its points", () => {
    renderCanvas({
      shapes: [
        shapeEntry({ id: "s1", type: "arrow", points: [0, 0, 10, 20], stroke: "#123456" }),
      ],
    });
    const arrow = nodes("Arrow")[0];
    expect(arrow.getAttribute("data-points")).toBe("[0,0,10,20]");
    expect(arrow.getAttribute("data-fill")).toBe("#123456");
  });

  it("renders a line with points relative to its group origin", () => {
    renderCanvas({
      shapes: [shapeEntry({ id: "s1", type: "line", points: [5, 5, 25, 25] })],
    });
    const group = groupFor("s1")!;
    expect(group.getAttribute("data-x")).toBe("5");
    expect(group.getAttribute("data-y")).toBe("5");
    expect(nodes("Line")[0].getAttribute("data-points")).toBe("[0,0,20,20]");
  });

  it("renders text content and font settings", () => {
    renderCanvas({
      shapes: [
        shapeEntry({
          id: "s1",
          type: "text",
          text: "caption",
          fontSize: 30,
          width: 200,
          height: 40,
        }),
      ],
    });
    const text = nodes("Text")[0];
    expect(text.getAttribute("data-text")).toBe("caption");
    expect(text.getAttribute("data-font-size")).toBe("30");
  });

  it("hides the shape being edited inline", () => {
    renderCanvas({
      shapes: [
        shapeEntry({ id: "s1", type: "rect", width: 40, height: 40 }),
        shapeEntry({ id: "s2", type: "text", text: "edit" }),
      ],
      editingTextId: "s2",
    });
    expect(nodes("Rect")).toHaveLength(1);
    expect(nodes("Text")).toHaveLength(0);
  });

  it("renders an erase stroke as a non-listening line", () => {
    renderCanvas({
      shapes: [
        shapeEntry({
          id: "s1",
          type: "rect",
          width: 40,
          height: 40,
          eraseStrokes: [{ points: [1, 2, 3, 4], strokeWidth: 20 }],
        }),
      ],
    });
    const line = nodes("Line")[0];
    expect(line.getAttribute("data-listen")).toBe("false");
    expect(line.getAttribute("data-stroke-width")).toBe("20");
  });

  it("renders two transformers", () => {
    renderCanvas();
    expect(nodes("TextTransformer")).toHaveLength(2);
  });

  it("clears the selection on a stage click", () => {
    const { setSelectedId } = renderCanvas();
    fireEvent.click(node("Stage"));
    expect(setSelectedId).toHaveBeenCalledWith(null);
  });

  it("shows the eraser cursor for the eraser tool", () => {
    renderCanvas({ selectedTool: "eraser" });
    expect(node("Stage").style.cursor).toBe("crosshair");
  });

  it("leaves the cursor unset for other tools", () => {
    renderCanvas({ selectedTool: "rectangle" });
    expect(node("Stage").style.cursor).toBe("");
  });

  it("starts a rectangle at the pointer position", () => {
    const { addShape } = renderCanvas({ selectedTool: "rectangle" });
    drag("rectangle", { x: 10, y: 20 }, { x: 110, y: 120 });

    expect(addShape).toHaveBeenCalledTimes(1);
    const shape = addShape.mock.calls[0][0];
    expect(shape).toMatchObject({
      type: "rect",
      x: 10,
      y: 20,
      fill: "#ff0000",
    });
    expect(addShape.mock.calls[0][1]).toBe(false);
    expect(addShape.mock.calls[0][2]).toBe(false);
  });

  it("commits and selects a finished rectangle", () => {
    const { addShape, commitShapes, setSelectedId, onChangeTool } = renderCanvas({
      selectedTool: "rectangle",
    });
    drag("rectangle", { x: 0, y: 0 }, { x: 100, y: 80 });

    const id = addShape.mock.calls[0][0].id;
    expect(commitShapes).toHaveBeenCalled();
    expect(setSelectedId).toHaveBeenCalledWith(id);
    expect(onChangeTool).toHaveBeenCalledWith("select");
  });

  it("drops a rectangle that is too small", () => {
    const { deleteShape, commitShapes } = renderCanvas({
      selectedTool: "rectangle",
    });
    drag("rectangle", { x: 10, y: 10 }, { x: 12, y: 12 });

    expect(deleteShape).toHaveBeenCalledTimes(1);
    expect(commitShapes).not.toHaveBeenCalled();
  });

  it("draws a circle with the rectangle flow", () => {
    const { addShape } = renderCanvas({ selectedTool: "circle" });
    drag("circle", { x: 0, y: 0 }, { x: 100, y: 100 });
    expect(addShape.mock.calls[0][0].type).toBe("circle");
  });

  it("starts a pen stroke as a line", () => {
    const { addShape } = renderCanvas({ selectedTool: "pen" });
    drag("pen", { x: 5, y: 5 }, { x: 60, y: 25 });
    expect(addShape.mock.calls[0][0]).toMatchObject({
      type: "line",
      stroke: "#ff0000",
      strokeWidth: 3,
    });
  });

  it("starts an arrow stroke with the arrow tool", () => {
    const { addShape } = renderCanvas({ selectedTool: "arrow" });
    drag("arrow", { x: 5, y: 5 }, { x: 60, y: 25 });
    expect(addShape.mock.calls[0][0].type).toBe("arrow");
  });

  it("ignores a drag when the pointer is unavailable", () => {
    const { addShape } = renderCanvas({ selectedTool: "rectangle" });
    konva.pointer = null;
    fireEvent.mouseDown(node("Stage"), { button: 0 });
    expect(addShape).not.toHaveBeenCalled();
  });

  it("pans with the middle mouse button", () => {
    const image = document.createElement("img");
    Object.defineProperty(image, "width", { value: 1000 });
    Object.defineProperty(image, "height", { value: 800 });
    const { onPanChange } = renderCanvas({ image });
    pointer(200, 150);
    fireEvent.mouseDown(node("Stage"), { button: 1, clientX: 200, clientY: 150 });
    pointer(240, 170);
    fireEvent.mouseMove(node("Stage"), { clientX: 240, clientY: 170 });
    fireEvent.mouseUp(node("Stage"), { button: 1 });

    expect(onPanChange).toHaveBeenCalledWith({ x: 40, y: 20 });
  });

  it("does not draw shapes while panning with the select tool", () => {
    const { addShape } = renderCanvas({ selectedTool: "select" });
    drag("select", { x: 10, y: 10 }, { x: 90, y: 90 });
    expect(addShape).not.toHaveBeenCalled();
  });

  it("erases with the eraser tool on a hit shape", () => {
    konva.intersectionId = "s1";
    const { updateShape } = renderCanvas({
      selectedTool: "eraser",
      shapes: [shapeEntry({ id: "s1", type: "rect", width: 40, height: 40 })],
      eraserSize: 30,
    });
    pointer(20, 20);
    fireEvent.mouseDown(node("Stage"), { button: 0 });
    fireEvent.mouseUp(node("Stage"), { button: 0 });

    expect(updateShape).toHaveBeenCalledTimes(1);
    const [id, attrs, save] = updateShape.mock.calls[0];
    expect(id).toBe("s1");
    expect(attrs.eraseStrokes[0].strokeWidth).toBe(30);
    expect(save).toBe(false);
  });

  it("stores erase strokes in the shape's local frame", () => {
    konva.intersectionId = "s1";
    const { updateShape } = renderCanvas({
      selectedTool: "eraser",
      shapes: [
        shapeEntry({ id: "s1", type: "rect", x: 100, y: 50, width: 40, height: 40 }),
      ],
      eraserSize: 30,
    });
    pointer(120, 70);
    fireEvent.mouseDown(node("Stage"), { button: 0 });

    const [, attrs] = updateShape.mock.calls[0];
    expect(attrs.eraseStrokes[0].points[0]).toBe(20);
    expect(attrs.eraseStrokes[0].points[1]).toBe(20);
  });

  it("keeps erase strokes unchanged when the shape is dragged", () => {
    const eraseStrokes = [{ points: [10, 10, 20, 20], strokeWidth: 10 }];
    const { updateShape } = renderCanvas({
      selectedTool: "select",
      shapes: [
        shapeEntry({
          id: "s1",
          type: "rect",
          x: 0,
          y: 0,
          width: 40,
          height: 40,
          eraseStrokes,
        }),
      ],
    });
    dragEndWith(groupFor("s1")!, 50, 50);

    expect(updateShape).toHaveBeenCalledWith("s1", { x: 50, y: 50 });
  });

  it("renders erase strokes inside the shape group so they follow it", () => {
    renderCanvas({
      shapes: [
        shapeEntry({
          id: "s1",
          type: "rect",
          x: 100,
          y: 100,
          width: 40,
          height: 40,
          eraseStrokes: [{ points: [10, 10, 20, 20], strokeWidth: 10 }],
        }),
      ],
    });
    const group = groupFor("s1")!;
    expect(group.getAttribute("data-x")).toBe("100");
    expect(group.getAttribute("data-y")).toBe("100");
    expect(group.contains(nodes("Line")[0])).toBe(true);
    expect(nodes("Line")[0].getAttribute("data-points")).toBe("[10,10,20,20]");
  });

  it("scales erase strokes with the shape on transform", () => {
    const { updateShape } = renderCanvas({
      selectedTool: "select",
      shapes: [
        shapeEntry({
          id: "s1",
          type: "rect",
          x: 10,
          y: 10,
          width: 40,
          height: 40,
          eraseStrokes: [{ points: [10, 10, 20, 20], strokeWidth: 10 }],
        }),
      ],
    });
    transformEndWith(groupFor("s1")!, { x: 20, y: 20, scaleX: 2, scaleY: 2 });

    expect(updateShape).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        width: 80,
        height: 80,
        eraseStrokes: [{ points: [20, 20, 40, 40], strokeWidth: 20 }],
      }),
    );
  });

  it("keeps erase strokes on a moved line", () => {
    const { updateShape } = renderCanvas({
      selectedTool: "select",
      shapes: [
        shapeEntry({
          id: "s1",
          type: "line",
          points: [10, 10, 30, 30],
          eraseStrokes: [{ points: [5, 5, 10, 10], strokeWidth: 8 }],
        }),
      ],
    });
    dragEndWith(groupFor("s1")!, 30, 10);

    expect(updateShape).toHaveBeenCalledWith("s1", {
      points: [30, 10, 50, 30],
    });
  });

  it("ignores the eraser without a hit shape", () => {
    konva.intersectionId = null;
    const { updateShape } = renderCanvas({
      selectedTool: "eraser",
      shapes: [shapeEntry({ id: "s1", type: "rect", width: 40, height: 40 })],
    });
    pointer(20, 20);
    fireEvent.mouseDown(node("Stage"), { button: 0 });
    expect(updateShape).not.toHaveBeenCalled();
  });

  it("opens inline text editing on a double click", () => {
    const shape = shapeEntry({ id: "s1", type: "text", text: "hello", width: 120, height: 30 });
    const { onTextDoubleClick } = renderCanvas({ shapes: [shape] });
    fireEvent.doubleClick(nodes("Text")[0]);
    expect(onTextDoubleClick).toHaveBeenCalledWith(shape);
  });

  it("renders no crop overlay outside crop mode", () => {
    renderCanvas({ cropRect: { x: 10, y: 10, width: 100, height: 100 } });
    expect(nodes("Rect")).toHaveLength(0);
  });

  it("renders the crop overlay with dimming and handles", () => {
    renderCanvas({
      cropMode: true,
      cropRect: { x: 10, y: 10, width: 100, height: 100 },
    });
    // four dimming rects plus the crop window plus four corner handles
    expect(nodes("Rect").length).toBeGreaterThanOrEqual(9);
    const handles = nodes("Rect").filter(
      (r) => r.getAttribute("data-cursor") && r.getAttribute("data-cursor") !== "move",
    );
    expect(handles.map((h) => h.getAttribute("data-cursor"))).toEqual([
      "nwse-resize",
      "nesw-resize",
      "nesw-resize",
      "nwse-resize",
    ]);
  });

  it("makes the crop window draggable", () => {
    renderCanvas({
      cropMode: true,
      cropRect: { x: 0, y: 0, width: 100, height: 100 },
    });
    const cropWindow = nodes("Rect").find((r) => r.getAttribute("data-cursor") === "move");
    expect(cropWindow).toBeTruthy();
  });

  it("offsets the crop overlay by the image transform", () => {
    renderCanvas({
      cropMode: true,
      cropRect: { x: 0, y: 0, width: 100, height: 100 },
      imageTransform: { x: 20, y: 30, scaleX: 1, scaleY: 1, rotation: 0 },
    });
    const cropWindow = nodes("Rect").find((r) => r.getAttribute("data-cursor") === "move");
    expect(cropWindow?.getAttribute("data-x")).toBe("20");
    expect(cropWindow?.getAttribute("data-y")).toBe("30");
  });

  it("exposes the stage through its ref", () => {
    const { ref } = renderCanvas();
    expect(ref.current).toBeTruthy();
  });

  it("does not re-render untouched shapes when one shape changes", () => {
    const first = shapeEntry({ id: "s1", type: "rect", x: 0, y: 0, width: 10, height: 10 });
    const second = shapeEntry({ id: "s2", type: "rect", x: 20, y: 0, width: 10, height: 10 });
    const { rerenderCanvas } = renderCanvas({ shapes: [first, second] });
    const before = konva.renderCounts.get("s2") ?? 0;
    const firstBefore = konva.renderCounts.get("s1") ?? 0;

    rerenderCanvas({ shapes: [{ ...first, x: 5 }, second] });

    expect(konva.renderCounts.get("s2") ?? 0).toBe(before);
    expect(konva.renderCounts.get("s1") ?? 0).toBeGreaterThan(firstBefore);
  });

  it("scales the stage with the zoom factor", () => {
    renderCanvas({ zoom: 2 });
    expect(node("Stage")).toBeTruthy();
  });
});