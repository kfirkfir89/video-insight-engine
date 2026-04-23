import { memo } from "react";
import { Link } from "react-router-dom";
import { VieLogotype } from "@/components/brand/VieMark";

export const SidebarHeader = memo(function SidebarHeader() {
  return (
    <div className="flex items-center px-3 h-13 border-b border-border/50 shrink-0">
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
