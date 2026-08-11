import { memo } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { VieLogotype } from "@/components/brand/VieMark";

export const SidebarHeader = memo(function SidebarHeader() {
  return (
    <div
      className={cn(
        "relative flex items-center px-3 h-13 shrink-0",
        // Quiet 1px domain underline — mirrors AppHeader so the sidebar reads
        // as the same chrome territory. See --rule-domain in index.css.
        "after:absolute after:inset-x-0 after:-bottom-px after:h-px after:opacity-60",
        "after:[background:var(--rule-domain)]",
      )}
    >
      <Link
        to="/board"
        className="group flex items-center min-w-0 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        aria-label="Home"
      >
        <VieLogotype size="md" glow />
      </Link>
    </div>
  );
});
