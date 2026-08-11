import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SortableHeader } from './SortableHeader';

describe('SortableHeader', () => {
  it('should render children label', () => {
    render(
      <SortableHeader sortKey="cost" currentKey={null} direction="desc" onToggle={() => {}}>
        Cost
      </SortableHeader>,
    );
    expect(screen.getByText('Cost')).toBeTruthy();
  });

  it('should call onToggle with sortKey when clicked', () => {
    const onToggle = vi.fn();
    render(
      <SortableHeader sortKey="cost" currentKey="cost" direction="desc" onToggle={onToggle}>
        Cost
      </SortableHeader>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith('cost');
  });

  it('should expose aria-sort=none when inactive', () => {
    render(
      <SortableHeader sortKey="cost" currentKey="duration" direction="desc" onToggle={() => {}}>
        Cost
      </SortableHeader>,
    );
    expect(screen.getByRole('button').getAttribute('aria-sort')).toBe('none');
  });

  it('should expose aria-sort=descending when active desc', () => {
    render(
      <SortableHeader sortKey="cost" currentKey="cost" direction="desc" onToggle={() => {}}>
        Cost
      </SortableHeader>,
    );
    expect(screen.getByRole('button').getAttribute('aria-sort')).toBe('descending');
  });

  it('should expose aria-sort=ascending when active asc', () => {
    render(
      <SortableHeader sortKey="cost" currentKey="cost" direction="asc" onToggle={() => {}}>
        Cost
      </SortableHeader>,
    );
    expect(screen.getByRole('button').getAttribute('aria-sort')).toBe('ascending');
  });
});
