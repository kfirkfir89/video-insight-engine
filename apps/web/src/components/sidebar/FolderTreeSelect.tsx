import { useState, useMemo } from "react";
import { ChevronRight, Folder, FolderX } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getFolderColorStyle } from "@/lib/style-utils";
import { buildFolderTree } from "@/lib/folder-utils";
import type { FolderNode } from "@/lib/folder-utils";
import type { Folder as FolderData } from "@/types";

interface FolderTreeSelectProps {
  /** All folders available */
  folders: FolderData[];
  /** Current folder ID to exclude (item's current location) */
  currentFolderId?: string | null;
  /** Additional folder IDs to exclude (e.g., the folder being moved and its descendants) */
  excludeFolderIds?: string[];
  /** Callback when a folder is selected */
  onSelect: (folderId: string | null) => void;
  /** Whether to show "Remove from folder" option */
  showRemoveOption?: boolean;
  /** Label for remove option */
  removeLabel?: string;
}

/**
 * Recursive folder tree item for selection menus.
 * Shows nested folder structure with proper indentation.
 */
function FolderTreeItem({
  node,
  level,
  excludeIds,
  onSelect,
}: {
  node: FolderNode;
  level: number;
  excludeIds: Set<string>;
  onSelect: (folderId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = node.children.length > 0;
  const isExcluded = excludeIds.has(node.id);

  // Filter out excluded children
  const visibleChildren = node.children.filter((child) => !excludeIds.has(child.id));

  if (isExcluded) {
    return null;
  }

  return (
    <div>
      <DropdownMenuItem
        className={cn(
          "flex items-center gap-2 cursor-pointer",
          level > 0 && "ml-4"
        )}
        style={{ paddingLeft: `${8 + level * 12}px` }}
        onClick={(e) => {
          if (hasChildren && visibleChildren.length > 0) {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          } else {
            onSelect(node.id);
          }
        }}
        onSelect={(e) => {
          // Allow selection even if has children
          if (!hasChildren || visibleChildren.length === 0) {
            return;
          }
          e.preventDefault();
        }}
      >
        {/* Expand/collapse chevron */}
        {hasChildren && visibleChildren.length > 0 ? (
          <button
            className="w-4 h-4 flex items-center justify-center shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Folder icon */}
        <Folder
          className="h-4 w-4 shrink-0"
          style={getFolderColorStyle(node.color)}
        />

        {/* Folder name - click to select */}
        <span
          className="truncate flex-1 cursor-pointer hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(node.id);
          }}
        >
          {node.name}
        </span>
      </DropdownMenuItem>

      {/* Nested children */}
      {isExpanded && visibleChildren.length > 0 && (
        <div>
          {visibleChildren.map((child) => (
            <FolderTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              excludeIds={excludeIds}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Folder tree selection component for "Move to folder" menus.
 * Shows a hierarchical tree of folders with expand/collapse functionality.
 */
export function FolderTreeSelect({
  folders,
  currentFolderId,
  excludeFolderIds = [],
  onSelect,
  showRemoveOption = false,
  removeLabel = "Remove from folder",
}: FolderTreeSelectProps) {
  // Build folder tree
  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);

  // Create set of excluded folder IDs
  const excludeIds = useMemo(() => {
    const ids = new Set<string>(excludeFolderIds);
    if (currentFolderId) {
      ids.add(currentFolderId);
    }
    return ids;
  }, [currentFolderId, excludeFolderIds]);

  // Filter out excluded root folders
  const visibleRoots = folderTree.filter((node) => !excludeIds.has(node.id));

  const hasAvailableFolders = visibleRoots.length > 0;

  return (
    <>
      {/* Remove from folder option */}
      {showRemoveOption && (
        <>
          <DropdownMenuItem onClick={() => onSelect(null)}>
            <FolderX className="h-4 w-4" />
            <span>{removeLabel}</span>
          </DropdownMenuItem>
          {hasAvailableFolders && <DropdownMenuSeparator />}
        </>
      )}

      {/* Folder tree */}
      {hasAvailableFolders ? (
        visibleRoots.map((node) => (
          <FolderTreeItem
            key={node.id}
            node={node}
            level={0}
            excludeIds={excludeIds}
            onSelect={onSelect}
          />
        ))
      ) : (
        <DropdownMenuItem disabled>
          <span className="text-muted-foreground">No folders available</span>
        </DropdownMenuItem>
      )}
    </>
  );
}
