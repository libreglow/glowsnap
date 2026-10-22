import { useCallback, useEffect, useRef, useState } from "react";
import { OverlayProps, OverlayRect } from "@/types/types";

interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type HandleId = "tl" | "tr" | "bl" | "br";

type Mode =
  | { type: "idle" }
  | { type: "drawing"; start: Point }
  | { type: "moving"; grabOffset: Point }
  | { type: "resizing"; handle: HandleId; anchor: Point };

const toRect = (a: Point, b: Point): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
};

const clampPoint = (p: Point, maxX: number, maxY: number): Point => ({
  x: Math.max(0, Math.min(maxX, p.x)),
  y: Math.max(0, Math.min(maxY, p.y)),
});

const HANDLE_SIZE = 12;
const HANDLE_HIT = 20;

export default function Overlay({ imageUrl, onComplete, onCancel }: OverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [mode, setMode] = useState<Mode>({ type: "idle" });
  const [natural, setNatural] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const innerW = window.innerWidth;
  const innerH = window.innerHeight;
  const scaleX = natural && natural.width > 0 ? natural.width / innerW : 1;
  const scaleY = natural && natural.height > 0 ? natural.height / innerH : 1;

  const toImageRect = useCallback(
    (rect: Rect): OverlayRect | null => {
      if (!natural || rect.width < 2 || rect.height < 2) return null;
      return {
        x: Math.round(rect.x * scaleX),
        y: Math.round(rect.y * scaleY),
        width: Math.round(rect.width * scaleX),
        height: Math.round(rect.height * scaleY),
      };
    },
    [natural, scaleX, scaleY],
  );

  const localPoint = (clientX: number, clientY: number): Point => {
    const rect = containerRef.current?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    return clampPoint({ x: clientX - left, y: clientY - top }, innerW, innerH);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel?.();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const imgRect = selection ? toImageRect(selection) : null;
        if (imgRect) onComplete(imgRect);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selection, toImageRect, onComplete, onCancel]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (mode.type === "idle") return;
      const p = localPoint(e.clientX, e.clientY);

      if (mode.type === "drawing") {
        setSelection(toRect(mode.start, p));
        return;
      }

      if (mode.type === "moving") {
        setSelection((prev) => {
          if (!prev) return prev;
          let x = p.x - mode.grabOffset.x;
          let y = p.y - mode.grabOffset.y;
          x = Math.max(0, Math.min(innerW - prev.width, x));
          y = Math.max(0, Math.min(innerH - prev.height, y));
          return { ...prev, x, y };
        });
        return;
      }

      if (mode.type === "resizing") {
        setSelection(toRect(mode.anchor, p));
        return;
      }
    };

    const handleMouseUp = () => {
      setMode({ type: "idle" });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [mode]);

  const handleBackgroundMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setSelection(null);
    setMode({ type: "drawing", start: localPoint(e.clientX, e.clientY) });
  };

  const handleSelectionMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !selection) return;
    e.stopPropagation();
    const p = localPoint(e.clientX, e.clientY);
    setMode({
      type: "moving",
      grabOffset: { x: p.x - selection.x, y: p.y - selection.y },
    });
  };

  const handleHandleMouseDown =
    (handle: HandleId) => (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0 || !selection) return;
      e.stopPropagation();
      const anchor: Point =
        handle === "tl"
          ? {
              x: selection.x + selection.width,
              y: selection.y + selection.height,
            }
          : handle === "tr"
            ? { x: selection.x, y: selection.y + selection.height }
            : handle === "bl"
              ? { x: selection.x + selection.width, y: selection.y }
              : { x: selection.x, y: selection.y };
      setMode({ type: "resizing", handle, anchor });
    };

  const activeRect = mode.type === "drawing" ? (selection ?? null) : selection;

  const handles: { id: HandleId; x: number; y: number; cursor: string }[] =
    activeRect
      ? [
          { id: "tl", x: activeRect.x, y: activeRect.y, cursor: "nwse-resize" },
          {
            id: "tr",
            x: activeRect.x + activeRect.width,
            y: activeRect.y,
            cursor: "nesw-resize",
          },
          {
            id: "bl",
            x: activeRect.x,
            y: activeRect.y + activeRect.height,
            cursor: "nesw-resize",
          },
          {
            id: "br",
            x: activeRect.x + activeRect.width,
            y: activeRect.y + activeRect.height,
            cursor: "nwse-resize",
          },
        ]
      : [];

  return (
    <div
      ref={containerRef}
      onMouseDown={handleBackgroundMouseDown}
      className="fixed inset-0 overflow-hidden cursor-crosshair select-none wails-no-drag"
      style={{ backgroundColor: "#000" }}
    >
      <img
        src={imageUrl}
        alt=""
        draggable={false}
        onLoad={(e) => {
          const el = e.currentTarget;
          setNatural({ width: el.naturalWidth, height: el.naturalHeight });
        }}
        className="pointer-events-none w-full h-full object-fill"
        style={{ imageRendering: "auto" }}
      />

      <div className="absolute inset-0 pointer-events-none bg-black/60" />

      {activeRect && (
        <div
          onMouseDown={handleSelectionMouseDown}
          className="absolute border-2 border-red-500 bg-red-500/20"
          style={{
            left: activeRect.x,
            top: activeRect.y,
            width: activeRect.width,
            height: activeRect.height,
            cursor: mode.type === "moving" ? "grabbing" : "grab",
          }}
        >
          <span className="absolute top-0 left-0 -translate-y-full bg-red-500/90 text-white text-[11px] font-medium px-1.5 py-0.5 rounded-sm whitespace-nowrap pointer-events-none">
            {activeRect.width} × {activeRect.height}
          </span>

          {handles.map((h) => (
            <div
              key={h.id}
              onMouseDown={handleHandleMouseDown(h.id)}
              className="absolute bg-white border-2 border-red-500 rounded-full"
              style={{
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                left: h.x - activeRect.x,
                top: h.y - activeRect.y,
                transform: "translate(-50%, -50%)",
                cursor: h.cursor,
                padding: (HANDLE_HIT - HANDLE_SIZE) / 2,
                backgroundClip: "content-box",
              }}
            />
          ))}
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none rounded-lg bg-black/70 px-3 py-1.5 text-white/90 text-xs flex items-center gap-3 whitespace-nowrap">
        {selection ? (
          <>
            <span className="text-red-500">Selection ready</span>
            <span className="text-white/40">|</span>
            <span>
              <kbd className="text-red-500">Enter</kbd> capture
            </span>
            <span className="text-white/40">|</span>
            <span>
              <kbd className="text-red-500">Esc</kbd> cancel
            </span>
          </>
        ) : (
          <>
            <span>Drag to select an area</span>
            <span className="text-white/40">|</span>
            <span>
              <kbd className="text-red-500">Esc</kbd> cancel
            </span>
          </>
        )}
      </div>
    </div>
  );
}
