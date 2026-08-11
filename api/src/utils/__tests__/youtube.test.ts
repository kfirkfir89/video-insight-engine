import { describe, it, expect } from 'vitest';
import {
  extractYoutubeId,
  isValidYoutubeUrl,
  extractPlaylistId,
  isValidPlaylistUrl,
  parseYouTubeUrl,
  validateUrlForMode,
  ParsedYouTubeUrl,
} from '../youtube.js';

describe('YouTube URL Utilities', () => {
  describe('extractYoutubeId', () => {
    it('should extract video ID from standard watch URL', () => {
      const id = extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(id).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from short URL', () => {
      const id = extractYoutubeId('https://youtu.be/dQw4w9WgXcQ');
      expect(id).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from embed URL', () => {
      const id = extractYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(id).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from URL with additional parameters', () => {
      const id = extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120');
      expect(id).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from URL with playlist', () => {
      const id = extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest123');
      expect(id).toBe('dQw4w9WgXcQ');
    });

    it('should handle URL without www', () => {
      const id = extractYoutubeId('https://youtube.com/watch?v=dQw4w9WgXcQ');
      expect(id).toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid URL', () => {
      const id = extractYoutubeId('https://example.com/video');
      expect(id).toBeNull();
    });

    it('should return null for empty string', () => {
      const id = extractYoutubeId('');
      expect(id).toBeNull();
    });

    it('should return null for malformed URL', () => {
      const id = extractYoutubeId('not-a-url');
      expect(id).toBeNull();
    });

    it('should return null for YouTube URL without video ID', () => {
      const id = extractYoutubeId('https://www.youtube.com/');
      expect(id).toBeNull();
    });

    it('should handle video IDs with underscores and hyphens', () => {
      const id = extractYoutubeId('https://www.youtube.com/watch?v=a-B_1234567');
      expect(id).toBe('a-B_1234567');
    });
  });

  describe('isValidYoutubeUrl', () => {
    it('should return true for valid YouTube URL', () => {
      expect(isValidYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    });

    it('should return true for valid short URL', () => {
      expect(isValidYoutubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    });

    it('should return false for invalid URL', () => {
      expect(isValidYoutubeUrl('https://example.com/video')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidYoutubeUrl('')).toBe(false);
    });

    it('should return false for playlist-only URL', () => {
      expect(isValidYoutubeUrl('https://www.youtube.com/playlist?list=PLtest123')).toBe(false);
    });
  });

  describe('extractPlaylistId', () => {
    it('should extract playlist ID from playlist URL', () => {
      const id = extractPlaylistId('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
      expect(id).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
    });

    it('should extract playlist ID from watch URL with playlist', () => {
      const id = extractPlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest123');
      expect(id).toBe('PLtest123');
    });

    it('should extract playlist ID from short URL with playlist', () => {
      const id = extractPlaylistId('https://youtu.be/dQw4w9WgXcQ?list=PLtest123');
      expect(id).toBe('PLtest123');
    });

    it('should handle playlist ID at beginning of query string', () => {
      const id = extractPlaylistId('https://www.youtube.com/watch?list=PLtest123&v=dQw4w9WgXcQ');
      expect(id).toBe('PLtest123');
    });

    it('should return null for URL without playlist', () => {
      const id = extractPlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(id).toBeNull();
    });

    it('should return null for empty string', () => {
      const id = extractPlaylistId('');
      expect(id).toBeNull();
    });

    it('should handle playlist IDs with underscores and hyphens', () => {
      const id = extractPlaylistId('https://www.youtube.com/playlist?list=PL_abc-123_XYZ');
      expect(id).toBe('PL_abc-123_XYZ');
    });
  });

  describe('isValidPlaylistUrl', () => {
    it('should return true for valid playlist URL', () => {
      expect(isValidPlaylistUrl('https://www.youtube.com/playlist?list=PLtest123')).toBe(true);
    });

    it('should return true for watch URL with playlist', () => {
      expect(isValidPlaylistUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest123')).toBe(true);
    });

    it('should return false for URL without playlist', () => {
      expect(isValidPlaylistUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidPlaylistUrl('')).toBe(false);
    });
  });

  describe('parseYouTubeUrl', () => {
    it('should parse standard video URL', () => {
      const result = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      expect(result.videoId).toBe('dQw4w9WgXcQ');
      expect(result.playlistId).toBeNull();
      expect(result.isPlaylistPage).toBe(false);
    });

    it('should parse playlist page URL', () => {
      const result = parseYouTubeUrl('https://www.youtube.com/playlist?list=PLtest123');

      expect(result.videoId).toBeNull();
      expect(result.playlistId).toBe('PLtest123');
      expect(result.isPlaylistPage).toBe(true);
    });

    it('should parse video URL with playlist', () => {
      const result = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest123');

      expect(result.videoId).toBe('dQw4w9WgXcQ');
      expect(result.playlistId).toBe('PLtest123');
      expect(result.isPlaylistPage).toBe(false);
    });

    it('should handle short URL', () => {
      const result = parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ');

      expect(result.videoId).toBe('dQw4w9WgXcQ');
      expect(result.playlistId).toBeNull();
      expect(result.isPlaylistPage).toBe(false);
    });

    it('should handle short URL with playlist', () => {
      const result = parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?list=PLtest123');

      expect(result.videoId).toBe('dQw4w9WgXcQ');
      expect(result.playlistId).toBe('PLtest123');
      expect(result.isPlaylistPage).toBe(false);
    });

    it('should handle invalid URL', () => {
      const result = parseYouTubeUrl('https://example.com/video');

      expect(result.videoId).toBeNull();
      expect(result.playlistId).toBeNull();
      expect(result.isPlaylistPage).toBe(false);
    });
  });

  describe('validateUrlForMode', () => {
    describe('video mode', () => {
      it('should be valid for standard video URL', () => {
        const parsed: ParsedYouTubeUrl = {
          videoId: 'dQw4w9WgXcQ',
          playlistId: null,
          isPlaylistPage: false,
        };

        const result = validateUrlForMode(parsed, 'video');

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should be valid for video URL with playlist', () => {
        const parsed: ParsedYouTubeUrl = {
          videoId: 'dQw4w9WgXcQ',
          playlistId: 'PLtest123',
          isPlaylistPage: false,
        };

        const result = validateUrlForMode(parsed, 'video');

        expect(result.valid).toBe(true);
      });

      it('should be invalid for playlist-only URL', () => {
        const parsed: ParsedYouTubeUrl = {
          videoId: null,
          playlistId: 'PLtest123',
          isPlaylistPage: true,
        };

        const result = validateUrlForMode(parsed, 'video');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('This URL points to a playlist, not a video');
        expect(result.suggestion).toBe('Switch to Playlist mode to import this playlist');
      });

      it('should be invalid for URL without video ID', () => {
        const parsed: ParsedYouTubeUrl = {
          videoId: null,
          playlistId: null,
          isPlaylistPage: false,
        };

        const result = validateUrlForMode(parsed, 'video');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('No video ID found in URL');
      });
    });

    describe('playlist mode', () => {
      it('should be valid for playlist URL', () => {
        const parsed: ParsedYouTubeUrl = {
          videoId: null,
          playlistId: 'PLtest123',
          isPlaylistPage: true,
        };

        const result = validateUrlForMode(parsed, 'playlist');

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should be valid for video URL with playlist', () => {
        const parsed: ParsedYouTubeUrl = {
          videoId: 'dQw4w9WgXcQ',
          playlistId: 'PLtest123',
          isPlaylistPage: false,
        };

        const result = validateUrlForMode(parsed, 'playlist');

        expect(result.valid).toBe(true);
      });

      it('should be invalid for video-only URL', () => {
        const parsed: ParsedYouTubeUrl = {
          videoId: 'dQw4w9WgXcQ',
          playlistId: null,
          isPlaylistPage: false,
        };

        const result = validateUrlForMode(parsed, 'playlist');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('No playlist ID found in URL');
        expect(result.suggestion).toBe('Switch to Video mode to add this single video');
      });

      it('should be invalid for URL without playlist and without video', () => {
        const parsed: ParsedYouTubeUrl = {
          videoId: null,
          playlistId: null,
          isPlaylistPage: false,
        };

        const result = validateUrlForMode(parsed, 'playlist');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('No playlist ID found in URL');
        expect(result.suggestion).toBeUndefined();
      });
    });
  });
});
