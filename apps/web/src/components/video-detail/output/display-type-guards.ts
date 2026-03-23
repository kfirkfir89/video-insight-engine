import type {
  KeyPointItem,
  TipItem,
  ReviewSpec,
  NarrativeQuote,
  TechSetup,
  TechPattern,
  MusicSection,
  MusicCredit,
  TravelBudget,
} from '@vie/types';

// ── Shared predicate ──

function isArrayOfObjects(data: unknown): data is Array<Record<string, unknown>> {
  return Array.isArray(data) && data.length > 0
    && data.every(item => typeof item === 'object' && item != null && !Array.isArray(item));
}

// ── Type guards ──

/** Check first item for required keys (representative sample for LLM data). */
function hasKeys(data: Array<Record<string, unknown>>, ...keys: string[]): boolean {
  // Check first + last item to catch heterogeneous arrays
  const check = (item: Record<string, unknown>) => keys.every(k => k in item);
  return check(data[0]) && (data.length < 2 || check(data[data.length - 1]));
}

export function isKeyPoints(data: unknown): data is KeyPointItem[] {
  return isArrayOfObjects(data) && hasKeys(data, 'emoji', 'title', 'detail');
}

export function isAnalysisItems(data: unknown): data is Array<{ aspect: string; emoji?: string; detail: string }> {
  return isArrayOfObjects(data) && hasKeys(data, 'aspect', 'detail');
}

export function isMusicSections(data: unknown): data is MusicSection[] {
  return isArrayOfObjects(data)
    && hasKeys(data, 'name', 'description') && !('aspect' in data[0]) && !('role' in data[0]);
}

export function isMusicCredits(data: unknown): data is MusicCredit[] {
  return isArrayOfObjects(data)
    && hasKeys(data, 'role', 'name') && !('description' in data[0]) && !('title' in data[0]);
}

export function isLyrics(data: unknown): data is Array<{ line: string; timestamp?: number }> {
  return isArrayOfObjects(data) && hasKeys(data, 'line');
}

export function isTechPatterns(data: unknown): data is TechPattern[] {
  return isArrayOfObjects(data) && hasKeys(data, 'doExample', 'dontExample');
}

export function isTechSetup(data: unknown): data is TechSetup {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  return 'commands' in obj || 'dependencies' in obj || 'envVars' in obj;
}

export function isBudget(data: unknown): data is TravelBudget {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  return 'total' in obj && 'currency' in obj && 'breakdown' in obj;
}

export function isTips(data: unknown): data is TipItem[] {
  return isArrayOfObjects(data)
    && hasKeys(data, 'type', 'text') && !('emoji' in data[0]);
}

export function isSpecs(data: unknown): data is ReviewSpec[] {
  return isArrayOfObjects(data) && hasKeys(data, 'key', 'value');
}

export function isQuotes(data: unknown): data is NarrativeQuote[] {
  return isArrayOfObjects(data) && hasKeys(data, 'text', 'speaker');
}

export function isStringArray(data: unknown): data is string[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  // Check first and last to catch mixed-type arrays
  return typeof data[0] === 'string' && typeof data[data.length - 1] === 'string';
}

// ── Helpers ──

export function mapTipType(type: string): 'tip' | 'warning' | 'note' {
  if (type === 'warning' || type === 'safety') return 'warning';
  if (type === 'chef_tip' || type === 'tip') return 'tip';
  return 'note';
}

/** Convert camelCase/snake_case key to readable label */
export function formatLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format seconds to MM:SS */
export function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
