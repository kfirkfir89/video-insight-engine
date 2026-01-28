// ─────────────────────────────────────────────────────
// Video ID Extraction
// ─────────────────────────────────────────────────────

export function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

export function isValidYoutubeUrl(url: string): boolean {
  return extractYoutubeId(url) !== null;
}

// ─────────────────────────────────────────────────────
// Playlist ID Extraction
// ─────────────────────────────────────────────────────

/**
 * Extract playlist ID from a YouTube URL.
 * Handles various URL formats:
 * - youtube.com/playlist?list=PLxxx
 * - youtube.com/watch?v=xxx&list=PLxxx
 * - youtu.be/xxx?list=PLxxx
 */
export function extractPlaylistId(url: string): string | null {
  // Match list= parameter in any YouTube URL
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export function isValidPlaylistUrl(url: string): boolean {
  return extractPlaylistId(url) !== null;
}

// ─────────────────────────────────────────────────────
// URL Parsing & Validation
// ─────────────────────────────────────────────────────

export type PlaylistMode = 'video' | 'playlist';

export interface ParsedYouTubeUrl {
  videoId: string | null;
  playlistId: string | null;
  isPlaylistPage: boolean;  // True if URL is youtube.com/playlist?list=...
}

/**
 * Parse a YouTube URL and extract all relevant IDs.
 * Determines if URL is a pure playlist page vs a video page.
 */
export function parseYouTubeUrl(url: string): ParsedYouTubeUrl {
  const videoId = extractYoutubeId(url);
  const playlistId = extractPlaylistId(url);

  // Detect if this is a pure playlist page (no video, just playlist)
  const isPlaylistPage = /youtube\.com\/playlist\?/.test(url);

  return {
    videoId,
    playlistId,
    isPlaylistPage,
  };
}

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Validate a parsed URL against the user's selected mode.
 *
 * Rules:
 * - Video mode + playlist-only URL → error
 * - Playlist mode + video-only URL → error
 * - Mixed URL (video+playlist) → valid for both modes
 */
export function validateUrlForMode(
  parsed: ParsedYouTubeUrl,
  mode: PlaylistMode
): UrlValidationResult {
  const { videoId, playlistId, isPlaylistPage } = parsed;

  if (mode === 'video') {
    // User wants a single video
    if (isPlaylistPage && !videoId) {
      return {
        valid: false,
        error: 'This URL points to a playlist, not a video',
        suggestion: 'Switch to Playlist mode to import this playlist',
      };
    }
    if (!videoId) {
      return {
        valid: false,
        error: 'No video ID found in URL',
      };
    }
    // Valid: has video ID (may also have playlist, that's fine)
    return { valid: true };
  }

  if (mode === 'playlist') {
    // User wants to import a playlist
    if (!playlistId) {
      return {
        valid: false,
        error: 'No playlist ID found in URL',
        suggestion: videoId ? 'Switch to Video mode to add this single video' : undefined,
      };
    }
    // Valid: has playlist ID
    return { valid: true };
  }

  return { valid: false, error: 'Invalid mode' };
}
