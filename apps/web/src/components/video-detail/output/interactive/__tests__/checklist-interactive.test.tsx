import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../Celebration', () => ({
  Celebration: ({ title }: { title: string }) => <div data-testid="celebration">{title}</div>,
}));

import { ChecklistInteractive } from '../ChecklistInteractive';

const items = [
  { label: 'Flour', amount: 2, unit: 'cups' },
  { label: 'Sugar', amount: 1, unit: 'cup', essential: true },
  { label: 'Salt' },
];

describe('ChecklistInteractive', () => {
  it('should render all items', () => {
    render(<ChecklistInteractive items={items} tabLabel="Ingredients" />);
    expect(screen.getByText('Ingredients')).toBeInTheDocument();
    expect(screen.getByText('Flour')).toBeInTheDocument();
    expect(screen.getByText('Sugar')).toBeInTheDocument();
    expect(screen.getByText('Salt')).toBeInTheDocument();
  });

  it('should return null for empty items', () => {
    const { container } = render(<ChecklistInteractive items={[]} tabLabel="Empty" />);
    expect(container.innerHTML).toBe('');
  });

  it('should toggle item checked state on click', () => {
    render(<ChecklistInteractive items={items} tabLabel="Items" />);
    const firstItem = screen.getByText('Flour').closest('button')!;
    expect(firstItem).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(firstItem);
    expect(firstItem).toHaveAttribute('aria-pressed', 'true');
  });

  it('should show progress percentage', () => {
    render(<ChecklistInteractive items={items} tabLabel="Items" />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Flour').closest('button')!);
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('should show essential badge for essential items', () => {
    render(<ChecklistInteractive items={items} tabLabel="Items" />);
    expect(screen.getByText('essential')).toBeInTheDocument();
  });

  it('should show celebration when all items checked', () => {
    render(<ChecklistInteractive items={[{ label: 'Only item' }]} tabLabel="Items" />);
    fireEvent.click(screen.getByText('Only item').closest('button')!);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
  });

  it('should show servings scaler when scalable', () => {
    render(<ChecklistInteractive items={items} tabLabel="Items" scalable baseServings={4} />);
    expect(screen.getByText('4 servings')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Increase servings'));
    expect(screen.getByText('5 servings')).toBeInTheDocument();
  });

  it('should not decrease servings below 1', () => {
    render(<ChecklistInteractive items={items} tabLabel="Items" scalable baseServings={1} />);
    expect(screen.getByLabelText('Decrease servings')).toBeDisabled();
  });

  it('should render group headers when groups provided', () => {
    const grouped = [
      { label: 'Flour', group: 'Dry' },
      { label: 'Milk', group: 'Wet' },
    ];
    render(<ChecklistInteractive items={grouped} tabLabel="Items" groups={['Dry', 'Wet']} />);
    expect(screen.getByText('Dry')).toBeInTheDocument();
    expect(screen.getByText('Wet')).toBeInTheDocument();
  });
});
