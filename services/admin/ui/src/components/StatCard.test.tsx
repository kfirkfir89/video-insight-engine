import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('should render label and value', () => {
    render(<StatCard label="Total Cost" value="$12.34" />);
    expect(screen.getByText('Total Cost')).toBeTruthy();
    expect(screen.getByText('$12.34')).toBeTruthy();
  });

  it('should accept numeric value', () => {
    render(<StatCard label="Calls" value={1234} />);
    expect(screen.getByText('1234')).toBeTruthy();
  });

  it('should render value in neutral text color (not tone-colored)', () => {
    const { container } = render(<StatCard label="Calls" value="42" tone="primary" />);
    const value = container.querySelector('[data-slot="statcard-value"]');
    expect(value?.className).toContain('text-[var(--color-text)]');
    expect(value?.className).toContain('font-semibold');
    expect(value?.className).toContain('tabular-nums');
  });

  it('should render hint when provided', () => {
    render(<StatCard label="Calls" value="42" hint="vs last 7d" />);
    expect(screen.getByText('vs last 7d')).toBeTruthy();
  });

  it('should render icon chip with tone soft background when tone is set and icon provided', () => {
    const { container } = render(
      <StatCard label="Calls" value="42" tone="success" icon={<span>i</span>} />,
    );
    const iconChip = container.querySelector('[data-slot="statcard-icon"]');
    expect(iconChip?.getAttribute('data-tone')).toBe('success');
    expect((iconChip as HTMLElement | null)?.style.background).toContain('success-soft');
  });

  it('should render md size (text-2xl) by default', () => {
    const { container } = render(<StatCard label="x" value="1" />);
    const value = container.querySelector('[data-slot="statcard-value"]');
    expect(value?.className).toContain('text-2xl');
    expect(value?.getAttribute('data-size')).toBe('md');
  });

  it('should render sm size (text-xl) when size=sm', () => {
    const { container } = render(<StatCard label="x" value="1" size="sm" />);
    const value = container.querySelector('[data-slot="statcard-value"]');
    expect(value?.className).toContain('text-xl');
    expect(value?.getAttribute('data-size')).toBe('sm');
  });

  it('should render trend up with success color', () => {
    const { container } = render(
      <StatCard label="x" value="1" trend={{ direction: 'up', label: '+5%' }} />,
    );
    const trend = container.querySelector('[data-slot="statcard-trend"]');
    expect(trend?.getAttribute('data-direction')).toBe('up');
    expect((trend as HTMLElement | null)?.style.color).toContain('success');
    expect(screen.getByText('+5%')).toBeTruthy();
  });

  it('should render trend down with danger color', () => {
    const { container } = render(
      <StatCard label="x" value="1" trend={{ direction: 'down', label: '-3%' }} />,
    );
    const trend = container.querySelector('[data-slot="statcard-trend"]');
    expect(trend?.getAttribute('data-direction')).toBe('down');
    expect((trend as HTMLElement | null)?.style.color).toContain('danger');
  });

  it('should render trend flat with muted color', () => {
    const { container } = render(
      <StatCard label="x" value="1" trend={{ direction: 'flat' }} />,
    );
    const trend = container.querySelector('[data-slot="statcard-trend"]');
    expect(trend?.getAttribute('data-direction')).toBe('flat');
    expect((trend as HTMLElement | null)?.style.color).toContain('text-muted');
  });

  it('should not render icon chip when no icon provided', () => {
    const { container } = render(<StatCard label="x" value="1" tone="primary" />);
    expect(container.querySelector('[data-slot="statcard-icon"]')).toBeNull();
  });

  it('should not render trend slot when no trend provided', () => {
    const { container } = render(<StatCard label="x" value="1" />);
    expect(container.querySelector('[data-slot="statcard-trend"]')).toBeNull();
  });
});
