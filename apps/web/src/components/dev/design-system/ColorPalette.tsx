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

const semanticColors: ColorToken[] = [
  { name: 'background', cssVar: '--background', description: 'Page background' },
  { name: 'foreground', cssVar: '--foreground', description: 'Primary text color' },
  { name: 'card', cssVar: '--card', description: 'Card background' },
  { name: 'card-foreground', cssVar: '--card-foreground', description: 'Card text color' },
  { name: 'popover', cssVar: '--popover', description: 'Popover background' },
  { name: 'popover-foreground', cssVar: '--popover-foreground', description: 'Popover text' },
  { name: 'primary', cssVar: '--primary', description: 'Primary action color' },
  { name: 'primary-foreground', cssVar: '--primary-foreground', description: 'Primary text' },
  { name: 'secondary', cssVar: '--secondary', description: 'Secondary background' },
  { name: 'secondary-foreground', cssVar: '--secondary-foreground', description: 'Secondary text' },
  { name: 'muted', cssVar: '--muted', description: 'Muted background' },
  { name: 'muted-foreground', cssVar: '--muted-foreground', description: 'Muted text' },
  { name: 'accent', cssVar: '--accent', description: 'Accent background' },
  { name: 'accent-foreground', cssVar: '--accent-foreground', description: 'Accent text' },
  { name: 'destructive', cssVar: '--destructive', description: 'Destructive/error color' },
  { name: 'border', cssVar: '--border', description: 'Border color' },
  { name: 'input', cssVar: '--input', description: 'Input border' },
  { name: 'ring', cssVar: '--ring', description: 'Focus ring color' },
];

function ColorSwatch({ token }: { token: ColorToken }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(token.cssVar).trim();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative flex flex-col gap-2">
      <button
        onClick={copyToClipboard}
        className={cn(
          'relative h-20 w-full rounded-lg border transition-all',
          'hover:ring-2 hover:ring-ring hover:ring-offset-2'
        )}
        style={{ backgroundColor: `var(${token.cssVar})` }}
        aria-label={`Copy ${token.name} color value`}
      >
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center opacity-0 transition-opacity',
            'group-hover:opacity-100'
          )}
        >
          {copied ? (
            <Check className="h-5 w-5 text-status-success" />
          ) : (
            <Copy className="h-5 w-5 text-foreground" />
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Color Palette</h2>
        <p className="text-muted-foreground">
          Semantic colors used throughout the application. Click to copy the computed value.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {semanticColors.map((token) => (
          <ColorSwatch key={token.name} token={token} />
        ))}
      </div>
    </div>
  );
}
