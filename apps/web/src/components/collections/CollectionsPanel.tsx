import { memo, useState } from 'react';
import { FolderOpen, Plus, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Collection {
  id: string;
  name: string;
  description?: string;
  color?: string;
  itemCount: number;
}

interface CollectionsPanelProps {
  collections: Collection[];
  selectedId?: string;
  onSelect?: (collection: Collection) => void;
  onCreate?: () => void;
  onEdit?: (collection: Collection) => void;
  onDelete?: (collection: Collection) => void;
  className?: string;
}

/**
 * Panel showing list of user collections.
 * Allows create, edit, delete actions.
 */
export const CollectionsPanel = memo(function CollectionsPanel({
  collections,
  selectedId,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  className,
}: CollectionsPanelProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Collections</h3>
        {onCreate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCreate}
            className="h-7 px-2"
          >
            <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
            New
          </Button>
        )}
      </div>

      {/* Collection List */}
      {collections.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-30" aria-hidden="true" />
          <p className="text-sm">No collections yet</p>
          <p className="text-xs mt-1">Create a collection to organize your memorized items.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {collections.map((collection) => (
            <div
              key={collection.id}
              onMouseEnter={() => setHoveredId(collection.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={cn(
                'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer',
                'transition-colors',
                selectedId === collection.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted'
              )}
              onClick={() => onSelect?.(collection)}
            >
              {/* Color indicator */}
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: collection.color || '#888' }}
              />

              {/* Name and count */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block">
                  {collection.name}
                </span>
                {collection.description && (
                  <span className="text-xs text-muted-foreground truncate block">
                    {collection.description}
                  </span>
                )}
              </div>

              {/* Item count */}
              <span className="text-xs text-muted-foreground shrink-0">
                {collection.itemCount}
              </span>

              {/* Actions (shown on hover) */}
              {(hoveredId === collection.id || selectedId === collection.id) && (
                <div className="flex items-center gap-0.5 shrink-0">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(collection);
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">Edit {collection.name}</span>
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(collection);
                      }}
                      className="h-6 w-6 p-0 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">Delete {collection.name}</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
