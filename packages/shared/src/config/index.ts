/**
 * @vie/shared/config — Single source of truth for domain configuration.
 *
 * Both TypeScript and Python consumers read from domains.json.
 * TypeScript imports this module; Python reads the JSON directly.
 */

import domainsJson from './domains.json' with { type: 'json' };

// ─────────────────────────────────────────────────────
// Canonical union types (update here when adding domains)
// ─────────────────────────────────────────────────────

/** Primary content domain tag — one per domain in domains.json. */
export type ContentTag =
  | 'learning'
  | 'tech'
  | 'fitness'
  | 'food'
  | 'music'
  | 'travel'
  | 'review'
  | 'project'
  | 'language'
  | 'science'
  | 'podcast'
  | 'news'
  | 'gaming'
  | 'sport';

/** Modifier tag — cross-domain enrichment layer. */
export type Modifier = 'narrative' | 'finance';

// ─────────────────────────────────────────────────────
// Raw JSON shape
// ─────────────────────────────────────────────────────

interface TabMeta {
  label: string;
  emoji: string;
}

interface DefaultTab {
  id: string;
  component: string;
  dataSource: string;
  label: string;
  emoji: string;
}

interface DomainEntry {
  emoji: string;
  label: string;
  gradient: string;
  defaultTabs: DefaultTab[];
}

interface ModifierEntry {
  emoji: string;
  label: string;
}

/** Component hierarchy tier. `primary` = planner-selectable standalone tab;
 *  `secondary` = attachment-only (never standalone); `display` = last-resort
 *  fallback renderer. */
export type ComponentTier = 'primary' | 'secondary' | 'display';

interface DomainsConfig {
  components: string[];
  /** Optional so the `?? {}` read below stays meaningful for older/partial
   *  configs that predate the tier map (mirrors the Python `.get(...)`). */
  componentTiers?: Record<string, ComponentTier>;
  domains: Record<ContentTag, DomainEntry>;
  modifiers: Record<Modifier, ModifierEntry>;
  enrichment: Record<string, string>;
  categoryMap: Record<string, string>;
}

const config: DomainsConfig = domainsJson as DomainsConfig;

// ─────────────────────────────────────────────────────
// Derived constants
// ─────────────────────────────────────────────────────

/** All valid content tag names, derived from JSON keys. */
export const CONTENT_TAG_VALUES: readonly ContentTag[] = Object.keys(config.domains) as ContentTag[];

/** All valid modifier names, derived from JSON keys. */
export const MODIFIER_VALUES: readonly Modifier[] = Object.keys(config.modifiers) as Modifier[];

/** Component name → tier (primary | secondary | display). */
export const COMPONENT_TIERS: Readonly<Record<string, ComponentTier>> = config.componentTiers ?? {};

/** Secondary-tier (attachment-only) component names. */
export const SECONDARY_COMPONENTS: readonly string[] = Object.entries(COMPONENT_TIERS)
  .filter(([, tier]) => tier === 'secondary')
  .map(([name]) => name);

/** Get a component's tier, defaulting to `primary` for unmapped names. */
export function componentTier(name: string): ComponentTier {
  return COMPONENT_TIERS[name] ?? 'primary';
}

// ─────────────────────────────────────────────────────
// Accessors
// ─────────────────────────────────────────────────────

export interface DomainConfig {
  emoji: string;
  label: string;
  gradient: string;
}

/** Get emoji, label, gradient for a domain. */
export function getDomainConfig(tag: ContentTag): DomainConfig {
  const d = config.domains[tag];
  return { emoji: d.emoji, label: d.label, gradient: d.gradient };
}

/** Get the full tab metadata map for a domain (derived from defaultTabs array). */
export function getDomainTabs(tag: ContentTag): Record<string, TabMeta> {
  const domain = config.domains[tag];
  const map: Record<string, TabMeta> = {};
  for (const tab of domain.defaultTabs) {
    map[tab.id] = { label: tab.label, emoji: tab.emoji };
  }
  return map;
}

/** Get the ordered default tab IDs for a domain. */
export function getDefaultTabIds(tag: ContentTag): string[] {
  return config.domains[tag].defaultTabs.map((t) => t.id);
}

/** Get all allowed tab IDs for a domain. Alias for getDefaultTabIds. */
export const getAllowedTabIds = getDefaultTabIds;

/** Get tab metadata (label + emoji) by tab ID across all domains. */
export function getTabMeta(tabId: string): TabMeta | undefined {
  for (const domain of Object.values(config.domains)) {
    const tab = domain.defaultTabs.find((t) => t.id === tabId);
    if (tab) return { label: tab.label, emoji: tab.emoji };
  }
  return undefined;
}

const DEFAULT_TAG: ContentTag = 'learning';

/** Map of content tag → enrichment prompt filename (tags not listed = no enrichment). */
export function getEnrichmentMap(): Record<string, string> {
  return config.enrichment ?? {};
}

/** Category hint → content tag mapping. Falls back to 'learning'. */
export function mapCategoryToTag(category: string, fallback: ContentTag = DEFAULT_TAG): ContentTag {
  const mapped = config.categoryMap[category.toLowerCase()];
  return (mapped ?? fallback) as ContentTag;
}

/** Build fallback tabs (TabDefinition-shaped) for a domain. */
export function buildFallbackTabs(tag: ContentTag): { id: string; label: string; emoji: string; dataSource: string }[] {
  const domain = config.domains[tag] ?? config.domains.learning;
  return domain.defaultTabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    emoji: tab.emoji,
    dataSource: tab.dataSource,
  }));
}

/** Get gradient for a domain tag. */
export function getDomainGradient(tag: ContentTag): string {
  return config.domains[tag]?.gradient ?? config.domains.learning.gradient;
}

/** Full raw config (escape hatch). */
export { config as rawConfig };
export type { TabMeta, DefaultTab, DomainEntry, ModifierEntry, DomainsConfig };
