import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useUpdateFolder } from "@/hooks/use-folders";
import { useSidebarTextClasses } from "@/hooks/use-sidebar-text-size";
import { cn } from "@/lib/utils";

interface FolderRenameInputProps {
  folderId: string;
  currentName: string;
  onComplete: () => void;
}

/**
 * Inline input for renaming a folder.
 * Handles Enter to save, Escape to cancel, blur to save.
 */
export function FolderRenameInput({
  folderId,
  currentName,
  onComplete,
}: FolderRenameInputProps) {
  const [value, setValue] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateFolder = useUpdateFolder();
  const textClasses = useSidebarTextClasses();

  // Focus and select on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSave = async () => {
    const trimmedValue = value.trim();

    // If empty or unchanged, just cancel
    if (!trimmedValue || trimmedValue === currentName) {
      onComplete();
      return;
    }

    try {
      await updateFolder.mutateAsync({
        id: folderId,
        data: { name: trimmedValue },
      });
      onComplete();
    } catch {
      toast.error("Failed to rename folder");
      onComplete();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      onComplete();
    }
  };

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      className={cn("ml-2 h-5 py-0 px-1 flex-1", textClasses.mainText)}
      onClick={(e) => e.stopPropagation()}
      disabled={updateFolder.isPending}
    />
  );
}
