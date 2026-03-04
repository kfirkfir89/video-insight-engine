import { memo, useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { OUTPUT_TYPE_CONFIG, getOutputTypeConfig } from "@/lib/output-type-config";
import type { OutputType } from "@vie/types";

interface DetectionOverrideProps {
  detectedType: OutputType;
  confidence: number;
  alternatives?: Array<{ type: string; confidence: number }>;
  onOverride: (type: OutputType) => void;
  className?: string;
}

const ALL_OUTPUT_TYPES = Object.keys(OUTPUT_TYPE_CONFIG) as OutputType[];

export const DetectionOverride = memo(function DetectionOverride({
  detectedType,
  confidence,
  alternatives = [],
  onOverride,
  className,
}: DetectionOverrideProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Focus listbox and set initial focus index when opened
  useEffect(() => {
    if (!open) return;
    const idx = ALL_OUTPUT_TYPES.indexOf(detectedType);
    setFocusedIndex(idx >= 0 ? idx : 0);
    requestAnimationFrame(() => listRef.current?.focus());
  }, [open, detectedType]);

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((i) =>
            Math.min(i + 1, ALL_OUTPUT_TYPES.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedIndex >= 0) {
            onOverride(ALL_OUTPUT_TYPES[focusedIndex]);
            setOpen(false);
          }
          break;
      }
    },
    [focusedIndex, onOverride]
  );

  const currentConfig = getOutputTypeConfig(detectedType);
  const confidencePercent = Math.round(confidence * 100);

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs glass rounded-full px-3 py-1.5 hover:bg-accent/50 transition-colors"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Detected as ${currentConfig.label} (${confidencePercent}% confidence). Click to change.`}
      >
        <Sparkles className="h-3 w-3 text-primary" />
        <span>
          {currentConfig.emoji} {currentConfig.label}
        </span>
        <span className="text-muted-foreground/60">{confidencePercent}%</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          className="absolute top-full mt-1 left-0 z-50 w-56 glass rounded-xl p-1 shadow-lg outline-none"
          aria-label="Select output type"
          aria-activedescendant={
            focusedIndex >= 0
              ? `output-type-${ALL_OUTPUT_TYPES[focusedIndex]}`
              : undefined
          }
        >
          {ALL_OUTPUT_TYPES.map((type, idx) => {
            const config = getOutputTypeConfig(type);
            const alt = alternatives.find((a) => a.type === type);
            const isActive = type === detectedType;

            return (
              <div
                key={type}
                id={`output-type-${type}`}
                role="option"
                aria-selected={isActive}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg transition-colors text-left cursor-pointer",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : idx === focusedIndex
                      ? "bg-accent/50"
                      : "hover:bg-accent/50"
                )}
                onClick={() => {
                  onOverride(type);
                  setOpen(false);
                }}
                onMouseEnter={() => setFocusedIndex(idx)}
              >
                <span>{config.emoji}</span>
                <span className="flex-1">{config.label}</span>
                {alt && (
                  <span className="text-muted-foreground/60">
                    {Math.round(alt.confidence * 100)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
