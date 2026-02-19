import { memo, useState, useCallback } from 'react';
import { Check, FolderPlus, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Collection {
  id: string;
  name: string;
  color?: string;
}

interface CollectionPickerProps {
  collections: Collection[];
  selectedIds: string[];
  onSelect: (collectionId: string) => void;
  onDeselect: (collectionId: string) => void;
  onCreateNew?: () => void;
  className?: string;
}

/**
 * Dropdown picker for assigning items to collections.
 * Supports multi-select.
 */
export const CollectionPicker = memo(function CollectionPicker({
  collections,
  selectedIds,
  onSelect,
  onDeselect,
  onCreateNew,
  className,
}: CollectionPickerProps) {
  const [open, setOpen] = useState(false);

  const handleToggle = useCallback((collectionId: string) => {
    if (selectedIds.includes(collectionId)) {
      onDeselect(collectionId);
    } else {
      onSelect(collectionId);
    }
  }, [selectedIds, onSelect, onDeselect]);

  const selectedCount = selectedIds.length;
  const triggerLabel = selectedCount === 0
    ? 'Add to collection'
    : selectedCount === 1
      ? collections.find(c => c.id === selectedIds[0])?.name ?? '1 collection'
      : `${selectedCount} collections`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between', className)}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="max-h-[300px] overflow-y-auto">
          {collections.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No collections yet
            </div>
          ) : (
            <div className="p-1">
              {collections.map((collection) => {
                const isSelected = selectedIds.includes(collection.id);
                return (
                  <Button
                    key={collection.id}
                    variant="ghost"
                    size="bare"
                    onClick={() => handleToggle(collection.id)}
                    className={cn(
                      'w-full px-2 py-1.5 rounded-sm text-sm justify-start whitespace-normal',
                      'text-left',
                      isSelected && 'bg-primary/10'
                    )}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: collection.color || '#888' }}
                    />
                    <span className="flex-1 truncate">{collection.name}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                    )}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
        {onCreateNew && (
          <>
            <div className="border-t" />
            <div className="p-1">
              <Button
                variant="ghost"
                size="bare"
                onClick={() => {
                  setOpen(false);
                  onCreateNew();
                }}
                className="w-full px-2 py-1.5 rounded-sm text-sm justify-start text-primary"
              >
                <FolderPlus className="h-4 w-4" aria-hidden="true" />
                <span>Create new collection</span>
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
});
