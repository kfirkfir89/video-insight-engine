import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { VideoFilmstrip, type FilmstripFrame } from '../VideoFilmstrip';

const frames: FilmstripFrame[] = [
  {
    thumbnailUrl: 'https://example.com/frame-0.jpg',
    timestamp: 0,
    caption: 'Opening scene',
    sceneType: 'talking_head',
  },
  {
    thumbnailUrl: 'https://example.com/frame-1.jpg',
    timestamp: 30,
    caption: 'Demo screen',
    ocr: 'main()',
    sceneType: 'code',
  },
  {
    thumbnailUrl: 'https://example.com/frame-2.jpg',
    timestamp: 90,
    caption: 'Closing slide',
  },
];

describe('VideoFilmstrip', () => {
  it('should render one cell per frame', () => {
    render(<VideoFilmstrip frames={frames} />);
    const cells = screen.getAllByRole('listitem');
    expect(cells.length).toBe(3);
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBe(3);
  });

  it('should return null for empty frames', () => {
    const { container } = render(<VideoFilmstrip frames={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should call onSeek with the frame timestamp when a cell is clicked', () => {
    const onSeek = vi.fn();
    render(<VideoFilmstrip frames={frames} onSeek={onSeek} />);
    const cell = screen.getByLabelText(/Jump to 0:30/);
    fireEvent.click(cell);
    expect(onSeek).toHaveBeenCalledWith(30);
  });

  it('should highlight the cell whose timestamp is within ±5s of currentTime', () => {
    render(<VideoFilmstrip frames={frames} currentTime={32} />);
    const activeBtn = screen.getByLabelText(/Jump to 0:30/);
    expect(activeBtn.className).toContain('ring-primary');
    const inactiveBtn = screen.getByLabelText(/Jump to 0:00/);
    expect(inactiveBtn.className).not.toContain('ring-primary');
  });

  it("mode='overlay' should not render label text below cells", () => {
    const { container } = render(<VideoFilmstrip frames={frames} mode="overlay" />);
    expect(container.querySelector('[data-mode="overlay"]')).toBeTruthy();
    // The timestamp is rendered inside the button as an overlay badge,
    // but there is no separate label row below in overlay mode.
    // Tab mode also renders the stamp inside the button, so we can detect
    // overlay by absence of the centered label container ".text-center".
    expect(container.querySelector('.text-center')).toBeNull();
  });

  it("mode='tab' should render timestamp labels below cells", () => {
    const { container } = render(<VideoFilmstrip frames={frames} mode="tab" />);
    expect(container.querySelector('[data-mode="tab"]')).toBeTruthy();
    expect(container.querySelector('.text-center')).not.toBeNull();
  });
});
