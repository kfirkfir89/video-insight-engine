import { describe, it, expect } from 'vitest';
import { renderSharePage } from './share-page.js';

const mockData = {
  title: 'Test Video Title',
  channel: 'Test Channel',
  thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  duration: 3723, // 1:02:03
  youtubeId: 'dQw4w9WgXcQ',
  outputType: 'summary' as const,
  context: null,
  summary: {
    tldr: 'A test summary of the video content.',
    keyTakeaways: ['Takeaway 1', 'Takeaway 2'],
    chapters: [],
    concepts: [],
  },
  shareSlug: 'aBcDeFgHiJ',
  sharedAt: '2024-01-01T00:00:00.000Z',
};

describe('renderSharePage', () => {
  it('should return valid HTML', () => {
    const html = renderSharePage(mockData);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('should contain Open Graph meta tags', () => {
    const html = renderSharePage(mockData);
    expect(html).toContain('og:title');
    expect(html).toContain('og:description');
    expect(html).toContain('og:image');
    expect(html).toContain('og:url');
    expect(html).toContain('og:type');
  });

  it('should contain Twitter Card meta tags', () => {
    const html = renderSharePage(mockData);
    expect(html).toContain('twitter:card');
    expect(html).toContain('twitter:title');
    expect(html).toContain('twitter:description');
    expect(html).toContain('twitter:image');
  });

  it('should contain JSON-LD structured data', () => {
    const html = renderSharePage(mockData);
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@context":"https://schema.org"');
    expect(html).toContain('"@type":"VideoObject"');
  });

  it('should include the video title escaped', () => {
    const html = renderSharePage(mockData);
    expect(html).toContain('Test Video Title');
  });

  it('should escape HTML in title', () => {
    const data = { ...mockData, title: 'Test <script>alert("xss")</script>' };
    const html = renderSharePage(data);
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('should escape < in JSON-LD to prevent script injection', () => {
    const data = { ...mockData, title: '</script><img onerror=alert(1)>' };
    const html = renderSharePage(data);
    // JSON-LD block must not contain literal </script> which would break out
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(jsonLdMatch).not.toBeNull();
    const jsonLdContent = jsonLdMatch![1];
    expect(jsonLdContent).not.toContain('</script>');
    expect(jsonLdContent).toContain('\\u003c');
  });

  it('should include channel name when provided', () => {
    const html = renderSharePage(mockData);
    expect(html).toContain('Test Channel');
  });

  it('should handle missing channel', () => {
    const data = { ...mockData, channel: null };
    const html = renderSharePage(data);
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('should format duration correctly', () => {
    const html = renderSharePage(mockData);
    // 3723 seconds = 1:02:03
    expect(html).toContain('1:02:03');
  });

  it('should include tldr in description', () => {
    const html = renderSharePage(mockData);
    expect(html).toContain('A test summary of the video content.');
  });

  it('should include key takeaways', () => {
    const html = renderSharePage(mockData);
    expect(html).toContain('Takeaway 1');
    expect(html).toContain('Takeaway 2');
  });

  it('should include the share slug in OG image URL', () => {
    const html = renderSharePage(mockData);
    expect(html).toContain('/s/aBcDeFgHiJ/og-image.png');
  });

  it('should include redirect script', () => {
    const html = renderSharePage(mockData);
    expect(html).toContain('window.location.replace');
  });

  it('should include the output type badge', () => {
    const html = renderSharePage(mockData);
    expect(html).toContain('summary');
  });

  it('should handle missing duration', () => {
    const data = { ...mockData, duration: null };
    const html = renderSharePage(data);
    expect(html).toContain('<!DOCTYPE html>');
  });
});
