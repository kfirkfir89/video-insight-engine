import { memo } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileFABProps {
  onClick: () => void;
  className?: string;
}

/**
 * Floating action button for quick video submission on mobile.
 * Positioned bottom-right, above the bottom nav.
 */
export const MobileFAB = memo(function MobileFAB({
  onClick,
  className,
}: MobileFABProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed z-50 md:hidden",
        "bottom-[calc(4rem+env(safe-area-inset-bottom))] right-4",
        "flex items-center justify-center w-14 h-14 rounded-full",
        "bg-primary text-primary-foreground shadow-lg",
        "active:scale-95 transition-transform",
        "hover:shadow-xl",
        className
      )}
      aria-label="Add new video"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
});
