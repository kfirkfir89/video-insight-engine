import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfoTip } from './InfoTip';

describe('InfoTip', () => {
  it('should export InfoTip component', () => {
    expect(typeof InfoTip).toBe('function');
  });

  it('should render button with default aria-label', () => {
    render(<InfoTip>hello</InfoTip>);
    const btn = screen.getByRole('button', { name: 'More info' });
    expect(btn).toBeTruthy();
  });

  it('should use custom label for aria-label', () => {
    render(<InfoTip label="Explain costs">hello</InfoTip>);
    expect(screen.getByRole('button', { name: 'Explain costs' })).toBeTruthy();
  });

  it('should render tooltip content', () => {
    render(<InfoTip>Sum over last 30 days</InfoTip>);
    expect(screen.getByText('Sum over last 30 days')).toBeTruthy();
  });

  it('should link tooltip to button via aria-describedby', () => {
    render(<InfoTip>details here</InfoTip>);
    const btn = screen.getByRole('button', { name: 'More info' });
    const describedBy = btn.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(tip.getAttribute('id')).toBe(describedBy);
  });
});
