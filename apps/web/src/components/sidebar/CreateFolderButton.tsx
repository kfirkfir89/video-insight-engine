import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreateFolder } from "@/hooks/use-folders";
import { useUIStore } from "@/stores/ui-store";
import type { FolderType } from "@/types";
import { cn } from "@/lib/utils";

interface CreateFolderButtonProps {
  type: FolderType;
  className?: string;
}

export function CreateFolderButton({ type, className }: CreateFolderButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const createFolder = useCreateFolder();
  const selectedFolderId = useUIStore((s) => s.selectedFolderId);

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      await createFolder.mutateAsync({
        name: name.trim(),
        type,
        parentId: selectedFolderId,
      });
      setName("");
      setOpen(false);
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-6 w-6 hover:bg-accent transition-colors", className)}
          onClick={(e) => e.stopPropagation()}
        >
          <Plus className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="p-2 w-48">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Folder name..."
          className="text-sm h-8"
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <Button
          size="sm"
          className="w-full mt-2 h-8"
          onClick={handleCreate}
          disabled={!name.trim() || createFolder.isPending}
        >
          {createFolder.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : null}
          Create Folder
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
