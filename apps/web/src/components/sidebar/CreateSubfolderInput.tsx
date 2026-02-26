import { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateFolder } from "@/hooks/use-folders";
import { cn } from "@/lib/utils";
import type { FolderType } from "@/types";
import type { FolderNode } from "@/lib/folder-utils";

interface CreateSubfolderInputProps {
  parentFolder: FolderNode;
  type: FolderType;
  paddingLeft: number;
  indentPerLevel: number;
  open: boolean;
  onComplete: () => void;
  onExpand: () => void;
}

/**
 * Collapsible subfolder creation input.
 * Matches the toolbar panel design with smooth open/close animation.
 */
export function CreateSubfolderInput({
  parentFolder,
  type,
  paddingLeft,
  indentPerLevel,
  open,
  onComplete,
  onExpand,
}: CreateSubfolderInputProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const createFolder = useCreateFolder();

  // Focus when panel opens, reset name on close via cleanup
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(id);
      setName("");
    };
  }, [open]);

  const isDuplicateName = (checkName: string) => {
    return parentFolder.children.some(
      (child) => child.name.toLowerCase() === checkName.toLowerCase()
    );
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (isDuplicateName(trimmed)) {
      toast.error("A folder with this name already exists");
      return;
    }

    try {
      await createFolder.mutateAsync({
        name: trimmed,
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
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
    >
      <div className="overflow-hidden">
        <div
          className="flex items-center gap-2 py-1.5"
          style={{
            paddingLeft: `${paddingLeft + indentPerLevel}px`,
            paddingRight: "8px",
          }}
        >
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name..."
            className="h-7 text-xs flex-1 bg-muted/20 border-border/50"
            onKeyDown={handleKeyDown}
            disabled={createFolder.isPending}
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              handleCreate();
            }}
            disabled={!name.trim() || createFolder.isPending}
          >
            {createFolder.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Create"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
