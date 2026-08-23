import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useCallback,
} from "react";
import Konva from "konva";
import {
  Stage,
  Layer,
  Group,
  Rect,
  Ellipse,
  Arrow,
  Text,
  Line,
  Image as KonvaImage,
  Transformer,
} from "react-konva";
import { ShapeConfig, Tool } from "@/types/types";
import { BackgroundSettings } from "@/lib/hooks/useBackground";
import { clampPan as clampPanFn, clampPanSoft, type Pan } from "@/lib/viewport";

const HANDLE_ANCHOR_SIZE = 10;
const BOUNDING_BOX_STROKE = "#4A90D9";
const HANDLE_FILL = "#ffffff";
const HANDLE_STROKE = "#4A90D9";

const CROP_HANDLE_SIZE = 16;
const MIN_CROP_SIZE = 20;

const ERASER_MIN_WIDTH = 16;

type CropHandle = "tl" | "tr" | "bl" | "br";

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), Math.max(min, max));

function getImageBounds(
  image: HTMLImageElement,
  scaleX: number,
  scaleY: number,
) {
  return {
    left: 0,
    top: 0,
    right: image.width * scaleX,
    bottom: image.height * scaleY,
  };
}

function resizeCrop(
  handle: CropHandle,
  pointer: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
  bounds: { left: number; top: number; right: number; bottom: number },
): { x: number; y: number; width: number; height: number } {
  const min = MIN_CROP_SIZE;
  const left = bounds.left;
  const top = bounds.top;
  const rightEdge = rect.x + rect.width;
  const bottomEdge = rect.y + rect.height;

  switch (handle) {
    case "tl": {
      const x = clamp(pointer.x, left, Math.max(left, rightEdge - min));
      const y = clamp(pointer.y, top, Math.max(top, bottomEdge - min));
      return {
        x,
        y,
        width: Math.max(min, rightEdge - x),
        height: Math.max(min, bottomEdge - y),
      };
    }
    case "tr": {
      const x = rect.x;
      const y = clamp(pointer.y, top, Math.max(top, bottomEdge - min));
      return {
        x,
        y,
        width: Math.max(min, clamp(pointer.x, x + min, bounds.right) - x),
        height: Math.max(min, bottomEdge - y),
      };
    }
    case "bl": {
      const x = clamp(pointer.x, left, Math.max(left, rightEdge - min));
      const y = rect.y;
      return {
        x,
        y,
        width: Math.max(min, rightEdge - x),
        height: Math.max(min, clamp(pointer.y, y + min, bounds.bottom) - y),
      };
    }
    case "br":
    default: {
      const x = rect.x;
      const y = rect.y;
      return {
        x,
        y,
        width: Math.max(min, clamp(pointer.x, x + min, bounds.right) - x),
        height: Math.max(min, clamp(pointer.y, y + min, bounds.bottom) - y),
      };
    }
  }
}

function cropDimRects(
  c: { x: number; y: number; width: number; height: number },
  stageW: number,
  stageH: number,
): Array<{ x: number; y: number; width: number; height: number }> {
  const out: Array<{ x: number; y: number; width: number; height: number }> =
    [];
  const right = c.x + c.width;
  const bottom = c.y + c.height;
  if (c.y > 0) out.push({ x: 0, y: 0, width: stageW, height: c.y });
  if (bottom < stageH)
    out.push({ x: 0, y: bottom, width: stageW, height: stageH - bottom });
  if (c.x > 0) out.push({ x: 0, y: c.y, width: c.x, height: c.height });
  if (right < stageW)
    out.push({ x: right, y: c.y, width: stageW - right, height: c.height });
  return out;
}

const HANDLE_DEFS: Array<{ type: CropHandle; cursor: string }> = [
  { type: "tl", cursor: "nwse-resize" },
  { type: "tr", cursor: "nesw-resize" },
  { type: "bl", cursor: "nesw-resize" },
  { type: "br", cursor: "nwse-resize" },
];

interface CanvasProps {
  image: HTMLImageElement | null;
  stageSize: { width: number; height: number };
  selectedTool: Tool;
  shapes: ShapeConfig[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  addShape: (shape: ShapeConfig, select?: boolean, save?: boolean) => void;
  updateShape: (
    id: string,
    attrs: Partial<ShapeConfig>,
    save?: boolean,
  ) => void;
  deleteShape: (id: string) => void;
  commitShapes: () => void;
  color: string;
  strokeWidth: number;
  opacity: number;
  fillEnabled: boolean;
  cropMode: boolean;
  setCropMode: (v: boolean) => void;
  cropRect: { x: number; y: number; width: number; height: number } | null;
  setCropRect: React.Dispatch<
    React.SetStateAction<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null>
  >;
  onTextDoubleClick: (shape: ShapeConfig) => void;
  editingTextId: string | null;
  backgroundSettings: BackgroundSettings;
  imageTransform: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
  };
  onImageTransform: (attrs: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
  }) => void;
  onChangeTool?: (tool: Tool) => void;
  zoom?: number;
  pan?: { x: number; y: number };
  onPanChange?: (pan: { x: number; y: number }) => void;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: string;
  fontSize?: number;
  fontFamily?: string;
  eraserSize?: number;
}

function snapToNearestAngle(angle: number): number {
  const snapIncrement = Math.PI / 4;
  return Math.round(angle / snapIncrement) * snapIncrement;
}

function getConstrainedPoint(
  start: { x: number; y: number },
  current: { x: number; y: number },
): { x: number; y: number } {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < 1) return current;
  const angle = Math.atan2(dy, dx);
  const snappedAngle = snapToNearestAngle(angle);
  return {
    x: start.x + Math.cos(snappedAngle) * distance,
    y: start.y + Math.sin(snappedAngle) * distance,
  };
}

function getLineBounds(points: number[]): { cx: number; cy: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    const px = points[i];
    const py = points[i + 1];
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

const Canvas = forwardRef<Konva.Stage, CanvasProps>(
  (
    {
      image,
      stageSize,
      selectedTool,
      shapes,
      selectedId,
      setSelectedId,
      addShape,
      updateShape,
      deleteShape,
      commitShapes,
      color,
      strokeWidth,
      opacity,
      fillEnabled,
      cropMode,
      setCropMode,
      cropRect,
      setCropRect,
      onTextDoubleClick,
      editingTextId,
      backgroundSettings,
      imageTransform,
      onImageTransform,
      onChangeTool,
      zoom = 1,
      pan = { x: 0, y: 0 },
      onPanChange,
      textAlign,
      lineHeight,
      letterSpacing,
      textDecoration,
      fontSize = 24,
      fontFamily = "Inter",
      eraserSize,
    },
    ref,
  ) => {
    const stageRef = useRef<Konva.Stage>(null);
    const contentGroupRef = useRef<Konva.Group>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const textTransformerRef = useRef<Konva.Transformer>(null);
    const drawingRef = useRef<ShapeConfig | null>(null);
    const isDrawing = useRef(false);
    const isShiftPressed = useRef(false);
    const startPointRef = useRef<{ x: number; y: number } | null>(null);
    const cropStartPos = useRef<{ x: number; y: number } | null>(null);
    const activeCropHandle = useRef<CropHandle | null>(null);
    const justFinishedDrawing = useRef(false);
    const isPanning = useRef(false);
    const justPanned = useRef(false);
    const panStartRef = useRef<{
      pointerX: number;
      pointerY: number;
      panX: number;
      panY: number;
    } | null>(null);

    const isErasing = useRef(false);
    const erasingShapeId = useRef<string | null>(null);
    const currentEraseStroke = useRef<{
      points: number[];
      strokeWidth: number;
    } | null>(null);
    const shapeGroupRefs = useRef<Map<string, Konva.Group>>(new Map());
    const layerRef = useRef<Konva.Layer>(null);

    useImperativeHandle(ref, () => stageRef.current as Konva.Stage);
    const groupOffsetX = imageTransform.x;
    const groupOffsetY = imageTransform.y;

    const clampPan = useCallback(
      (next: Pan) => {
        return clampPanFn(next, {
          contentWidth: image
            ? image.width * imageTransform.scaleX
            : stageSize.width,
          contentHeight: image
            ? image.height * imageTransform.scaleY
            : stageSize.height,
          stageWidth: stageSize.width,
          stageHeight: stageSize.height,
          zoom,
          offsetX: groupOffsetX,
          offsetY: groupOffsetY,
        });
      },
      [
        image,
        imageTransform.scaleX,
        imageTransform.scaleY,
        zoom,
        stageSize.width,
        stageSize.height,
        groupOffsetX,
        groupOffsetY,
      ],
    );

    useEffect(() => {
      const clamped = clampPanSoft(pan, {
        contentWidth: image
          ? image.width * imageTransform.scaleX
          : stageSize.width,
        contentHeight: image
          ? image.height * imageTransform.scaleY
          : stageSize.height,
        stageWidth: stageSize.width,
        stageHeight: stageSize.height,
        zoom,
        offsetX: groupOffsetX,
        offsetY: groupOffsetY,
      });
      if (clamped.x !== pan.x || clamped.y !== pan.y) {
        onPanChange?.(clamped);
      }
    }, [
      image,
      imageTransform.scaleX,
      imageTransform.scaleY,
      zoom,
      stageSize.width,
      stageSize.height,
      groupOffsetX,
      groupOffsetY,
      pan,
      onPanChange,
    ]);

    const getRelativePointer = useCallback((): {
      x: number;
      y: number;
    } | null => {
      const stage = stageRef.current;
      if (!stage) return null;
      const pos = stage.getPointerPosition();
      if (!pos) return null;
      const relative = stage.getRelativePointerPosition();
      if (!relative) return null;
      return { x: relative.x - groupOffsetX, y: relative.y - groupOffsetY };
    }, [groupOffsetX, groupOffsetY]);

    const getShapeIdAtPointer = useCallback((): string | null => {
      const stage = stageRef.current;
      const layer = layerRef.current;
      if (!stage || !layer) return null;
      const pos = stage.getPointerPosition();
      if (!pos) return null;
      const shapeIds = new Set(shapes.map((s) => s.id));
      const hit = layer.getIntersection(pos);
      if (!hit) return null;
      let node: Konva.Node | null = hit;
      while (node) {
        const id = node.id();
        if (id && shapeIds.has(id)) return id;
        node = node.getParent();
      }
      return null;
    }, [shapes]);

    const recacheShapeGroup = useCallback((id: string) => {
      const node = shapeGroupRefs.current.get(id);
      if (!node) return;
      requestAnimationFrame(() => {
        if (!node.getStage()) return; 
        node.clearCache();
        node.cache();
        node.getLayer()?.batchDraw();
      });
    }, []);

    useEffect(() => {
      shapes.forEach((s) => {
        if (s.eraseStrokes?.length) recacheShapeGroup(s.id);
      });
    }, [shapes]);

    const getGradientEndPoint = () => {
      const rad = (backgroundSettings.angle * Math.PI) / 180;
      return {
        x: Math.cos(rad) * stageSize.width,
        y: Math.sin(rad) * stageSize.height,
      };
    };

    const renderBackground = () => {
      if (!backgroundSettings.enabled) return null;
      if (backgroundSettings.type === "linear") {
        const endPoint = getGradientEndPoint();
        return (
          <Rect
            x={0}
            y={0}
            width={stageSize.width}
            height={stageSize.height}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={endPoint}
            fillLinearGradientColorStops={[
              0,
              backgroundSettings.startColor,
              1,
              backgroundSettings.endColor,
            ]}
          />
        );
      } else {
        return (
          <Rect
            x={0}
            y={0}
            width={stageSize.width}
            height={stageSize.height}
            fillRadialGradientStartPoint={{
              x: stageSize.width / 2,
              y: stageSize.height / 2,
            }}
            fillRadialGradientEndPoint={{
              x: stageSize.width / 2,
              y: stageSize.height / 2,
            }}
            fillRadialGradientStartRadius={0}
            fillRadialGradientEndRadius={stageSize.width}
            fillRadialGradientColorStops={[
              0,
              backgroundSettings.startColor,
              1,
              backgroundSettings.endColor,
            ]}
          />
        );
      }
    };

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Shift") {
          isShiftPressed.current = true;
        }
      };
      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === "Shift") {
          isShiftPressed.current = false;
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }, []);

    useEffect(() => {
      const clearBoth = () => {
        transformerRef.current?.nodes([]);
        transformerRef.current?.getLayer()?.batchDraw();
        textTransformerRef.current?.nodes([]);
        textTransformerRef.current?.getLayer()?.batchDraw();
      };

      if (
        !selectedId ||
        selectedTool !== "select" ||
        editingTextId === selectedId
      ) {
        clearBoth();
        return;
      }

      const shape = shapes.find((s) => s.id === selectedId);
      const node = stageRef.current?.findOne("#" + selectedId);
      if (!shape || !node) {
        clearBoth();
        return;
      }

      if (shape.type === "text" || shape.type === "number") {
        transformerRef.current?.nodes([]);
        transformerRef.current?.getLayer()?.batchDraw();
        textTransformerRef.current?.nodes([node]);
        textTransformerRef.current?.getLayer()?.batchDraw();
      } else {
        textTransformerRef.current?.nodes([]);
        textTransformerRef.current?.getLayer()?.batchDraw();
        transformerRef.current?.nodes([node]);
        transformerRef.current?.getLayer()?.batchDraw();
      }
    }, [selectedId, selectedTool, shapes, editingTextId]);

    const handleShapeDragEnd = useCallback(
      (e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target;
        const id = node.id();
        const shape = shapes.find((s) => s.id === id);
        if (!shape) return;

        if (shape.type === "circle") {
          const w = shape.width || 80;
          const h = shape.height || 80;
          updateShape(id, { x: node.x() - w / 2, y: node.y() - h / 2 });
        } else if (shape.type === "rect") {
          const w = shape.width || 0;
          const h = shape.height || 0;
          updateShape(id, { x: node.x() - w / 2, y: node.y() - h / 2 });
        } else if (shape.type === "text" || shape.type === "number") {
          const w = shape.width || 100;
          const h = shape.height || (shape.fontSize || 24) * 1.2;
          updateShape(id, { x: node.x() - w / 2, y: node.y() - h / 2 });
        } else {
          const pts = shape.points || [];
          const { cx, cy } = getLineBounds(pts);
          const dx = node.x() - cx;
          const dy = node.y() - cy;
          if (dx !== 0 || dy !== 0) {
            const newPoints = pts.map((v, i) =>
              i % 2 === 0 ? v + dx : v + dy,
            );
            updateShape(id, { points: newPoints });
          }
        }
      },
      [shapes, updateShape],
    );

    const handleTransformEnd = useCallback(
      (e: Konva.KonvaEventObject<Event>) => {
        const node = e.target;
        const id = node.id();
        const shape = shapes.find((s) => s.id === id);
        if (!shape) return;

        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);

        const newAttrs: Partial<ShapeConfig> = {
          rotation: node.rotation(),
        };

        if (shape.type === "circle") {
          const newWidth = (shape.width || 80) * scaleX;
          const newHeight = (shape.height || 80) * scaleY;
          newAttrs.width = Math.max(10, newWidth);
          newAttrs.height = Math.max(10, newHeight);
          newAttrs.x = node.x() - newWidth / 2;
          newAttrs.y = node.y() - newHeight / 2;
        } else if (shape.type === "rect") {
          const newWidth = (shape.width || 100) * scaleX;
          const newHeight = (shape.height || 30) * scaleY;
          newAttrs.width = newWidth;
          newAttrs.height = newHeight;
          newAttrs.x = node.x() - newWidth / 2;
          newAttrs.y = node.y() - newHeight / 2;
        } else {
          if (shape.width) newAttrs.width = (shape.width || 100) * scaleX;
          if (shape.height) newAttrs.height = (shape.height || 30) * scaleY;
          newAttrs.x = node.x();
          newAttrs.y = node.y();
        }

        updateShape(id, newAttrs);
      },
      [shapes, updateShape],
    );

    const handleTextTransform = useCallback(
      (e: Konva.KonvaEventObject<Event>) => {
        const node = e.target as Konva.Text;
        const id = node.id();
        const shape = shapes.find((s) => s.id === id);
        if (!shape) return;

        const scaleX = node.scaleX();
        const currentAttrWidth = node.width() || shape.width || 100;

        node.scaleX(1);
        node.scaleY(1);

        const newWidth = Math.max(20, currentAttrWidth * scaleX);
        node.width(newWidth);

        node.height(undefined as unknown as number);
        const autoHeight = node.getHeight();
        const contentHeight = Math.max(shape.fontSize || 24, autoHeight || 0);

        const centerX = node.x();
        const centerY = node.y();
        node.offsetX(newWidth / 2);
        node.offsetY(contentHeight / 2);

        updateShape(
          id,
          {
            x: centerX - newWidth / 2,
            y: centerY - contentHeight / 2,
            width: newWidth,
            height: contentHeight,
          },
          false,
        );
      },
      [shapes, updateShape],
    );

    const handleTextTransformEnd = useCallback(
      (e: Konva.KonvaEventObject<Event>) => {
        const node = e.target as Konva.Text;
        const id = node.id();
        const shape = shapes.find((s) => s.id === id);
        if (!shape) return;

        node.scaleX(1);
        node.scaleY(1);

        const w = node.width() || shape.width || 100;
        const h = node.height() || shape.height || (shape.fontSize || 24) * 1.2;

        updateShape(id, {
          rotation: node.rotation(),
          width: w,
          height: h,
          x: node.x() - w / 2,
          y: node.y() - h / 2,
        });
      },
      [shapes, updateShape],
    );

    const handleImageDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
      const dx = e.target.x();
      const dy = e.target.y();
      onImageTransform({
        ...imageTransform,
        x: imageTransform.x + dx,
        y: imageTransform.y + dy,
      });
      e.target.position({ x: 0, y: 0 });
    };

    const handleMouseDown = useCallback(
      (e: Konva.KonvaEventObject<MouseEvent>) => {
        const pos = getRelativePointer();
        if (!pos) return;

        const isMiddleButton = e.evt.button === 1;
        const isLeftButton = e.evt.button === 0;

        const isEmptyTarget = (() => {
          if (!e.target) return true;
          if (e.target.id()) return false;
          let node: Konva.Node | null = e.target;
          while (node) {
            if (node.getClassName() === "Transformer") return false;
            node = node.getParent();
          }
          return true;
        })();
        const shouldPan =
          isMiddleButton ||
          (selectedTool === "select" && isLeftButton && isEmptyTarget);

        if (shouldPan) {
          if (isMiddleButton) e.evt.preventDefault();
          isPanning.current = true;
          justPanned.current = false;
          panStartRef.current = {
            pointerX: e.evt.clientX,
            pointerY: e.evt.clientY,
            panX: pan.x,
            panY: pan.y,
          };
          const el = stageRef.current?.container();
          if (el) el.style.cursor = "grabbing";
          return;
        }

        if (selectedTool === "eraser") {
          const id = getShapeIdAtPointer();
          if (!id) return;
          const shape = shapes.find((s) => s.id === id);
          if (!shape) return;

          isErasing.current = true;
          erasingShapeId.current = id;

          const brushWidth = Math.max(
            ERASER_MIN_WIDTH,
            eraserSize ?? strokeWidth * 4,
          );
          const newStroke = { points: [pos.x, pos.y], strokeWidth: brushWidth };
          currentEraseStroke.current = newStroke;

          const strokes = [...(shape.eraseStrokes || []), newStroke];
          updateShape(id, { eraseStrokes: strokes }, false);
          return;
        }

        if (selectedTool === "pen" || selectedTool === "arrow") {
          isDrawing.current = true;
          startPointRef.current = { x: pos.x, y: pos.y };
          const id =
            Date.now().toString(36) +
            Math.random().toString(36).substring(2, 7);
          drawingRef.current = {
            id,
            type: selectedTool === "arrow" ? "arrow" : "line",
            x: 0,
            y: 0,
            points: [pos.x, pos.y],
            stroke: color,
            strokeWidth,
            opacity,
            fill: "transparent",
          };
          addShape(drawingRef.current, false, false);
        } else if (selectedTool === "rectangle" || selectedTool === "circle") {
          isDrawing.current = true;
          startPointRef.current = { x: pos.x, y: pos.y };
          const id =
            Date.now().toString(36) +
            Math.random().toString(36).substring(2, 7);
          const shapeType = selectedTool === "rectangle" ? "rect" : "circle";
          drawingRef.current = {
            id,
            type: shapeType,
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            fill: fillEnabled ? color : "transparent",
            fillEnabled: fillEnabled,
            stroke: color,
            strokeWidth,
            opacity,
          };
          addShape(drawingRef.current, false, false);
        } else if (selectedTool === "crop") {
          return;
        }
      },
      [
        selectedTool,
        color,
        strokeWidth,
        opacity,
        fillEnabled,
        addShape,
        getRelativePointer,
        getShapeIdAtPointer,
        updateShape,
        shapes,
        eraserSize,
        pan,
      ],
    );

    const handleMouseMove = useCallback(
      (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (isPanning.current && panStartRef.current) {
          const start = panStartRef.current;
          const dx = e.evt.clientX - start.pointerX;
          const dy = e.evt.clientY - start.pointerY;
          const next = clampPan({ x: start.panX + dx, y: start.panY + dy });
          justPanned.current = true;
          onPanChange?.(next);
          return;
        }

        const point = getRelativePointer();
        if (!point) return;

        if (isErasing.current && erasingShapeId.current && currentEraseStroke.current) {
          currentEraseStroke.current.points.push(point.x, point.y);
          const id = erasingShapeId.current;
          const shape = shapes.find((s) => s.id === id);
          if (shape) {
            const strokes = [...(shape.eraseStrokes || [])];
            strokes[strokes.length - 1] = { ...currentEraseStroke.current };
            updateShape(id, { eraseStrokes: strokes }, false);
          }
          return;
        }

        if (activeCropHandle.current && cropRect && image) {
          const next = resizeCrop(
            activeCropHandle.current,
            point,
            cropRect,
            getImageBounds(image, imageTransform.scaleX, imageTransform.scaleY),
          );
          setCropRect(next);
          return;
        }

        if (isDrawing.current && drawingRef.current) {
          const startPoint = startPointRef.current;
          if (!startPoint) return;

          if (
            drawingRef.current.type === "rect" ||
            drawingRef.current.type === "circle"
          ) {
            const dx = point.x - startPoint.x;
            const dy = point.y - startPoint.y;

            let width = Math.abs(dx);
            let height = Math.abs(dy);

            if (isShiftPressed.current) {
              const size = Math.max(width, height);
              width = size;
              height = size;
            }

            const x = dx >= 0 ? startPoint.x : startPoint.x - width;
            const y = dy >= 0 ? startPoint.y : startPoint.y - height;

            drawingRef.current = { ...drawingRef.current, x, y, width, height };
            updateShape(
              drawingRef.current.id,
              {
                x,
                y,
                width,
                height,
              },
              false,
            );
          } else {
            if (isShiftPressed.current) {
              const constrainedEnd = getConstrainedPoint(startPoint, point);
              const newPoints = [
                startPoint.x,
                startPoint.y,
                constrainedEnd.x,
                constrainedEnd.y,
              ];
              drawingRef.current.points = newPoints;
              updateShape(drawingRef.current.id, { points: newPoints }, false);
            } else {
              const currentPoints = drawingRef.current.points || [];
              const newPoints = [...currentPoints, point.x, point.y];
              drawingRef.current.points = newPoints;
              updateShape(drawingRef.current.id, { points: newPoints }, false);
            }
          }
        }
      },
      [
        selectedTool,
        updateShape,
        setCropRect,
        getRelativePointer,
        shapes,
        cropRect,
        image,
        imageTransform.scaleX,
        imageTransform.scaleY,
        clampPan,
        onPanChange,
      ],
    );

    const handleMouseUp = useCallback(() => {
      if (isPanning.current) {
        isPanning.current = false;
        panStartRef.current = null;
        const el = stageRef.current?.container();
        if (el) el.style.cursor = "";
      }
      if (isErasing.current) {
        isErasing.current = false;
        if (erasingShapeId.current) {
          commitShapes();
          recacheShapeGroup(erasingShapeId.current);
        }
        erasingShapeId.current = null;
        currentEraseStroke.current = null;
      }
      if (isDrawing.current && drawingRef.current) {
        const shape = drawingRef.current;
        const isRectOrCircle = shape.type === "rect" || shape.type === "circle";

        if (isRectOrCircle) {
          const minDimension = 5;
          const hasValidSize =
            (shape.width || 0) > minDimension &&
            (shape.height || 0) > minDimension;

          if (hasValidSize) {
            commitShapes();
            setSelectedId(shape.id);
            onChangeTool?.("select");
          } else {
            deleteShape(shape.id);
          }
        } else {
          commitShapes();
          setSelectedId(shape.id);
          onChangeTool?.("select");
        }

        isDrawing.current = false;
        drawingRef.current = null;
        startPointRef.current = null;
        justFinishedDrawing.current = true;
      }
      cropStartPos.current = null;
      activeCropHandle.current = null;
    }, [commitShapes, setSelectedId, onChangeTool, deleteShape, recacheShapeGroup]);

    const handleStageClick = useCallback(
      (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (justFinishedDrawing.current) {
          justFinishedDrawing.current = false;
          return;
        }
        if (justPanned.current) {
          justPanned.current = false;
          return;
        }
        if (selectedTool === "select") {
          setSelectedId(null);
          return;
        }
        if (
          selectedTool === "crop" ||
          selectedTool === "pen" ||
          selectedTool === "arrow" ||
          selectedTool === "rectangle" ||
          selectedTool === "circle" ||
          selectedTool === "eraser"
        )
          return;
        const pos = getRelativePointer();
        if (!pos) return;
        const id =
          Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

        if (selectedTool === "text" || selectedTool === "number") {
          const isNumber = selectedTool === "number";
          const text =
            selectedTool === "number"
              ? (
                  shapes.filter((s) => s.type === "number").length + 1
                ).toString()
              : "Text";
          const fillColor = color;
          const style = selectedTool === "number" ? "bold" : "";

          const measureNode = new Konva.Text({
            text,
            fontSize,
            fontFamily,
            fontStyle: style,
            padding: 4,
          });
          const measuredWidth = measureNode.width() * 8;
          const measuredHeight = Math.max(
            fontSize * (lineHeight ?? 1),
            measureNode.height(),
          );
          measureNode.destroy();

          const textShape: ShapeConfig = {
            id,
            type: selectedTool === "number" ? "number" : "text",
            x: pos.x,
            y: pos.y,
            text,
            fill: fillColor,
            fillEnabled: true,
            fontSize,
            fontFamily,
            fontStyle: style,
            opacity,
            align: textAlign || "left",
            lineHeight: lineHeight ?? 1,
            letterSpacing: letterSpacing ?? 0,
            textDecoration: textDecoration || "none",
            width: measuredWidth,
            height: measuredHeight,
          };
          addShape(textShape);
          if (!isNumber) {
            onChangeTool?.("select");
            onTextDoubleClick(textShape);
          }
        }
      },
      [
        selectedTool,
        color,
        strokeWidth,
        opacity,
        shapes,
        addShape,
        onChangeTool,
        onTextDoubleClick,
        getRelativePointer,
      ],
    );

    const renderShapeNode = (shape: ShapeConfig) => {
      const commonProps = {
        id: shape.id,
        key: shape.id,
        draggable: selectedTool === "select",
        onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
          if (
            selectedTool === "select" ||
            shape.type === "text" ||
            shape.type === "number"
          ) {
            setSelectedId(shape.id);
            if (selectedTool !== "select") onChangeTool?.("select");
            e.cancelBubble = true;
          }
        },
        onTap: (e: Konva.KonvaEventObject<Event>) => {
          if (
            selectedTool === "select" ||
            shape.type === "text" ||
            shape.type === "number"
          ) {
            setSelectedId(shape.id);
            if (selectedTool !== "select") onChangeTool?.("select");
            e.cancelBubble = true;
          }
        },
        onDragEnd: handleShapeDragEnd,
        stroke: shape.stroke,
        fill:
          shape.fillEnabled === false
            ? "transparent"
            : shape.fill || "transparent",
        strokeWidth: shape.strokeWidth,
        opacity: shape.opacity,
      };

      const rotation = shape.rotation || 0;

      switch (shape.type) {
        case "rect": {
          const w = shape.width || 0;
          const h = shape.height || 0;
          return (
            <Rect
              {...commonProps}
              x={shape.x + w / 2}
              y={shape.y + h / 2}
              width={w}
              height={h}
              offsetX={w / 2}
              offsetY={h / 2}
              rotation={rotation}
              onTransformEnd={handleTransformEnd}
            />
          );
        }
        case "circle":
          return (
            <Ellipse
              {...commonProps}
              x={shape.x + (shape.width || 80) / 2}
              y={shape.y + (shape.height || 80) / 2}
              radiusX={(shape.width || 80) / 2}
              radiusY={(shape.height || 80) / 2}
              rotation={rotation}
              onTransformEnd={handleTransformEnd}
            />
          );
        case "arrow": {
          const { cx, cy } = getLineBounds(shape.points || []);
          return (
            <Arrow
              {...commonProps}
              fill={shape.stroke || shape.fill}
              points={shape.points!}
              x={cx}
              y={cy}
              offsetX={cx}
              offsetY={cy}
              rotation={rotation}
              onTransformEnd={handleTransformEnd}
            />
          );
        }
        case "text":
        case "number": {
          const w = shape.width || 100;
          const h = shape.height || (shape.fontSize || 24) * 1.2;
          return (
            <Text
              {...commonProps}
              x={shape.x + w / 2}
              y={shape.y + h / 2}
              offsetX={w / 2}
              offsetY={h / 2}
              width={w}
              height={h}
              text={shape.text}
              fontSize={shape.fontSize}
              fontFamily={shape.fontFamily}
              fontStyle={shape.fontStyle}
              direction={shape.direction === "rtl" ? "rtl" : "ltr"}
              align={shape.align || "left"}
              lineHeight={shape.lineHeight ?? lineHeight ?? 1}
              letterSpacing={shape.letterSpacing ?? letterSpacing ?? 0}
              textDecoration={shape.textDecoration || textDecoration || "none"}
              wrap="word"
              onDblClick={(e) => {
                e.cancelBubble = true;
                onTextDoubleClick(shape);
              }}
              onDblTap={(e) => {
                e.cancelBubble = true;
                onTextDoubleClick(shape);
              }}
              onTransform={handleTextTransform}
              onTransformEnd={handleTextTransformEnd}
              rotation={rotation}
            />
          );
        }
        case "line": {
          const { cx, cy } = getLineBounds(shape.points || []);
          return (
            <Line
              {...commonProps}
              points={shape.points!}
              x={cx}
              y={cy}
              offsetX={cx}
              offsetY={cy}
              tension={0.2}
              lineCap="round"
              lineJoin="round"
              rotation={rotation}
              onTransformEnd={handleTransformEnd}
            />
          );
        }
        default:
          return null;
      }
    };

    const renderShape = (shape: ShapeConfig) => {
      if (editingTextId === shape.id) return null;

      const node = renderShapeNode(shape);
      if (!node) return null;

      const hasErase = !!shape.eraseStrokes?.length;

      return (
        <Group
          key={`group-${shape.id}`}
          ref={(instance) => {
            if (instance) shapeGroupRefs.current.set(shape.id, instance);
            else shapeGroupRefs.current.delete(shape.id);
          }}
        >
          {node}
          {hasErase &&
            shape.eraseStrokes!.map((stroke, i) => (
              <Line
                key={`${shape.id}-erase-${i}`}
                points={stroke.points}
                stroke="#000"
                strokeWidth={stroke.strokeWidth}
                lineCap="round"
                lineJoin="round"
                tension={0}
                globalCompositeOperation="destination-out"
                listening={false}
                perfectDrawEnabled={false}
              />
            ))}
        </Group>
      );
    };

    const cropStage =
      cropMode && cropRect
        ? {
            x: cropRect.x + imageTransform.x,
            y: cropRect.y + imageTransform.y,
            width: cropRect.width,
            height: cropRect.height,
          }
        : null;

    return (
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        ref={stageRef}
        scaleX={zoom}
        scaleY={zoom}
        x={(stageSize.width * (1 - zoom)) / 2 + pan.x}
        y={(stageSize.height * (1 - zoom)) / 2 + pan.y}
        onClick={handleStageClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          margin: "auto",
          display: "block",
          cursor: selectedTool === "eraser" ? "crosshair" : undefined,
        }}
      >
        <Layer ref={layerRef}>
          {renderBackground()}
          <Group ref={contentGroupRef} x={groupOffsetX} y={groupOffsetY}>
            {image && (
              <KonvaImage
                id="main-image"
                image={image}
                x={0}
                y={0}
                width={image.width}
                height={image.height}
                cornerRadius={25}
                scaleX={imageTransform.scaleX}
                scaleY={imageTransform.scaleY}
                rotation={imageTransform.rotation}
                draggable={false}
              />
            )}
            {shapes.map(renderShape)}

            <Transformer
              ref={transformerRef}
              rotateEnabled={true}
              enabledAnchors={[
                "top-left",
                "top-right",
                "bottom-left",
                "bottom-right",
                "middle-left",
                "middle-right",
              ]}
              borderStroke={BOUNDING_BOX_STROKE}
              borderStrokeWidth={1.5}
              borderDash={[4, 4]}
              anchorFill={HANDLE_FILL}
              anchorStroke={HANDLE_STROKE}
              anchorSize={HANDLE_ANCHOR_SIZE}
              anchorCornerRadius={2}
              keepRatio={false}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 10 || newBox.height < 10) return oldBox;
                return newBox;
              }}
            />

            <Transformer
              ref={textTransformerRef}
              rotateEnabled={true}
              enabledAnchors={["middle-left", "middle-right"]}
              borderStroke={BOUNDING_BOX_STROKE}
              borderStrokeWidth={1.5}
              borderDash={[4, 4]}
              anchorFill={HANDLE_FILL}
              anchorStroke={HANDLE_STROKE}
              anchorSize={HANDLE_ANCHOR_SIZE}
              anchorCornerRadius={2}
              keepRatio={false}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 20) return oldBox;
                return { ...newBox, height: oldBox.height, y: oldBox.y };
              }}
            />
          </Group>
          {cropStage && (
            <>
              {cropDimRects(cropStage, stageSize.width, stageSize.height).map(
                (r, i) => (
                  <Rect
                    key={`crop-dim-${i}`}
                    {...r}
                    fill="rgba(0,0,0,0.55)"
                    listening={false}
                  />
                ),
              )}

              <Rect
                {...cropStage}
                fill="rgba(255,255,255,0.04)"
                stroke="#4A90D9"
                strokeWidth={2}
                draggable
                cursor="move"
                onDragMove={(e: Konva.KonvaEventObject<DragEvent>) => {
                  if (!image) return;
                  const stagePos = e.target.position();
                  const imgW = image.width * imageTransform.scaleX;
                  const imgH = image.height * imageTransform.scaleY;
                  const x = clamp(
                    stagePos.x - imageTransform.x,
                    0,
                    Math.max(0, imgW - cropStage.width),
                  );
                  const y = clamp(
                    stagePos.y - imageTransform.y,
                    0,
                    Math.max(0, imgH - cropStage.height),
                  );
                  setCropRect((prev) => (prev ? { ...prev, x, y } : prev));
                }}
                onDragEnd={() => {
                  const el = stageRef.current?.container?.();
                  if (el) el.style.cursor = "";
                }}
              />

              {HANDLE_DEFS.map((h) => (
                <Rect
                  key={h.type}
                  x={
                    h.type === "tl" || h.type === "bl"
                      ? cropStage.x
                      : cropStage.x + cropStage.width
                  }
                  y={
                    h.type === "tl" || h.type === "tr"
                      ? cropStage.y
                      : cropStage.y + cropStage.height
                  }
                  width={CROP_HANDLE_SIZE}
                  height={CROP_HANDLE_SIZE}
                  offsetX={CROP_HANDLE_SIZE / 2}
                  offsetY={CROP_HANDLE_SIZE / 2}
                  fill="#ffffff"
                  stroke="#4A90D9"
                  strokeWidth={2}
                  cornerRadius={3}
                  cursor={h.cursor}
                  onMouseDown={(e) => {
                    activeCropHandle.current = h.type;
                    e.cancelBubble = true;
                    e.evt.preventDefault();
                  }}
                />
              ))}
            </>
          )}
        </Layer>
      </Stage>
    );
  },
);

export default Canvas;