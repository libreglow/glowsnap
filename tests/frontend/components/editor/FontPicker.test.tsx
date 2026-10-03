import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FontPicker from "@/components/editor/FontPicker";

const { hookMock } = vi.hoisted(() => ({ hookMock: vi.fn() }));

vi.mock("@/lib/customFonts", () => ({
  useCustomFonts: () => hookMock(),
}));

const BUILTIN = ["Inter", "Arial", "Georgia"];
const CUSTOM = [
  { id: "f1", name: "Nunito", loaded: true },
  { id: "f2", name: "Broken", loaded: false },
];

function setup(customFonts = [] as typeof CUSTOM) {
  const state = {
    customFonts,
    builtinFonts: BUILTIN,
    addFont: vi.fn().mockResolvedValue({ id: "new", name: "Uploaded" }),
    removeFont: vi.fn().mockResolvedValue(undefined),
    acceptExtensions: ".ttf,.otf,.woff,.woff2",
  };
  hookMock.mockReturnValue(state);
  return state;
}

function fileInputOf(scope: Document | HTMLElement) {
  return scope.querySelector('input[type="file"]') as HTMLInputElement;
}

function file(name = "Uploaded.ttf") {
  return new File([new Uint8Array([1, 2, 3])], name, {
    type: "font/ttf",
  });
}

describe("FontPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it("lists the built-in fonts", () => {
    render(<FontPicker value="Inter" onChange={vi.fn()} />);
    for (const name of BUILTIN) {
      expect(screen.getByRole("option", { name })).toBeInTheDocument();
    }
  });

  it("marks the current font as selected", () => {
    render(<FontPicker value="Georgia" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveValue("Georgia");
  });

  it("reports a new selection", async () => {
    const onChange = vi.fn();
    render(<FontPicker value="Inter" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "Arial");
    expect(onChange).toHaveBeenCalledWith("Arial");
  });

  it("hides the custom group when there are no custom fonts", () => {
    render(<FontPicker value="Inter" onChange={vi.fn()} />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("groups custom fonts and marks unavailable ones", () => {
    setup(CUSTOM);
    const { container } = render(<FontPicker value="Inter" onChange={vi.fn()} />);
    const group = container.querySelector("optgroup");
    expect(group?.getAttribute("label")).toBe("Custom Fonts");
    expect(screen.getByRole("option", { name: "Nunito" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Broken (unavailable)" })).toBeInTheDocument();
  });

  it("keeps the menu closed initially", () => {
    render(<FontPicker value="Inter" onChange={vi.fn()} />);
    expect(screen.queryByText("No custom fonts yet.")).not.toBeInTheDocument();
  });

  it("opens and closes the font manager", async () => {
    render(<FontPicker value="Inter" onChange={vi.fn()} />);
    const toggle = screen.getByTitle("Add or manage custom fonts");
    await userEvent.click(toggle);
    expect(screen.getByText("No custom fonts yet.")).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.queryByText("No custom fonts yet.")).not.toBeInTheDocument();
  });

  it("closes the font manager on an outside click", async () => {
    render(<FontPicker value="Inter" onChange={vi.fn()} />);
    await userEvent.click(screen.getByTitle("Add or manage custom fonts"));
    expect(screen.getByText("No custom fonts yet.")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    await waitFor(() =>
      expect(screen.queryByText("No custom fonts yet.")).not.toBeInTheDocument(),
    );
  });

  it("uploads a font and selects it", async () => {
    const state = setup();
    const onChange = vi.fn();
    render(<FontPicker value="Inter" onChange={onChange} />);
    await userEvent.click(screen.getByTitle("Add or manage custom fonts"));
    await userEvent.upload(
      fileInputOf(document),
      file(),
    );

    await waitFor(() => expect(state.addFont).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith("Uploaded");
    await waitFor(() => expect(screen.getByText('Added "Uploaded".')).toBeInTheDocument());
  });

  it("reports a failed upload", async () => {
    const state = setup();
    state.addFont.mockRejectedValue(new Error("not a font"));
    render(<FontPicker value="Inter" onChange={vi.fn()} />);
    await userEvent.click(screen.getByTitle("Add or manage custom fonts"));
    await userEvent.upload(
      fileInputOf(document),
      file("bad.ttf"),
    );

    await waitFor(() => expect(screen.getByText("not a font")).toBeInTheDocument());
  });

  it("stringifies a non-Error upload failure", async () => {
    const state = setup();
    state.addFont.mockRejectedValue("weird");
    render(<FontPicker value="Inter" onChange={vi.fn()} />);
    await userEvent.click(screen.getByTitle("Add or manage custom fonts"));
    await userEvent.upload(
      fileInputOf(document),
      file("bad.ttf"),
    );

    await waitFor(() =>
      expect(screen.getByText("Could not add font.")).toBeInTheDocument(),
    );
  });

  it("clears the file input so the same file can be re-picked", async () => {
    const state = setup();
    render(<FontPicker value="Inter" onChange={vi.fn()} />);
    await userEvent.click(screen.getByTitle("Add or manage custom fonts"));
    const input = fileInputOf(document);
    await userEvent.upload(input, file());
    await waitFor(() => expect(state.addFont).toHaveBeenCalledTimes(1));
    expect(input.value).toBe("");
  });

  it("lists custom fonts with remove buttons", async () => {
    setup(CUSTOM);
    render(<FontPicker value="Inter" onChange={vi.fn()} />);
    await userEvent.click(screen.getByTitle("Add or manage custom fonts"));
    expect(screen.getByTitle("Remove Nunito")).toBeInTheDocument();
    expect(screen.getByTitle("Remove Broken")).toBeInTheDocument();
  });

  it("removes a font that is not selected", async () => {
    const state = setup(CUSTOM);
    const onChange = vi.fn();
    render(<FontPicker value="Inter" onChange={onChange} />);
    await userEvent.click(screen.getByTitle("Add or manage custom fonts"));
    await userEvent.click(screen.getByTitle("Remove Broken"));

    await waitFor(() => expect(state.removeFont).toHaveBeenCalledWith("f2"));
    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Removed "Broken".')).toBeInTheDocument());
  });

  it("clears the selection when the selected font is removed", async () => {
    setup(CUSTOM);
    const onChange = vi.fn();
    render(<FontPicker value="nunito" onChange={onChange} />);
    await userEvent.click(screen.getByTitle("Add or manage custom fonts"));
    await userEvent.click(screen.getByTitle("Remove Nunito"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("keeps the selection when a different font is removed", async () => {
    setup(CUSTOM);
    const onChange = vi.fn();
    render(<FontPicker value="Nunito" onChange={onChange} />);
    await userEvent.click(screen.getByTitle("Add or manage custom fonts"));
    await userEvent.click(screen.getByTitle("Remove Broken"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports a failed removal", async () => {
    const state = setup(CUSTOM);
    state.removeFont.mockRejectedValue(new Error("locked"));
    render(<FontPicker value="Inter" onChange={vi.fn()} />);
    await userEvent.click(screen.getByTitle("Add or manage custom fonts"));
    await userEvent.click(screen.getByTitle("Remove Nunito"));
    await waitFor(() =>
      expect(screen.getByText("Could not remove the font.")).toBeInTheDocument(),
    );
  });

  it("blocks the manager while a font operation is running", async () => {
    const state = setup();
    let release: (v?: unknown) => void = () => {};
    state.addFont.mockReturnValue(new Promise((resolve) => {
      release = resolve;
    }));
    render(<FontPicker value="Inter" onChange={vi.fn()} />);
    await userEvent.click(screen.getByTitle("Add or manage custom fonts"));
    await userEvent.upload(
      fileInputOf(document),
      file(),
    );

    await waitFor(() =>
      expect(screen.getByTitle("Add or manage custom fonts")).toBeDisabled(),
    );
    expect(document.querySelector(".animate-spin")).not.toBeNull();
    release();
    await waitFor(() =>
      expect(screen.getByTitle("Add or manage custom fonts")).toBeEnabled(),
    );
  });

  it("ignores a file input change without a file", async () => {
    const state = setup();
    render(<FontPicker value="Inter" onChange={vi.fn()} />);
    await userEvent.click(screen.getByTitle("Add or manage custom fonts"));
    fireEvent.change(fileInputOf(document));
    expect(state.addFont).not.toHaveBeenCalled();
  });

  it("restricts uploads to font extensions", async () => {
    render(<FontPicker value="Inter" onChange={vi.fn()} />);
    await userEvent.click(screen.getByTitle("Add or manage custom fonts"));
    expect(fileInputOf(document)).toHaveAttribute("accept", ".ttf,.otf,.woff,.woff2");
  });
});