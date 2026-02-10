/**
 * Color Palette Component - Dev Only
 *
 * Displays all semantic colors with light/dark mode values.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('ColorPalette should not be imported in production');
}

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColorToken {
  name: string;
  cssVar: string;
  description: string;
}

interface ColorGroup {
  name: string;
  tokens: ColorToken[];
}

const colorGroups: ColorGroup[] = [
  {
    name: 'Base',
    tokens: [
      { name: 'background', cssVar: '--background', description: 'Page background' },
      { name: 'foreground', cssVar: '--foreground', description: 'Primary text color' },
      { name: 'card', cssVar: '--card', description: 'Card background' },
      { name: 'card-foreground', cssVar: '--card-foreground', description: 'Card text color' },
      { name: 'popover', cssVar: '--popover', description: 'Popover background' },
      { name: 'popover-foreground', cssVar: '--popover-foreground', description: 'Popover text' },
    ],
  },
  {
    name: 'Interactive',
    tokens: [
      { name: 'primary', cssVar: '--primary', description: 'Primary action color' },
      { name: 'primary-foreground', cssVar: '--primary-foreground', description: 'Primary text' },
      { name: 'secondary', cssVar: '--secondary', description: 'Secondary background' },
      { name: 'secondary-foreground', cssVar: '--secondary-foreground', description: 'Secondary text' },
      { name: 'accent', cssVar: '--accent', description: 'Accent background' },
      { name: 'accent-foreground', cssVar: '--accent-foreground', description: 'Accent text' },
    ],
  },
  {
    name: 'Semantic',
    tokens: [
      { name: 'muted', cssVar: '--muted', description: 'Muted background' },
      { name: 'muted-foreground', cssVar: '--muted-foreground', description: 'Muted text' },
      { name: 'destructive', cssVar: '--destructive', description: 'Destructive/error color' },
      { name: 'border', cssVar: '--border', description: 'Border color' },
      { name: 'input', cssVar: '--input', description: 'Input border' },
      { name: 'ring', cssVar: '--ring', description: 'Focus ring color' },
    ],
  },
  {
    name: 'Feedback',
    tokens: [
      { name: 'success', cssVar: '--success', description: 'Positive feedback' },
      { name: 'success-foreground', cssVar: '--success-foreground', description: 'Text on success' },
      { name: 'success-soft', cssVar: '--success-soft', description: 'Subtle success bg' },
      { name: 'warning', cssVar: '--warning', description: 'Caution feedback' },
      { name: 'warning-foreground', cssVar: '--warning-foreground', description: 'Text on warning' },
      { name: 'warning-soft', cssVar: '--warning-soft', description: 'Subtle warning bg' },
      { name: 'info', cssVar: '--info', description: 'Informational feedback' },
      { name: 'info-foreground', cssVar: '--info-foreground', description: 'Text on info' },
      { name: 'info-soft', cssVar: '--info-soft', description: 'Subtle info bg' },
      { name: 'destructive', cssVar: '--destructive', description: 'Error/destructive' },
      { name: 'destructive-foreground', cssVar: '--destructive-foreground', description: 'Text on destructive' },
    ],
  },
  {
    name: 'Status',
    tokens: [
      { name: 'status-pending', cssVar: '--status-pending', description: 'Pending state' },
      { name: 'status-processing', cssVar: '--status-processing', description: 'Processing state' },
      { name: 'status-success', cssVar: '--status-success', description: 'Success state' },
      { name: 'status-error', cssVar: '--status-error', description: 'Error state' },
    ],
  },
];

function ColorSwatch({ token }: { token: ColorToken }) {
  const [copied, setCopied] = useState(false);
  const [computedValue, setComputedValue] = useState('');

  const copyToClipboard = async () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(token.cssVar).trim();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMouseEnter = () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(token.cssVar).trim();
    setComputedValue(value);
  };

  return (
    <div className="group relative flex flex-col gap-2">
      <button
        onClick={copyToClipboard}
        onMouseEnter={handleMouseEnter}
        className={cn(
          'relative h-20 w-full rounded-xl border border-border/40 transition-all shadow-sm',
          'hover:ring-2 hover:ring-ring hover:ring-offset-2 hover:shadow-md hover:-translate-y-0.5'
        )}
        style={{ backgroundColor: `var(${token.cssVar})` }}
        aria-label={`Copy ${token.name} color value`}
      >
        <span
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center opacity-0 transition-opacity',
            'group-hover:opacity-100'
          )}
        >
          {copied ? (
            <Check className="h-5 w-5 text-status-success" />
          ) : (
            <>
              <Copy className="h-4 w-4 text-foreground" />
              {computedValue && (
                <span className="mt-1 text-[10px] font-mono text-foreground bg-background/80 px-1 rounded">
                  {computedValue}
                </span>
              )}
            </>
          )}
        </span>
      </button>
      <div>
        <p className="font-mono text-sm font-medium">{token.name}</p>
        <p className="text-xs text-muted-foreground">{token.description}</p>
      </div>
    </div>
  );
}

export function ColorPalette() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Color Palette</h2>
        <p className="text-muted-foreground">
          Semantic colors grouped by purpose. Click to copy the computed value.
        </p>
      </div>

      {colorGroups.map((group) => (
        <div key={group.name} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {group.name}
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {group.tokens.map((token) => (
              <ColorSwatch key={token.name} token={token} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
