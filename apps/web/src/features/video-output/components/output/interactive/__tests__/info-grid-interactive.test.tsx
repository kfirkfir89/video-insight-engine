import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';


import { InfoGridInteractive } from '../InfoGridInteractive';

const items = [
  { key: 'Director', value: 'Christopher Nolan' },
  { key: 'Year', value: '2023' },
  { key: 'Genre', value: 'Sci-Fi' },
];

describe('InfoGridInteractive', () => {
  it('should render key-value mode by default', () => {
    render(<InfoGridInteractive items={items} />);
    expect(screen.getByText('Director')).toBeInTheDocument();
    expect(screen.getByText('Christopher Nolan')).toBeInTheDocument();
  });

  it('should return null for empty items', () => {
    const { container } = render(<InfoGridInteractive items={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render table mode', () => {
    render(<InfoGridInteractive items={items} mode="table" />);
    expect(screen.getByText('Key')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Director')).toBeInTheDocument();
  });

  it('should render tag cloud mode', () => {
    render(<InfoGridInteractive items={items} mode="tag_cloud" />);
    expect(screen.getByText('Director: Christopher Nolan')).toBeInTheDocument();
    expect(screen.getByText('Year: 2023')).toBeInTheDocument();
  });

  // ─── Audited-bug regression tests ─────────────────────────────
  // These cover the failure modes the field audit surfaced — empty cards
  // for items missing a key, walls of text from long values, and the new
  // evidence field that handles term + definition + example shapes without
  // exploding the primary value into a paragraph.

  it('drops items missing a key without rendering an empty card', () => {
    // Items without a key would render as empty rectangles in the audited
    // builds (Stocks "8 Key Signals", Transformers "14 Core Concepts").
    // The normalizer now drops them silently. Assert by the rendered text
    // so the test doesn't break when GlassCard's class names change.
    render(
      <InfoGridInteractive
        items={[
          { key: 'Real concept', value: 'Has substance' },
          { key: '', value: 'orphan value' },
          { key: '   ', value: 'whitespace key' },
        ]}
      />,
    );
    expect(screen.getByText('Real concept')).toBeInTheDocument();
    expect(screen.queryByText('orphan value')).not.toBeInTheDocument();
    expect(screen.queryByText('whitespace key')).not.toBeInTheDocument();
  });

  it('renders evidence below the value when provided', () => {
    render(
      <InfoGridInteractive
        items={[
          {
            key: 'Tokenization',
            value: 'Splitting text into discrete units',
            evidence: "'Hello world' → ['Hello', 'world']",
          },
        ]}
      />,
    );
    expect(screen.getByText('Tokenization')).toBeInTheDocument();
    expect(screen.getByText('Splitting text into discrete units')).toBeInTheDocument();
    expect(screen.getByText("'Hello world' → ['Hello', 'world']")).toBeInTheDocument();
  });

  it('renders an emoji prefix on the key when provided', () => {
    render(
      <InfoGridInteractive
        items={[{ key: 'Speed', value: 'Fast', emoji: '⚡' }]}
      />,
    );
    expect(screen.getByText('Speed')).toBeInTheDocument();
    expect(screen.getByText('⚡')).toBeInTheDocument();
  });

  it('widens grid columns for long values to avoid wall-of-text', () => {
    // A 130-char value should bump the grid to the wider track so the cell
    // doesn't squeeze into 5+ wrapped lines on mobile.
    const longValue = 'Lorem ipsum dolor sit amet '.repeat(6);
    const { container } = render(
      <InfoGridInteractive items={[{ key: 'Long', value: longValue }]} />,
    );
    const grid = container.querySelector('div[style*="grid-template-columns"]') as HTMLElement | null;
    expect(grid).not.toBeNull();
    expect(grid?.style.gridTemplateColumns).toContain('280px');
  });
});
