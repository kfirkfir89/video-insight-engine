import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SummaryHeader } from '../SummaryHeader';

describe('SummaryHeader', () => {
  it('renders the summary text', () => {
    render(<SummaryHeader summary="Eight ordered steps." />);
    expect(screen.getByText('Eight ordered steps.')).toBeInTheDocument();
  });

  it('renders the optional title', () => {
    render(<SummaryHeader title="In short" summary="Quick recap." />);
    expect(screen.getByText('In short')).toBeInTheDocument();
  });

  it('renders nothing for empty summary', () => {
    const { container } = render(<SummaryHeader summary="" />);
    expect(container.innerHTML).toBe('');
  });
});
