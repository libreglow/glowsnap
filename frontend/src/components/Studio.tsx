import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  ArrowLeft,
  Image as ImageIcon,
  RefreshCw,
  X,
  Search,
  Star,
} from "lucide-react";
import { StudioProps, Screenshot } from "@/types/types";
import {
  ListScreenshots,
  GetScreenshotsBaseURL,
  RenameScreenshot,
  DeleteScreenshot,
  GetSettings,
} from "../../wailsjs/go/main/App";
import { ScrollArea } from "@/components/ui/scroll-area";
import Editor from "@/components/editor/Editor";
import { CustomFontsProvider } from "@/lib/customFonts";
import { Button } from "./ui/button";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const IMAGES_PER_PAGE = 50;

const SUPPORTED_IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
function withSupportedExtension(name: string, originalName: string): string {
  const lower = name.toLowerCase();
  if (SUPPORTED_IMAGE_EXTS.some((ext) => lower.endsWith(ext))) return name;
  const dot = originalName.lastIndexOf(".");
  const ext = dot >= 0 ? originalName.slice(dot) : ".png";
  return name + ext;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateGroupLabel(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (sameDay(d, yest)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Studio({ onBackToPalette, onSwitchToRecord }: StudioProps) {
  const [images, setImages] = useState<Screenshot[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<Screenshot | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "az" | "za">(
    "newest",
  );
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [renamingImage, setRenamingImage] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [page, setPage] = useState(1);

  const imageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastOpenedImage = useRef<string | null>(null);
  const renamingRef = useRef(false);
  useEffect(() => {
    const stored = localStorage.getItem("glowsnap-favorites");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[];
        setFavorites(new Set(parsed));
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("glowsnap-favorites", JSON.stringify([...favorites]));
  }, [favorites]);

  const loadImages = async () => {
    try {
      setLoading(true);
      const files = await ListScreenshots();
      const url = await GetScreenshotsBaseURL();
      setBaseUrl(url);
      setImages(files ?? []);
    } catch (err) {
      console.error("Failed to load screenshots:", err);
    } finally {
      setLoading(false);
    }
  };

  const syncImages = useCallback(async () => {
    try {
      const files = await ListScreenshots();
      console.log(
        "[rename-dbg] ListScreenshots() returned",
        JSON.stringify(files),
      );
      setImages(files ?? []);
    } catch (err) {
      console.error(
        "[rename-dbg] Failed to reload screenshots after rename:",
        err,
      );
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, []);

  useEffect(() => {
    if (selectedImage === null && lastOpenedImage.current) {
      const ref = imageRefs.current[lastOpenedImage.current];
      if (ref) {
        setTimeout(() => {
          ref.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
      }
    }
  }, [selectedImage]);

  const toggleFavorite = useCallback((fileName: string) => {
    setFavorites((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileName)) newSet.delete(fileName);
      else newSet.add(fileName);
      return newSet;
    });
  }, []);

  const handleRename = useCallback(
    async (oldName: string, newNameInput: string) => {
      const rawName = newNameInput.trim();

      if (!rawName) {
        console.log("[rename-dbg] cancel (empty input) old=", oldName);
        setRenameValue("");
        setRenamingImage(null);
        return;
      }

      const newName = withSupportedExtension(rawName, oldName);

      if (newName === oldName) {
        console.log(
          "[rename-dbg] cancel (unchanged) old=",
          oldName,
          "new=",
          newName,
        );
        setRenameValue("");
        setRenamingImage(null);
        return;
      }

      if (renamingRef.current) {
        console.log(
          "[rename-dbg] duplicate call suppressed (renamingRef) old=",
          oldName,
          "new=",
          newName,
        );
        return;
      }
      renamingRef.current = true;

      console.log(
        "[rename-dbg] RenameScreenshot(",
        JSON.stringify(oldName),
        "->",
        JSON.stringify(newName),
        ") [raw=",
        JSON.stringify(rawName),
        "]",
      );
      try {
        await RenameScreenshot(oldName, newName);
        console.log(
          "[rename-dbg] RenameScreenshot resolved OK (backend error = none)",
        );

        setFavorites((prev) => {
          if (!prev.has(oldName)) return prev;
          const newSet = new Set(prev);
          newSet.delete(oldName);
          newSet.add(newName);
          console.log(
            "[rename-dbg] favorites migrated",
            JSON.stringify([...prev]),
            "->",
            JSON.stringify([...newSet]),
          );
          return newSet;
        });
        await syncImages();
      } catch (err) {
        console.error("[rename-dbg] Rename failed:", err);
      } finally {
        setRenameValue("");
        setRenamingImage(null);
      }
    },
    [syncImages],
  );

  const handleDelete = useCallback(
    async (fileName: string) => {
      try {
        const cfg = await GetSettings();
        const shouldConfirm = cfg.general?.confirmDelete ?? true;
        if (shouldConfirm && !window.confirm(`Delete ${fileName}?`)) {
          return;
        }
        await DeleteScreenshot(fileName);
        setFavorites((prev) => {
          const newSet = new Set(prev);
          newSet.delete(fileName);
          return newSet;
        });
        await syncImages();
      } catch (err) {
        console.error("[rename-dbg] Delete failed:", err);
      }
    },
    [syncImages],
  );
  const processedImages = useMemo(() => {
    let filtered = [...images];

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(q));
    }

    if (showFavoritesOnly) {
      filtered = filtered.filter((s) => favorites.has(s.name));
    }

    switch (sortOrder) {
      case "newest":
        filtered.sort((a, b) => b.date - a.date);
        break;
      case "oldest":
        filtered.sort((a, b) => a.date - b.date);
        break;
      case "az":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "za":
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }

    return filtered;
  }, [images, debouncedSearch, sortOrder, showFavoritesOnly, favorites]);

  const totalPages = Math.ceil(processedImages.length / IMAGES_PER_PAGE);
  const currentPageImages = processedImages.slice(0, page * IMAGES_PER_PAGE);

  useEffect(() => {
    console.log(
      "[rename-dbg] render state: images=",
      JSON.stringify(images),
      "filtered(",
      debouncedSearch,
      ",",
      sortOrder,
      ",fav=",
      showFavoritesOnly,
      ")=",
      JSON.stringify(processedImages),
      "page1=",
      JSON.stringify(currentPageImages),
    );
  }, [
    images,
    processedImages,
    currentPageImages,
    debouncedSearch,
    sortOrder,
    showFavoritesOnly,
  ]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortOrder, showFavoritesOnly]);

  const handleImageClick = (screenshot: Screenshot) => {
    lastOpenedImage.current = screenshot.name;
    setSelectedImage(screenshot);
  };

  const handleBackToGallery = () => {
    setSelectedImage(null);
  };

  if (selectedImage) {
    const imageUrl = `${baseUrl}/${encodeURIComponent(selectedImage.name)}`;
    return (
      <CustomFontsProvider>
        <Editor imageUrl={imageUrl} onBack={handleBackToGallery} />
      </CustomFontsProvider>
    );
  }

  return (
    <div className="w-full h-full flex flex-col justify-start items-center rounded-3xl backdrop-blur-3xl border border-white/10 shadow-2xl overflow-hidden text-white bg-black">
      <header className="flex items-center z-50 backdrop-blur-lg w-full px-6 py-3 border-b border-white/10 shrink-0 fixed top-0 left-0 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToPalette}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/15 text-xs border border-white/10 text-white/80 hover:text-white transition-transform hover:scale-105 active:scale-95"
          >
            <ArrowLeft size={14} />
            <span>Palette</span>
          </button>
          <h1 className="text-sm font-semibold text-white/90">
            GlowSnap Studio
          </h1>
        </div>

        <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10 ml-auto mr-auto">
          <button
            className="px-3 py-1 text-xs rounded-md bg-white/15 text-white font-medium"
          >
            Studio
          </button>
          <button
            onClick={onSwitchToRecord}
            className="px-3 py-1 text-xs rounded-md text-white/60 hover:text-white/90 transition-colors"
          >
            Record
          </button>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-40 h-8 pl-7 pr-2 text-xs bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-white/30 text-white/80"
            />
          </div>

          <div className="relative w-32">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full h-8 pl-2 pr-8 text-xs bg-white/5 border border-white/10 rounded-lg text-white/80 focus:outline-none focus:border-white/30 appearance-none cursor-pointer"
            >
              <option value="newest" className="bg-black">
                Newest
              </option>
              <option value="oldest" className="bg-black">
                Oldest
              </option>
              <option value="az" className="bg-black">
                A-Z
              </option>
              <option value="za" className="bg-black">
                Z-A
              </option>
            </select>

            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/50 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m19 9-7 7-7-7"
              />
            </svg>
          </div>

          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`p-2 rounded-lg ${showFavoritesOnly ? "bg-yellow-500/20 text-yellow-400" : "bg-white/5 text-white/60"} hover:bg-white/10`}
            title="Show favorites only"
          >
            <Star size={14} />
          </button>

          <button
            onClick={loadImages}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-white/10 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      <ScrollArea className="flex-1 p-4 w-full h-[95vh] mt-16">
        {loading && images.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/40">
            <RefreshCw size={32} className="animate-spin" />
          </div>
        ) : processedImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-white/10 rounded-2xl p-6 text-center text-white/40">
            <ImageIcon size={48} className="mb-3 stroke-1" />
            <p className="text-sm">
              No screenshots yet. Capture your first screen!
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-max">
              {currentPageImages.map((file) => (
                <div
                  key={file.name}
                  ref={(el) => {
                    imageRefs.current[file.name] = el;
                  }}
                  className="relative group bg-white/5 rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-200 cursor-pointer"
                >
                  <img
                    onClick={() => handleImageClick(file)}
                    src={`${baseUrl}/${encodeURIComponent(file.name)}`}
                    alt={file.name}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                  />
                  <div className="p-2 text-xs text-white/70">
                    {renamingImage === file.name ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRename(file.name, renameValue)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          handleRename(file.name, renameValue)
                        }
                        className="bg-white/10 rounded text-xs px-1 w-full outline-none mb-1"
                      />
                    ) : (
                      <span
                        onDoubleClick={() => {
                          renamingRef.current = false;
                          setRenamingImage(file.name);
                          setRenameValue(file.name);
                        }}
                        className="cursor-pointer block truncate"
                        title={file.name}
                      >
                        {file.name}
                      </span>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span
                        className="text-[10px] text-white/40 truncate"
                        title={formatDate(file.date)}
                      >
                        {formatDate(file.date)}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(file.name);
                          }}
                          className={`text-xs ${favorites.has(file.name) ? "text-yellow-400" : "text-white/30 hover:text-yellow-400"}`}
                        >
                          <Star size={15} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(file.name);
                          }}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                    <span className="text-[10px] text-white/30">
                      {formatSize(file.size)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {page < totalPages && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  Load More ({processedImages.length - currentPageImages.length}{" "}
                  remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </ScrollArea>
    </div>
  );
}
