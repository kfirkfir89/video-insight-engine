import { memo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Plus, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom navigation bar.
 * Hidden on desktop (md:hidden). Safe area insets for notched devices.
 * Active tab: 1px primary-gradient underline via --rule-active token.
 */
export const MobileBottomNav = memo(function MobileBottomNav() {
  const navigate = useNavigate();

  return (
    <nav
      className={cn(
        "fixed bottom-2 inset-x-2 z-40 md:hidden",
        "rounded-(--app-chrome-radius) bg-background/80 backdrop-blur-[12px] shadow-lg",
        "pb-[env(safe-area-inset-bottom)]",
      )}
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch justify-around h-14 max-w-screen-sm mx-auto">
        {/* Board */}
        <NavLink
          to="/board"
          end
          className={({ isActive }) =>
            cn(
              "relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[44px] min-h-[44px] text-xs whitespace-nowrap transition-colors",
              // 1px primary-gradient underline on active route — see --rule-active in index.css
              isActive && "text-primary after:absolute after:inset-x-4 after:top-0 after:h-px after:[background:var(--rule-active)]",
              !isActive && "text-muted-foreground hover:text-foreground",
            )
          }
          aria-label="Board"
        >
          <LayoutGrid className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Board</span>
        </NavLink>

        {/* Create — the one prominent CTA on mobile. */}
        <button
          type="button"
          onClick={() => navigate("/generate")}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[44px] min-h-[44px] text-xs whitespace-nowrap text-primary transition-colors"
          aria-label="Create new summary"
        >
          <div
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full",
              "bg-primary text-primary-foreground",
              "shadow-[0_6px_20px_-8px_oklch(from_var(--primary)_l_c_h_/_0.6)]",
              "active:scale-95 transition-transform motion-reduce:active:scale-100 motion-reduce:transition-none",
            )}
          >
            <Plus className="h-5 w-5 shrink-0" aria-hidden="true" />
          </div>
          <span className="font-semibold">New</span>
        </button>
      </div>
    </nav>
  );
});
