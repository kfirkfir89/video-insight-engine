import { useState, useRef, useEffect } from "react";
import { Folder, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateFolder } from "@/hooks/use-folders";
import type { FolderType } from "@/types";
import type { FolderNode } from "@/lib/folder-utils";

interface CreateSubfolderInputProps {
  parentFolder: FolderNode;
  type: FolderType;
  paddingLeft: number;
  indentPerLevel: number;
  onComplete: () => void;
  onExpand: () => void;
}

/**
 * Inline input for creating a subfolder within a parent folder.
 * Checks for duplicate names at the same level.
 */
export function CreateSubfolderInput({
  parentFolder,
  type,
  paddingLeft,
  indentPerLevel,
  onComplete,
  onExpand,
}: CreateSubfolderInputProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const createFolder = useCreateFolder();

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Check for duplicate folder name at the same level
  const isDuplicateName = (checkName: string) => {
    return parentFolder.children.some(
      (child) => child.name.toLowerCase() === checkName.toLowerCase()
    );
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    // Check for duplicate at this level
    if (isDuplicateName(trimmedName)) {
      toast.error("A folder with this name already exists");
      return;
    }

    try {
      await createFolder.mutateAsync({
        name: trimmedName,
        type,
        parentId: parentFolder.id,
      });
      setName("");
      onComplete();
      onExpand();
    } catch {
      toast.error("Failed to create subfolder");
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
    <div
      className="flex items-center gap-2 py-1"
      style={{
        paddingLeft: `${paddingLeft + indentPerLevel}px`,
        paddingRight: "8px",
      }}
    >
      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Folder name..."
        className="h-6 text-sm flex-1"
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!name.trim() && !createFolder.isPending) {
            onComplete();
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
          handleCreate();
        }}
        disabled={!name.trim() || createFolder.isPending}
      >
        {createFolder.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          "Add"
        )}
      </Button>
    </div>
  );
}
