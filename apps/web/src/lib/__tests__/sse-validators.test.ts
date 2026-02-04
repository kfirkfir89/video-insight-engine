import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateChapters,
  validateChapter,
  validateConcepts,
  validateDescriptionAnalysis,
  validateMetadataEvent,
  validateSynthesisComplete,
  validateDoneEvent,
  validateErrorEvent,
  validateChaptersEvent,
  validatePhaseEvent,
} from '../sse-validators';

// Mock the sse-logger to avoid console output during tests
vi.mock('../sse-logger', () => ({
  sseLogger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('sse-validators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────
  // validateChapters Tests
  // ─────────────────────────────────────────────────────

  describe('validateChapters', () => {
    it('should validate valid chapters array', () => {
      const chapters = [
        { startSeconds: 0, endSeconds: 60, title: 'Intro' },
        { startSeconds: 60, endSeconds: 120, title: 'Main Content' },
      ];

      const result = validateChapters(chapters);

      expect(result).toEqual(chapters);
    });

    it('should return empty array for invalid data', () => {
      const result = validateChapters('not an array');

      expect(result).toEqual([]);
    });

    it('should return empty array for null', () => {
      const result = validateChapters(null);

      expect(result).toEqual([]);
    });

    it('should return empty array for chapters with missing fields', () => {
      const result = validateChapters([{ startSeconds: 0 }]);

      expect(result).toEqual([]);
    });

    it('should return empty array for chapters with wrong types', () => {
      const result = validateChapters([
        { startSeconds: '0', endSeconds: 60, title: 'Intro' },
      ]);

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────
  // validateChapter Tests
  // ─────────────────────────────────────────────────────

  describe('validateChapter', () => {
    it('should validate valid section', () => {
      const section = {
        id: 's1',
        timestamp: '0:00',
        startSeconds: 0,
        endSeconds: 60,
        title: 'Intro',
        summary: 'Introduction to the topic',
        bullets: ['Point 1', 'Point 2'],
      };

      const result = validateChapter(section);

      expect(result).toMatchObject({
        id: 's1',
        timestamp: '0:00',
        startSeconds: 0,
        endSeconds: 60,
        title: 'Intro',
      });
    });

    it('should normalize snake_case to camelCase', () => {
      const section = {
        id: 's1',
        timestamp: '0:00',
        start_seconds: 0,
        end_seconds: 60,
        title: 'Intro',
        original_title: 'Original',
        generated_title: 'Generated',
        is_creator_chapter: true,
        summary: 'Summary',
        bullets: [],
      };

      const result = validateChapter(section);

      expect(result).toMatchObject({
        startSeconds: 0,
        endSeconds: 60,
        originalTitle: 'Original',
        generatedTitle: 'Generated',
        isCreatorChapter: true,
      });
    });

    it('should prefer camelCase over snake_case when both present', () => {
      const section = {
        id: 's1',
        timestamp: '0:00',
        startSeconds: 100,
        start_seconds: 50,
        endSeconds: 200,
        end_seconds: 150,
        title: 'Test',
        summary: 'Summary',
        bullets: [],
      };

      const result = validateChapter(section);

      expect(result?.startSeconds).toBe(100);
      expect(result?.endSeconds).toBe(200);
    });

    it('should return null for invalid section', () => {
      const result = validateChapter({ id: 's1' }); // Missing required fields

      expect(result).toBeNull();
    });

    it('should return null for null input', () => {
      const result = validateChapter(null);

      expect(result).toBeNull();
    });

    it('should validate section with content blocks', () => {
      const section = {
        id: 's1',
        timestamp: '0:00',
        startSeconds: 0,
        endSeconds: 60,
        title: 'Intro',
        summary: 'Summary',
        bullets: [],
        content: [
          { blockId: 'block-1', type: 'paragraph', text: 'Hello world' },
          { blockId: 'block-2', type: 'bullets', items: ['Item 1', 'Item 2'] },
        ],
      };

      const result = validateChapter(section);

      expect(result?.content).toHaveLength(2);
      expect(result?.content?.[0]).toEqual({ blockId: 'block-1', type: 'paragraph', text: 'Hello world' });
    });

    it('should filter out invalid content blocks', () => {
      const section = {
        id: 's1',
        timestamp: '0:00',
        startSeconds: 0,
        endSeconds: 60,
        title: 'Intro',
        summary: 'Summary',
        bullets: [],
        content: [
          { blockId: 'block-1', type: 'paragraph', text: 'Valid' },
          { blockId: 'block-2', type: 'invalid_type', data: 'Invalid' },
          { blockId: 'block-3', type: 'bullets', items: ['Valid items'] },
        ],
      };

      const result = validateChapter(section);

      expect(result?.content).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────
  // validateConcepts Tests
  // ─────────────────────────────────────────────────────

  describe('validateConcepts', () => {
    it('should validate valid concepts array', () => {
      const concepts = [
        { id: 'c1', name: 'React', definition: 'A JavaScript library', timestamp: '1:00' },
        { id: 'c2', name: 'Vue', definition: null, timestamp: null },
      ];

      const result = validateConcepts(concepts);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('React');
      expect(result[0].definition).toBe('A JavaScript library');
      expect(result[1].definition).toBeNull();
    });

    it('should handle missing optional fields', () => {
      const concepts = [{ id: 'c1', name: 'Test' }];

      const result = validateConcepts(concepts);

      expect(result).toHaveLength(1);
      expect(result[0].definition).toBeNull();
      expect(result[0].timestamp).toBeNull();
    });

    it('should return empty array for invalid input', () => {
      const result = validateConcepts('not an array');

      expect(result).toEqual([]);
    });

    it('should return empty array for concepts missing required fields', () => {
      const result = validateConcepts([{ definition: 'No name field' }]);

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────
  // validateDescriptionAnalysis Tests
  // ─────────────────────────────────────────────────────

  describe('validateDescriptionAnalysis', () => {
    it('should validate complete description analysis', () => {
      const data = {
        links: [{ url: 'https://example.com', type: 'documentation', label: 'Docs' }],
        resources: [{ name: 'Resource', url: 'https://resource.com' }],
        relatedVideos: [{ title: 'Related', url: 'https://youtube.com/watch?v=test' }],
        timestamps: [{ time: '1:00', label: 'Chapter 1' }],
        socialLinks: [{ platform: 'twitter', url: 'https://twitter.com/test' }],
      };

      const result = validateDescriptionAnalysis(data);

      expect(result).toEqual(data);
    });

    it('should use defaults for missing arrays', () => {
      const result = validateDescriptionAnalysis({});

      expect(result).toEqual({
        links: [],
        resources: [],
        relatedVideos: [],
        timestamps: [],
        socialLinks: [],
      });
    });

    it('should return null for invalid input', () => {
      const result = validateDescriptionAnalysis('invalid');

      expect(result).toBeNull();
    });

    it('should return null when arrays contain invalid items', () => {
      const result = validateDescriptionAnalysis({
        links: [{ invalid: 'data' }], // Missing required fields
      });

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────
  // validateMetadataEvent Tests
  // ─────────────────────────────────────────────────────

  describe('validateMetadataEvent', () => {
    it('should validate complete metadata event', () => {
      const data = {
        event: 'metadata',
        title: 'Test Video',
        channel: 'Test Channel',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        duration: 3600,
        context: {
          category: 'coding',
          youtubeCategory: 'Education',
          tags: ['programming'],
          displayTags: ['Programming'],
        },
      };

      const result = validateMetadataEvent(data);

      expect(result).toEqual({
        title: 'Test Video',
        channel: 'Test Channel',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        duration: 3600,
        context: {
          category: 'coding',
          youtubeCategory: 'Education',
          tags: ['programming'],
          displayTags: ['Programming'],
        },
      });
    });

    it('should handle partial metadata', () => {
      const data = {
        event: 'metadata',
        title: 'Just Title',
      };

      const result = validateMetadataEvent(data);

      expect(result).toEqual({
        title: 'Just Title',
        channel: undefined,
        thumbnailUrl: undefined,
        duration: undefined,
        context: undefined,
      });
    });

    it('should return empty object for invalid event', () => {
      const result = validateMetadataEvent({ event: 'wrong' });

      expect(result).toEqual({});
    });

    it('should return empty object for invalid context category', () => {
      const data = {
        event: 'metadata',
        title: 'Test',
        context: {
          // Missing required 'category' field
          youtubeCategory: 'Education',
          tags: [],
          displayTags: [],
        },
      };

      const result = validateMetadataEvent(data);

      expect(result).toEqual({});
    });
  });

  // ─────────────────────────────────────────────────────
  // validateSynthesisComplete Tests
  // ─────────────────────────────────────────────────────

  describe('validateSynthesisComplete', () => {
    it('should validate complete synthesis event', () => {
      const data = {
        event: 'synthesis_complete',
        tldr: 'This is the summary',
        keyTakeaways: ['Point 1', 'Point 2', 'Point 3'],
      };

      const result = validateSynthesisComplete(data);

      expect(result).toEqual({
        tldr: 'This is the summary',
        keyTakeaways: ['Point 1', 'Point 2', 'Point 3'],
      });
    });

    it('should use defaults for missing fields', () => {
      const data = { event: 'synthesis_complete' };

      const result = validateSynthesisComplete(data);

      expect(result).toEqual({
        tldr: '',
        keyTakeaways: [],
      });
    });

    it('should return defaults for invalid event', () => {
      const result = validateSynthesisComplete({ event: 'wrong' });

      expect(result).toEqual({ tldr: '', keyTakeaways: [] });
    });
  });

  // ─────────────────────────────────────────────────────
  // validateDoneEvent Tests
  // ─────────────────────────────────────────────────────

  describe('validateDoneEvent', () => {
    it('should validate done event with processing time', () => {
      const data = { event: 'done', processingTimeMs: 5000 };

      const result = validateDoneEvent(data);

      expect(result).toBe(5000);
    });

    it('should return null when processingTimeMs is null', () => {
      const data = { event: 'done', processingTimeMs: null };

      const result = validateDoneEvent(data);

      expect(result).toBeNull();
    });

    it('should return null when processingTimeMs is undefined', () => {
      const data = { event: 'done' };

      const result = validateDoneEvent(data);

      expect(result).toBeNull();
    });

    it('should return null for invalid event', () => {
      const result = validateDoneEvent({ event: 'wrong' });

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────
  // validateErrorEvent Tests
  // ─────────────────────────────────────────────────────

  describe('validateErrorEvent', () => {
    it('should validate error event with message and code', () => {
      const data = {
        event: 'error',
        message: 'Something went wrong',
        code: 'ERR_001',
      };

      const result = validateErrorEvent(data);

      expect(result).toEqual({
        message: 'Something went wrong',
        code: 'ERR_001',
      });
    });

    it('should use default message when missing', () => {
      const data = { event: 'error' };

      const result = validateErrorEvent(data);

      expect(result).toEqual({
        message: 'Unknown error',
        code: undefined,
      });
    });

    it('should return default for invalid event', () => {
      const result = validateErrorEvent({ event: 'wrong' });

      expect(result).toEqual({ message: 'Unknown error' });
    });
  });

  // ─────────────────────────────────────────────────────
  // validateChaptersEvent Tests
  // ─────────────────────────────────────────────────────

  describe('validateChaptersEvent', () => {
    it('should validate chapters event', () => {
      const data = {
        event: 'chapters',
        chapters: [
          { startSeconds: 0, endSeconds: 60, title: 'Intro' },
          { startSeconds: 60, endSeconds: 120, title: 'Main' },
        ],
        isCreatorChapters: true,
      };

      const result = validateChaptersEvent(data);

      expect(result.chapters).toHaveLength(2);
      expect(result.isCreatorChapters).toBe(true);
    });

    it('should default isCreatorChapters to false', () => {
      const data = {
        event: 'chapters',
        chapters: [],
      };

      const result = validateChaptersEvent(data);

      expect(result.isCreatorChapters).toBe(false);
    });

    it('should return defaults for invalid event', () => {
      const result = validateChaptersEvent({ event: 'wrong' });

      expect(result).toEqual({ chapters: [], isCreatorChapters: false });
    });
  });

  // ─────────────────────────────────────────────────────
  // validatePhaseEvent Tests
  // ─────────────────────────────────────────────────────

  describe('validatePhaseEvent', () => {
    it('should validate all valid phases', () => {
      const validPhases = [
        'metadata',
        'transcript',
        'parallel_analysis',
        'chapter_detect',
        'chapter_summaries',
        'concepts',
        'master_summary',
      ];

      for (const phase of validPhases) {
        const result = validatePhaseEvent({ event: 'phase', phase });
        expect(result).toBe(phase);
      }
    });

    it('should return null for invalid phase', () => {
      const result = validatePhaseEvent({ event: 'phase', phase: 'invalid_phase' });

      expect(result).toBeNull();
    });

    it('should return null for missing phase', () => {
      const result = validatePhaseEvent({ event: 'phase' });

      expect(result).toBeNull();
    });

    it('should return null for wrong event type', () => {
      const result = validatePhaseEvent({ event: 'wrong', phase: 'metadata' });

      expect(result).toBeNull();
    });
  });
});
