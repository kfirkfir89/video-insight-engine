import { FolderItem } from "./FolderItem";
import type { FolderNode } from "@/lib/folder-utils";
import type { FolderType, Video, Folder } from "@/types";

interface FolderTreeProps {
  folders: FolderNode[];
  type: FolderType;
  videos: Video[];
  allFolders: Folder[];
}

export function FolderTree({ folders, type, videos, allFolders }: FolderTreeProps) {
  if (folders.length === 0) {
    return (
      <div className="px-4 py-2 text-xs text-muted-foreground">
        No folders yet
      </div>
    );
  }

  return (
    <div className="py-1">
      {folders.map((folder) => (
        <FolderItem
          key={folder.id}
          folder={folder}
          type={type}
          level={0}
          videos={videos}
          allFolders={allFolders}
        />
      ))}
    </div>
  );
}
