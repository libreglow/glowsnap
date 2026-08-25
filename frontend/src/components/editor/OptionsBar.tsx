import React from "react";
import {
  Palette,
  Minus,
  Plus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Layers,
  Type,
  PaintBucket,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CaseSensitive,
  WrapText,
  MoveHorizontal,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { Tool } from "@/types/types";
import FontPicker from "./FontPicker";

interface OptionsBarProps {
  selectedTool: Tool;
  color: string;
  setColor: (c: string) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  opacity: number;
  setOpacity: (o: number) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
  fontFamily: string;
  setFontFamily: (f: string) => void;
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

const handleSlider =
  (setter: (v: number) => void) => (v: number | readonly number[]) => {
    setter(Array.isArray(v) ? v[0] : v);
  };

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
  "text-[10px] text-white/60 w-6 text-right tabular-nums bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-white/30 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

export default function OptionsBar({
  selectedTool,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
  opacity,
  setOpacity,
  fontSize,
  setFontSize,
  fontFamily,
  setFontFamily,
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
}: OptionsBarProps) {
  if (
    selectedTool === "select" ||
    selectedTool === "crop" ||
    selectedTool === "eraser"
  )
    return null;

  return (
    <div className="flex wails-no-drag items-center gap-3 px-4 py-1.5 border-b border-white/10 bg-black/40 backdrop-blur-md text-white">
      <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
        <Palette size={13} className="text-white/50" />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-5 h-5 rounded border border-white/10 bg-transparent cursor-pointer"
        />
      </div>

      <div className="w-px h-4 bg-white/20" />

      <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1">
        <Minus size={13} className="text-white/50" />
        <Slider
          value={[strokeWidth]}
          min={1}
          max={20}
          onValueChange={handleSlider(setStrokeWidth)}
          className="w-20 h-4"
        />
        <Plus size={13} className="text-white/50" />
        <input
          type="number"
          value={strokeWidth}
          min={1}
          max={20}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (!isNaN(val)) setStrokeWidth(val);
          }}
          onBlur={(e) => {
            const val = Number(e.target.value);
            if (!isNaN(val)) setStrokeWidth(clamp(val, 1, 20));
          }}
          className={numberInputClass}
        />
        <span className="text-[10px] text-white/60">px</span>
      </div>

      <div className="w-px h-4 bg-white/20" />

      <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1">
        <Layers size={13} className="text-white/50" />
        <span className="text-[10px] text-white/40 uppercase tracking-wider">
          Opacity
        </span>
        <Slider
          value={[opacity * 100]}
          min={10}
          max={100}
          onValueChange={handleSlider((v) => setOpacity(v / 100))}
          className="w-20 h-4"
        />
        <input
          type="number"
          value={Math.round(opacity * 100)}
          min={10}
          max={100}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (!isNaN(val)) setOpacity(val / 100);
          }}
          onBlur={(e) => {
            const val = Number(e.target.value);
            if (!isNaN(val)) setOpacity(clamp(val, 10, 100) / 100);
          }}
          className={numberInputClass}
        />
        <span className="text-[10px] text-white/60">%</span>
      </div>

      {(selectedTool === "rectangle" || selectedTool === "circle") && (
        <>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
            <PaintBucket size={13} className="text-white/50" />
            <button
              onClick={() => setFillEnabled(!fillEnabled)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                fillEnabled ? "bg-white/20 text-white" : "text-white/40"
              }`}
              title={fillEnabled ? "Fill enabled" : "No fill"}
            >
              {fillEnabled ? "Fill" : "No Fill"}
            </button>
          </div>
        </>
      )}

      {selectedTool === "text" && (
        <>
          <div className="w-px h-4 bg-white/20" />

          <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
            <Toggle
              pressed={isBold}
              onPressedChange={setIsBold}
              className="data-[state=on]:bg-white/20 text-white/60 hover:text-white rounded p-1.5"
              title="Bold"
            >
              <Bold size={13} />
            </Toggle>
            <Toggle
              pressed={isItalic}
              onPressedChange={setIsItalic}
              className="data-[state=on]:bg-white/20 text-white/60 hover:text-white rounded p-1.5"
              title="Italic"
            >
              <Italic size={13} />
            </Toggle>
            <Toggle
              pressed={isUnderline}
              onPressedChange={setIsUnderline}
              className="data-[state=on]:bg-white/20 text-white/60 hover:text-white rounded p-1.5"
              title="Underline"
            >
              <Underline size={13} />
            </Toggle>
            <Toggle
              pressed={isStrikethrough}
              onPressedChange={setIsStrikethrough}
              className="data-[state=on]:bg-white/20 text-white/60 hover:text-white rounded p-1.5"
              title="Strikethrough"
            >
              <Strikethrough size={13} />
            </Toggle>
            {(() => {
              const AlignIcon = ALIGN_ICONS[textAlign];
              const currentIndex = ALIGN_ORDER.indexOf(textAlign);
              const next = ALIGN_ORDER[(currentIndex + 1) % ALIGN_ORDER.length];
              const label =
                textAlign.charAt(0).toUpperCase() + textAlign.slice(1);
              return (
                <button
                  onClick={() => setTextAlign(next)}
                  className="bg-white/5 hover:bg-white/20 text-white/60 hover:text-white rounded p-1.5 transition-colors"
                  title={`Align ${label} (click for ${next})`}
                >
                  <AlignIcon size={13} />
                </button>
              );
            })()}
          </div>

          <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
            <Type size={13} className="text-white/50" />
            <FontPicker
              value={fontFamily}
              onChange={setFontFamily}
              selectClassName="text-xs px-1.5 py-0.5"
              optionClassName="bg-gray-800 text-white"
            />
          </div>

          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1">
            <CaseSensitive size={13} className="text-white/50" />
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              Size
            </span>
            <Slider
              value={[fontSize]}
              min={12}
              max={72}
              onValueChange={handleSlider(setFontSize)}
              className="w-20 h-4"
            />
            <input
              type="number"
              value={fontSize}
              min={12}
              max={72}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val)) setFontSize(val);
              }}
              onBlur={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val)) setFontSize(clamp(val, 12, 72));
              }}
              className={numberInputClass}
            />
            <span className="text-[10px] text-white/60">px</span>
          </div>

          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1">
            <WrapText size={13} className="text-white/50" />
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              Line Height
            </span>
            <Slider
              value={[lineHeight]}
              min={0}
              max={3}
              step={0.1}
              onValueChange={handleSlider(setLineHeight)}
              className="w-20 h-4"
            />
            <input
              type="number"
              value={lineHeight}
              min={0}
              max={3}
              step={0.1}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val)) setLineHeight(val);
              }}
              onBlur={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val)) setLineHeight(clamp(val, 0, 3));
              }}
              className={numberInputClass}
            />
          </div>

          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1">
            <MoveHorizontal size={13} className="text-white/50" />
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              Letter Sp.
            </span>
            <Slider
              value={[letterSpacing]}
              min={-10}
              max={20}
              step={0.5}
              onValueChange={handleSlider(setLetterSpacing)}
              className="w-20 h-4"
            />
            <input
              type="number"
              value={letterSpacing}
              min={-10}
              max={20}
              step={0.5}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val)) setLetterSpacing(val);
              }}
              onBlur={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val)) setLetterSpacing(clamp(val, -10, 20));
              }}
              className={numberInputClass}
            />
          </div>
        </>
      )}
    </div>
  );
}
