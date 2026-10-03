import React, { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  Copy,
  RotateCw,
  Layers,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  CaseSensitive,
  WrapText,
  MoveHorizontal,
  Palette,
  PaintBucket,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { ShapeConfig } from "@/types/types";
import FontPicker from "./FontPicker";

interface FloatingToolbarProps {
  selectedShape: ShapeConfig | null;
  visible: boolean;
  stageContainerRect: DOMRect | null;
  stageSize: { width: number; height: number };
  zoom?: number;
  pan?: { x: number; y: number };
  onUpdateShape: (id: string, attrs: Partial<ShapeConfig>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (shape: ShapeConfig) => void;
  color: string;
  setColor: (c: string) => void;
  fontFamily: string;
  setFontFamily: (f: string) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
  opacity: number;
  setOpacity: (o: number) => void;
  isBold: boolean;
  setIsBold: (b: boolean) => void;
  isItalic: boolean;
  setIsItalic: (i: boolean) => void;
  isUnderline: boolean;
  setIsUnderline: (u: boolean) => void;
  isStrikethrough: boolean;
  setIsStrikethrough: (s: boolean) => void;
  textAlign: "left" | "center" | "right";
  setTextAlign: (a: "left" | "center" | "right") => void;
  lineHeight: number;
  setLineHeight: (l: number) => void;
  letterSpacing: number;
  setLetterSpacing: (s: number) => void;
  fillEnabled: boolean;
  setFillEnabled: (v: boolean) => void;
}

const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max);

const ALIGN_ORDER: Array<"left" | "center" | "right"> = [
  "left",
  "center",
  "right",
];
const ALIGN_ICONS = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
} as const;

const numberInputClass =
  "text-[10px] text-white/60 w-8 text-right tabular-nums bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-white/30 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

export default function FloatingToolbar({
  selectedShape,
  visible,
  stageContainerRect,
  stageSize,
  zoom = 1,
  pan = { x: 0, y: 0 },
  onUpdateShape,
  onDelete,
  onDuplicate,
  color,
  setColor,
  fontFamily,
  setFontFamily,
  fontSize,
  setFontSize,
  opacity,
  setOpacity,
  isBold,
  setIsBold,
  isItalic,
  setIsItalic,
  isUnderline,
  setIsUnderline,
  isStrikethrough,
  setIsStrikethrough,
  textAlign,
  setTextAlign,
  lineHeight,
  setLineHeight,
  letterSpacing,
  setLetterSpacing,
  fillEnabled,
  setFillEnabled,
}: FloatingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const anchorX = selectedShape?.x ?? 0;
  const anchorY = selectedShape?.y ?? 0;

  useEffect(() => {
    if (!selectedShape || !stageContainerRect) return;
    const stageCenterX = window.innerWidth * 0.5;
    const stageLeft = stageCenterX - stageSize.width / 2;
    const stageTop = stageContainerRect.top;
    const zoomOffsetX = (stageSize.width * (1 - zoom)) / 2;
    const zoomOffsetY = (stageSize.height * (1 - zoom)) / 2;
    setPosition({
      x: stageLeft + zoomOffsetX + anchorX * zoom + pan.x,
      y: stageTop + zoomOffsetY + anchorY * zoom + pan.y,
    });
  }, [anchorX, anchorY, stageContainerRect, stageSize, zoom, pan.x, pan.y]);

  const handleOpacityChange = (v: number | readonly number[]) => {
    if (!selectedShape) return;
    const val = Array.isArray(v) ? v[0] : v;
    const opacityVal = val / 100;
    setOpacity(opacityVal);
    onUpdateShape(selectedShape.id, { opacity: opacityVal });
  };

  const handleFontSizeChange = (v: number | readonly number[]) => {
    if (!selectedShape) return;
    const val = Array.isArray(v) ? v[0] : v;
    setFontSize(val);
    onUpdateShape(selectedShape.id, { fontSize: val });
  };

  const handleLineHeightChange = (v: number | readonly number[]) => {
    if (!selectedShape) return;
    const val = Array.isArray(v) ? v[0] : v;
    const nextValue = Number(val);
    setLineHeight(nextValue);
    onUpdateShape(selectedShape.id, { lineHeight: nextValue });
  };

  const handleLetterSpacingChange = (v: number | readonly number[]) => {
    if (!selectedShape) return;
    const val = Array.isArray(v) ? v[0] : v;
    const nextValue = Number(val);
    setLetterSpacing(nextValue);
    onUpdateShape(selectedShape.id, { letterSpacing: nextValue });
  };

  const handleRotationChange = (v: number | readonly number[]) => {
    if (!selectedShape) return;
    const val = Array.isArray(v) ? v[0] : v;
    onUpdateShape(selectedShape.id, { rotation: val });
  };

  const handleDuplicate = () => {
    if (!selectedShape) return;
    onDuplicate(selectedShape);
  };

  const handleDelete = () => {
    if (!selectedShape) return;
    onDelete(selectedShape.id);
  };

  const handleFillToggle = () => {
    if (!selectedShape) return;
    const newFillEnabled = !fillEnabled;
    setFillEnabled(newFillEnabled);
    onUpdateShape(selectedShape.id, {
      fillEnabled: newFillEnabled,
      fill: newFillEnabled ? color : "transparent",
    });
  };

  const handleAlignCycle = () => {
    if (!selectedShape) return;
    const currentIndex = ALIGN_ORDER.indexOf(textAlign);
    const next = ALIGN_ORDER[(currentIndex + 1) % ALIGN_ORDER.length];
    setTextAlign(next);
    onUpdateShape(selectedShape.id, { align: next });
  };

  const isRectOrCircle =
    selectedShape?.type === "rect" || selectedShape?.type === "circle";
  const isText = selectedShape?.type === "text";

  const currentOpacity = selectedShape?.opacity ?? 1;
  const currentFontSize = selectedShape?.fontSize ?? 24;
  const currentLineHeight = selectedShape?.lineHeight ?? lineHeight ?? 1;
  const currentLetterSpacing =
    selectedShape?.letterSpacing ?? letterSpacing ?? 0;
  const currentRotation = selectedShape?.rotation ?? 0;

  return (
    <AnimatePresence>
      {visible && selectedShape && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 0.8,
          }}
          className="absolute z-50"
          style={{
            left: position.x + 60,
            top: position.y - 160,
            pointerEvents: "auto",
          }}
        >
          <div className="-translate-x-1/2">
            <div className="flex items-center gap-1.5 backdrop-blur-xl bg-neutral-900/90 border-white/10 rounded-xl mt-[3vh] shadow-2xl shadow-black/50">
              <div className="flex items-center gap-1 bg-white/5 rounded-lg px-1.5 py-1">
                <Palette size={12} className="text-white/50 shrink-0" />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-5 h-5 rounded border border-white/10 bg-transparent cursor-pointer"
                />
              </div>

              {isRectOrCircle && (
                <>
                  <div className="w-px h-6 bg-white/10" />
                  <button
                    onClick={handleFillToggle}
                    className={`p-1.5 rounded-lg transition-colors ${
                      fillEnabled
                        ? "bg-white/20 text-white"
                        : "bg-white/5 text-white/60 hover:text-white"
                    }`}
                    title={fillEnabled ? "Fill enabled" : "No fill"}
                  >
                    <PaintBucket size={12} />
                  </button>
                </>
              )}

              {isText && (
                <>
                  <div className="w-px h-6 bg-white/10" />

                  <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
                    <Toggle
                      pressed={isBold}
                      onPressedChange={setIsBold}
                      className="data-[state=on]:bg-white/20 text-white/60 hover:text-white rounded p-1 h-6 w-6"
                      title="Bold"
                    >
                      <Bold size={12} />
                    </Toggle>
                    <Toggle
                      pressed={isItalic}
                      onPressedChange={setIsItalic}
                      className="data-[state=on]:bg-white/20 text-white/60 hover:text-white rounded p-1 h-6 w-6"
                      title="Italic"
                    >
                      <Italic size={12} />
                    </Toggle>
                    <Toggle
                      pressed={isUnderline}
                      onPressedChange={setIsUnderline}
                      className="data-[state=on]:bg-white/20 text-white/60 hover:text-white rounded p-1 h-6 w-6"
                      title="Underline"
                    >
                      <Underline size={12} />
                    </Toggle>
                    <Toggle
                      pressed={isStrikethrough}
                      onPressedChange={setIsStrikethrough}
                      className="data-[state=on]:bg-white/20 text-white/60 hover:text-white rounded p-1 h-6 w-6"
                      title="Strikethrough"
                    >
                      <Strikethrough size={12} />
                    </Toggle>
                    {(() => {
                      const AlignIcon = ALIGN_ICONS[textAlign];
                      const currentIndex = ALIGN_ORDER.indexOf(textAlign);
                      const next =
                        ALIGN_ORDER[(currentIndex + 1) % ALIGN_ORDER.length];
                      const label =
                        textAlign.charAt(0).toUpperCase() + textAlign.slice(1);
                      return (
                        <button
                          onClick={handleAlignCycle}
                          className="bg-white/5 hover:bg-white/20 text-white/60 hover:text-white rounded p-1 h-6 w-6 flex items-center justify-center transition-colors"
                          title={`Align ${label} (click for ${next})`}
                        >
                          <AlignIcon size={12} />
                        </button>
                      );
                    })()}
                  </div>

                  <div className="w-px h-6 bg-white/10" />

                  <div className="bg-white/5 rounded-lg px-1.5 py-1">
                    <FontPicker
                      value={fontFamily}
                      onChange={setFontFamily}
                      selectClassName="text-[10px] px-1 py-0.5"
                      optionClassName="bg-gray-900 text-white"
                    />
                  </div>

                  <div className="w-px h-6 bg-white/10" />

                  <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                    <CaseSensitive
                      size={12}
                      className="text-white/50 shrink-0"
                    />
                    <Slider
                      value={[currentFontSize]}
                      min={8}
                      max={120}
                      onValueChange={handleFontSizeChange}
                      className="w-16 h-4"
                    />
                    <input
                      type="number"
                      value={currentFontSize}
                      min={8}
                      max={120}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val)) handleFontSizeChange(val);
                      }}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val))
                          handleFontSizeChange(clamp(val, 8, 120));
                      }}
                      className={numberInputClass}
                    />
                  </div>

                  <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                    <WrapText size={12} className="text-white/50 shrink-0" />
                    <Slider
                      value={[currentLineHeight]}
                      min={0}
                      max={3}
                      step={0.1}
                      onValueChange={handleLineHeightChange}
                      className="w-16 h-4"
                    />
                    <input
                      type="number"
                      value={currentLineHeight}
                      min={0}
                      max={3}
                      step={0.1}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val)) handleLineHeightChange(val);
                      }}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val))
                          handleLineHeightChange(clamp(val, 0, 3));
                      }}
                      className={numberInputClass}
                    />
                  </div>

                  <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                    <MoveHorizontal
                      size={12}
                      className="text-white/50 shrink-0"
                    />
                    <Slider
                      value={[currentLetterSpacing]}
                      min={-10}
                      max={20}
                      step={0.5}
                      onValueChange={handleLetterSpacingChange}
                      className="w-16 h-4"
                    />
                    <input
                      type="number"
                      value={currentLetterSpacing}
                      min={-10}
                      max={20}
                      step={0.5}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val)) handleLetterSpacingChange(val);
                      }}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val))
                          handleLetterSpacingChange(clamp(val, -10, 20));
                      }}
                      className={numberInputClass}
                    />
                  </div>
                </>
              )}

              <div className="w-px h-6 bg-white/10" />

              <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                <Layers size={12} className="text-white/50 shrink-0" />
                <Slider
                  value={[Math.round(currentOpacity * 100)]}
                  min={10}
                  max={100}
                  onValueChange={handleOpacityChange}
                  className="w-16 h-4"
                />
                <input
                  type="number"
                  value={Math.round(currentOpacity * 100)}
                  min={10}
                  max={100}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val)) handleOpacityChange(val);
                  }}
                  onBlur={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val)) handleOpacityChange(clamp(val, 10, 100));
                  }}
                  className={numberInputClass}
                />
                <span className="text-[10px] text-white/60">%</span>
              </div>

              <div className="w-px h-6 bg-white/10" />

              <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                <RotateCw size={12} className="text-white/50 shrink-0" />
                <Slider
                  value={[currentRotation]}
                  min={-180}
                  max={180}
                  onValueChange={handleRotationChange}
                  className="w-16 h-4"
                />
                <input
                  type="number"
                  value={Number(currentRotation).toFixed(1)}
                  min={-180}
                  max={180}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val)) handleRotationChange(val);
                  }}
                  onBlur={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val))
                      handleRotationChange(clamp(val, -180, 180));
                  }}
                  className={numberInputClass}
                />
                <span className="text-[10px] text-white/60">°</span>
              </div>

              <div className="w-px h-6 bg-white/10" />

              <button
                onClick={handleDuplicate}
                className="p-1.5 bg-white/5 rounded-lg text-white/60 hover:text-white transition-colors"
                title="Duplicate"
              >
                <Copy size={14} />
              </button>

              <button
                onClick={handleDelete}
                className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
