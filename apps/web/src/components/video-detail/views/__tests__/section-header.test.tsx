import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionHeader } from '../SectionHeader';
import { Clock } from 'lucide-react';

describe('SectionHeader', () => {
  it('should render label text', () => {
    render(<SectionHeader icon={Clock} label="Timestamps" />);

    expect(screen.getByText('Timestamps')).toBeInTheDocument();
  });

  it('should render icon with aria-hidden', () => {
    const { container } = render(<SectionHeader icon={Clock} label="Timestamps" />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('should accept className', () => {
    const { container } = render(
      <SectionHeader icon={Clock} label="Timestamps" className="mt-4" />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('mt-4');
  });

  it('should apply uppercase tracking-wider styling', () => {
    const { container } = render(<SectionHeader icon={Clock} label="Timestamps" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('uppercase');
    expect(wrapper.className).toContain('tracking-wider');
  });
});
