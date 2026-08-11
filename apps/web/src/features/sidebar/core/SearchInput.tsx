import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Search...",
  className,
  debounceMs = 300,
}: SearchInputProps) {
  // Local state for immediate UI feedback
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync local value when external value changes (e.g., clear from parent)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Global `/` shortcut: focus this input when the user isn't already editing
  // somewhere else. The kbd hint promises this affordance; without the handler
  // pressing `/` would just type the character into whatever has focus.
  useEffect(() => {
    const handleSlash = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement as HTMLElement | null;
      const isEditing =
        !!active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable);
      if (isEditing) return;
      const el = inputRef.current;
      if (!el) return;
      e.preventDefault();
      el.focus();
      el.select();
    };
    window.addEventListener("keydown", handleSlash);
    return () => window.removeEventListener("keydown", handleSlash);
  }, []);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the onChange callback
    debounceRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  };

  const handleClear = () => {
    setLocalValue("");
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    onClear();
  };

  const hasValue = localValue.length > 0;

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        // pe-9 reserves room for the kbd hint / clear button at rest.
        // shadow-xs is inherited from the Input primitive — kept implicit.
        className="h-7 ps-7 pe-9 text-xs bg-muted/20 border-border/50"
        aria-label="Search folders and videos"
        aria-keyshortcuts="/"
      />
      {hasValue ? (
        <button
          onClick={handleClear}
          className="absolute end-2 top-1/2 -translate-y-1/2 p-0.5 rounded-sm hover:bg-accent transition-colors"
          type="button"
          aria-label="Clear search"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      ) : (
        /* Visual keyboard hint — mirrors the New CTA's chip language so the
           sidebar's keyboard affordances feel coordinated. aria-hidden: the
           input is already labelled, this is just a quiet reminder. */
        <kbd
          aria-hidden="true"
          className={cn(
            "absolute end-2 top-1/2 -translate-y-1/2 pointer-events-none",
            "inline-flex items-center font-mono tabular-nums",
            "text-[10px] leading-none tracking-wide",
            "px-1.5 py-0.5 rounded",
            "bg-muted text-muted-foreground/80 border border-border/40",
          )}
        >
          /
        </kbd>
      )}
    </div>
  );
}
