import type { ReactNode } from "react";
import { useState, createContext, useContext } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
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
import { useMoveFolder } from "@/hooks/use-folders";

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
  const moveFolder = useMoveFolder();

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

    const cleanup = () => {
      setActiveItem(null);
      setOverFolderId(null);
    };

    if (!over) {
      cleanup();
      return;
    }

    const dragType = active.data.current?.type;
    const targetId = over.id as string;

    // Extract actual folder ID from prefixed targetId
    let targetFolderId: string | null = null;
    if (targetId.startsWith("root-")) {
      targetFolderId = null;
    } else if (targetId.startsWith("folder-")) {
      targetFolderId = targetId.replace("folder-", "");
    } else {
      // Fallback for unprefixed IDs
      targetFolderId = targetId;
    }

    if (dragType === "video") {
      // Extract actual video ID from data
      const videoId = active.data.current?.id as string;
      moveVideo.mutate({ id: videoId, folderId: targetFolderId });
    } else if (dragType === "folder") {
      // Extract actual folder ID from data
      const sourceFolderId = active.data.current?.id as string;

      // Prevent dropping folder into itself
      if (sourceFolderId === targetFolderId) {
        cleanup();
        return;
      }

      // Move folder to new parent
      moveFolder.mutate({ id: sourceFolderId, parentId: targetFolderId });
    }

    cleanup();
  };

  const handleDragCancel = () => {
    setActiveItem(null);
    setOverFolderId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
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
