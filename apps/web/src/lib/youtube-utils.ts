/**
 * YouTube URL parsing utilities for frontend.
 * Mirrors api/src/utils/youtube.ts for consistency.
 */

export function extractVideoId(url: string): string | null {
  // Unified pattern for all YouTube URL formats:
  // - youtu.be/ID (short links)
  // - youtube.com/embed/ID (embed links)
  // - youtube.com/watch?v=ID (standard, v= anywhere in query string)
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch[^]*[?&]v=))([a-zA-Z0-9_-]{11})/
  );
  return match?.[1] ?? null;
}

export function hasVideoId(url: string): boolean {
  return extractVideoId(url) !== null;
}

export function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export function hasPlaylistId(url: string): boolean {
  return extractPlaylistId(url) !== null;
}

export function isPlaylistPage(url: string): boolean {
  return /youtube\.com\/playlist\?/.test(url);
}

export type PlaylistMode = "video" | "playlist";

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
}

export function validateUrlForMode(
  url: string,
  mode: PlaylistMode
): UrlValidationResult {
  const videoId = extractVideoId(url);
  const playlistId = extractPlaylistId(url);
  const isPlaylist = isPlaylistPage(url);

  if (mode === "video") {
    if (isPlaylist && !videoId) {
      return {
        valid: false,
        error: "This URL points to a playlist, not a video",
        suggestion: "Switch to Playlist mode",
      };
    }
    if (!videoId) {
      return { valid: false, error: "No video ID found in URL" };
    }
    return { valid: true };
  }

  if (mode === "playlist") {
    if (!playlistId) {
      return {
        valid: false,
        error: "No playlist ID found in URL",
        suggestion: videoId ? "Switch to Video mode" : undefined,
      };
    }
    return { valid: true };
  }

  return { valid: false, error: "Invalid mode" };
}
