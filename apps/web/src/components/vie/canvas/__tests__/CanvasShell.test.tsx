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

  it('should accept bounded-pan + locked-node passthrough props without crashing', () => {
    // translateExtent / nodeExtent / nodesDraggable all flow through `...rest`
    // into ReactFlow — the concept canvas relies on this for static layout.
    const { container } = render(
      <VieCanvas
        nodes={[]}
        edges={[]}
        nodesDraggable={false}
        translateExtent={[
          [0, 0],
          [800, 600],
        ]}
      >
        <div data-testid="bounded-child">bounded</div>
      </VieCanvas>,
    );
    expect(screen.getByTestId('bounded-child')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="vie-canvas"]')).not.toBeNull();
  });

  it('should accept a custom edgeTypes registration (e.g. FloatingEdge)', () => {
    const FakeEdge = () => null;
    const { container } = render(
      <VieCanvas nodes={[]} edges={[]} edgeTypes={{ floating: FakeEdge }} />,
    );
    expect(container.querySelector('[data-slot="vie-canvas"]')).not.toBeNull();
  });
});
