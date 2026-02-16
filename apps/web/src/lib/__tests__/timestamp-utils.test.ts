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

    it('should orphan concepts without timestamp when name not found in content', () => {
      const chapters: SummaryChapter[] = [createChapter('s1', 0, 60)];
      const concepts: Concept[] = [
        createConcept('c1', 'No Timestamp', null),
        createConcept('c2', 'With Timestamp', '0:30'),
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // 'No Timestamp' doesn't appear in default chapter content ('Test summary')
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

    it('should assign concept to first content-match chapter (content takes priority over timestamp)', () => {
      // Concept timestamp puts it in s3, but name appears in s1 content
      // Content wins — concept assigned to s1
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

      // s1 via content match — timestamp in s3 is ignored
      expect(result.byChapter.get('s1')).toHaveLength(1);
      expect(result.byChapter.get('s1')![0].name).toBe('Light and Airy');
      expect(result.byChapter.get('s2')).toHaveLength(0);
      expect(result.byChapter.get('s3')).toHaveLength(0);
    });

    it('should assign concept to first content-match chapter even when content matches multiple chapters', () => {
      // Content mentions Fermentation in s1 and s2
      // First content match is s1 — assigned there regardless of timestamp
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

      // s1 via first content match — s2 content match does not duplicate
      expect(result.byChapter.get('s1')).toHaveLength(1);
      expect(result.byChapter.get('s2')).toHaveLength(0);
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
        createConcept('c1', 'Dutch Oven', '5:00'), // timestamp outside s1, but content matches
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // Matched via content (case-insensitive), timestamp not needed
      expect(result.byChapter.get('s1')).toHaveLength(1);
    });

    it('should fall back to timestamp when chapter has empty content', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, []),  // empty content
        createChapter('s2', 60, 120),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Some Concept', '0:30'), // 30s in s1, no content to match — timestamp fallback
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // No content match anywhere, falls back to timestamp in s1
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
        createConcept('c1', 'Sourdough Starter', '5:00'), // timestamp outside s1, content matches
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // Found via content in step block
      expect(result.byChapter.get('s1')).toHaveLength(1);
    });

    // ─────────────────────────────────────────────────────
    // Deduplication tests (single-assignment semantics)
    // ─────────────────────────────────────────────────────

    it('should assign concept without timestamp to first content-match chapter only', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Learn about Gluten Development here' },
        ]),
        createChapter('s2', 60, 120, [
          { blockId: 'b2', type: 'paragraph', text: 'More on Gluten Development techniques' },
        ]),
        createChapter('s3', 120, 180, [
          { blockId: 'b3', type: 'paragraph', text: 'Final Gluten Development tips' },
        ]),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Gluten Development', null), // no timestamp
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // Assigned to s1 (first content match) only
      expect(result.byChapter.get('s1')).toHaveLength(1);
      expect(result.byChapter.get('s1')![0].name).toBe('Gluten Development');
      expect(result.byChapter.get('s2')).toHaveLength(0);
      expect(result.byChapter.get('s3')).toHaveLength(0);
    });

    it('should assign concept mentioned in 3 chapters to first content-match chapter', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Intro to Maillard Reaction in cooking' },
        ]),
        createChapter('s2', 60, 120, [
          { blockId: 'b2', type: 'paragraph', text: 'The Maillard Reaction explained in depth' },
        ]),
        createChapter('s3', 120, 180, [
          { blockId: 'b3', type: 'paragraph', text: 'Advanced Maillard Reaction applications' },
        ]),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Maillard Reaction', '1:30'), // 90s falls in s2
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // Content assigns to s1 (first match) — timestamp in s2 is ignored
      expect(result.byChapter.get('s1')).toHaveLength(1);
      expect(result.byChapter.get('s1')![0].name).toBe('Maillard Reaction');
      expect(result.byChapter.get('s2')).toHaveLength(0);
      expect(result.byChapter.get('s3')).toHaveLength(0);
    });

    it('should fall back to first content match when timestamp is out of range', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Standard chapter content' },
        ]),
        createChapter('s2', 60, 120, [
          { blockId: 'b2', type: 'paragraph', text: 'Chapter about Proofing dough correctly' },
        ]),
        createChapter('s3', 120, 180, [
          { blockId: 'b3', type: 'paragraph', text: 'More on Proofing techniques' },
        ]),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Proofing', '5:00'), // 300s — outside all chapters
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // Timestamp out of range, falls back to first content match (s2)
      expect(result.byChapter.get('s1')).toHaveLength(0);
      expect(result.byChapter.get('s2')).toHaveLength(1);
      expect(result.byChapter.get('s2')![0].name).toBe('Proofing');
      expect(result.byChapter.get('s3')).toHaveLength(0);
    });

    it('should orphan concept with no timestamp and no content match', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Bread baking basics' },
        ]),
        createChapter('s2', 60, 120, [
          { blockId: 'b2', type: 'paragraph', text: 'Advanced techniques' },
        ]),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Lamination', null), // no timestamp, name not in any content
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(0);
      expect(result.byChapter.get('s2')).toHaveLength(0);
      expect(result.orphaned).toHaveLength(1);
      expect(result.orphaned[0].name).toBe('Lamination');
    });

    // ─────────────────────────────────────────────────────
    // Content-position ordering tests
    // ─────────────────────────────────────────────────────

    it('should order multiple concepts within a chapter by content position', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 300, [
          { blockId: 'b1', type: 'paragraph', text: 'First we discuss Dopamine pathways, then Growth Mindset research, and finally Neuroplasticity mechanisms' },
        ]),
      ];
      // Concepts intentionally in reverse order of content appearance
      const concepts: Concept[] = [
        createConcept('c1', 'Neuroplasticity', '0:30'),
        createConcept('c2', 'Dopamine', '1:00'),
        createConcept('c3', 'Growth Mindset', '2:00'),
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      const assigned = result.byChapter.get('s1')!;
      expect(assigned).toHaveLength(3);
      // Sorted by content position: Dopamine (pos ~22), Growth Mindset (pos ~48), Neuroplasticity (pos ~82)
      expect(assigned[0].name).toBe('Dopamine');
      expect(assigned[1].name).toBe('Growth Mindset');
      expect(assigned[2].name).toBe('Neuroplasticity');
    });

    it('should assign concept with content in ch2 and no timestamp to ch2', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'General introduction' },
        ]),
        createChapter('s2', 60, 120, [
          { blockId: 'b2', type: 'paragraph', text: 'Deep dive into Interoception and body awareness' },
        ]),
        createChapter('s3', 120, 180, [
          { blockId: 'b3', type: 'paragraph', text: 'More about Interoception techniques' },
        ]),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Interoception', null), // no timestamp
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // First content match is s2
      expect(result.byChapter.get('s1')).toHaveLength(0);
      expect(result.byChapter.get('s2')).toHaveLength(1);
      expect(result.byChapter.get('s2')![0].name).toBe('Interoception');
      expect(result.byChapter.get('s3')).toHaveLength(0);
    });

    it('should use timestamp fallback when no content match exists', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Introduction overview' },
        ]),
        createChapter('s2', 60, 120, [
          { blockId: 'b2', type: 'paragraph', text: 'Main discussion topics' },
        ]),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Unique Concept', '1:15'), // 75s in s2, not in any content
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // No content match, falls back to timestamp → s2
      expect(result.byChapter.get('s1')).toHaveLength(0);
      expect(result.byChapter.get('s2')).toHaveLength(1);
      expect(result.byChapter.get('s2')![0].name).toBe('Unique Concept');
    });

    it('should place timestamp-fallback concepts after content-matched concepts', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 300, [
          { blockId: 'b1', type: 'paragraph', text: 'Discussing Alpha Waves and Beta Waves in the brain' },
        ]),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Gamma Waves', '0:30'),  // timestamp in s1, NOT in content
        createConcept('c2', 'Beta Waves', '1:00'),    // timestamp in s1, also in content
        createConcept('c3', 'Alpha Waves', '2:00'),   // timestamp in s1, also in content
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      const assigned = result.byChapter.get('s1')!;
      expect(assigned).toHaveLength(3);
      // Content-matched concepts sorted by position: Alpha Waves, Beta Waves
      // Timestamp-only concept (Gamma Waves) has Infinity offset, goes last
      expect(assigned[0].name).toBe('Alpha Waves');
      expect(assigned[1].name).toBe('Beta Waves');
      expect(assigned[2].name).toBe('Gamma Waves');
    });
  });

  // ─────────────────────────────────────────────────────
  // Parenthetical concept matching integration tests
  // (variant generation itself is tested in concept-utils.test.ts)
  // ─────────────────────────────────────────────────────

  describe('matchConceptsToChapters — parenthetical concept names', () => {
    it('should match concept with parenthetical name via base name in chapter content', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Introduction to concepts' },
        ]),
        createChapter('s2', 60, 120, [
          { blockId: 'b2', type: 'paragraph', text: 'In this section we examine DPO analysis and its applications' },
        ]),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'DPO analysis (Duration, Path, Outcome)', '0:30'), // timestamp in s1, content match via base name in s2
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // Should match s2 via "dpo analysis" base name (not s1 via timestamp)
      expect(result.byChapter.get('s1')).toHaveLength(0);
      expect(result.byChapter.get('s2')).toHaveLength(1);
      expect(result.byChapter.get('s2')![0].name).toBe('DPO analysis (Duration, Path, Outcome)');
    });

    it('should match concept with short abbreviation in chapter content', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Basic SEO techniques for better rankings' },
        ]),
        createChapter('s2', 60, 120, [
          { blockId: 'b2', type: 'paragraph', text: 'Advanced web development' },
        ]),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Search Engine Optimization (SEO)', '1:15'), // timestamp in s2, abbreviation match in s1
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // Should match s1 via "seo" abbreviation
      expect(result.byChapter.get('s1')).toHaveLength(1);
      expect(result.byChapter.get('s2')).toHaveLength(0);
    });

    it('should prefer full name match over base name or abbreviation', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Overview of Search Engine Optimization (SEO) principles' },
        ]),
        createChapter('s2', 60, 120, [
          { blockId: 'b2', type: 'paragraph', text: 'Apply SEO to your site' },
        ]),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Search Engine Optimization (SEO)', '1:15'),
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // Full name matches s1 first
      expect(result.byChapter.get('s1')).toHaveLength(1);
      expect(result.byChapter.get('s2')).toHaveLength(0);
    });

    it('should still work for concepts without parentheses (no regression)', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Understanding Neuroplasticity in the brain' },
        ]),
        createChapter('s2', 60, 120),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Neuroplasticity', '1:15'), // timestamp in s2, content in s1
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(1);
      expect(result.byChapter.get('s2')).toHaveLength(0);
    });

    it('should fall back to timestamp when no needle variant matches any chapter', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Unrelated content here' },
        ]),
        createChapter('s2', 60, 120, [
          { blockId: 'b2', type: 'paragraph', text: 'More unrelated content' },
        ]),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'DPO analysis (Duration, Path, Outcome)', '1:15'), // 75s in s2, no content match
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // Falls back to timestamp → s2
      expect(result.byChapter.get('s1')).toHaveLength(0);
      expect(result.byChapter.get('s2')).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────
  // chapterIndex fast path tests
  // ─────────────────────────────────────────────────────

  describe('matchConceptsToChapters — chapterIndex fast path', () => {
    it('should assign concept to chapter via chapterIndex', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60),
        createChapter('s2', 60, 120, [
          { blockId: 'b1', type: 'paragraph', text: 'Understanding Neuroplasticity and brain adaptation' },
        ]),
        createChapter('s3', 120, 180),
      ];
      const concepts: Concept[] = [
        { ...createConcept('c1', 'Neuroplasticity', '2:30'), chapterIndex: 1 },
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // chapterIndex=1 maps to s2 (concept name appears in content), regardless of timestamp (2:30 = 150s would be in s3)
      expect(result.byChapter.get('s1')).toHaveLength(0);
      expect(result.byChapter.get('s2')).toHaveLength(1);
      expect(result.byChapter.get('s2')![0].name).toBe('Neuroplasticity');
      expect(result.byChapter.get('s3')).toHaveLength(0);
    });

    it('should fall back to content matching when chapterIndex is undefined', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Discussion of Dopamine pathways' },
        ]),
        createChapter('s2', 60, 120),
      ];
      const concepts: Concept[] = [
        createConcept('c1', 'Dopamine', '1:15'), // no chapterIndex, content matches s1
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(1);
      expect(result.byChapter.get('s2')).toHaveLength(0);
    });

    it('should fall back to content matching when chapterIndex is out of range', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Content about Serotonin levels' },
        ]),
      ];
      const concepts: Concept[] = [
        { ...createConcept('c1', 'Serotonin', '0:30'), chapterIndex: 99 }, // out of range
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // Falls back to content matching
      expect(result.byChapter.get('s1')).toHaveLength(1);
    });

    it('should compute contentOffset for ordering even with chapterIndex', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 300, [
          { blockId: 'b1', type: 'paragraph', text: 'First we cover Alpha Waves then Beta Waves and finally Gamma Waves' },
        ]),
      ];
      const concepts: Concept[] = [
        { ...createConcept('c1', 'Gamma Waves', '0:30'), chapterIndex: 0 },
        { ...createConcept('c2', 'Alpha Waves', '1:00'), chapterIndex: 0 },
        { ...createConcept('c3', 'Beta Waves', '2:00'), chapterIndex: 0 },
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      const assigned = result.byChapter.get('s1')!;
      expect(assigned).toHaveLength(3);
      // Sorted by content position within the chapter
      expect(assigned[0].name).toBe('Alpha Waves');
      expect(assigned[1].name).toBe('Beta Waves');
      expect(assigned[2].name).toBe('Gamma Waves');
    });

    it('should handle mix of chapterIndex and legacy concepts', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Intro about Dopamine receptors' },
        ]),
        createChapter('s2', 60, 120, [
          { blockId: 'b2', type: 'paragraph', text: 'Deep dive into Cortisol response' },
        ]),
      ];
      const concepts: Concept[] = [
        { ...createConcept('c1', 'Dopamine', null), chapterIndex: 0 },   // new: chapterIndex, name in content
        createConcept('c2', 'Cortisol', '1:15'),                          // legacy: content + timestamp
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      expect(result.byChapter.get('s1')).toHaveLength(1);
      expect(result.byChapter.get('s1')![0].name).toBe('Dopamine');
      expect(result.byChapter.get('s2')).toHaveLength(1);
      expect(result.byChapter.get('s2')![0].name).toBe('Cortisol');
    });

    it('should fall through to content search when concept not in assigned chapter', () => {
      const chapters: SummaryChapter[] = [
        createChapter('s1', 0, 60, [
          { blockId: 'b1', type: 'paragraph', text: 'Early mention of tokens and limits' },
        ]),
        createChapter('s2', 60, 120, [
          { blockId: 'b2', type: 'paragraph', text: 'Unrelated content here' },
        ]),
      ];
      const concepts: Concept[] = [
        { ...createConcept('c1', 'tokens', '1:00'), chapterIndex: 1 }, // assigned to s2 but "tokens" is in s1
      ];

      const result = matchConceptsToChapters(concepts, chapters);

      // Should fall through to content-based matching and land in s1
      expect(result.byChapter.get('s1')).toHaveLength(1);
      expect(result.byChapter.get('s1')![0].name).toBe('tokens');
      expect(result.byChapter.get('s2')).toHaveLength(0);
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
