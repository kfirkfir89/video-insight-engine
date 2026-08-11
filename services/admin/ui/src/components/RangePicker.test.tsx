import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RangePicker } from './RangePicker';

describe('RangePicker', () => {
  it('should render default options as Nd labels', () => {
    render(<RangePicker value={30} onChange={() => {}} />);
    expect(screen.getByText('7d')).toBeTruthy();
    expect(screen.getByText('30d')).toBeTruthy();
    expect(screen.getByText('90d')).toBeTruthy();
  });

  it('should mark the active option as aria-pressed', () => {
    render(<RangePicker value={30} onChange={() => {}} />);
    const active = screen.getByText('30d');
    expect(active.getAttribute('aria-pressed')).toBe('true');
    const inactive = screen.getByText('7d');
    expect(inactive.getAttribute('aria-pressed')).toBe('false');
  });

  it('should call onChange with the clicked option', () => {
    const onChange = vi.fn();
    render(<RangePicker value={30} onChange={onChange} />);
    fireEvent.click(screen.getByText('7d'));
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('should render custom options', () => {
    render(<RangePicker value={14} onChange={() => {}} options={[1, 14, 60]} />);
    expect(screen.getByText('1d')).toBeTruthy();
    expect(screen.getByText('14d')).toBeTruthy();
    expect(screen.getByText('60d')).toBeTruthy();
  });

  it('should expose role="group" with a date-range label', () => {
    render(<RangePicker value={30} onChange={() => {}} />);
    const group = screen.getByRole('group', { name: /date range/i });
    expect(group).toBeTruthy();
  });
});
