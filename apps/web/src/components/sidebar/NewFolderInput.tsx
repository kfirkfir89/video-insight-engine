import { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateFolder } from "@/hooks/use-folders";
import type { FolderType, Folder } from "@/types";

interface NewFolderInputProps {
  type: FolderType;
  existingFolders: Folder[];
  onComplete: () => void;
}

/**
 * Inline input for creating a new root-level folder in a section.
 * Checks for duplicate names at root level.
 */
export function NewFolderInput({
  type,
  existingFolders,
  onComplete,
}: NewFolderInputProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const createFolder = useCreateFolder();

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Check for duplicate folder name at root level
  const isDuplicateRootFolder = (checkName: string) => {
    const rootFolders = existingFolders.filter((f) => !f.parentId);
    return rootFolders.some(
      (f) => f.name.toLowerCase() === checkName.toLowerCase()
    );
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (isDuplicateRootFolder(trimmedName)) {
      toast.error("A folder with this name already exists");
      return;
    }

    try {
      await createFolder.mutateAsync({
        name: trimmedName,
        type,
        parentId: null,
      });
      setName("");
      onComplete();
    } catch {
      toast.error("Failed to create folder");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    }
    if (e.key === "Escape") {
      onComplete();
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Folder name..."
        className="h-7 text-sm flex-1"
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!name.trim() && !createFolder.isPending) {
            onComplete();
          }
        }}
        disabled={createFolder.isPending}
      />
      <Button
        size="sm"
        className="h-7 px-3"
        onClick={handleCreate}
        disabled={!name.trim() || createFolder.isPending}
      >
        {createFolder.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          "Create"
        )}
      </Button>
    </div>
  );
}
