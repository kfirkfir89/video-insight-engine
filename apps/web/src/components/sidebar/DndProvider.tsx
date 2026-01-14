import type { ReactNode } from "react";
import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  rectIntersection,
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
import { Film, Folder, Files } from "lucide-react";
import { useMoveVideo, useBulkMoveVideos } from "@/hooks/use-videos";
import { useMoveFolder, useBulkMoveFolders } from "@/hooks/use-folders";
import { useUIStore } from "@/stores/ui-store";
import { DndStateContext } from "./dnd-context";

interface DndProviderProps {
  children: ReactNode;
}

interface DragData {
  type: "video" | "folder" | "multi";
  id: string;
  title: string;
  selectedVideoIds?: string[];
  selectedFolderIds?: string[];
}

/** Type guard to check if data matches DragData structure */
function isDragData(data: unknown): data is DragData {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    "id" in data &&
    "title" in data
  );
}

/** Safely extract string array from unknown data */
function getStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string")
    ? value
    : [];
}

export function DndProvider({ children }: DndProviderProps) {
  const [activeItem, setActiveItem] = useState<DragData | null>(null);
  const [overFolderId, setOverFolderId] = useState<string | null>(null);
  const moveVideo = useMoveVideo();
  const moveFolder = useMoveFolder();
  const bulkMoveVideos = useBulkMoveVideos();
  const bulkMoveFolders = useBulkMoveFolders();
  const exitSelectionMode = useUIStore((s) => s.exitSelectionMode);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (isDragData(data)) {
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

    if (dragType === "multi") {
      // Multi-drag: move all selected items
      const data = active.data.current;
      const videoIds = getStringArray(data?.selectedVideoIds);
      const folderIds = getStringArray(data?.selectedFolderIds);

      if (videoIds.length > 0) {
        bulkMoveVideos.mutate({ videoIds, folderId: targetFolderId });
      }
      if (folderIds.length > 0) {
        // Filter out any folder being dropped into itself
        const validFolderIds = folderIds.filter((id) => id !== targetFolderId);
        if (validFolderIds.length > 0) {
          bulkMoveFolders.mutate({ folderIds: validFolderIds, parentId: targetFolderId });
        }
      }
      exitSelectionMode();
    } else if (dragType === "video") {
      // Extract actual video ID from data
      const videoId = String(active.data.current?.id ?? "");
      if (videoId) {
        moveVideo.mutate({ id: videoId, folderId: targetFolderId });
      }
    } else if (dragType === "folder") {
      // Extract actual folder ID from data
      const sourceFolderId = String(active.data.current?.id ?? "");

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
      collisionDetection={rectIntersection}
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
            {activeItem.type === "multi" ? (
              <Files className="h-4 w-4 text-muted-foreground" />
            ) : activeItem.type === "video" ? (
              <Film className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Folder className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm truncate max-w-[200px]">
              {activeItem.type === "multi"
                ? `${(activeItem.selectedVideoIds?.length || 0) + (activeItem.selectedFolderIds?.length || 0)} items`
                : activeItem.title}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
