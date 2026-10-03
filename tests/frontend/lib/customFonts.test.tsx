import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { render, screen, waitFor, act } from "@testing-library/react";
import {
  BUILTIN_FONTS,
  CustomFontsProvider,
  familyFromFilename,
  useCustomFonts,
  type CustomFont,
} from "@/lib/customFonts";

// jsdom implements neither FontFace nor document.fonts, so both are stubbed.
class FontFaceStub {
  loaded = true;
  constructor(
    public family: string,
    public source: ArrayBuffer,
    public descriptors?: object,
  ) {}
  load() {
    return this.loaded
      ? Promise.resolve(this as unknown as FontFace)
      : Promise.reject(new Error("decode failed"));
  }
}

const addedFaces: FontFaceStub[] = [];
const deletedFaces: FontFaceStub[] = [];

function installFontStubs() {
  vi.stubGlobal("FontFace", FontFaceStub as unknown as typeof FontFace);
  Object.defineProperty(document, "fonts", {
    configurable: true,
    writable: true,
    value: {
      add: (face: FontFaceStub) => addedFaces.push(face),
      delete: (face: FontFaceStub) => {
        deletedFaces.push(face);
        return true;
      },
      check: () => true,
    },
  });
}

function fontBytes(tag: string, length = 32): ArrayBuffer {
  const buffer = new ArrayBuffer(length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < tag.length; i += 1) view[i] = tag.charCodeAt(i);
  return buffer;
}

function fontFile(name: string, tag: string): File {
  return new File([fontBytes(tag)], name, { type: "font/ttf" });
}

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useCustomFonts>) => void }) {
  const api = useCustomFonts();
  onReady(api);
  return (
    <div>
      <span data-testid="fonts">{api.fonts.join("|")}</span>
      <span data-testid="custom">{api.customFonts.map((c: CustomFont) => `${c.name}:${c.loaded}`).join("|")}</span>
      <span data-testid="error">{api.error ?? ""}</span>
      <span data-testid="accept">{api.acceptExtensions}</span>
    </div>
  );
}

function renderProvider() {
  let api!: ReturnType<typeof useCustomFonts>;
  const { unmount } = render(
    <CustomFontsProvider>
      <Probe onReady={(value) => { api = value; }} />
    </CustomFontsProvider>,
  );
  return { getApi: () => api, unmount };
}

beforeEach(() => {
  // A fresh database per test so stored fonts never leak between cases.
  vi.stubGlobal("indexedDB", new IDBFactory());
  addedFaces.length = 0;
  deletedFaces.length = 0;
  installFontStubs();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("familyFromFilename", () => {
  it("drops the extension", () => {
    expect(familyFromFilename("Inter-SemiBold.ttf")).toBe("Inter-SemiBold");
    expect(familyFromFilename("Roboto.woff2")).toBe("Roboto");
  });

  it("drops only the final extension", () => {
    expect(familyFromFilename("my.font.name.otf")).toBe("my.font.name");
  });

  it("trims surrounding whitespace", () => {
    expect(familyFromFilename("  Padded Font .ttf ")).toBe("Padded Font");
  });

  it("falls back to the full filename when nothing is left", () => {
    expect(familyFromFilename(".ttf")).toBe(".ttf");
    // The fallback returns the untouched filename, including any whitespace.
    expect(familyFromFilename("   .ttf")).toBe("   .ttf");
  });

  it("keeps filenames without an extension", () => {
    expect(familyFromFilename("NoExtension")).toBe("NoExtension");
  });
});

describe("useCustomFonts", () => {
  it("throws when used outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe onReady={() => {}} />)).toThrow(
      "useCustomFonts must be used within a CustomFontsProvider",
    );
    spy.mockRestore();
  });

  it("starts with only the builtin fonts", () => {
    const { getApi } = renderProvider();
    expect(screen.getByTestId("fonts").textContent).toBe(BUILTIN_FONTS.join("|"));
    expect(screen.getByTestId("custom").textContent).toBe("");
    expect(getApi().builtinFonts).toEqual(BUILTIN_FONTS);
  });

  it("exposes the accepted extensions for the file input", () => {
    renderProvider();
    const accept = screen.getByTestId("accept").textContent ?? "";
    for (const ext of [".ttf", ".otf", ".woff", ".woff2"]) {
      expect(accept, ext).toContain(ext);
    }
    expect(accept).toContain("font/woff2");
  });

  it("adds a valid ttf font and registers the face", async () => {
    const { getApi } = renderProvider();
    let added!: CustomFont;
    await act(async () => {
      added = await getApi().addFont(fontFile("Fancy Sans.ttf", "\x00\x01\x00\x00"));
    });

    expect(added.name).toBe("Fancy Sans");
    expect(added.ext).toBe(".ttf");
    expect(added.loaded).toBe(true);
    expect(added.filename).toBe("Fancy Sans.ttf");
    await waitFor(() =>
      expect(screen.getByTestId("fonts").textContent).toBe(
        `${BUILTIN_FONTS.join("|")}|Fancy Sans`,
      ),
    );
    expect(screen.getByTestId("custom").textContent).toBe("Fancy Sans:true");
    expect(addedFaces).toHaveLength(1);
    expect(addedFaces[0].family).toBe("Fancy Sans");
  });

  it("accepts every supported extension with a matching signature", async () => {
    const { getApi } = renderProvider();
    const cases: Array<[string, string, string]> = [
      ["A.ttf", "\x00\x01\x00\x00", ".ttf"],
      ["B.otf", "OTTO", ".otf"],
      ["C.woff", "wOFF", ".woff"],
      ["D.woff2", "wOF2", ".woff2"],
    ];
    for (const [name, tag, ext] of cases) {
      await act(async () => {
        const item = await getApi().addFont(fontFile(name, tag));
        expect(item.ext).toBe(ext);
        expect(item.loaded).toBe(true);
      });
    }
    expect(screen.getByTestId("custom").textContent).toBe(
      "A:true|B:true|C:true|D:true",
    );
  });

  it("persists the font so a remount restores it", async () => {
    const { getApi: first, unmount } = renderProvider();
    await act(async () => {
      await first().addFont(fontFile("Persisted.ttf", "\x00\x01\x00\x00"));
    });
    unmount();

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("custom").textContent).toBe("Persisted:true"),
    );
    expect(screen.getByTestId("fonts").textContent).toContain("Persisted");
  });

  it("rejects unsupported extensions", async () => {
    const { getApi } = renderProvider();
    await act(async () => {
      await expect(getApi().addFont(fontFile("Bad.pdf", "%PDF"))).rejects.toThrow(
        /Unsupported font file "Bad.pdf"/,
      );
    });
    const message = screen.getByTestId("error").textContent ?? "";
    expect(message).toContain("Unsupported font file");
    expect(message).toContain(".ttf, .otf, .woff, or .woff2");
    expect(screen.getByTestId("custom").textContent).toBe("");
  });

  it("rejects a file whose bytes do not match its extension", async () => {
    const { getApi } = renderProvider();
    await act(async () => {
      await expect(getApi().addFont(fontFile("Fake.woff2", "wOFF"))).rejects.toThrow(
        /doesn't look like a valid \.woff2 font file/,
      );
    });
    expect(screen.getByTestId("custom").textContent).toBe("");
  });

  it("rejects a file that is too short to be a font", async () => {
    const { getApi } = renderProvider();
    await act(async () => {
      await expect(getApi().addFont(fontFile("Tiny.ttf", "a"))).rejects.toThrow(
        /doesn't look like a valid/,
      );
    });
  });

  it("rejects a duplicate family regardless of case", async () => {
    const { getApi } = renderProvider();
    await act(async () => {
      await getApi().addFont(fontFile("Unique.ttf", "\x00\x01\x00\x00"));
    });
    await act(async () => {
      await expect(getApi().addFont(fontFile("unique.ttf", "\x00\x01\x00\x00"))).rejects.toThrow(
        /already available as a custom font/,
      );
    });
    expect(screen.getByTestId("custom").textContent).toBe("Unique:true");
  });

  it("clears a previous error on a successful add", async () => {
    const { getApi } = renderProvider();
    await act(async () => {
      await expect(getApi().addFont(fontFile("Bad.pdf", "%PDF"))).rejects.toThrow();
    });
    expect(screen.getByTestId("error").textContent).not.toBe("");

    await act(async () => {
      await getApi().addFont(fontFile("Good.ttf", "\x00\x01\x00\x00"));
    });
    expect(screen.getByTestId("error").textContent).toBe("");
  });

  it("clearError resets the message", async () => {
    const { getApi } = renderProvider();
    await act(async () => {
      await expect(getApi().addFont(fontFile("Bad.pdf", "%PDF"))).rejects.toThrow();
    });
    act(() => getApi().clearError());
    expect(screen.getByTestId("error").textContent).toBe("");
  });

  it("removes a font from the list, the database and document.fonts", async () => {
    const { getApi } = renderProvider();
    let id = "";
    await act(async () => {
      id = (await getApi().addFont(fontFile("Doomed.ttf", "\x00\x01\x00\x00"))).id;
    });
    expect(screen.getByTestId("custom").textContent).toBe("Doomed:true");

    await act(async () => {
      await getApi().removeFont(id);
    });

    expect(screen.getByTestId("custom").textContent).toBe("");
    expect(screen.getByTestId("fonts").textContent).toBe(BUILTIN_FONTS.join("|"));
    expect(deletedFaces).toHaveLength(1);
  });

  it("keeps the font deleted after a remount", async () => {
    const { getApi: first, unmount } = renderProvider();
    let id = "";
    await act(async () => {
      id = (await first().addFont(fontFile("Doomed.ttf", "\x00\x01\x00\x00"))).id;
    });
    await act(async () => {
      await first().removeFont(id);
    });
    unmount();

    renderProvider();
    await waitFor(() => expect(screen.getByTestId("custom").textContent).toBe(""));
  });

  it("marks a font as not loaded when the face fails to decode", async () => {
    vi.stubGlobal(
      "FontFace",
      class {
        constructor(
          public family: string,
          public source: ArrayBuffer,
        ) {}
        load() {
          return Promise.reject(new Error("decode failed"));
        }
      } as unknown as typeof FontFace,
    );
    const { getApi } = renderProvider();
    let added!: CustomFont;
    await act(async () => {
      added = await getApi().addFont(fontFile("Broken.ttf", "\x00\x01\x00\x00"));
    });
    expect(added.loaded).toBe(false);
    expect(screen.getByTestId("custom").textContent).toBe("Broken:false");
    expect(addedFaces).toHaveLength(0);
  });

  it("ignores removal of an unknown id", async () => {
    const { getApi } = renderProvider();
    await act(async () => {
      await getApi().addFont(fontFile("Keep.ttf", "\x00\x01\x00\x00"));
    });
    await act(async () => {
      await getApi().removeFont("does-not-exist");
    });
    expect(screen.getByTestId("custom").textContent).toBe("Keep:true");
  });
});