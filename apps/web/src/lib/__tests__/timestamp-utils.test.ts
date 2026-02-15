import { describe, it, expect } from 'vitest';
import { parseTimestamp, matchConceptsToChapters, extractBlockText } from '../timestamp-utils';
import type { SummaryChapter, Concept, ContentBlock } from '@vie/types';

// ─────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────

const createChapter = (
  id: string,
  startSeconds: number,
  endSeconds: number,
  content?: ContentBlock[],
): SummaryChapter => ({
  id,
  timestamp: `${Math.floor(startSeconds / 60)}:${String(startSeconds % 60).padStart(2, '0')}`,
  startSeconds,
  endSeconds,
  title: `Chapter ${id}`,
  isCreatorChapter: true,
  content: content ?? [{ blockId: 'b1', type: 'paragraph', text: 'Test summary' }],
});

const createConcept = (
  id: string,
  name: string,
  timestamp: string | null = null
): Concept => ({
  id,
  name,
  definition: `Definition of ${name}`,
  timestamp,
});

// ─────────────────────────────────────────────────────
// parseTimestamp Tests
// ─────────────────────────────────────────────────────

describe('timestamp-utils', () => {
  describe('parseTimestamp', () => {
    describe('MM:SS format', () => {
      it('should parse simple minutes and seconds', () => {
        expect(parseTimestamp('2:05')).toBe(125);
      });

      it('should parse single digit minutes', () => {
        expect(parseTimestamp('5:30')).toBe(330);
      });

      it('should parse double digit minutes', () => {
        expect(parseTimestamp('12:45')).toBe(765);
      });

      it('should parse zero minutes', () => {
        expect(parseTimestamp('0:30')).toBe(30);
      });

      it('should parse zero seconds', () => {
        expect(parseTimestamp('5:00')).toBe(300);
      });

      it('should handle 0:00', () => {
        expect(parseTimestamp('0:00')).toBe(0);
      });
    });

    describe('HH:MM:SS format', () => {
      it('should parse hours, minutes, and seconds', () => {
        expect(parseTimestamp('1:01:05')).toBe(3665);
      });

      it('should parse single digit hours', () => {
        expect(parseTimestamp('2:30:15')).toBe(9015);
      });

      it('should parse zero hours component', () => {
        expect(parseTimestamp('0:45:00')).toBe(2700);
      });

      it('should parse large hour values', () => {
        expect(parseTimestamp('10:00:00')).toBe(36000);
      });

      it('should handle all zeros', () => {
        expect(parseTimestamp('0:00:00')).toBe(0);
      });
    });

    describe('edge cases and invalid inputs', () => {
      it('should return 0 for invalid format', () => {
        expect(parseTimestamp('invalid')).toBe(0);
      });

      it('should return 0 for empty string', () => {
        expect(parseTimestamp('')).toBe(0);
      });

      it('should return 0 for single number', () => {
        expect(parseTimestamp('123')).toBe(0);
      });

      it('should return 0 for non-numeric parts', () => {
        expect(parseTimestamp('a:b:c')).toBe(0);
      });

      it('should return 0 for partial non-numeric', () => {
        expect(parseTimestamp('5:ab')).toBe(0);
      });

      it('should return 0 for too many colons', () => {
        expect(parseTimestamp('1:2:3:4')).toBe(0);
      });
    });
  });

  // ─────────────────────────────────────────────────────
  // matchConceptsToChapters Tests
  // ─────────────────────────────────────────────────────

  describe('matchConceptsToChapters', () => {
    it('should return all concepts as orphaned when no chapters exist', () => {
      const concepts: Concept[] = [
        createConcept('1', 'Concept A', '1:00'),
        createConcept('2', 'Concept B', '2:00'),
      ];

      const result = matchConceptsToChapters(concepts, []);

      expect(result.byChapter.size).toBe(0);
      expect(result.orphaned).toHaveLength(2);
    });

    it('should return empty result for no concepts', () => {
      const chapters: SummaryChapter[] = [createChapter('s1', 0, 60)];

      const result = matchConceptsToChapters([], chapters);

      expect(result.byChapter.get('s1')).toEqual([]);
      expect(result.orphaned).toHaveLength(0);
    });

    it('should match concept to chapter by timestamp range', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60),
        createChapter('s2', 60, 120),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Concept A', '0:30'), // 30 seconds - in s1
        createConcept('c2', 'Concept B', '1:15'), // 75 seconds - in s2
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(1);
      expect(result.byChapter.get('s1')![0].name).toBe('Concept A');
      expect(result.byChapter.get('s2')).toHaveLength(1);
      expect(result.byChapter.get('s2')![0].name).toBe('Concept B');
      expect(result.orphaned).toHaveLength(0);
    });

    it('should handle concept at exact chapter start', () => {
      const chapters: SummaryChapter[] = [createChapter('s1', 60, 120)];
      const concepts: Concept[] = [createConcept('c1', 'At Start', '1:00')]; // Exactly 60 seconds

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(1);
    });

    it('should NOT match concept at exact chapter end (exclusive end)', () => {
      const chapters: SummaryChapter[] = [createChapter('s1', 0, 60)];
      const concepts: Concept[] = [createConcept('c1', 'At End', '1:00')]; // Exactly 60 seconds

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(0);
      expect(result.orphaned).toHaveLength(1);
    });

    it('should treat concepts without timestamp as orphaned', () => {
      const chapters: SummaryChapter[] = [createChapter('s1', 0, 60)];
      const concepts: Concept[] = [
        createConcept('c1', 'No Timestamp', null),
        createConcept('c2', 'With Timestamp', '0:30'),
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(1);
      expect(result.orphaned).toHaveLength(1);
      expect(result.orphaned[0].name).toBe('No Timestamp');
    });

    it('should treat concepts with invalid timestamp as orphaned', () => {
      const chapters: SummaryChapter[] = [createChapter('s1', 0, 60)];
      const concepts: Concept[] = [createConcept('c1', 'Invalid', 'invalid')];

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(0);
      expect(result.orphaned).toHaveLength(1);
    });

    it('should handle special case of 0:00 timestamp correctly', () => {
      const chapters: SummaryChapter[] = [createChapter('s1', 0, 60)];
      const concepts: Concept[] = [createConcept('c1', 'At Zero', '0:00')];

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(1);
      expect(result.orphaned).toHaveLength(0);
    });

    it('should normalize chapters with missing endSeconds', () => {
      // endSeconds=0 should be calculated from next chapter
      const chapters: SummaryChapter[] = [
        { ...createChapter('s1', 0, 0), endSeconds: 0 },
        { ...createChapter('s2', 60, 0), endSeconds: 0 },
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'In S1', '0:30'), // Should match s1 (0-60)
        createConcept('c2', 'In S2', '1:30'), // Should match s2 (60-Infinity)
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(1);
      expect(result.byChapter.get('s1')![0].name).toBe('In S1');
      expect(result.byChapter.get('s2')).toHaveLength(1);
      expect(result.byChapter.get('s2')![0].name).toBe('In S2');
    });

    it('should orphan concepts that fall outside all chapters', () => {
      const chapters: SummaryChapter[] = [createChapter('s1', 60, 120)];
      const concepts: Concept[] = [
        createConcept('c1', 'Before', '0:30'), // 30 seconds - before s1
        createConcept('c2', 'After', '3:00'), // 180 seconds - after s1
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(0);
      expect(result.orphaned).toHaveLength(2);
    });

    it('should initialize all chapters with empty arrays', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60),
        createChapter('s2', 60, 120),
        createChapter('s3', 120, 180),
      ];
      const concepts: Concept[] = [createConcept('c1', 'Only in S2', '1:30')];

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.has('s1')).toBe(true);
      expect(result.byChapter.has('s2')).toBe(true);
      expect(result.byChapter.has('s3')).toBe(true);
      expect(result.byChapter.get('s1')).toEqual([]);
      expect(result.byChapter.get('s2')).toHaveLength(1);
      expect(result.byChapter.get('s3')).toEqual([]);
    });

    it('should match multiple concepts to the same chapter', () => {
      const chapters: SummaryChapter[] = [createChapter('s1', 0, 300)];
      const concepts: Concept[] = [
        createConcept('c1', 'First', '0:30'),
        createConcept('c2', 'Second', '1:00'),
        createConcept('c3', 'Third', '2:30'),
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(3);
    });

    it('should preserve original chapter order in byChapter map', () => {
      // Chapters intentionally out of time order
      const chapters: SummaryChapter[] = [
        createChapter('s2', 60, 120),
        createChapter('s1', 0, 60),
        createChapter('s3', 120, 180),
      ];
      const concepts: Concept[] = [];

      const result = matchConceptsToChapters(concepts, chapters);

      const keys = Array.from(result.byChapter.keys());
      // Should preserve original order (s2, s1, s3)
      expect(keys).toEqual(['s2', 's1', 's3']);
    });

    // ─────────────────────────────────────────────────────
    // Content-based matching tests
    // ─────────────────────────────────────────────────────

    it('should match concept to chapter via content AND via timestamp (both signals)', () => {
      // Concept timestamp puts it in s3, but the name appears in s1 content
      // Both signals fire — concept shows in both chapters
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Tips for a Light and Airy crumb structure' },
        ]),
        createChapter('s2', 60, 120),
        createChapter('s3', 120, 180),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Light and Airy', '2:30'), // 150s falls in s3
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // s1 via content match, s3 via timestamp match
      expect(result.byChapter.get('s1')).toHaveLength(1);
      expect(result.byChapter.get('s1')![0].name).toBe('Light and Airy');
      expect(result.byChapter.get('s3')).toHaveLength(1);
      expect(result.byChapter.get('s3')![0].name).toBe('Light and Airy');
      expect(result.byChapter.get('s2')).toHaveLength(0);
    });

    it('should match concept to multiple chapters via content without duplicating from timestamp', () => {
      // Content mentions Fermentation in s1 and s2
      // Timestamp 0:30 also falls in s1
      // s1 should have concept once (no duplicate), s2 from content
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Introduction to Fermentation process' },
        ]),
        createChapter('s2', 60, 120, [
          { blockId: 'b2', type: 'paragraph', text: 'Advanced Fermentation techniques' },
        ]),
        createChapter('s3', 120, 180),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Fermentation', '0:30'), // 30s in s1
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // s1: content match + timestamp match = 1 (deduplicated)
      expect(result.byChapter.get('s1')).toHaveLength(1);
      // s2: content match only
      expect(result.byChapter.get('s2')).toHaveLength(1);
      expect(result.byChapter.get('s3')).toHaveLength(0);
    });

    it('should fall back to timestamp when concept name not found in any content', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60),
        createChapter('s2', 60, 120),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Unique Term', '1:15'), // 75s in s2, name not in any content
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(0);
      expect(result.byChapter.get('s2')).toHaveLength(1);
    });

    it('should handle content-based matching case-insensitively', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Use DUTCH OVEN for best results' },
        ]),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Dutch Oven', '5:00'), // timestamp outside s1
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(1);
    });

    it('should handle chapters with empty content gracefully (timestamp still works)', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, []),  // empty content
        createChapter('s2', 60, 120),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Some Concept', '0:30'), // 30s in s1, no content to match but timestamp works
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // Matched via timestamp signal
      expect(result.byChapter.get('s1')).toHaveLength(1);
    });

    it('should search step blocks for concept names', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          {
            blockId: 'b1',
            type: 'step',
            steps: [
              { number: 1, instruction: 'Mix the Sourdough Starter with flour' },
            ],
          } as ContentBlock,
        ]),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Sourdough Starter', '5:00'),
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────
  // extractBlockText Tests
  // ─────────────────────────────────────────────────────

  describe('extractBlockText', () => {
    it('should extract text from paragraph blocks', () => {
      const block: ContentBlock = { blockId: 'b1', type: 'paragraph', text: 'Hello world' };
      expect(extractBlockText(block)).toBe('Hello world');
    });

    it('should extract text from definition blocks', () => {
      const block: ContentBlock = {
        blockId: 'b1', type: 'definition', term: 'API', meaning: 'Application Programming Interface',
      };
      expect(extractBlockText(block)).toContain('API');
      expect(extractBlockText(block)).toContain('Application Programming Interface');
    });

    it('should extract text from step blocks', () => {
      const block = {
        blockId: 'b1',
        type: 'step',
        steps: [
          { number: 1, instruction: 'Preheat oven', tips: 'Use convection mode' },
          { number: 2, instruction: 'Mix ingredients' },
        ],
      } as ContentBlock;
      const text = extractBlockText(block);
      expect(text).toContain('Preheat oven');
      expect(text).toContain('Use convection mode');
      expect(text).toContain('Mix ingredients');
    });

    it('should extract text from bullet items', () => {
      const block: ContentBlock = {
        blockId: 'b1', type: 'bullets', items: ['First item', 'Second item'],
      };
      const text = extractBlockText(block);
      expect(text).toContain('First item');
      expect(text).toContain('Second item');
    });

    it('should return empty string for blocks with no text fields', () => {
      const block = { blockId: 'b1', type: 'code', language: 'js', code: 'x = 1' } as ContentBlock;
      expect(extractBlockText(block)).toBe('');
    });
  });
});
