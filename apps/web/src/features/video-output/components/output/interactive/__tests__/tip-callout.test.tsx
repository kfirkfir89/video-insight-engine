import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TipCallout } from '../TipCallout';

describe('TipCallout', () => {
  it('renders the tip text', () => {
    render(<TipCallout text="Whisk while cold." />);
    expect(screen.getByText(/whisk while cold/i)).toBeInTheDocument();
  });

  it('prefixes the title inline when provided', () => {
    render(<TipCallout title="Heads up" text="Unplug first." />);
    expect(screen.getByText('Heads up: Unplug first.')).toBeInTheDocument();
  });

  it('renders as an accessible note', () => {
    render(<TipCallout style="warning" text="Careful." />);
    expect(screen.getByRole('note')).toBeInTheDocument();
  });

  it('renders nothing for empty text', () => {
    const { container } = render(<TipCallout text="  " />);
    expect(container.innerHTML).toBe('');
  });
});
