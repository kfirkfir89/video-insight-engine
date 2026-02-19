import { memo, useState, useCallback } from 'react';
import { StickyNote, Check, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface UserNotesCardProps {
  notes: string;
  onSave?: (notes: string) => void;
  className?: string;
}

/**
 * Editable card for user notes on memorized items.
 */
export const UserNotesCard = memo(function UserNotesCard({
  notes,
  onSave,
  className,
}: UserNotesCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState(notes);
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = useCallback(() => {
    setEditedNotes(notes);
    setIsEditing(true);
  }, [notes]);

  const handleSave = useCallback(async () => {
    if (onSave) {
      setIsSaving(true);
      try {
        await onSave(editedNotes);
      } finally {
        setIsSaving(false);
      }
    }
    setIsEditing(false);
  }, [editedNotes, onSave]);

  const handleCancel = useCallback(() => {
    setEditedNotes(notes);
    setIsEditing(false);
  }, [notes]);

  return (
    <div
      className={cn(
        'p-3 rounded-lg border border-border/50 bg-muted/20',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
          <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Your Notes</span>
        </div>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="h-6 px-2 text-xs"
          >
            <Pencil className="h-3 w-3 mr-1" aria-hidden="true" />
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={editedNotes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditedNotes(e.target.value)}
            className="min-h-[100px] text-sm"
            placeholder="Add your notes here..."
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                'Saving...'
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" aria-hidden="true" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <p className={cn(
          'text-sm leading-relaxed whitespace-pre-wrap',
          !notes && 'text-muted-foreground/70 italic'
        )}>
          {notes || 'No notes yet. Click Edit to add some.'}
        </p>
      )}
    </div>
  );
});
