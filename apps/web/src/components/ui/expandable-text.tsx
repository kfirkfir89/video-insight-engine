import { memo, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface ExpandableTextProps {
  /** Text content to display */
  text: string;
  /** Number of lines to show when collapsed */
  lineClamp?: number;
  /** Custom class name */
  className?: string;
  /** Expand button text */
  expandLabel?: string;
  /** Collapse button text */
  collapseLabel?: string;
  /** Initially expanded */
  defaultExpanded?: boolean;
}

/**
 * Text component that truncates with "show more/less" toggle.
 */
export const ExpandableText = memo(function ExpandableText({
  text,
  lineClamp = 3,
  className,
  expandLabel = 'Show more',
  collapseLabel = 'Show less',
  defaultExpanded = false,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // Check if text needs truncation (useLayoutEffect to measure before paint)
  useLayoutEffect(() => {
    if (textRef.current) {
      const element = textRef.current;
      // Compare scroll height vs client height to determine if truncated
      setNeedsTruncation(element.scrollHeight > element.clientHeight);
    }
  }, [text, lineClamp]);

  const toggle = useCallback(() => setExpanded((prev) => !prev), []);

  const lineClampClass = {
    1: 'line-clamp-1',
    2: 'line-clamp-2',
    3: 'line-clamp-3',
    4: 'line-clamp-4',
    5: 'line-clamp-5',
    6: 'line-clamp-6',
  }[lineClamp] ?? 'line-clamp-3';

  return (
    <div className={cn('space-y-1', className)}>
      <p
        ref={textRef}
        className={cn(
          'text-sm text-muted-foreground leading-relaxed transition-all duration-200',
          !expanded && lineClampClass
        )}
      >
        {text}
      </p>

      {needsTruncation && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggle}
          className="h-auto p-0 text-xs text-primary hover:text-primary/80 font-normal"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-0.5" aria-hidden="true" />
              {collapseLabel}
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-0.5" aria-hidden="true" />
              {expandLabel}
            </>
          )}
        </Button>
      )}
    </div>
  );
});
