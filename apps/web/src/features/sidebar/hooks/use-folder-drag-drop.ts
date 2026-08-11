import { useCallback } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface UseFolderDragDropOptions {
  folderId: string;
  folderName: string;
  level: number;
  /** Disables dragging (but not dropping) */
  disabled?: boolean;
  // Multi-drag support
  isMultiDrag?: boolean;
  selectedVideoIds?: string[];
  selectedFolderIds?: string[];
}

interface UseFolderDragDropResult {
  // Combined ref for both draggable and droppable
  setNodeRef: (node: HTMLElement | null) => void;
  // Droppable state
  isOver: boolean;
  // Draggable state
  isDragging: boolean;
  // Draggable attributes and listeners
  attributes: ReturnType<typeof useDraggable>["attributes"];
  listeners: ReturnType<typeof useDraggable>["listeners"];
  // Transform style for dragging
  dragStyle: { transform: string } | undefined;
}

/**
 * Custom hook that combines useDraggable and useDroppable for folder items.
 * Handles the complexity of making a folder both draggable and a drop target.
 */
export function useFolderDragDrop({
  folderId,
  folderName,
  level,
  disabled = false,
  isMultiDrag = false,
  selectedVideoIds = [],
  selectedFolderIds = [],
}: UseFolderDragDropOptions): UseFolderDragDropResult {
  // Droppable - use prefixed ID to ensure uniqueness
  // Never disabled - folders should always accept drops even in selection mode
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `folder-${folderId}`,
    data: { type: "folder", folderId, level },
  });

  // Draggable - for folder-to-folder moves
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `drag-folder-${folderId}`,
    data: {
      type: isMultiDrag ? "multi" : "folder",
      id: folderId,
      title: folderName,
      selectedVideoIds: isMultiDrag ? selectedVideoIds : [],
      selectedFolderIds: isMultiDrag ? selectedFolderIds : [folderId],
    },
    disabled,
  });

  // Combine refs for both droppable and draggable
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      setDropRef(node);
      setDragRef(node);
    },
    [setDropRef, setDragRef]
  );

  const transformString = transform ? CSS.Translate.toString(transform) : undefined;
  const dragStyle = transformString ? { transform: transformString } : undefined;

  return {
    setNodeRef,
    isOver,
    isDragging,
    attributes,
    listeners,
    dragStyle,
  };
}
