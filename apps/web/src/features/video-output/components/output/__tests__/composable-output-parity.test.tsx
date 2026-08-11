import { describe, it, expect } from 'vitest';
import { rawConfig, SECONDARY_COMPONENTS } from '@vie/shared/config';
import { REGISTERED_COMPONENT_NAMES } from '../ComposableOutput';

/**
 * Contract-parity test (interactive-overhaul-v2 1F + P2) — frontend half.
 *
 * Every component the backend can emit — both `primary` tabs (domains.json
 * `components`) and `secondary` attachments (componentTiers) — must have a
 * COMPONENT_REGISTRY renderer. A drift here means a freshly-planned tab or
 * attachment silently falls back to DisplaySection (or, for attachments, is
 * dropped). The Python half (`test_contract_parity.py`) guarantees the same
 * names are assemblable.
 */
describe('COMPONENT_REGISTRY ↔ domains.json parity', () => {
  // display_section is the documented last-resort renderer; it is intentionally
  // registered but is not a backend-selectable component.
  const FALLBACK_ONLY = new Set(['display_section']);
  const primary = rawConfig.components as string[];
  const secondary = SECONDARY_COMPONENTS as string[];
  const renderable = [...primary, ...secondary];

  it('every primary component has a registered renderer', () => {
    const missing = primary.filter((name) => !REGISTERED_COMPONENT_NAMES.has(name));
    expect(missing).toEqual([]);
  });

  it('every secondary component has a registered renderer', () => {
    const missing = secondary.filter((name) => !REGISTERED_COMPONENT_NAMES.has(name));
    expect(missing).toEqual([]);
  });

  it('no orphan renderers for unknown components', () => {
    const orphans = [...REGISTERED_COMPONENT_NAMES].filter(
      (name) => !renderable.includes(name) && !FALLBACK_ONLY.has(name),
    );
    expect(orphans).toEqual([]);
  });

  // P3 components must be wired both sides — explicit checks document the
  // contract beyond the data-driven assertions above.
  it('registers the P3 components: connect_canvas + comparison_radar alias + diagram_card', () => {
    expect(REGISTERED_COMPONENT_NAMES.has('connect_canvas')).toBe(true);
    expect(REGISTERED_COMPONENT_NAMES.has('comparison_radar')).toBe(true);
    expect(REGISTERED_COMPONENT_NAMES.has('diagram_card')).toBe(true);
  });

  it('lists connect_canvas as a primary component in domains.json', () => {
    expect(primary).toContain('connect_canvas');
  });
});
