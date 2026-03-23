import { config } from '../config.js';

interface SharePageData {
  title: string;
  creator: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  youtubeId: string;
  tldr: string;
  shareSlug: string;
  sharedAt: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function renderSharePage(data: SharePageData): string {
  const {
    title, creator, thumbnailUrl, duration,
    youtubeId, tldr, shareSlug, sharedAt,
  } = data;

  const safeTitle = escapeHtml(title);
  const safeCreator = creator ? escapeHtml(creator) : '';
  const description = tldr
    ? escapeHtml(tldr.slice(0, 200))
    : `Video summary for ${safeTitle}`;
  const pageUrl = `${config.FRONTEND_URL}/s/${shareSlug}`;
  const ogImageUrl = `${config.FRONTEND_URL}/s/${shareSlug}/og-image.png`;
  const durationStr = formatDuration(duration);
  const ytThumb = thumbnailUrl || `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    description: tldr || '',
    thumbnailUrl: ytThumb,
    uploadDate: sharedAt,
    ...(duration && { duration: `PT${Math.floor(duration / 60)}M${duration % 60}S` }),
    ...(creator && { author: { '@type': 'Person', name: creator } }),
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle} — Video Insight Engine</title>
  <meta name="description" content="${description}">

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="Video Insight Engine">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImageUrl}">

  <!-- JSON-LD -->
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>

  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; background: #0a0a0a; color: #e5e5e5; }
    .thumb { width: 100%; border-radius: 12px; aspect-ratio: 16/9; object-fit: cover; }
    .meta { opacity: 0.7; font-size: 14px; margin: 8px 0; }
    .tldr { font-size: 18px; line-height: 1.6; margin: 16px 0; }
    .redirect { text-align: center; margin-top: 32px; font-size: 14px; opacity: 0.5; }
  </style>
</head>
<body>
  <article>
    <img class="thumb" src="${escapeHtml(ytThumb)}" alt="${safeTitle}" loading="lazy">
    <h1>${safeTitle}</h1>
    <p class="meta">
      ${safeCreator ? `${safeCreator} · ` : ''}${durationStr || ''}
    </p>
    ${tldr ? `<p class="tldr">${escapeHtml(tldr)}</p>` : ''}
  </article>
  <p class="redirect">Loading interactive view...</p>
  <noscript><p style="text-align:center"><a href="${escapeHtml(pageUrl)}">View full interactive summary</a></p></noscript>
  <script>
    // Redirect to frontend app for full interactive experience
    if (typeof window !== 'undefined') {
      window.location.replace(${JSON.stringify(pageUrl)});
    }
  </script>
</body>
</html>`;
}
