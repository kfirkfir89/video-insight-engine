import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Dispatch, SetStateAction } from 'react';
import { processEvent } from '@/lib/stream-event-processor';
import type { StreamState } from '@/hooks/use-summary-stream';

// Mock validators used by the processor
vi.mock('@/lib/sse-validators', () => ({
  validateMetadataEvent: vi.fn((event: Record<string, unknown>) => ({
    title: event.title,
    channel: event.channel,
    thumbnailUrl: event.thumbnailUrl,
    duration: event.duration,
  })),
  validateSynthesisComplete: vi.fn((event: Record<string, unknown>) => ({
    tldr: typeof event.tldr === 'string' ? event.tldr : '',
    keyTakeaways: Array.isArray(event.keyTakeaways) ? event.keyTakeaways : [],
  })),
  validateDoneEvent: vi.fn((event: Record<string, unknown>) => event.processingTimeMs ?? null),
  validateErrorEvent: vi.fn((event: Record<string, unknown>) => ({
    message: event.message ?? 'Unknown error',
    code: event.code,
  })),
  validatePhaseEvent: vi.fn((event: Record<string, unknown>) => event.phase ?? null),
}));

vi.mock('@/lib/stream-error-messages', () => ({
  getUserFriendlyError: vi.fn((msg: string) => msg),
}));

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

const initialState: StreamState = {
  phase: 'idle',
  metadata: null,
  duration: null,
  error: null,
  isCached: false,
  processingTimeMs: null,
  warnings: [],
  confettiCount: 0,
  intent: null,
  extractionProgress: null,
  output: null,
  enrichment: null,
  synthesis: null,
};

/**
 * Creates a mock setState that captures the updater function and applies it
 * to the initial state, returning the resulting state.
 */
function createMockSetState() {
  let capturedState = { ...initialState };
  const setState: Dispatch<SetStateAction<StreamState>> = (action) => {
    if (typeof action === 'function') {
      capturedState = action(capturedState);
    } else {
      capturedState = action;
    }
  };
  return {
    setState,
    getState: () => capturedState,
  };
}

describe('stream-event-processor — Pipeline events', () => {
  let mockSetState: ReturnType<typeof createMockSetState>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetState = createMockSetState();
  });

  // ─────────────────────────────────────────────────────
  // intent_detected
  // ─────────────────────────────────────────────────────

  describe('intent_detected', () => {
    it('should update intent and set phase to "extraction"', () => {
      const event = {
        event: 'intent_detected',
        outputType: 'recipe',
        confidence: 0.95,
        userGoal: 'Learn to cook pasta',
        sections: [
          { id: 'ingredients', label: 'Ingredients', emoji: '🧅', description: 'List of ingredients' },
          { id: 'steps', label: 'Steps', emoji: '👨‍🍳', description: 'Cooking steps' },
        ],
      };

      processEvent(event, mockSetState.setState);

      const state = mockSetState.getState();
      expect(state.phase).toBe('extraction');
      expect(state.intent).toEqual({
        outputType: 'recipe',
        confidence: 0.95,
        userGoal: 'Learn to cook pasta',
        sections: [
          { id: 'ingredients', label: 'Ingredients', emoji: '🧅', description: 'List of ingredients' },
          { id: 'steps', label: 'Steps', emoji: '👨‍🍳', description: 'Cooking steps' },
        ],
      });
    });

    it('should default outputType to "explanation" when missing', () => {
      processEvent(
        { event: 'intent_detected', confidence: 0.5 },
        mockSetState.setState,
      );
      expect(mockSetState.getState().intent?.outputType).toBe('explanation');
    });

    it('should default confidence to 0 when missing', () => {
      processEvent(
        { event: 'intent_detected', outputType: 'study_kit' },
        mockSetState.setState,
      );
      expect(mockSetState.getState().intent?.confidence).toBe(0);
    });

    it('should default userGoal to empty string when missing', () => {
      processEvent(
        { event: 'intent_detected', outputType: 'code_walkthrough', confidence: 0.8 },
        mockSetState.setState,
      );
      expect(mockSetState.getState().intent?.userGoal).toBe('');
    });

    it('should default sections to empty array when missing', () => {
      processEvent(
        { event: 'intent_detected', outputType: 'verdict', confidence: 0.9, userGoal: 'Review the product' },
        mockSetState.setState,
      );
      expect(mockSetState.getState().intent?.sections).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────
  // extraction_progress
  // ─────────────────────────────────────────────────────

  describe('extraction_progress', () => {
    it('should update extractionProgress with section and percent', () => {
      processEvent(
        { event: 'extraction_progress', section: 'ingredients', percent: 45 },
        mockSetState.setState,
      );

      const state = mockSetState.getState();
      expect(state.phase).toBe('extraction');
      expect(state.extractionProgress).toEqual({ section: 'ingredients', percent: 45 });
    });

    it('should default section to empty string when missing', () => {
      processEvent(
        { event: 'extraction_progress', percent: 75 },
        mockSetState.setState,
      );
      expect(mockSetState.getState().extractionProgress?.section).toBe('');
    });

    it('should default percent to 0 when missing', () => {
      processEvent(
        { event: 'extraction_progress', section: 'steps' },
        mockSetState.setState,
      );
      expect(mockSetState.getState().extractionProgress?.percent).toBe(0);
    });

    it('should overwrite previous extraction progress', () => {
      processEvent(
        { event: 'extraction_progress', section: 'intro', percent: 20 },
        mockSetState.setState,
      );
      processEvent(
        { event: 'extraction_progress', section: 'main', percent: 80 },
        mockSetState.setState,
      );

      expect(mockSetState.getState().extractionProgress).toEqual({ section: 'main', percent: 80 });
    });
  });

  // ─────────────────────────────────────────────────────
  // extraction_complete
  // ─────────────────────────────────────────────────────

  describe('extraction_complete', () => {
    it('should update output with type and data', () => {
      const mockData = {
        keyPoints: [{ emoji: '1', title: 'Point 1', detail: 'Detail 1' }],
        concepts: [],
        takeaways: ['Takeaway 1'],
        timestamps: [],
      };

      processEvent(
        { event: 'extraction_complete', outputType: 'explanation', data: mockData },
        mockSetState.setState,
      );

      expect(mockSetState.getState().output).toEqual({ type: 'explanation', data: mockData });
    });

    it('should default outputType to "explanation" when missing', () => {
      processEvent(
        { event: 'extraction_complete', data: { keyPoints: [], concepts: [], takeaways: [], timestamps: [] } },
        mockSetState.setState,
      );
      expect(mockSetState.getState().output?.type).toBe('explanation');
    });

    it('should handle recipe output type', () => {
      const recipeData = {
        meta: { prepTime: 15, cookTime: 30, servings: 4 },
        ingredients: [{ name: 'Pasta', amount: '500', unit: 'g' }],
        steps: [{ number: 1, instruction: 'Boil water' }],
        tips: [],
        substitutions: [],
        nutrition: [],
        equipment: ['Pot'],
      };

      processEvent(
        { event: 'extraction_complete', outputType: 'recipe', data: recipeData },
        mockSetState.setState,
      );

      expect(mockSetState.getState().output).toEqual({ type: 'recipe', data: recipeData });
    });
  });

  // ─────────────────────────────────────────────────────
  // enrichment_complete
  // ─────────────────────────────────────────────────────

  describe('enrichment_complete', () => {
    it('should update enrichment with quiz data', () => {
      const quiz = [
        { question: 'What is React?', options: ['Library', 'Framework', 'Language', 'Database'], correctIndex: 0, explanation: 'React is a JavaScript library' },
      ];

      processEvent({ event: 'enrichment_complete', quiz }, mockSetState.setState);
      expect(mockSetState.getState().enrichment).toEqual({ quiz });
    });

    it('should update enrichment with flashcards data', () => {
      const flashcards = [{ front: 'What is JSX?', back: 'A syntax extension for JavaScript' }];

      processEvent({ event: 'enrichment_complete', flashcards }, mockSetState.setState);
      expect(mockSetState.getState().enrichment).toEqual({ flashcards });
    });

    it('should update enrichment with cheatSheet data', () => {
      const cheatSheet = [{ title: 'useState', code: 'const [x, setX] = useState(0)', description: 'State hook' }];

      processEvent({ event: 'enrichment_complete', cheatSheet }, mockSetState.setState);
      expect(mockSetState.getState().enrichment).toEqual({ cheatSheet });
    });

    it('should handle all enrichment fields together', () => {
      const quiz = [{ question: 'Q?', options: ['A', 'B'], correctIndex: 0, explanation: 'E' }];
      const flashcards = [{ front: 'F', back: 'B' }];
      const cheatSheet = [{ title: 'T', code: 'C', description: 'D' }];

      processEvent({ event: 'enrichment_complete', quiz, flashcards, cheatSheet }, mockSetState.setState);
      expect(mockSetState.getState().enrichment).toEqual({ quiz, flashcards, cheatSheet });
    });

    it('should produce empty enrichment when no arrays are provided', () => {
      processEvent({ event: 'enrichment_complete' }, mockSetState.setState);
      expect(mockSetState.getState().enrichment).toEqual({});
    });

    it('should ignore non-array quiz field', () => {
      processEvent(
        { event: 'enrichment_complete', quiz: 'not an array', flashcards: [{ front: 'A', back: 'B' }] },
        mockSetState.setState,
      );

      const state = mockSetState.getState();
      expect(state.enrichment?.quiz).toBeUndefined();
      expect(state.enrichment?.flashcards).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────
  // synthesis_complete
  // ─────────────────────────────────────────────────────

  describe('synthesis_complete', () => {
    it('should update synthesis with all fields', () => {
      processEvent(
        {
          event: 'synthesis_complete',
          tldr: 'Quick summary of the video',
          keyTakeaways: ['Point 1', 'Point 2'],
          masterSummary: 'A comprehensive overview of the content...',
          seoDescription: 'SEO-optimized description for search engines',
        },
        mockSetState.setState,
      );

      expect(mockSetState.getState().synthesis).toEqual({
        tldr: 'Quick summary of the video',
        keyTakeaways: ['Point 1', 'Point 2'],
        masterSummary: 'A comprehensive overview of the content...',
        seoDescription: 'SEO-optimized description for search engines',
      });
    });

    it('should default masterSummary to empty string when missing', () => {
      processEvent(
        { event: 'synthesis_complete', tldr: 'Short', keyTakeaways: [] },
        mockSetState.setState,
      );

      expect(mockSetState.getState().synthesis?.masterSummary).toBe('');
    });

    it('should default seoDescription to empty string when missing', () => {
      processEvent(
        { event: 'synthesis_complete', tldr: 'Short', keyTakeaways: [], masterSummary: 'Full' },
        mockSetState.setState,
      );

      expect(mockSetState.getState().synthesis?.seoDescription).toBe('');
    });
  });

  // ─────────────────────────────────────────────────────
  // done
  // ─────────────────────────────────────────────────────

  describe('done', () => {
    it('should set phase to done and increment confettiCount', () => {
      processEvent(
        { event: 'done', processingTimeMs: 5000 },
        mockSetState.setState,
      );

      const state = mockSetState.getState();
      expect(state.phase).toBe('done');
      expect(state.confettiCount).toBe(1);
    });

    it('should not increment confettiCount when cached', () => {
      // Set isCached first
      processEvent({ event: 'cached' }, mockSetState.setState);
      processEvent({ event: 'done', processingTimeMs: 100 }, mockSetState.setState);

      expect(mockSetState.getState().confettiCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────
  // error
  // ─────────────────────────────────────────────────────

  describe('error', () => {
    it('should set phase to error with message', () => {
      processEvent(
        { event: 'error', message: 'Something went wrong' },
        mockSetState.setState,
      );

      const state = mockSetState.getState();
      expect(state.phase).toBe('error');
      expect(state.error).toBe('Something went wrong');
    });
  });

  // ─────────────────────────────────────────────────────
  // warning
  // ─────────────────────────────────────────────────────

  describe('warning', () => {
    it('should append warning to warnings array', () => {
      processEvent(
        { event: 'warning', message: 'Partial failure', failedTasks: ['enrichment'] },
        mockSetState.setState,
      );

      expect(mockSetState.getState().warnings).toEqual(['Partial failure (failed: enrichment)']);
    });
  });
});
