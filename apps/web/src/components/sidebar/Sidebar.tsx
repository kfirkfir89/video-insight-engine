import { AddVideoInput } from "./AddVideoInput";
import { SidebarSection } from "./SidebarSection";
import { DndProvider } from "./DndProvider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export function Sidebar() {
  return (
    <aside className="h-full w-full flex flex-col bg-card border-r overflow-hidden">
      {/* Add Video Input at top */}
      <AddVideoInput />

      <Separator />

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
}
