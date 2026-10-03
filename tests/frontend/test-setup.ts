import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import "fake-indexeddb/auto";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

// jsdom does not implement <video>.play()/pause(); the Record view calls them.
if (typeof HTMLMediaElement !== "undefined") {
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: vi.fn(),
  });
}

// jsdom returns 0 for naturalWidth/naturalHeight and never loads images.
Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
  configurable: true,
  get() {
    return 1000;
  },
});
Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
  configurable: true,
  get() {
    return 800;
  },
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  writable: true,
  value: ResizeObserverStub,
});

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

// jsdom implements no Web Animations API; framer-motion probes for it.
if (typeof Element !== "undefined" && !Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => [];
}
// Konva expects a working canvas in some environments; jsdom may not provide full context
if (typeof HTMLCanvasElement !== "undefined") {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: any, ...args: any[]) {
    let ctx: any = null;
    try {
      ctx = orig ? (orig.call(this, type, ...args) as any) : null;
    } catch (e) {
      ctx = null;
    }
    if (!ctx) return null;
    if (type === "2d" && !("imageSmoothingEnabled" in ctx)) {
      (ctx as any).imageSmoothingEnabled = true;
    }
    if (!("fillStyle" in ctx)) (ctx as any).fillStyle = "#000";
    if (!("strokeStyle" in ctx)) (ctx as any).strokeStyle = "#000";
    return ctx;
  } as any;
}
