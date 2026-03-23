import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';


import { VerdictInteractive } from '../VerdictInteractive';

describe('VerdictInteractive', () => {
  it('should render product name and bottom line', () => {
    render(<VerdictInteractive product="iPhone 15" bottomLine="Great upgrade for most users." />);
    expect(screen.getByText('iPhone 15')).toBeInTheDocument();
    expect(screen.getByText('Great upgrade for most users.')).toBeInTheDocument();
  });

  it('should show badge with variant', () => {
    render(<VerdictInteractive product="Test" bottomLine="Good" badge="recommended" />);
    expect(screen.getByText('recommended')).toBeInTheDocument();
  });

  it('should show score ring when score provided', async () => {
    render(<VerdictInteractive product="Test" bottomLine="Good" score={8} maxScore={10} />);
    // Score animates from 0 to 8 — wait for any score label to appear
    const scoreRing = await screen.findByText('Score');
    expect(scoreRing).toBeInTheDocument();
  });

  it('should show best for and not for lists', () => {
    render(
      <VerdictInteractive
        product="Test"
        bottomLine="Good"
        bestFor={['Power users', 'Photographers']}
        notFor={['Budget shoppers']}
      />,
    );
    expect(screen.getByText('Best For')).toBeInTheDocument();
    expect(screen.getByText('Power users')).toBeInTheDocument();
    expect(screen.getByText('Not For')).toBeInTheDocument();
    expect(screen.getByText('Budget shoppers')).toBeInTheDocument();
  });

  it('should show price stat pill', () => {
    render(<VerdictInteractive product="Test" bottomLine="Good" price="$999" />);
    expect(screen.getByText('$999')).toBeInTheDocument();
  });

  it('should not render stray number in DOM when bestFor is empty and notFor has items', () => {
    const { container } = render(
      <VerdictInteractive product="Test" bottomLine="Good" bestFor={[]} notFor={['Budget shoppers']} />,
    );
    // The grid with not-for should render
    expect(screen.getByText('Budget shoppers')).toBeInTheDocument();
    // Should NOT render a bare number like "1" from (0 || 1) && (...) pattern
    // Look for stray text nodes that are just digits at the root level
    const rootChildren = container.firstChild?.childNodes;
    if (rootChildren) {
      for (const child of Array.from(rootChildren)) {
        if (child.nodeType === 3 && /^\d+$/.test(child.textContent ?? '')) {
          throw new Error(`Stray number "${child.textContent}" rendered in DOM from falsy length check`);
        }
      }
    }
  });
});
