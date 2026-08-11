import { FastifyInstance } from 'fastify';
import { renderSharePage } from '../templates/share-page.js';
import { shareSlugParamsSchema } from '../schemas/share.schema.js';

export async function ssrRoutes(fastify: FastifyInstance) {
  const { shareService, ogImageService } = fastify.container;

  // GET /s/:slug — server-side rendered share page with OG tags
  fastify.get<{
    Params: { slug: string };
  }>('/s/:slug', {
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute',
      },
    },
  }, async (req, reply) => {
    const { slug } = shareSlugParamsSchema.parse(req.params);
    const summary = await shareService.getPublicSummary(slug);

    const meta = (summary.meta ?? {}) as Record<string, unknown>;
    const html = renderSharePage({
      title: summary.title,
      creator: summary.creator,
      thumbnailUrl: summary.thumbnailUrl,
      duration: summary.duration,
      youtubeId: summary.youtubeId,
      tldr: typeof meta.tldr === 'string' ? meta.tldr : '',
      shareSlug: slug,
      sharedAt: summary.sharedAt,
    });

    return reply.type('text/html').send(html);
  });

  // GET /s/:slug/og-image.png — OG image for social previews
  fastify.get<{
    Params: { slug: string };
  }>('/s/:slug/og-image.png', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
      },
    },
  }, async (req, reply) => {
    const { slug } = shareSlugParamsSchema.parse(req.params);
    // No IP passed — OG image requests from crawlers should not inflate view counts
    const summary = await shareService.getPublicSummary(slug);

    const image = await ogImageService.getOgImage(slug, {
      title: summary.title,
      channel: summary.creator,
      thumbnailUrl: summary.thumbnailUrl,
      youtubeId: summary.youtubeId,
    });

    if (!image) {
      return reply.code(404).send({ error: 'Image not available' });
    }

    return reply
      .type('image/png')
      .header('Cache-Control', 'public, max-age=86400')
      .send(image);
  });
}
