import { memo } from "react";
import {
  LayoutGrid,
  Search,
  Library,
  MessageCircle,
  Command,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useUIStore,
  useActiveSection,
  useIconStripCollapsed,
} from "@/stores/ui-store";
import { useSidebarToggle } from "@/hooks/use-sidebar-toggle";
import { cn } from "@/lib/utils";
import { SidebarNavItem } from "./SidebarNavItem";

/**
 * Left nav rail shown on desktop when the main sidebar is closed.
 *
 * Default: labels visible under every icon (Arc-style wayfinding) —
 * first-time users should never have to probe icons to learn the app.
 *
 * Opt-in collapsed: a chevron toggle at the foot of the strip collapses
 * the rail to icon-only. In that mode tooltips switch from the provider's
 * hover probe to a near-instant ~120ms delay so discovery still works on
 * first contact, but power users get the density back.
 *
 * Collapsed preference persists via `useUIStore` (Zustand persist →
 * localStorage key `vie-ui-store`, field `iconStripCollapsed`).
 */
export const LeftSidebarIconStrip = memo(function LeftSidebarIconStrip() {
  const { toggle: toggleSidebar } = useSidebarToggle();
  const openSidebarSearch = useUIStore((s) => s.openSidebarSearch);
  const activeSection = useActiveSection();
  const setActiveSection = useUIStore((s) => s.setActiveSection);
  const collapsed = useIconStripCollapsed();
  const toggleCollapsed = useUIStore((s) => s.toggleIconStripCollapsed);

  const handleTabClick = (section: "summarized" | "assistant") => {
    setActiveSection(section);
    toggleSidebar();
  };

  const handleOpenCommandPalette = () => {
    window.dispatchEvent(new CustomEvent("vie:open-command-palette"));
  };

  // Tooltip delay: instant-ish when labels are hidden; suppressed when expanded
  // (SidebarNavItem skips rendering tooltips in expanded mode).
  const tooltipDelay = 120;

  return (
    <TooltipProvider delayDuration={tooltipDelay} skipDelayDuration={0}>
      <nav
        aria-label="Primary navigation"
        className={cn(
          "h-full bg-card rounded-(--app-chrome-radius) flex flex-col items-center shrink-0",
          "transition-[width] duration-200 ease-out motion-reduce:transition-none",
          collapsed ? "w-12 py-2 gap-1" : "w-[72px] py-2 gap-1",
        )}
      >
        {/* Board — matches mobile bottom nav icon for cross-device consistency */}
        <SidebarNavItem
          as="link"
          to="/board"
          icon={LayoutGrid}
          label="Board"
          ariaLabel="Go to your board"
          collapsed={collapsed}
        />

        {/* New summary — primary CTA, always reachable */}
        <div className={cn("mt-1", collapsed ? undefined : "mt-0.5")}>
          <SidebarNavItem
            as="link"
            to="/generate"
            icon={Plus}
            label="New"
            ariaLabel="Create a new video summary"
            variant="solid"
            collapsed={collapsed}
          />
        </div>

        {/* Divider */}
        <div className="w-6 h-px bg-border/50 my-1" aria-hidden="true" />

        {/* Collection */}
        <SidebarNavItem
          as="button"
          onClick={() => handleTabClick("summarized")}
          icon={Library}
          label="Library"
          ariaLabel="Open your library"
          collapsed={collapsed}
          active={activeSection === "summarized"}
          accent="primary"
        />

        {/* Assistant — coral accent for clear wayfinding vs. Library */}
        <SidebarNavItem
          as="button"
          onClick={() => handleTabClick("assistant")}
          icon={MessageCircle}
          label="Assistant"
          ariaLabel="Open assistant"
          collapsed={collapsed}
          active={activeSection === "assistant"}
          accent="coral"
        />

        {/* Divider */}
        <div className="w-6 h-px bg-border/50 my-1" aria-hidden="true" />

        {/* Search */}
        <SidebarNavItem
          as="button"
          onClick={openSidebarSearch}
          icon={Search}
          label="Search"
          ariaLabel="Search videos"
          collapsed={collapsed}
        />

        {/* Command palette */}
        <SidebarNavItem
          as="button"
          onClick={handleOpenCommandPalette}
          icon={Command}
          label="Command"
          ariaLabel="Open command palette"
          collapsed={collapsed}
          tooltipHint={<>⌘K</>}
        />

        {/* Spacer pushes collapse toggle to the bottom */}
        <div className="flex-1" aria-hidden="true" />

        {/* Collapse toggle — Arc-style chevron at the foot of the rail */}
        <CollapseToggle collapsed={collapsed} onToggle={toggleCollapsed} />
      </nav>
    </TooltipProvider>
  );
});

interface CollapseToggleProps {
  collapsed: boolean;
  onToggle: () => void;
}

function CollapseToggle({ collapsed, onToggle }: CollapseToggleProps) {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          aria-label={label}
          aria-pressed={collapsed}
          className={cn(
            "flex items-center justify-center rounded-md text-muted-foreground",
            "hover:bg-muted hover:text-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
            "motion-reduce:transition-none",
            collapsed ? "h-7 w-7" : "h-7 w-14",
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
