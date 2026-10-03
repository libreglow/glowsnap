import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Editor from "@/components/editor/Editor";
import {
  appSettingsFixture,
  wailsModuleMock,
  type WailsModule,
} from "@tests/test-support/wails";

vi.mock("@wailsjs/go/main/App", async () => {
  const { wailsModuleMock } = await import("@tests/test-support/wails");
  return wailsModuleMock();
});

vi.mock("@/components/editor/FontPicker", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select aria-label="Font family" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="Inter">Inter</option>
    </select>
  ),
}));

const { canvasMock, stageElement, counterBox } = vi.hoisted(() => {
  const canvasMock = vi.fn();
  const counterBox = { value: 0 };
  const stageElement = {
    getBoundingClientRect: () => new DOMRect(0, 0, 800, 600),
  };
  return { canvasMock, stageElement, counterBox };
});

vi.mock("@/components/editor/Canvas", async () => {
  const React = await import("react");
  return {
    default: React.forwardRef((props: Record<string, any>, ref: React.Ref<unknown>) => {
      canvasMock(props);
      React.useImperativeHandle(ref, () => ({
        x: () => 0,
        y: () => 0,
        scaleX: () => 1,
        scaleY: () => 1,
        position: () => {},
        scale: () => {},
        toDataURL: () => "data:image/png;base64,QUJD",
        getPointerPosition: () => null,
        container: () => stageElement,
      }));
      return (
        <div data-testid="canvas" data-zoom={props.zoom} data-crop={String(props.cropMode)}>
          {props.shapes.map((shape: { id: string }) => (
            <button key={shape.id} onClick={() => props.setSelectedId(shape.id)}>
              pick-{shape.id}
            </button>
          ))}
          <button
            onClick={() => {
              counterBox.value += 1;
              props.addShape(
                {
                  id: `s${counterBox.value}`,
                  type: "rect",
                  x: 0,
                  y: 0,
                  width: 10,
                  height: 10,
                },
                true,
              );
            }}
          >
            add-rect
          </button>
          <button onClick={() => props.setCropMode(true)}>start-crop</button>
        </div>
      );
    }),
  };
});

const App = await import("@wailsjs/go/main/App");
const wails = () => App as unknown as WailsModule;

const lastProps = () => canvasMock.mock.calls.at(-1)![0];

function renderEditor(onBack = vi.fn()) {
  const view = render(
    <Editor imageUrl="http://127.0.0.1:34115/shot.png" onBack={onBack} />,
  );
  return { onBack, ...view };
}

async function renderReady(onBack = vi.fn()) {
  const view = renderEditor(onBack);
  await waitFor(() => expect(wails().GetSettings).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByTestId("canvas")).toBeInTheDocument());
  return view;
}

function hasIcon(icon: string) {
  return Array.from(document.querySelectorAll("button")).some((b) =>
    b.querySelector(`svg.lucide-${icon}`),
  );
}

function iconButton(icon: string) {
  const button = Array.from(document.querySelectorAll("button")).find((b) =>
    b.querySelector(`svg.lucide-${icon}`),
  );
  if (!button) throw new Error(`no button with lucide-${icon}`);
  return button as HTMLButtonElement;
}

async function addRect() {
  const before = lastProps().shapes.length;
  await fireEvent.click(screen.getByRole("button", { name: "add-rect" }));
  await waitFor(() => expect(lastProps().shapes).toHaveLength(before + 1));
  const shape = lastProps().shapes.at(-1);
  await waitFor(() => expect(lastProps().selectedId).toBe(shape.id));
  return shape.id as string;
}

function selectShape(id: string) {
  fireEvent.click(screen.getByRole("button", { name: `pick-${id}` }));
}

function press(key: string, init: Record<string, unknown> = {}) {
  fireEvent.keyDown(window, { key, ...init });
}

describe("Editor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    counterBox.value = 0;
    wails().GetSettings.mockResolvedValue(appSettingsFixture());
    wails().SaveFileDialog.mockResolvedValue("");
    wails().WriteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the editor defaults once", async () => {
    await renderReady();
    expect(wails().GetSettings).toHaveBeenCalledTimes(1);
  });

  it("starts on the configured default tool", async () => {
    wails().GetSettings.mockResolvedValue(
      appSettingsFixture({
        editor: {
          defaultTool: "rectangle",
          defaultFont: "Inter",
          defaultFontSize: 24,
          defaultColor: "#ff3b30",
          defaultStrokeWidth: 3,
          defaultOpacity: 1,
        },
      } as never),
    );
    await renderReady();
    await waitFor(() =>
      expect(lastProps().selectedTool).toBe("rectangle"),
    );
  });

  it("falls back to the select tool for an unknown default", async () => {
    wails().GetSettings.mockResolvedValue(
      appSettingsFixture({
        editor: {
          defaultTool: "nonsense",
          defaultFont: "Inter",
          defaultFontSize: 24,
          defaultColor: "#ff3b30",
          defaultStrokeWidth: 3,
          defaultOpacity: 1,
        },
      } as never),
    );
    await renderReady();
    await waitFor(() => expect(lastProps().selectedTool).toBe("select"));
  });

  it("hides the options bar for the select tool", async () => {
    await renderReady();
    expect(document.querySelector('input[type="color"]')).toBeNull();
  });

  it("shows the options bar for a drawing tool", async () => {
    await renderReady();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Rect/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Rect/ }));
    await waitFor(() =>
      expect(document.querySelector('input[type="color"]')).not.toBeNull(),
    );
  });

  it("survives a settings failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    wails().GetSettings.mockRejectedValue(new Error("boom"));
    await renderReady();
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        "Failed to load editor defaults:",
        expect.any(Error),
      ),
    );
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });

  it("goes back", async () => {
    const { onBack } = await renderReady();
    await fireEvent.click(
      screen.getAllByRole("button", { name: "Back" })[0],
    );
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("hands the stage size to the canvas", async () => {
    await renderReady();
    expect(lastProps().stageSize).toEqual({ width: 800, height: 600 });
  });

  it("passes no image until the screenshot loads", async () => {
    await renderReady();
    expect(lastProps().image).toBeNull();
  });

  it("adds a shape through the canvas", async () => {
    await renderReady();
    await fireEvent.click(screen.getByRole("button", { name: "add-rect" }));
    expect(lastProps().shapes).toHaveLength(1);
    expect(lastProps().shapes[0].id).toBe("s1");
  });

  it("selects a newly added shape", async () => {
    await renderReady();
    await addRect();
    expect(lastProps().selectedId).toBe("s1");
    expect(hasIcon("trash-2")).toBe(true);
  });

  it("hides the delete button after deselecting", async () => {
    await renderReady();
    await addRect();
    press("Escape");
    await waitFor(() => expect(lastProps().selectedId).toBeNull());
    // The toolbar animates out, so the delete button unmounts asynchronously.
    await waitFor(() => expect(hasIcon("trash-2")).toBe(false));
  });

  it("removes the selected shape from the canvas props", async () => {
    await renderReady();
    const id = await addRect();
    selectShape(id);
    await waitFor(() => expect(lastProps().selectedId).toBe(id));

    fireEvent.click(iconButton("trash-2"));
    await waitFor(() => expect(lastProps().shapes).toHaveLength(0));
  });

  it("deletes the selection with the Delete key", async () => {
    await renderReady();
    const id = await addRect();
    selectShape(id);

    press("Delete");
    await waitFor(() => expect(lastProps().shapes).toHaveLength(0));
  });

  it("deletes the selection with Backspace", async () => {
    await renderReady();
    const id = await addRect();
    selectShape(id);

    press("Backspace");
    await waitFor(() => expect(lastProps().shapes).toHaveLength(0));
  });

  it("ignores Delete without a selection", async () => {
    await renderReady();
    await addRect();
    press("Escape");
    await waitFor(() => expect(lastProps().selectedId).toBeNull());

    press("Delete");
    expect(lastProps().shapes).toHaveLength(1);
  });

  it("deselects with Escape", async () => {
    await renderReady();
    await addRect();
    selectShape("s1");

    press("Escape");
    await waitFor(() => expect(lastProps().selectedId).toBeNull());
  });

  it("duplicates the selection with Ctrl+D", async () => {
    await renderReady();
    await addRect();
    selectShape("s1");

    press("d", { ctrlKey: true });
    await waitFor(() => expect(lastProps().shapes).toHaveLength(2));
    expect(lastProps().shapes[1].id).not.toBe(lastProps().shapes[0].id);
  });

  it("copies and pastes a shape with an offset", async () => {
    await renderReady();
    await addRect();
    selectShape("s1");

    press("c", { ctrlKey: true });
    press("v", { ctrlKey: true });
    await waitFor(() => expect(lastProps().shapes).toHaveLength(2));
    const pasted = lastProps().shapes[1];
    expect(pasted.x).toBe(20);
    expect(pasted.y).toBe(20);
    await waitFor(() => expect(lastProps().selectedTool).toBe("select"));
  });

  it("ignores paste with an empty clipboard", async () => {
    await renderReady();
    await addRect();
    press("v", { ctrlKey: true });
    expect(lastProps().shapes).toHaveLength(1);
  });

  it("undoes and redoes an edit", async () => {
    await renderReady();
    await addRect();
    await addRect();
    press("z", { ctrlKey: true });
    await waitFor(() => expect(lastProps().shapes).toHaveLength(1));

    press("z", { ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(lastProps().shapes).toHaveLength(2));
  });

  it("redo also answers to Ctrl+Y", async () => {
    await renderReady();
    await addRect();
    await addRect();
    press("z", { ctrlKey: true });
    await waitFor(() => expect(lastProps().shapes).toHaveLength(1));

    press("y", { ctrlKey: true });
    await waitFor(() => expect(lastProps().shapes).toHaveLength(2));
  });

  it("ignores undo before the first snapshot exists", async () => {
    await renderReady();
    await addRect();
    press("z", { ctrlKey: true });
    expect(lastProps().shapes).toHaveLength(1);
  });

  it("exports with Ctrl+S", async () => {
    await renderReady();
    press("s", { ctrlKey: true });
    await waitFor(() => expect(wails().SaveFileDialog).toHaveBeenCalledTimes(1));
  });

  it("opens a save dialog with a timestamped default name", async () => {
    await renderReady();
    fireEvent.click(iconButton("download"));
    await waitFor(() => expect(wails().SaveFileDialog).toHaveBeenCalledTimes(1));
    expect(wails().SaveFileDialog.mock.calls[0][0]).toMatch(/^edited-\d+\.png$/);
  });

  it("writes the exported bytes to the chosen path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      blob: async () => new Blob(["ABC"], { type: "image/png" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    wails().SaveFileDialog.mockResolvedValue("/tmp/out.png");

    await renderReady();
    fireEvent.click(iconButton("download"));

    await waitFor(() => expect(wails().WriteFile).toHaveBeenCalledTimes(1));
    expect(wails().WriteFile.mock.calls[0][0]).toBe("/tmp/out.png");
    expect(wails().WriteFile.mock.calls[0][1]).toEqual(
      Array.from(new TextEncoder().encode("ABC")),
    );
    expect(fetchMock).toHaveBeenCalledWith("data:image/png;base64,QUJD");
  });

  it("does nothing when the save dialog is cancelled", async () => {
    wails().SaveFileDialog.mockResolvedValue("");
    await renderReady();
    fireEvent.click(iconButton("download"));

    await waitFor(() => expect(wails().SaveFileDialog).toHaveBeenCalled());
    expect(wails().WriteFile).not.toHaveBeenCalled();
  });

  it("logs a failed export without crashing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    wails().WriteFile.mockRejectedValue(new Error("disk full"));
    const fetchMock = vi.fn().mockResolvedValue({
      blob: async () => new Blob(["ABC"], { type: "image/png" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    wails().SaveFileDialog.mockResolvedValue("/tmp/out.png");

    await renderReady();
    fireEvent.click(iconButton("download"));

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith("Export failed:", expect.any(Error)),
    );
  });

  it("copies the image to the clipboard", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("ClipboardItem", class {
      constructor(public items: Record<string, Blob>) {}
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      blob: async () => new Blob(["ABC"], { type: "image/png" }),
    }));

    await renderReady();
    await fireEvent.click(screen.getByTitle("Copy image"));

    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
  });

  it("reports an unsupported clipboard", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write: vi.fn() },
    });
    Reflect.deleteProperty(globalThis, "ClipboardItem");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      blob: async () => new Blob(["ABC"], { type: "image/png" }),
    }));

    await renderReady();
    await fireEvent.click(screen.getByTitle("Copy image"));

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        "Clipboard API not supported in this environment",
      ),
    );
  });

  it("logs a failed clipboard copy", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const write = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("ClipboardItem", class {
      constructor(public items: Record<string, Blob>) {}
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      blob: async () => new Blob(["ABC"], { type: "image/png" }),
    }));

    await renderReady();
    await fireEvent.click(screen.getByTitle("Copy image"));

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith("Copy failed:", expect.any(Error)),
    );
  });

  it("switches tools from the toolbar", async () => {
    await renderReady();
    await fireEvent.click(screen.getByRole("button", { name: /Text/ }));
    await waitFor(() => expect(lastProps().selectedTool).toBe("text"));
  });

  it("switches tools from a keyboard shortcut", async () => {
    await renderReady();
    press("t");
    await waitFor(() => expect(lastProps().selectedTool).toBe("text"));
    press("r");
    await waitFor(() => expect(lastProps().selectedTool).toBe("rectangle"));
    press("v");
    await waitFor(() => expect(lastProps().selectedTool).toBe("select"));
  });

  it("zooms in and out", async () => {
    await renderReady();
    press("=", { ctrlKey: true });
    await waitFor(() => expect(lastProps().zoom).toBeGreaterThan(1));

    press("-", { ctrlKey: true });
    await waitFor(() => expect(lastProps().zoom).toBeLessThan(1.1));
  });

  it("shows the crop actions while cropping", async () => {
    await renderReady();
    expect(screen.queryByText("Apply Crop")).not.toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "start-crop" }));
    await waitFor(() => expect(lastProps().cropMode).toBe(true));
    expect(screen.getByText("Apply Crop")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("cancels cropping", async () => {
    await renderReady();
    await fireEvent.click(screen.getByRole("button", { name: "start-crop" }));
    await waitFor(() => expect(lastProps().cropMode).toBe(true));
    await fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => expect(lastProps().cropMode).toBe(false));
  });

  it("toggles the background from the background controls", async () => {
    await renderReady();
    await fireEvent.click(screen.getByTitle("Toggle Background"));
    await waitFor(() => expect(lastProps().backgroundSettings.enabled).toBe(true));
  });

  it("passes the background settings to the canvas", async () => {
    await renderReady();
    expect(lastProps().backgroundSettings).toMatchObject({
      enabled: false,
      type: "linear",
    });
  });

  it("does not render the floating toolbar without a selection", async () => {
    await renderReady();
    expect(screen.queryByTitle("Duplicate")).not.toBeInTheDocument();
  });

  it("shows the floating toolbar for a selected shape", async () => {
    await renderReady();
    await addRect();
    selectShape("s1");
    await waitFor(() => expect(screen.getByTitle("Duplicate")).toBeInTheDocument());
  });

  it("ignores shortcuts while typing in a field", async () => {
    await renderReady();
    await addRect();
    selectShape("s1");

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: "Delete" });

    expect(lastProps().shapes).toHaveLength(1);
    input.remove();
  });
});