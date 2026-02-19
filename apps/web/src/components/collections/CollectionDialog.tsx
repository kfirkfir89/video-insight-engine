import { memo, useState, useCallback, useEffect } from 'react';
import { Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialValues?: {
    name: string;
    description?: string;
    color?: string;
  };
  onSave: (values: { name: string; description?: string; color?: string }) => void;
}

const PRESET_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#6B7280', // gray
];

/**
 * Dialog for creating or editing a collection.
 */
export const CollectionDialog = memo(function CollectionDialog({
  open,
  onOpenChange,
  mode,
  initialValues,
  onSave,
}: CollectionDialogProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [color, setColor] = useState(initialValues?.color ?? PRESET_COLORS[5]);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when dialog opens with new initialValues
  useEffect(() => {
    if (open) {
      setName(initialValues?.name ?? '');
      setDescription(initialValues?.description ?? '');
      setColor(initialValues?.color ?? PRESET_COLORS[5]);
    }
  }, [open, initialValues]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim() || undefined, color });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  }, [name, description, color, onSave, onOpenChange]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setName(initialValues?.name ?? '');
      setDescription(initialValues?.description ?? '');
      setColor(initialValues?.color ?? PRESET_COLORS[5]);
    }
    onOpenChange(newOpen);
  }, [initialValues, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" aria-hidden="true" />
            {mode === 'create' ? 'Create Collection' : 'Edit Collection'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a new collection to organize your memorized items.'
              : 'Update the collection details.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Collection"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="collection-description">Description (optional)</Label>
            <Textarea
              id="collection-description"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="What's this collection for?"
              className="min-h-[80px]"
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((presetColor) => (
                <Button
                  key={presetColor}
                  variant="ghost"
                  size="icon-bare"
                  onClick={() => setColor(presetColor)}
                  className={cn(
                    'w-6 h-6 rounded-full transition-transform',
                    color === presetColor && 'ring-2 ring-primary ring-offset-2 scale-110'
                  )}
                  style={{ backgroundColor: presetColor }}
                  aria-label={`Select color ${presetColor}`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
            {isSaving ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
