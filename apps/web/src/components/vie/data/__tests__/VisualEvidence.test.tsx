import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VisualEvidence } from '../VisualEvidence';

describe('VisualEvidence', () => {
  it('returns null when no thumbnail, caption, or OCR is provided', () => {
    const { container } = render(<VisualEvidence sceneType="slide" evidence="just rationale" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders just a thumbnail when no caption or OCR is provided', () => {
    render(<VisualEvidence thumbnailUrl="https://cdn.example.com/f1.jpg" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/f1.jpg');
  });

  it('renders caption, OCR, evidence and scene badge together', () => {
    render(
      <VisualEvidence
        thumbnailUrl="https://cdn.example.com/code.jpg"
        caption="Hook example on screen"
        ocr="useState<number>(0)"
        evidence="Demonstrates state initialization"
        sceneType="code"
      />,
    );
    expect(screen.getByText('Hook example on screen')).toBeInTheDocument();
    expect(screen.getByText(/useState<number>\(0\)/)).toBeInTheDocument();
    expect(screen.getByText(/Demonstrates state initialization/)).toBeInTheDocument();
    expect(screen.getByText('code')).toBeInTheDocument();
  });

  it('wires onSeek to the jump button when timestamp + onSeek are provided', async () => {
    const onSeek = vi.fn();
    const user = userEvent.setup();
    render(
      <VisualEvidence
        thumbnailUrl="https://cdn.example.com/f.jpg"
        timestamp={185}
        onSeek={onSeek}
      />,
    );
    const btn = screen.getByRole('button', { name: /Jump to 3:05/ });
    await user.click(btn);
    expect(onSeek).toHaveBeenCalledWith(185);
  });

  it('omits the jump button when onSeek is not provided', () => {
    render(<VisualEvidence thumbnailUrl="https://cdn.example.com/f.jpg" timestamp={185} />);
    expect(screen.queryByRole('button', { name: /Jump to/ })).not.toBeInTheDocument();
  });

  it('renders in figure variant with aspect-video frame', () => {
    const { container } = render(
      <VisualEvidence
        variant="figure"
        thumbnailUrl="https://cdn.example.com/f.jpg"
        caption="Diagram"
      />,
    );
    const fig = container.querySelector('[data-slot="visual-evidence"][data-variant="figure"]');
    expect(fig).toBeInTheDocument();
    expect(fig?.tagName).toBe('FIGURE');
  });

  it('renders timestamp button with LTR direction even inside an RTL container', () => {
    const { container } = render(
      <div dir="rtl">
        <VisualEvidence
          thumbnailUrl="https://cdn.example.com/f.jpg"
          timestamp={65}
          onSeek={() => {}}
        />
      </div>,
    );
    const btn = container.querySelector('button[dir="ltr"]');
    expect(btn).toBeInTheDocument();
    expect(btn?.textContent).toContain('1:05');
  });
});
