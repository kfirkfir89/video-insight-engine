import { describe, it, expect } from 'vitest';
import {
  extractVideoId,
  hasVideoId,
  extractPlaylistId,
  hasPlaylistId,
  isPlaylistPage,
  validateUrlForMode,
} from '../youtube-utils';

describe('youtube-utils', () => {
  // ─────────────────────────────────────────────────────
  // extractVideoId Tests
  // ─────────────────────────────────────────────────────

  describe('extractVideoId', () => {
    describe('standard watch URL format', () => {
      it('should extract video ID from standard watch URL', () => {
        expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
          'dQw4w9WgXcQ'
        );
      });

      it('should extract video ID from URL with additional parameters', () => {
        expect(
          extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120')
        ).toBe('dQw4w9WgXcQ');
      });

      it('should extract video ID when v is not first parameter', () => {
        expect(
          extractVideoId('https://www.youtube.com/watch?t=120&v=dQw4w9WgXcQ')
        ).toBe('dQw4w9WgXcQ');
      });

      it('should handle http protocol', () => {
        expect(extractVideoId('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
          'dQw4w9WgXcQ'
        );
      });

      it('should handle URL without www', () => {
        expect(extractVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
          'dQw4w9WgXcQ'
        );
      });
    });

    describe('short URL format (youtu.be)', () => {
      it('should extract video ID from short URL', () => {
        expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      });

      it('should extract video ID from short URL with timestamp', () => {
        expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ?t=120')).toBe(
          'dQw4w9WgXcQ'
        );
      });
    });

    describe('embed URL format', () => {
      it('should extract video ID from embed URL', () => {
        expect(
          extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')
        ).toBe('dQw4w9WgXcQ');
      });

      it('should extract video ID from embed URL with parameters', () => {
        expect(
          extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1')
        ).toBe('dQw4w9WgXcQ');
      });
    });

    describe('video ID validation', () => {
      it('should extract ID with hyphens', () => {
        expect(extractVideoId('https://youtu.be/abc-def_123')).toBe('abc-def_123');
      });

      it('should extract ID with underscores', () => {
        expect(extractVideoId('https://youtu.be/abc_def_123')).toBe('abc_def_123');
      });

      it('should return null for ID shorter than 11 characters', () => {
        expect(extractVideoId('https://youtu.be/short')).toBeNull();
      });

      it('should only extract first 11 characters', () => {
        // Video IDs are exactly 11 characters
        expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      });
    });

    describe('invalid URLs', () => {
      it('should return null for non-YouTube URL', () => {
        expect(extractVideoId('https://vimeo.com/123456789')).toBeNull();
      });

      it('should return null for empty string', () => {
        expect(extractVideoId('')).toBeNull();
      });

      it('should return null for URL without video ID', () => {
        expect(extractVideoId('https://www.youtube.com/')).toBeNull();
      });

      it('should return null for playlist-only URL', () => {
        expect(
          extractVideoId('https://www.youtube.com/playlist?list=PLtest123')
        ).toBeNull();
      });

      it('should return null for malformed URL', () => {
        expect(extractVideoId('not-a-url')).toBeNull();
      });
    });
  });

  // ─────────────────────────────────────────────────────
  // hasVideoId Tests
  // ─────────────────────────────────────────────────────

  describe('hasVideoId', () => {
    it('should return true for valid video URL', () => {
      expect(hasVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    });

    it('should return true for short URL', () => {
      expect(hasVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    });

    it('should return false for invalid URL', () => {
      expect(hasVideoId('https://youtube.com/')).toBe(false);
    });

    it('should return false for playlist URL without video', () => {
      expect(hasVideoId('https://youtube.com/playlist?list=PLtest')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────
  // extractPlaylistId Tests
  // ─────────────────────────────────────────────────────

  describe('extractPlaylistId', () => {
    it('should extract playlist ID from playlist page URL', () => {
      expect(
        extractPlaylistId(
          'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'
        )
      ).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
    });

    it('should extract playlist ID from watch URL with playlist', () => {
      expect(
        extractPlaylistId(
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'
        )
      ).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
    });

    it('should extract playlist ID with hyphens and underscores', () => {
      expect(
        extractPlaylistId('https://youtube.com/playlist?list=PL_test-list_123')
      ).toBe('PL_test-list_123');
    });

    it('should return null for URL without playlist ID', () => {
      expect(extractPlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(extractPlaylistId('')).toBeNull();
    });

    it('should return null for non-YouTube URL', () => {
      expect(extractPlaylistId('https://vimeo.com/album/123')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────
  // hasPlaylistId Tests
  // ─────────────────────────────────────────────────────

  describe('hasPlaylistId', () => {
    it('should return true for playlist page URL', () => {
      expect(hasPlaylistId('https://youtube.com/playlist?list=PLtest123')).toBe(true);
    });

    it('should return true for watch URL with playlist', () => {
      expect(
        hasPlaylistId('https://youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest123')
      ).toBe(true);
    });

    it('should return false for video-only URL', () => {
      expect(hasPlaylistId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────
  // isPlaylistPage Tests
  // ─────────────────────────────────────────────────────

  describe('isPlaylistPage', () => {
    it('should return true for playlist page URL', () => {
      expect(isPlaylistPage('https://www.youtube.com/playlist?list=PLtest123')).toBe(
        true
      );
    });

    it('should return false for watch URL even with playlist', () => {
      expect(
        isPlaylistPage('https://www.youtube.com/watch?v=test&list=PLtest123')
      ).toBe(false);
    });

    it('should return false for regular video URL', () => {
      expect(isPlaylistPage('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
        false
      );
    });

    it('should return false for short URL', () => {
      expect(isPlaylistPage('https://youtu.be/dQw4w9WgXcQ')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────
  // validateUrlForMode Tests
  // ─────────────────────────────────────────────────────

  describe('validateUrlForMode', () => {
    describe('video mode', () => {
      it('should validate standard video URL', () => {
        const result = validateUrlForMode(
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          'video'
        );
        expect(result).toEqual({ valid: true });
      });

      it('should validate short video URL', () => {
        const result = validateUrlForMode('https://youtu.be/dQw4w9WgXcQ', 'video');
        expect(result).toEqual({ valid: true });
      });

      it('should validate video URL with playlist parameter', () => {
        const result = validateUrlForMode(
          'https://youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest',
          'video'
        );
        expect(result).toEqual({ valid: true });
      });

      it('should reject playlist page URL', () => {
        const result = validateUrlForMode(
          'https://youtube.com/playlist?list=PLtest123',
          'video'
        );
        expect(result).toEqual({
          valid: false,
          error: 'This URL points to a playlist, not a video',
          suggestion: 'Switch to Playlist mode',
        });
      });

      it('should reject URL without video ID', () => {
        const result = validateUrlForMode('https://youtube.com/', 'video');
        expect(result).toEqual({
          valid: false,
          error: 'No video ID found in URL',
        });
      });
    });

    describe('playlist mode', () => {
      it('should validate playlist page URL', () => {
        const result = validateUrlForMode(
          'https://youtube.com/playlist?list=PLtest123',
          'playlist'
        );
        expect(result).toEqual({ valid: true });
      });

      it('should validate watch URL with playlist', () => {
        const result = validateUrlForMode(
          'https://youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest123',
          'playlist'
        );
        expect(result).toEqual({ valid: true });
      });

      it('should reject video URL without playlist', () => {
        const result = validateUrlForMode(
          'https://youtube.com/watch?v=dQw4w9WgXcQ',
          'playlist'
        );
        expect(result).toEqual({
          valid: false,
          error: 'No playlist ID found in URL',
          suggestion: 'Switch to Video mode',
        });
      });

      it('should reject random URL without suggesting video mode', () => {
        const result = validateUrlForMode('https://youtube.com/', 'playlist');
        expect(result).toEqual({
          valid: false,
          error: 'No playlist ID found in URL',
          suggestion: undefined,
        });
      });
    });

    describe('edge cases', () => {
      it('should handle invalid mode', () => {
        const result = validateUrlForMode(
          'https://youtube.com/watch?v=test',
          'invalid' as 'video'
        );
        expect(result).toEqual({ valid: false, error: 'Invalid mode' });
      });
    });
  });
});
