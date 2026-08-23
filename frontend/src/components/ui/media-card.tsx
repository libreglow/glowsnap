import React from "react";
import { Film, Star, X } from "lucide-react";

interface MediaCardProps {
  name: string;
  dateLabel?: string;
  sizeLabel?: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onOpen?: () => void;
  thumbnail?: React.ReactNode;
  cardRef?: (node: HTMLDivElement | null) => void;
  renaming?: boolean;
  renameValue?: string;
  onRenameChange?: (value: string) => void;
  onRenameCommit?: () => void;
  onStartRename?: () => void;
}

export function MediaCard({
  name,
  dateLabel,
  sizeLabel,
  isFavorite,
  onToggleFavorite,
  onDelete,
  onOpen,
  thumbnail,
  cardRef,
  renaming = false,
  renameValue = "",
  onRenameChange,
  onRenameCommit,
  onStartRename,
}: MediaCardProps) {
  return (
    <div
      ref={cardRef}
      className="relative group bg-white/5 rounded-sm overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-200 cursor-pointer"
    >
      {thumbnail ?? (
        <button
          type="button"
          onClick={onOpen}
          title={name}
          className="w-full h-48 flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors"
        >
          <Film size={40} className="stroke-1 text-white/30" />
        </button>
      )}

      <div className="p-2 text-xs text-white/70">
        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => onRenameChange?.(e.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={(e) => e.key === "Enter" && onRenameCommit?.()}
            className="bg-white/10 rounded text-xs px-1 w-full outline-none mb-1"
          />
        ) : (
          <span
            onDoubleClick={onStartRename}
            className="cursor-pointer block truncate"
            title={name}
          >
            {name}
          </span>
        )}

        <div className="flex items-center justify-between mt-1">
          {dateLabel && (
            <span
              className="text-[10px] text-white/40 truncate"
              title={dateLabel}
            >
              {dateLabel}
            </span>
          )}
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={`text-xs ${
                isFavorite ? "text-yellow-400" : "text-white/30 hover:text-yellow-400"
              }`}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star size={15} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-xs text-red-400 hover:text-red-300"
              title="Delete"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {sizeLabel && (
          <span className="text-[10px] text-white/30">{sizeLabel}</span>
        )}
      </div>
    </div>
  );
}