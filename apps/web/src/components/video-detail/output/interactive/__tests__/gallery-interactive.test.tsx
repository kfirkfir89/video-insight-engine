import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';


import { GalleryInteractive } from '../GalleryInteractive';

const images = [
  { url: 'https://example.com/1.jpg', caption: 'Photo 1', alt: 'First photo' },
  { url: 'https://example.com/2.jpg', caption: 'Photo 2', alt: 'Second photo' },
  { query: 'sunset beach', caption: 'Sunset', alt: 'Beach sunset' },
];

describe('GalleryInteractive', () => {
  it('should render images in grid layout', () => {
    render(<GalleryInteractive images={images} layout="grid" />);
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBe(3);
  });

  it('should return null for empty images', () => {
    const { container } = render(<GalleryInteractive images={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should show captions', () => {
    render(<GalleryInteractive images={images} />);
    expect(screen.getByText('Photo 1')).toBeInTheDocument();
    expect(screen.getByText('Photo 2')).toBeInTheDocument();
  });

  it('should render carousel layout with navigation', () => {
    render(<GalleryInteractive images={images} layout="carousel" />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('Prev')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should render hero_stack layout', () => {
    render(<GalleryInteractive images={images} layout="hero_stack" />);
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBe(3);
  });
});
