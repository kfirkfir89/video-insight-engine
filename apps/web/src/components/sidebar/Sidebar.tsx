import { memo } from "react";
import { AddVideoInput } from "./AddVideoInput";
import { SidebarToolbar } from "./SidebarToolbar";
import { SidebarSection } from "./SidebarSection";
import { DndProvider } from "./DndProvider";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Sidebar = memo(function Sidebar() {
  return (
    <aside className="h-full w-full flex flex-col bg-card border-r overflow-hidden">
      {/* Add Video Input at top */}
      <AddVideoInput />

      {/* Toolbar for sidebar controls */}
      <SidebarToolbar />

      {/* Folder sections with DnD context */}
      <DndProvider>
        <ScrollArea className="flex-1">
          <div className="py-2">
            <SidebarSection type="summarized" label="Summaries" />
            <SidebarSection type="memorized" label="Memorized" />
          </div>
        </ScrollArea>
      </DndProvider>
    </aside>
  );
});
