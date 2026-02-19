import { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useActiveSection } from "@/stores/ui-store";
import { useCreateFolder, useFolders } from "@/hooks/use-folders";

interface NewFolderPanelProps {
  onComplete: () => void;
}

export function NewFolderPanel({ onComplete }: NewFolderPanelProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const activeSection = useActiveSection();
  const createFolder = useCreateFolder();
  const { data: foldersData } = useFolders(activeSection);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isDuplicate = (checkName: string) => {
    const rootFolders = (foldersData?.folders ?? []).filter((f) => !f.parentId);
    return rootFolders.some(
      (f) => f.name.toLowerCase() === checkName.toLowerCase()
    );
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (isDuplicate(trimmed)) {
      toast.error("A folder with this name already exists");
      return;
    }

    try {
      await createFolder.mutateAsync({
        name: trimmed,
        type: activeSection,
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
    <div className="px-3 py-2 flex items-center gap-2">
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Folder name..."
        className="h-7 text-xs flex-1 bg-muted/20 border-border/50"
        onKeyDown={handleKeyDown}
        disabled={createFolder.isPending}
        maxLength={100}
      />
      <Button
        size="sm"
        className="h-7 px-3 text-xs"
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
