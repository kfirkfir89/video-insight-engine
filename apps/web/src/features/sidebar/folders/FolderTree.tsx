import { memo } from "react";
import { FolderItem } from "./FolderItem";
import type { FolderNode } from "@/features/sidebar/lib/folder-utils";
import type { Video, Folder } from "@/types";

interface FolderTreeProps {
  folders: FolderNode[];
  videos: Video[];
  allFolders: Folder[];
}

export const FolderTree = memo(function FolderTree({ folders, videos, allFolders }: FolderTreeProps) {
  if (folders.length === 0) {
    return (
      <div className="px-4 py-2 text-xs text-muted-foreground">
        No folders yet
      </div>
    );
  }

  return (
    <>
      {folders.map((folder) => (
        <FolderItem
          key={folder.id}
          folder={folder}
          level={0}
          videos={videos}
          allFolders={allFolders}
        />
      ))}
    </>
  );
});
