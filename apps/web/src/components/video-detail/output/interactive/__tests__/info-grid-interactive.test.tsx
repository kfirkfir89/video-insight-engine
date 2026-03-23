import { describe, it, expect, vi } from 'vitest';
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
});
