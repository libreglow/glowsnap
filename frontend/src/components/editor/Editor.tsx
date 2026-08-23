import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import Konva from "konva";
import { X, Download, Undo2, Redo2, Trash2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tool, EditorProps, ShapeConfig } from "@/types/types";
import type { AppSettings } from "@/types/types";
import { useShapes } from "@/lib/hooks/useShapes";
import { useTextEditing } from "@/lib/hooks/useTextEditing";
import { useBackground } from "@/lib/hooks/useBackground";
import Toolbar from "./Toolbar";
import OptionsBar from "./OptionsBar";
import BackgroundControls from "./BackgroundControls";
import InlineTextEditor from "./InlineTextEditor";
import Canvas from "./Canvas";
import FloatingToolbar from "./FloatingToolbar";
import {
  SaveFileDialog,
  WriteFile,
  GetSettings,
} from "../../../wailsjs/go/main/App";
import {
  EDITOR_SHORTCUTS,
  TOOL_SHORTCUTS,
  matchesShortcut,
  isEditableTarget,
  applyShortcutOverrides,
  type EditorAction,
} from "@/lib/shortcut";
import { clampPanSoft, panForPointerZoom } from "@/lib/viewport";

interface ToolStyleState {
  color: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  textAlign: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  fillEnabled: boolean;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.1;

const clampZoom = (value: number) =>
  Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM);

const DEFAULT_STYLE: ToolStyleState = {
  color: "#ff3b30",
  strokeWidth: 3,
  opacity: 1,
  fontSize: 24,
  fontFamily: "Inter",
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikethrough: false,
  textAlign: "left",
  lineHeight: 1,
  letterSpacing: 0,
  fillEnabled: false,
};

function normalizeTool(value: string | undefined): Tool {
  const allowed: Tool[] = [
    "select",
    "crop",
    "arrow",
    "text",
    "number",
    "pen",
    "rectangle",
    "circle",
    "eraser",
  ];
  return allowed.includes(value as Tool) ? (value as Tool) : "select";
}

function styleFromSettings(settings: AppSettings | null): ToolStyleState {
  const editor = settings?.editor;
  return {
    color: editor?.defaultColor || DEFAULT_STYLE.color,
    strokeWidth: editor?.defaultStrokeWidth || DEFAULT_STYLE.strokeWidth,
    opacity:
      typeof editor?.defaultOpacity === "number"
        ? editor.defaultOpacity
        : DEFAULT_STYLE.opacity,
    fontSize: editor?.defaultFontSize || DEFAULT_STYLE.fontSize,
    fontFamily: editor?.defaultFont || DEFAULT_STYLE.fontFamily,
    isBold: DEFAULT_STYLE.isBold,
    isItalic: DEFAULT_STYLE.isItalic,
    isUnderline: DEFAULT_STYLE.isUnderline,
    isStrikethrough: DEFAULT_STYLE.isStrikethrough,
    textAlign: DEFAULT_STYLE.textAlign,
    lineHeight: DEFAULT_STYLE.lineHeight,
    letterSpacing: DEFAULT_STYLE.letterSpacing,
    fillEnabled: DEFAULT_STYLE.fillEnabled,
  };
}

export default function Editor({ imageUrl, onBack }: EditorProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const loadingStyleRef = useRef(false);
  const contentSizeRef = useRef({ width: 80, height: 24 });
  const selectAllOnMountRef = useRef(false);
  const [stageContainerRect, setStageContainerRect] = useState<DOMRect | null>(
    null,
  );
  const [stageRect, setStageRect] = useState<DOMRect | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool>("select");
  const [toolStyle, setToolStyle] = useState<ToolStyleState>(() =>
    styleFromSettings(null),
  );
  const [selectedStyle, setSelectedStyle] = useState<ToolStyleState>(() =>
    styleFromSettings(null),
  );
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const handlePanChange = useCallback(
    (p: { x: number; y: number }) => setPan(p),
    [],
  );

  const setToolProp = useCallback(
    <K extends keyof ToolStyleState>(key: K, value: ToolStyleState[K]) => {
      setToolStyle((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setSelectedProp = useCallback(
    <K extends keyof ToolStyleState>(key: K, value: ToolStyleState[K]) => {
      setSelectedStyle((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [imageTransform, setImageTransform] = useState({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  });
  const [customShortcuts, setCustomShortcuts] = useState<
    Record<string, string>
  >({});

  const {
    background,
    toggleBackground,
    setType,
    setStartColor,
    setEndColor,
    setAngle,
    setPadding,
  } = useBackground();

  const {
    shapes,
    selectedId,
    setSelectedId,
    addShape,
    updateShape,
    deleteShape,
    commitShapes,
    handleUndo,
    handleRedo,
  } = useShapes();

  const {
    editingTextId,
    editingTextValue,
    startEditing,
    updateEditingText,
    commitEditing,
    cancelEditing,
  } = useTextEditing(updateShape);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cfg = await GetSettings();
        if (!active) return;
        const nextStyle = styleFromSettings(cfg);
        setSelectedTool(normalizeTool(cfg.editor?.defaultTool));
        setToolStyle(nextStyle);
        setSelectedStyle(nextStyle);
        setCustomShortcuts(cfg.customShortcuts || {});
      } catch (err) {
        console.error("Failed to load editor defaults:", err);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const beginEditing = useCallback(
    (shape: ShapeConfig) => {
      selectAllOnMountRef.current = !shape.text || shape.text === "Text";
      startEditing(shape);
    },
    [startEditing],
  );

  const handleEditingTextChange = useCallback(
    (value: string) => {
      updateEditingText(value);
    },
    [updateEditingText],
  );

  const handleEditingTextMetrics = useCallback(
    (width: number, height: number) => {
      contentSizeRef.current = { width, height };
    },
    [],
  );

  const handleCommitEditing = useCallback(() => {
    commitEditing({
      width: contentSizeRef.current.width,
      height: contentSizeRef.current.height,
    });
  }, [commitEditing]);

  const handleCancelEditing = useCallback(() => {
    cancelEditing();
  }, [cancelEditing]);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      setImage(img);
      const maxW = window.innerWidth * 0.8;
      const maxH = window.innerHeight * 0.75;
      const baseScale = Math.min(maxW / img.width, maxH / img.height, 1);
      const pad = background.enabled ? background.padding : 0;

      setStageSize({
        width: img.width * baseScale + pad * 2,
        height: img.height * baseScale + pad * 2,
      });
      setImageTransform({
        x: pad,
        y: pad,
        scaleX: baseScale,
        scaleY: baseScale,
        rotation: 0,
      });
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!image) return;
    const pad = background.enabled ? background.padding : 0;

    setStageSize({
      width: image.width * imageTransform.scaleX + pad * 2,
      height: image.height * imageTransform.scaleY + pad * 2,
    });
    setImageTransform((prev) => ({
      ...prev,
      x: pad,
      y: pad,
    }));
  }, [
    background.enabled,
    background.padding,
    image,
    imageTransform.scaleX,
    imageTransform.scaleY,
  ]);

  useEffect(() => {
    if (cropMode && image && !cropRect) {
      setCropRect({
        x: 0,
        y: 0,
        width: image.width * imageTransform.scaleX,
        height: image.height * imageTransform.scaleY,
      });
    }
  }, [cropMode, image, cropRect, imageTransform.scaleX, imageTransform.scaleY]);

  useEffect(() => {
    if (!selectedId) return;
    const shape = shapes.find((s) => s.id === selectedId);
    if (!shape) return;
    loadingStyleRef.current = true;
    if (shape.type === "text" || shape.type === "number") {
      setSelectedStyle((prev) => ({
        ...prev,
        color: shape.fill || prev.color,
        fontSize: shape.fontSize ?? prev.fontSize,
        fontFamily: shape.fontFamily || prev.fontFamily,
        isBold: shape.fontStyle
          ? shape.fontStyle.includes("bold")
          : prev.isBold,
        isItalic: shape.fontStyle
          ? shape.fontStyle.includes("italic")
          : prev.isItalic,
        isUnderline:
          shape.textDecoration === "underline" ||
          shape.textDecoration?.includes("underline") ||
          prev.isUnderline,
        isStrikethrough:
          shape.textDecoration === "line-through" ||
          shape.textDecoration?.includes("line-through") ||
          prev.isStrikethrough,
        textAlign: shape.align || prev.textAlign,
        lineHeight: shape.lineHeight ?? prev.lineHeight,
        letterSpacing: shape.letterSpacing ?? prev.letterSpacing,
      }));
    } else {
      setSelectedStyle((prev) => ({
        ...prev,
        color: shape.stroke || prev.color,
        strokeWidth: shape.strokeWidth ?? prev.strokeWidth,
        opacity: shape.opacity ?? prev.opacity,
        fillEnabled:
          shape.type === "rect" || shape.type === "circle"
            ? (shape.fillEnabled ?? prev.fillEnabled)
            : prev.fillEnabled,
      }));
    }
  }, [selectedId, shapes]);

  useEffect(() => {
    if (loadingStyleRef.current) return;
    if (selectedId && selectedTool === "select") {
      const shape = shapes.find((s) => s.id === selectedId);
      if (shape && (shape.type === "text" || shape.type === "number")) {
        const nextFontStyle =
          (selectedStyle.isBold ? "bold " : "") +
          (selectedStyle.isItalic ? "italic" : "");
        const nextAlign = selectedStyle.textAlign;
        const nextTextDecoration =
          [
            selectedStyle.isUnderline ? "underline" : null,
            selectedStyle.isStrikethrough ? "line-through" : null,
          ]
            .filter(Boolean)
            .join(" ") || "none";
        if (
          shape.fontSize !== selectedStyle.fontSize ||
          shape.fontFamily !== selectedStyle.fontFamily ||
          shape.fontStyle !== nextFontStyle ||
          (shape.align || "left") !== nextAlign ||
          (shape.lineHeight ?? 1) !== selectedStyle.lineHeight ||
          (shape.letterSpacing ?? 0) !== selectedStyle.letterSpacing ||
          (shape.textDecoration || "none") !== nextTextDecoration
        ) {
          updateShape(
            selectedId,
            {
              fontSize: selectedStyle.fontSize,
              fontFamily: selectedStyle.fontFamily,
              fontStyle: nextFontStyle,
              align: nextAlign,
              lineHeight: selectedStyle.lineHeight,
              letterSpacing: selectedStyle.letterSpacing,
              textDecoration: nextTextDecoration,
            },
            true,
          );
        }
      }
    }
  }, [
    selectedStyle.fontSize,
    selectedStyle.fontFamily,
    selectedStyle.isBold,
    selectedStyle.isItalic,
    selectedStyle.isUnderline,
    selectedStyle.isStrikethrough,
    selectedStyle.textAlign,
    selectedStyle.lineHeight,
    selectedStyle.letterSpacing,
    selectedId,
    selectedTool,
  ]);

  useEffect(() => {
    if (loadingStyleRef.current) return;
    if (selectedId && selectedTool === "select") {
      const shape = shapes.find((s) => s.id === selectedId);
      if (shape) {
        if (shape.type === "text" || shape.type === "number") {
          if (shape.fill !== selectedStyle.color) {
            updateShape(selectedId, { fill: selectedStyle.color }, true);
          }
        } else {
          const attrs: Partial<ShapeConfig> = {};
          if (shape.stroke !== selectedStyle.color)
            attrs.stroke = selectedStyle.color;
          if (shape.strokeWidth !== selectedStyle.strokeWidth)
            attrs.strokeWidth = selectedStyle.strokeWidth;
          if (shape.opacity !== selectedStyle.opacity)
            attrs.opacity = selectedStyle.opacity;
          if (shape.type === "rect" || shape.type === "circle") {
            const nextFill = selectedStyle.fillEnabled
              ? selectedStyle.color
              : "transparent";
            if (shape.fillEnabled !== selectedStyle.fillEnabled)
              attrs.fillEnabled = selectedStyle.fillEnabled;
            if (shape.fill !== nextFill) attrs.fill = nextFill;
          }
          if (Object.keys(attrs).length > 0) {
            updateShape(selectedId, attrs, true);
          }
        }
      }
    }
  }, [
    selectedStyle.color,
    selectedStyle.strokeWidth,
    selectedStyle.opacity,
    selectedStyle.fillEnabled,
    selectedId,
    selectedTool,
  ]);

  useEffect(() => {
    loadingStyleRef.current = false;
  });

  useEffect(() => {
    if (canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      setStageContainerRect(rect);
    }
    const stageEl = stageRef.current?.container?.();
    if (stageEl) {
      setStageRect(stageEl.getBoundingClientRect());
    }
  }, [stageSize, image, editingTextId]);

  const editingShape = editingTextId
    ? shapes.find((s) => s.id === editingTextId) || null
    : null;

  const editingBox = useMemo(() => {
    if (!editingShape || !stageRect) return null;
    const containerRect = canvasContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return null;
    const stageX = (stageSize.width * (1 - zoom)) / 2;
    const stageY = (stageSize.height * (1 - zoom)) / 2;
    const px = (imageTransform.x + (editingShape.x || 0)) * zoom + stageX;
    const py = (imageTransform.y + (editingShape.y || 0)) * zoom + stageY;
    return {
      left: stageRect.left - containerRect.left + px + pan.x,
      top: stageRect.top - containerRect.top + py + pan.y,
    };
  }, [
    editingShape,
    stageRect,
    imageTransform.x,
    imageTransform.y,
    zoom,
    stageSize,
    pan.x,
    pan.y,
  ]);

  const handleDuplicate = useCallback(
    (shape: ShapeConfig) => {
      const newId =
        Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      const newShape: ShapeConfig = {
        ...shape,
        id: newId,
        x: (shape.x || 0) + 20,
        y: (shape.y || 0) + 20,
      };
      addShape(newShape, true);
    },
    [addShape],
  );

  const handleToolChange = (tool: Tool) => {
    setSelectedTool(tool);
    setCropMode(tool === "crop");
  };

  const applyCrop = () => {
    if (!image || !cropRect || !stageRef.current) return;

    const scaleX = imageTransform.scaleX;
    const scaleY = imageTransform.scaleY;
    const offsetX = imageTransform.x;
    const offsetY = imageTransform.y;

    const cropX = (cropRect.x - offsetX) / scaleX;
    const cropY = (cropRect.y - offsetY) / scaleY;
    const cropWidth = cropRect.width / scaleX;
    const cropHeight = cropRect.height / scaleY;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight,
    );

    const croppedImage = new window.Image();
    croppedImage.src = canvas.toDataURL();
    croppedImage.onload = () => {
      setImage(croppedImage);
      const maxW = window.innerWidth * 0.8;
      const maxH = window.innerHeight * 0.75;
      const baseScale = Math.min(
        maxW / croppedImage.width,
        maxH / croppedImage.height,
        1,
      );
      const pad = background.enabled ? background.padding : 0;
      setStageSize({
        width: croppedImage.width * baseScale + pad * 2,
        height: croppedImage.height * baseScale + pad * 2,
      });
      setImageTransform({
        x: pad,
        y: pad,
        scaleX: baseScale,
        scaleY: baseScale,
        rotation: 0,
      });
    };

    setCropMode(false);
    setCropRect(null);
    setSelectedTool("select");
  };

  const cancelCrop = () => {
    setCropMode(false);
    setCropRect(null);
    setSelectedTool("select");
  };

  const stageToDataURL = () => {
    const stage = stageRef.current;
    if (!stage) return null;
    const prev = {
      x: stage.x(),
      y: stage.y(),
      scaleX: stage.scaleX(),
      scaleY: stage.scaleY(),
    };
    stage.position({ x: 0, y: 0 });
    stage.scale({ x: 1, y: 1 });
    const uri = stage.toDataURL({ pixelRatio: 2 });
    stage.position({ x: prev.x, y: prev.y });
    stage.scale({ x: prev.scaleX, y: prev.scaleY });
    return uri;
  };

  const exportImage = async () => {
    if (!stageRef.current) return;

    try {
      const defaultName = `edited-${Date.now()}.png`;
      const filePath = await SaveFileDialog(defaultName);

      if (!filePath) return;

      const uri = stageToDataURL();
      if (!uri) return;

      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8arr = new Uint8Array(arrayBuffer);

      await WriteFile(filePath, Array.from(uint8arr));

      console.log("Image saved to:", filePath);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const copyImage = async () => {
    if (!stageRef.current) return;

    try {
      const uri = stageToDataURL();
      if (!uri) return;
      const response = await fetch(uri);
      const blob = await response.blob();
      if (!navigator.clipboard || !window.ClipboardItem) {
        console.error("Clipboard API not supported in this environment");
        return;
      }
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);

      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      console.log("Image copied to clipboard");
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const zoomAt = useCallback(
    (factor: number) => {
      const stage = stageRef.current;
      let pointer = { x: stageSize.width / 2, y: stageSize.height / 2 };
      const p = stage?.getPointerPosition();
      if (
        p &&
        p.x >= 0 &&
        p.x <= stageSize.width &&
        p.y >= 0 &&
        p.y <= stageSize.height
      ) {
        pointer = { x: p.x, y: p.y };
      }

      const newZoom = clampZoom(zoom * factor);
      if (newZoom === zoom) return;

      const newPan = panForPointerZoom(
        pointer,
        pan,
        zoom,
        newZoom,
        stageSize.width,
        stageSize.height,
      );
      const clampedPan = clampPanSoft(newPan, {
        contentWidth: image
          ? image.width * imageTransform.scaleX
          : stageSize.width,
        contentHeight: image
          ? image.height * imageTransform.scaleY
          : stageSize.height,
        stageWidth: stageSize.width,
        stageHeight: stageSize.height,
        zoom: newZoom,
        offsetX: imageTransform.x,
        offsetY: imageTransform.y,
      });

      setZoom(newZoom);
      setPan(clampedPan);
    },
    [zoom, pan, stageSize.width, stageSize.height, image, imageTransform],
  );

  const zoomIn = useCallback(() => zoomAt(ZOOM_STEP), [zoomAt]);

  const zoomOut = useCallback(() => zoomAt(1 / ZOOM_STEP), [zoomAt]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [zoomIn, zoomOut]);

  const clipboardRef = useRef<ShapeConfig | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingTextId) return;
      if (isEditableTarget(e.target)) return;

      const runAction = (action: EditorAction): boolean => {
        switch (action) {
          case "edit-text": {
            if (selectedTool !== "select" || !selectedId) return false;
            const shape = shapes.find((s) => s.id === selectedId);
            if (!shape || (shape.type !== "text" && shape.type !== "number"))
              return false;
            beginEditing(shape);
            return true;
          }
          case "delete":
            if (!selectedId) return false;
            deleteShape(selectedId);
            return true;
          case "undo":
            handleUndo();
            return true;
          case "redo":
            handleRedo();
            return true;
          case "export":
            exportImage();
            return true;
          case "copy": {
            if (!selectedId) return false;
            const shape = shapes.find((s) => s.id === selectedId);
            if (shape) clipboardRef.current = { ...shape };
            return true;
          }
          case "paste": {
            if (!clipboardRef.current) return false;
            const newId =
              Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            const pastedShape: ShapeConfig = {
              ...clipboardRef.current,
              id: newId,
              x: (clipboardRef.current.x || 0) + 20,
              y: (clipboardRef.current.y || 0) + 20,
            };
            addShape(pastedShape, true);
            setSelectedTool("select");
            return true;
          }
          case "duplicate": {
            if (!selectedId) return false;
            const shape = shapes.find((s) => s.id === selectedId);
            if (shape) handleDuplicate(shape);
            return true;
          }
          case "deselect":
            setSelectedId(null);
            return true;
          case "zoom-in":
            zoomIn();
            return true;
          case "zoom-out":
            zoomOut();
            return true;
        }
        return false;
      };

      const editorShortcuts = applyShortcutOverrides(
        EDITOR_SHORTCUTS,
        customShortcuts,
      );
      for (const shortcut of editorShortcuts) {
        if (matchesShortcut(shortcut, e) && runAction(shortcut.action)) {
          e.preventDefault();
          break;
        }
      }

      const toolShortcuts = applyShortcutOverrides(
        TOOL_SHORTCUTS,
        customShortcuts,
      );
      for (const shortcut of toolShortcuts) {
        if (matchesShortcut(shortcut, e)) {
          e.preventDefault();
          setSelectedTool(shortcut.tool);
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedId,
    selectedTool,
    shapes,
    editingTextId,
    deleteShape,
    addShape,
    handleDuplicate,
    handleUndo,
    handleRedo,
    beginEditing,
    setSelectedTool,
    setSelectedId,
    zoomIn,
    zoomOut,
    customShortcuts,
  ]);

  return (
    <div className="w-full h-screen flex flex-col bg-black/95 backdrop-blur-3xl rounded-3xl border border-white/10 overflow-hidden text-white">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm hover:bg-white/10 px-3 py-1 rounded-lg"
        >
          <X size={16} /> Back
        </button>
        <Toolbar
          selectedTool={selectedTool}
          onToolChange={handleToolChange}
          isEditingText={!!editingTextId}
          customShortcuts={customShortcuts}
        />
        <div className="flex gap-2">
          <button
            onClick={handleUndo}
            className="p-2 hover:bg-white/10 rounded"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={handleRedo}
            className="p-2 hover:bg-white/10 rounded"
          >
            <Redo2 size={16} />
          </button>
          {selectedId && (
            <button
              onClick={() => deleteShape(selectedId)}
              className="p-2 hover:bg-red-500/20 rounded text-red-400"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={copyImage}
            title="Copy image"
            className="p-2 hover:bg-white/10 rounded"
          >
            {copied ? (
              <Check size={16} className="text-green-400" />
            ) : (
              <Copy size={16} />
            )}
          </button>
          <button
            onClick={exportImage}
            className="p-2 hover:bg-white/10  rounded "
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      <BackgroundControls
        bg={background}
        onToggle={toggleBackground}
        onTypeChange={setType}
        onStartColor={setStartColor}
        onEndColor={setEndColor}
        onAngle={setAngle}
        onPadding={setPadding}
      />

      <OptionsBar
        selectedTool={selectedTool}
        color={toolStyle.color}
        setColor={(c) => setToolProp("color", c)}
        strokeWidth={toolStyle.strokeWidth}
        setStrokeWidth={(w) => setToolProp("strokeWidth", w)}
        opacity={toolStyle.opacity}
        setOpacity={(o) => setToolProp("opacity", o)}
        fontSize={toolStyle.fontSize}
        setFontSize={(s) => setToolProp("fontSize", s)}
        fontFamily={toolStyle.fontFamily}
        setFontFamily={(f) => setToolProp("fontFamily", f)}
        isBold={toolStyle.isBold}
        setIsBold={(b) => setToolProp("isBold", b)}
        isItalic={toolStyle.isItalic}
        setIsItalic={(i) => setToolProp("isItalic", i)}
        isUnderline={toolStyle.isUnderline}
        setIsUnderline={(u) => setToolProp("isUnderline", u)}
        isStrikethrough={toolStyle.isStrikethrough}
        setIsStrikethrough={(s) => setToolProp("isStrikethrough", s)}
        textAlign={toolStyle.textAlign}
        setTextAlign={(a) => setToolProp("textAlign", a)}
        lineHeight={toolStyle.lineHeight}
        setLineHeight={(l) => setToolProp("lineHeight", l)}
        letterSpacing={toolStyle.letterSpacing}
        setLetterSpacing={(s) => setToolProp("letterSpacing", s)}
        fillEnabled={toolStyle.fillEnabled}
        setFillEnabled={(v) => setToolProp("fillEnabled", v)}
      />

      <div
        ref={canvasContainerRef}
        className="flex-1 relative wails-no-drag flex justify-center items-center flex-col"
        style={{
          background:
            "radial-gradient(circle at center, #1a1a1a 0%, #000 100%)",
        }}
      >
        <Canvas
          ref={stageRef}
          image={image}
          stageSize={stageSize}
          selectedTool={selectedTool}
          shapes={shapes}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          addShape={addShape}
          updateShape={updateShape}
          deleteShape={deleteShape}
          commitShapes={commitShapes}
          color={toolStyle.color}
          strokeWidth={toolStyle.strokeWidth}
          opacity={toolStyle.opacity}
          fillEnabled={toolStyle.fillEnabled}
          cropMode={cropMode}
          setCropMode={setCropMode}
          cropRect={cropRect}
          setCropRect={setCropRect}
          onTextDoubleClick={beginEditing}
          editingTextId={editingTextId}
          backgroundSettings={background}
          imageTransform={imageTransform}
          onImageTransform={setImageTransform}
          onChangeTool={handleToolChange}
          zoom={zoom}
          pan={pan}
          onPanChange={handlePanChange}
          textAlign={toolStyle.textAlign}
          lineHeight={toolStyle.lineHeight}
          letterSpacing={toolStyle.letterSpacing}
          textDecoration={
            [
              toolStyle.isUnderline ? "underline" : null,
              toolStyle.isStrikethrough ? "line-through" : null,
            ]
              .filter(Boolean)
              .join(" ") || "none"
          }
        />
        {editingShape && editingBox && (
          <InlineTextEditor
            value={editingTextValue}
            onChange={handleEditingTextChange}
            onCommit={handleCommitEditing}
            onCancel={handleCancelEditing}
            left={editingBox.left}
            top={editingBox.top}
            rotation={editingShape.rotation || 0}
            fontFamily={editingShape.fontFamily || "Inter"}
            fontSize={editingShape.fontSize || 24}
            fontWeight={
              (editingShape.fontStyle || "").includes("bold") ? 700 : 400
            }
            fontStyle={
              (editingShape.fontStyle || "").includes("italic")
                ? "italic"
                : "normal"
            }
            direction={editingShape.direction === "rtl" ? "rtl" : "ltr"}
            align={editingShape.align || "left"}
            color={editingShape.fill || "#ffffff"}
            lineHeight={editingShape.lineHeight ?? 1}
            letterSpacing={editingShape.letterSpacing ?? 0}
            textDecoration={editingShape.textDecoration || "none"}
            wrapWidth={
              editingShape.width && editingShape.width > 0
                ? editingShape.width
                : undefined
            }
            maxWidth={
              stageRect ? Math.max(120, Math.floor(stageRect.width) - 60) : 600
            }
            onMetrics={handleEditingTextMetrics}
          />
        )}
        <FloatingToolbar
          selectedShape={shapes.find((s) => s.id === selectedId) || null}
          visible={selectedTool === "select" && !!selectedId}
          stageContainerRect={stageContainerRect}
          stageSize={stageSize}
          zoom={zoom}
          pan={pan}
          onUpdateShape={updateShape}
          onDelete={deleteShape}
          onDuplicate={handleDuplicate}
          color={selectedStyle.color}
          setColor={(c) => setSelectedProp("color", c)}
          fontFamily={selectedStyle.fontFamily}
          setFontFamily={(f) => setSelectedProp("fontFamily", f)}
          fontSize={selectedStyle.fontSize}
          setFontSize={(s) => setSelectedProp("fontSize", s)}
          opacity={selectedStyle.opacity}
          setOpacity={(o) => setSelectedProp("opacity", o)}
          isBold={selectedStyle.isBold}
          setIsBold={(b) => setSelectedProp("isBold", b)}
          isItalic={selectedStyle.isItalic}
          setIsItalic={(i) => setSelectedProp("isItalic", i)}
          isUnderline={selectedStyle.isUnderline}
          setIsUnderline={(u) => setSelectedProp("isUnderline", u)}
          isStrikethrough={selectedStyle.isStrikethrough}
          setIsStrikethrough={(s) => setSelectedProp("isStrikethrough", s)}
          textAlign={selectedStyle.textAlign}
          setTextAlign={(a) => setSelectedProp("textAlign", a)}
          lineHeight={selectedStyle.lineHeight}
          setLineHeight={(l) => setSelectedProp("lineHeight", l)}
          letterSpacing={selectedStyle.letterSpacing}
          setLetterSpacing={(s) => setSelectedProp("letterSpacing", s)}
          fillEnabled={selectedStyle.fillEnabled}
          setFillEnabled={(v) => setSelectedProp("fillEnabled", v)}
        />
        {cropMode && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            <Button onClick={applyCrop} variant="secondary">
              Apply Crop
            </Button>
            <Button onClick={cancelCrop} variant="ghost">
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
