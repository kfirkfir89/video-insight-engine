import { memo } from "react";
import { NavLink } from "react-router-dom";
import { Home, Plus, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom navigation bar.
 * Hidden on desktop (md:hidden). Safe area insets for notched devices.
 */
export const MobileBottomNav = memo(function MobileBottomNav({
  onCreateClick,
}: {
  onCreateClick?: () => void;
}) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch justify-around h-14">
        {/* Home */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[44px] min-h-[44px] text-xs transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )
          }
          aria-label="Home"
        >
          <Home className="h-5 w-5" />
          <span>Home</span>
        </NavLink>

        {/* Create (center, highlighted) */}
        <button
          type="button"
          onClick={onCreateClick}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[44px] min-h-[44px] text-xs text-primary transition-colors"
          aria-label="Create new summary"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-sm">
            <Plus className="h-5 w-5" />
          </div>
          <span>New</span>
        </button>

        {/* Board */}
        <NavLink
          to="/board"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[44px] min-h-[44px] text-xs transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )
          }
          aria-label="Board"
        >
          <LayoutGrid className="h-5 w-5" />
          <span>Board</span>
        </NavLink>
      </div>
    </nav>
  );
});
