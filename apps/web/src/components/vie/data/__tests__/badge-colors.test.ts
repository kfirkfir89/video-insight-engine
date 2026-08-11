import { describe, it, expect } from 'vitest';
import { detectBadgeVariant } from '../badge-colors';

describe('detectBadgeVariant', () => {
  it('should detect cost/price patterns as info', () => {
    expect(detectBadgeVariant('$25')).toBe('info');
    expect(detectBadgeVariant('¥1,000')).toBe('info');
    expect(detectBadgeVariant('€50')).toBe('info');
    expect(detectBadgeVariant('Free')).toBe('info');
    expect(detectBadgeVariant('Cost: $100')).toBe('info');
  });

  it('should detect duration patterns as warning', () => {
    expect(detectBadgeVariant('30 min')).toBe('warning');
    expect(detectBadgeVariant('2 hours')).toBe('warning');
    expect(detectBadgeVariant('5 sec')).toBe('warning');
    expect(detectBadgeVariant('3 days')).toBe('warning');
  });

  it('should detect difficulty patterns as default', () => {
    expect(detectBadgeVariant('Beginner')).toBe('default');
    expect(detectBadgeVariant('Intermediate')).toBe('default');
    expect(detectBadgeVariant('Advanced')).toBe('default');
    expect(detectBadgeVariant('Pro Level')).toBe('default');
  });

  it('should detect warning patterns as destructive', () => {
    expect(detectBadgeVariant('⚠ Tricky')).toBe('destructive');
    expect(detectBadgeVariant('Warning: hot oil')).toBe('destructive');
    expect(detectBadgeVariant('Careful!')).toBe('destructive');
  });

  it('should detect success patterns as success', () => {
    expect(detectBadgeVariant('✅ Verified')).toBe('success');
    expect(detectBadgeVariant('Complete')).toBe('success');
  });

  it('should detect rating patterns as warning', () => {
    expect(detectBadgeVariant('⭐ 4.5')).toBe('warning');
    expect(detectBadgeVariant('8.5/10')).toBe('warning');
    expect(detectBadgeVariant('Michelin Star')).toBe('warning');
  });

  it('should return muted for unrecognized text', () => {
    expect(detectBadgeVariant('Seafood')).toBe('muted');
    expect(detectBadgeVariant('Technique')).toBe('muted');
    expect(detectBadgeVariant('Japanese')).toBe('muted');
    expect(detectBadgeVariant('')).toBe('muted');
  });
});
