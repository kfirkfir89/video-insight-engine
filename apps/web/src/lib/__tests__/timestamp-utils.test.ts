import { describe, it, expect } from 'vitest';
import { parseTimestamp, matchConceptsToChapters } from '../timestamp-utils';
import type { SummaryChapter, Concept } from '@vie/types';

// ─────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────

const createChapter = (
  id: string,
  startSeconds: number,
  endSeconds: number
): SummaryChapter => ({
  id,
  timestamp: `${Math.floor(startSeconds / 60)}:${String(startSeconds % 60).padStart(2, '0')}`,
  startSeconds,
  endSeconds,
  title: `Chapter ${id}`,
  isCreatorChapter: true,
  summary: 'Test summary',
  bullets: ['Bullet 1'],
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
  });
});
