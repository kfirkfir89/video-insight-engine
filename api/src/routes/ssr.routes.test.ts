import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, createMockContainer, type MockContainer } from '../test/helpers.js';

const mockPublicSummary = {
  id: '507f1f77bcf86cd799439011',
  youtubeId: 'dQw4w9WgXcQ',
  title: 'Test Video',
  channel: 'Test Channel',
  thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  duration: 300,
  outputType: 'summary',
  context: null,
  summary: { tldr: 'Test summary', keyTakeaways: ['Point 1'], chapters: [], concepts: [] },
  shareSlug: 'aBcDeFgHiJ',
  viewsCount: 10,
  likesCount: 5,
  sharedAt: '2024-01-01T00:00:00.000Z',
};

describe('SSR routes', () => {
  let app: FastifyInstance;
  let mockContainer: MockContainer;

  beforeAll(async () => {
    mockContainer = createMockContainer();
    app = await buildTestApp(mockContainer);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /s/:slug', () => {
    const validSlug = 'aBcDeFgHiJ';

    it('should return text/html content type', async () => {
      mockContainer.shareService.getPublicSummary.mockResolvedValue(mockPublicSummary);

      const response = await app.inject({
        method: 'GET',
        url: `/s/${validSlug}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    });

    it('should contain OG meta tags in response', async () => {
      mockContainer.shareService.getPublicSummary.mockResolvedValue(mockPublicSummary);

      const response = await app.inject({
        method: 'GET',
        url: `/s/${validSlug}`,
      });

      const html = response.body;
      expect(html).toContain('<meta property="og:title"');
      expect(html).toContain('<meta property="og:description"');
      expect(html).toContain('<meta property="og:image"');
      expect(html).toContain('<meta property="og:url"');
      expect(html).toContain('<meta property="og:type"');
      expect(html).toContain('Test Video');
      expect(html).toContain('Test summary');
    });

    it('should contain JSON-LD script tag', async () => {
      mockContainer.shareService.getPublicSummary.mockResolvedValue(mockPublicSummary);

      const response = await app.inject({
        method: 'GET',
        url: `/s/${validSlug}`,
      });

      const html = response.body;
      expect(html).toContain('<script type="application/ld+json">');
      expect(html).toContain('"@context":"https://schema.org"');
      expect(html).toContain('"@type":"VideoObject"');
      expect(html).toContain('"name":"Test Video"');
    });

    it('should return 400 for invalid slug format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/s/bad',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty('error', 'VALIDATION_ERROR');
    });
  });

  describe('GET /s/:slug/og-image.png', () => {
    const validSlug = 'aBcDeFgHiJ';

    it('should return image/png when image is available', async () => {
      mockContainer.shareService.getPublicSummary.mockResolvedValue(mockPublicSummary);
      mockContainer.ogImageService.getOgImage.mockResolvedValue(Buffer.from('fake-image'));

      const response = await app.inject({
        method: 'GET',
        url: `/s/${validSlug}/og-image.png`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
      expect(response.headers['cache-control']).toContain('public');
      expect(mockContainer.ogImageService.getOgImage).toHaveBeenCalledWith(
        validSlug,
        {
          title: mockPublicSummary.title,
          channel: mockPublicSummary.channel,
          thumbnailUrl: mockPublicSummary.thumbnailUrl,
          youtubeId: mockPublicSummary.youtubeId,
          outputType: mockPublicSummary.outputType,
        }
      );
    });

    it('should return 404 when image is not available', async () => {
      mockContainer.shareService.getPublicSummary.mockResolvedValue(mockPublicSummary);
      mockContainer.ogImageService.getOgImage.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: `/s/${validSlug}/og-image.png`,
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toHaveProperty('error', 'Image not available');
    });
  });
});
