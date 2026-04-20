import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SkeletonPanel } from './SkeletonPanel';

describe('SkeletonPanel', () => {
  it('should render a single skeleton by default', () => {
    const { container } = render(<SkeletonPanel />);
    const tiles = container.querySelectorAll('[data-slot="skeleton-panel"]');
    expect(tiles.length).toBe(1);
  });

  it('should render N tiles when count > 1', () => {
    const { container } = render(<SkeletonPanel count={4} />);
    const tiles = container.querySelectorAll('[data-slot="skeleton-panel"]');
    expect(tiles.length).toBe(4);
  });

  it('should wrap multiple tiles in a flex column with gap-3', () => {
    const { container } = render(<SkeletonPanel count={3} />);
    const group = container.querySelector('[data-slot="skeleton-panel-group"]');
    expect(group).not.toBeNull();
    expect(group?.className).toContain('flex flex-col');
    expect(group?.className).toContain('gap-3');
  });

  it('should not wrap a single tile in a group', () => {
    const { container } = render(<SkeletonPanel count={1} />);
    expect(container.querySelector('[data-slot="skeleton-panel-group"]')).toBeNull();
  });

  it('should apply md size (h-24) by default', () => {
    const { container } = render(<SkeletonPanel />);
    const tile = container.querySelector('[data-slot="skeleton-panel"]');
    expect(tile?.className).toContain('h-24');
    expect(tile?.getAttribute('data-size')).toBe('md');
  });

  it('should apply sm size (h-16)', () => {
    const { container } = render(<SkeletonPanel size="sm" />);
    const tile = container.querySelector('[data-slot="skeleton-panel"]');
    expect(tile?.className).toContain('h-16');
  });

  it('should apply lg size (h-32)', () => {
    const { container } = render(<SkeletonPanel size="lg" />);
    const tile = container.querySelector('[data-slot="skeleton-panel"]');
    expect(tile?.className).toContain('h-32');
  });

  it('should apply xl size (h-48)', () => {
    const { container } = render(<SkeletonPanel size="xl" />);
    const tile = container.querySelector('[data-slot="skeleton-panel"]');
    expect(tile?.className).toContain('h-48');
  });

  it('should include animate-pulse on tiles', () => {
    const { container } = render(<SkeletonPanel count={2} />);
    const tile = container.querySelector('[data-slot="skeleton-panel"]');
    expect(tile?.className).toContain('animate-pulse');
  });

  it('should merge custom className onto tile', () => {
    const { container } = render(<SkeletonPanel className="custom" />);
    const tile = container.querySelector('[data-slot="skeleton-panel"]');
    expect(tile?.className).toContain('custom');
  });
});
