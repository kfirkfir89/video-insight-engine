import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDroppable } from "@dnd-kit/core";
import { ChevronRight, Folder, MoreVertical, Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { DeleteFolderDialog } from "@/components/dialogs/DeleteFolderDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useUpdateFolder, useDeleteFolder, useCreateFolder } from "@/hooks/use-folders";
import { Button } from "@/components/ui/button";
import { VideoItem } from "./VideoItem";
import type { FolderNode } from "@/lib/folder-utils";
import type { FolderType, Video, Folder as FolderData } from "@/types";

interface FolderItemProps {
  folder: FolderNode;
  type: FolderType;
  level: number;
  videos: Video[];
  allFolders: FolderData[];
}

const INDENT_PER_LEVEL = 12;
const BASE_PADDING = 8;

export function FolderItem({ folder, type, level, videos, allFolders }: FolderItemProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // State from Zustand (persisted)
  const expandedFolderIds = useUIStore((s) => s.expandedFolderIds);
  const toggleFolderExpansion = useUIStore((s) => s.toggleFolderExpansion);
  const selectedFolderId = useUIStore((s) => s.selectedFolderId);
  const setSelectedFolder = useUIStore((s) => s.setSelectedFolder);
  const setActiveSection = useUIStore((s) => s.setActiveSection);

  // Local state for rename
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Local state for delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Local state for subfolder creation
  const [showSubfolderInput, setShowSubfolderInput] = useState(false);
  const [subfolderName, setSubfolderName] = useState("");
  const subfolderInputRef = useRef<HTMLInputElement>(null);

  // Mutations
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const createFolder = useCreateFolder();

  // DnD droppable
  const { isOver, setNodeRef } = useDroppable({
    id: folder.id,
    data: { type: "folder", folderId: folder.id },
  });

  const isExpanded = expandedFolderIds.includes(folder.id);
  const isSelected = selectedFolderId === folder.id;

  // Filter videos that belong to this folder
  const folderVideos = videos.filter((v) => v.folderId === folder.id);
  const hasChildren = folder.children.length > 0 || folderVideos.length > 0;

  // Calculated padding: base + (level * indent)
  const paddingLeft = BASE_PADDING + level * INDENT_PER_LEVEL;

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  // Focus input when subfolder creation starts
  useEffect(() => {
    if (showSubfolderInput && subfolderInputRef.current) {
      subfolderInputRef.current.focus();
    }
  }, [showSubfolderInput]);

  const handleClick = () => {
    setSelectedFolder(folder.id);
    setActiveSection(type);

    // If navigating from another page, ensure folder is expanded (don't toggle)
    if (location.pathname !== "/") {
      navigate("/");
      // Ensure folder is expanded when navigating to it
      if (!isExpanded && hasChildren) {
        toggleFolderExpansion(folder.id);
      }
    } else {
      // On dashboard: toggle expansion if folder has children
      if (hasChildren) {
        toggleFolderExpansion(folder.id);
      }
    }
  };

  // Chevron-only toggle (doesn't change selection)
  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFolderExpansion(folder.id);
  };

  const handleRename = async () => {
    if (!renameValue.trim() || renameValue === folder.name) {
      setIsRenaming(false);
      setRenameValue(folder.name);
      return;
    }

    try {
      await updateFolder.mutateAsync({
        id: folder.id,
        data: { name: renameValue.trim() },
      });
      setIsRenaming(false);
    } catch (err) {
      console.error("Failed to rename folder:", err);
      setRenameValue(folder.name);
      setIsRenaming(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async (deleteContent: boolean) => {
    try {
      await deleteFolder.mutateAsync({
        id: folder.id,
        deleteContent,
      });
      // If this folder was selected, deselect
      if (selectedFolderId === folder.id) {
        setSelectedFolder(null);
      }
      setShowDeleteDialog(false);
    } catch (err) {
      console.error("Failed to delete folder:", err);
    }
  };

  // Check for duplicate folder name at the same level
  const isDuplicateName = (name: string) => {
    const siblings = folder.children; // Direct children of this folder
    return siblings.some(
      (child) => child.name.toLowerCase() === name.toLowerCase()
    );
  };

  const handleCreateSubfolder = async () => {
    if (!subfolderName.trim()) return;

    // Check for duplicate at this level
    if (isDuplicateName(subfolderName.trim())) {
      console.error("A folder with this name already exists at this level");
      return;
    }

    try {
      await createFolder.mutateAsync({
        name: subfolderName.trim(),
        type,
        parentId: folder.id,
      });
      setSubfolderName("");
      setShowSubfolderInput(false);
      // Expand folder to show new subfolder
      if (!isExpanded) {
        toggleFolderExpansion(folder.id);
      }
    } catch (err) {
      console.error("Failed to create subfolder:", err);
    }
  };

  const handleSubfolderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateSubfolder();
    }
    if (e.key === "Escape") {
      setShowSubfolderInput(false);
      setSubfolderName("");
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRename();
    }
    if (e.key === "Escape") {
      setIsRenaming(false);
      setRenameValue(folder.name);
    }
  };

  return (
    <div ref={setNodeRef}>
      <div
        className={cn(
          "group flex items-center h-7 cursor-pointer hover:bg-accent/50 rounded-sm transition-colors",
          isSelected && "bg-accent",
          isOver && "bg-primary/20 ring-1 ring-primary/50"
        )}
        style={{ paddingLeft: `${paddingLeft}px`, paddingRight: "8px" }}
        onClick={handleClick}
      >
        {/* Chevron - 16px fixed width */}
        {hasChildren ? (
          <button
            onClick={handleChevronClick}
            className="w-4 h-4 flex items-center justify-center shrink-0 hover:bg-accent rounded-sm"
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Folder Icon - 16px width */}
        <Folder
          className="h-4 w-4 shrink-0 text-muted-foreground"
          style={folder.color ? { color: folder.color } : undefined}
        />

        {/* Name or Rename Input */}
        {isRenaming ? (
          <Input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleRenameKeyDown}
            className="ml-2 h-5 text-sm py-0 px-1 flex-1"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="ml-2 text-sm truncate flex-1">{folder.name}</span>
        )}

        {/* Video count badge */}
        {folderVideos.length > 0 && !isRenaming && (
          <span className="text-xs text-muted-foreground opacity-60 shrink-0">
            {folderVideos.length}
          </span>
        )}

        {/* Add subfolder button - appears on hover */}
        {!isRenaming && (
          <button
            className="p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setShowSubfolderInput((prev) => !prev);
              // Expand folder if closed to show input
              if (!showSubfolderInput && !isExpanded) {
                toggleFolderExpansion(folder.id);
              }
            }}
            title="Create subfolder"
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}

        {/* Context Menu - appears on hover */}
        {!isRenaming && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="ml-1 p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setIsRenaming(true)}>
                <Pencil className="h-4 w-4" />
                <span>Rename</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDeleteClick}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Subfolder input - appears when showSubfolderInput is true */}
      {showSubfolderInput && (
        <div
          className="flex items-center gap-2 py-1"
          style={{ paddingLeft: `${paddingLeft + INDENT_PER_LEVEL}px`, paddingRight: "8px" }}
        >
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={subfolderInputRef}
            value={subfolderName}
            onChange={(e) => setSubfolderName(e.target.value)}
            placeholder="Folder name..."
            className="h-6 text-sm flex-1"
            onKeyDown={handleSubfolderKeyDown}
            onBlur={() => {
              if (!subfolderName.trim() && !createFolder.isPending) {
                setShowSubfolderInput(false);
              }
            }}
            disabled={createFolder.isPending}
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              handleCreateSubfolder();
            }}
            disabled={!subfolderName.trim() || createFolder.isPending}
          >
            {createFolder.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Add"
            )}
          </Button>
        </div>
      )}

      {/* Expanded children */}
      {isExpanded && (hasChildren || showSubfolderInput) && (
        <div>
          {/* Nested folders first */}
          {folder.children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              type={type}
              level={level + 1}
              videos={videos}
              allFolders={allFolders}
            />
          ))}
          {/* Then videos in this folder */}
          {folderVideos.map((video) => (
            <VideoItem
              key={video.id}
              video={video}
              level={level + 1}
              folders={allFolders}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <DeleteFolderDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        folderName={folder.name}
        hasContent={folderVideos.length > 0 || folder.children.length > 0}
        onConfirm={handleDeleteConfirm}
        isPending={deleteFolder.isPending}
      />
    </div>
  );
}
