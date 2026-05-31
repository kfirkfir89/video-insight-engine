import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { VieCanvas } from '../CanvasShell';

describe('VieCanvas', () => {
  it('should render provided children inside the ReactFlow wrapper', () => {
    render(
      <VieCanvas nodes={[]} edges={[]}>
        <div data-testid="canvas-child">hello</div>
      </VieCanvas>,
    );
    const child = screen.getByTestId('canvas-child');
    expect(child).toBeInTheDocument();
    expect(child.closest('[data-slot="vie-canvas"]')).not.toBeNull();
  });

  it('should not render the minimap by default', () => {
    const { container } = render(<VieCanvas nodes={[]} edges={[]} />);
    expect(container.querySelector('.react-flow__minimap')).toBeNull();
  });

  it('should render the controls panel by default', () => {
    const { container } = render(<VieCanvas nodes={[]} edges={[]} />);
    expect(container.querySelector('.react-flow__controls')).not.toBeNull();
  });
});
