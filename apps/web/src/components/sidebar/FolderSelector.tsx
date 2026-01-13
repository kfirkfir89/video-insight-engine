import { Folder, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { getFolderColorStyle } from "@/lib/style-utils";
import type { Folder as FolderType } from "@/types";

interface FolderSelectorProps {
  folders: FolderType[];
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  disabled?: boolean;
}

export function FolderSelector({
  folders,
  selectedFolderId,
  onSelect,
  disabled,
}: FolderSelectorProps) {
  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  // Sort folders by path to maintain hierarchy order (with fallback for empty paths)
  const sortedFolders = [...folders].sort((a, b) =>
    (a.path || a.name || "").localeCompare(b.path || b.name || "")
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between h-8 text-xs"
          disabled={disabled}
        >
          <span className="flex items-center gap-2 truncate">
            <Folder
              className="h-3.5 w-3.5 shrink-0"
              style={selectedFolder ? getFolderColorStyle(selectedFolder.color) : undefined}
            />
            {selectedFolder?.name || "No folder"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-60 overflow-y-auto">
        <DropdownMenuItem onClick={() => onSelect(null)}>
          <span className="text-muted-foreground">No folder</span>
        </DropdownMenuItem>
        {sortedFolders.length > 0 && <DropdownMenuSeparator />}
        {sortedFolders.map((folder) => (
          <DropdownMenuItem
            key={folder.id}
            onClick={() => onSelect(folder.id)}
            style={{ paddingLeft: `${8 + folder.level * 12}px` }}
          >
            <Folder
              className="h-4 w-4 shrink-0 mr-2"
              style={getFolderColorStyle(folder.color)}
            />
            <span className="truncate">{folder.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
