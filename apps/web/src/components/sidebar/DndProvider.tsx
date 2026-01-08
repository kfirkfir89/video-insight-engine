import type { ReactNode } from "react";
import { useState, createContext, useContext } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { Film, Folder } from "lucide-react";
import { useMoveVideo } from "@/hooks/use-videos";

interface DndProviderProps {
  children: ReactNode;
}

interface DragData {
  type: "video" | "folder";
  id: string;
  title: string;
}

// Context to share overFolderId state
const DndStateContext = createContext<string | null>(null);

export function useOverFolderId() {
  return useContext(DndStateContext);
}

export function DndProvider({ children }: DndProviderProps) {
  const [activeItem, setActiveItem] = useState<DragData | null>(null);
  const [overFolderId, setOverFolderId] = useState<string | null>(null);
  const moveVideo = useMoveVideo();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (data) {
      setActiveItem(data);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string | null;
    setOverFolderId(overId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.data.current?.type === "video") {
      const videoId = active.id as string;
      const targetId = over.id as string;

      // Handle drop on folder or "root" (null folderId)
      const folderId = targetId.startsWith("root-") ? null : targetId;

      moveVideo.mutate({ id: videoId, folderId });
    }

    setActiveItem(null);
    setOverFolderId(null);
  };

  const handleDragCancel = () => {
    setActiveItem(null);
    setOverFolderId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <DndStateContext.Provider value={overFolderId}>
        {children}
      </DndStateContext.Provider>

      <DragOverlay>
        {activeItem ? (
          <div className="flex items-center gap-2 px-2 py-1 bg-card border rounded-md shadow-lg">
            {activeItem.type === "video" ? (
              <Film className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Folder className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm truncate max-w-[200px]">
              {activeItem.title}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
