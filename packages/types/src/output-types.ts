// ═══════════════════════════════════════════════════
// Output Types & Contracts
// ═══════════════════════════════════════════════════

// ─────────────────────────────────────────────────────
// Output Type (10 purpose-built types)
// ─────────────────────────────────────────────────────

export type OutputType =
  | 'explanation'
  | 'recipe'
  | 'code_walkthrough'
  | 'study_kit'
  | 'trip_planner'
  | 'workout'
  | 'verdict'
  | 'highlights'
  | 'music_guide'
  | 'project_guide';

export const OUTPUT_TYPE_VALUES: readonly OutputType[] = [
  'explanation', 'recipe', 'code_walkthrough', 'study_kit',
  'trip_planner', 'workout', 'verdict', 'highlights',
  'music_guide', 'project_guide',
] as const;

// ─────────────────────────────────────────────────────
// Intent Detection
// ─────────────────────────────────────────────────────

export interface OutputSection {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

export interface IntentResult {
  outputType: OutputType;
  confidence: number;
  userGoal: string;
  sections: OutputSection[];
}

// ─────────────────────────────────────────────────────
// Synthesis
// ─────────────────────────────────────────────────────

export interface SynthesisResult {
  tldr: string;
  keyTakeaways: string[];
  masterSummary: string;
  seoDescription: string;
}

// ─────────────────────────────────────────────────────
// Per-Type Output Interfaces
// ─────────────────────────────────────────────────────

// --- Explanation (default fallback) ---
export interface ExplanationKeyPoint {
  emoji: string;
  title: string;
  detail: string;
  timestamp?: number;
}

export interface ExplanationConcept {
  name: string;
  definition: string;
  emoji: string;
}

export interface ExplanationOutput {
  keyPoints: ExplanationKeyPoint[];
  concepts: ExplanationConcept[];
  takeaways: string[];
  timestamps: { time: string; seconds: number; label: string }[];
}

// --- Recipe ---
export interface RecipeIngredient {
  name: string;
  amount?: string;
  unit?: string;
  group?: string;
  notes?: string;
}

export interface RecipeStep {
  number: number;
  instruction: string;
  duration?: number;
  tips?: string;
  timestamp?: number;
}

export interface RecipeTip {
  type: 'chef_tip' | 'warning' | 'substitution' | 'storage';
  text: string;
}

export interface RecipeNutrition {
  nutrient: string;
  amount: string;
  unit?: string;
}

export interface RecipeOutput {
  meta: {
    prepTime?: number;
    cookTime?: number;
    totalTime?: number;
    servings?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    cuisine?: string;
  };
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tips: RecipeTip[];
  substitutions: { original: string; substitute: string; notes?: string }[];
  nutrition: RecipeNutrition[];
  equipment: string[];
}

// --- Code Walkthrough ---
export interface CodeSetup {
  commands: string[];
  dependencies: { name: string; version?: string }[];
  envVars: { name: string; description: string; example?: string }[];
}

export interface CodeSnippet {
  filename?: string;
  language: string;
  code: string;
  explanation: string;
  timestamp?: number;
}

export interface CodePattern {
  title: string;
  doExample: string;
  dontExample: string;
  explanation: string;
}

export interface CodeCheatSheetItem {
  title: string;
  code: string;
  description: string;
}

export interface CodeWalkthroughOutput {
  languages: string[];
  frameworks: string[];
  concepts: string[];
  setup: CodeSetup;
  snippets: CodeSnippet[];
  patterns: CodePattern[];
  cheatSheet: CodeCheatSheetItem[];
}

// --- Study Kit ---
export interface StudyConcept {
  name: string;
  emoji: string;
  definition: string;
  example?: string;
  analogy?: string;
  connections: string[];
}

export interface StudyTimelineEvent {
  date?: string;
  title: string;
  description: string;
}

export interface StudyKitOutput {
  keyQuestion: string;
  concepts: StudyConcept[];
  keyFacts: string[];
  timeline: StudyTimelineEvent[];
  summary: string;
}

// --- Trip Planner ---
export interface TripSpot {
  name: string;
  emoji: string;
  description: string;
  cost?: string;
  duration?: string;
  mapQuery?: string;
  bookingUrl?: string;
  tips?: string;
}

export interface TripDay {
  day: number;
  city?: string;
  theme?: string;
  dailyCost?: string;
  spots: TripSpot[];
  tips: string[];
}

export interface TripBudgetItem {
  category: string;
  amount: number;
  currency: string;
  notes?: string;
}

export interface TripPackingItem {
  item: string;
  category: string;
  essential: boolean;
}

export interface TripPlannerOutput {
  destination: string;
  totalDays: number;
  bestSeason?: string;
  days: TripDay[];
  budget: {
    total: number;
    currency: string;
    breakdown: TripBudgetItem[];
  };
  packingList: TripPackingItem[];
}

// --- Workout ---
export interface WorkoutExercise {
  name: string;
  emoji: string;
  sets?: number;
  reps?: string;
  duration?: string;
  rest?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  formCues: string[];
  modifications: { label: string; description: string }[];
  supersetWith?: string;
  timestamp?: number;
}

export interface WorkoutTimerInterval {
  name: string;
  duration: number;
  type: 'work' | 'rest' | 'warmup' | 'cooldown';
}

export interface WorkoutOutput {
  meta: {
    type: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    duration: number;
    muscleGroups: string[];
    equipment: string[];
    caloriesBurned?: number;
  };
  warmup: WorkoutExercise[];
  exercises: WorkoutExercise[];
  cooldown: WorkoutExercise[];
  timer: {
    intervals: WorkoutTimerInterval[];
    rounds: number;
  } | null;
  tips: { type: 'form' | 'safety' | 'progression'; text: string }[];
}

// --- Verdict (Review) ---
export interface VerdictSpec {
  key: string;
  value: string;
}

export interface VerdictComparison {
  feature: string;
  thisProduct: string;
  competitor: string;
  competitorName: string;
}

export interface VerdictOutput {
  product: string;
  price?: string;
  rating: { score: number; maxScore: number; label: string };
  pros: string[];
  cons: string[];
  specs: VerdictSpec[];
  comparisons: VerdictComparison[];
  verdict: {
    badge: 'recommended' | 'not_recommended' | 'conditional' | 'best_in_class';
    bestFor: string[];
    notFor: string[];
    bottomLine: string;
  };
}

// --- Highlights (Podcast/Interview) ---
export interface HighlightsSpeaker {
  name: string;
  role?: string;
  emoji: string;
}

export interface HighlightsQuote {
  text: string;
  speaker: string;
  timestamp?: number;
  emoji: string;
}

export interface HighlightsTopic {
  name: string;
  emoji: string;
  timestamp?: number;
  duration?: number;
  summary: string;
}

export interface HighlightsOutput {
  speakers: HighlightsSpeaker[];
  highlights: HighlightsQuote[];
  topics: HighlightsTopic[];
}

// --- Music Guide ---
export interface MusicCredit {
  role: string;
  name: string;
}

export interface MusicSection {
  name: string;
  timestamp?: number;
  duration?: number;
  description: string;
}

export interface MusicGuideOutput {
  title: string;
  artist: string;
  genre: string[];
  credits: MusicCredit[];
  analysis: string;
  structure: MusicSection[];
  lyrics: { timestamp?: number; line: string }[];
  themes: string[];
}

// --- Project Guide (DIY) ---
export interface ProjectMaterial {
  name: string;
  quantity?: string;
  cost?: string;
  notes?: string;
}

export interface ProjectTool {
  name: string;
  required: boolean;
  alternative?: string;
}

export interface ProjectStep {
  number: number;
  title: string;
  instruction: string;
  duration?: string;
  tips?: string;
  safetyNote?: string;
  timestamp?: number;
}

export interface ProjectGuideOutput {
  projectName: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  estimatedCost?: string;
  materials: ProjectMaterial[];
  tools: ProjectTool[];
  steps: ProjectStep[];
  safetyWarnings: string[];
}

// ─────────────────────────────────────────────────────
// Discriminated OutputData Union
// ─────────────────────────────────────────────────────

export type OutputData =
  | { type: 'explanation'; data: ExplanationOutput }
  | { type: 'recipe'; data: RecipeOutput }
  | { type: 'code_walkthrough'; data: CodeWalkthroughOutput }
  | { type: 'study_kit'; data: StudyKitOutput }
  | { type: 'trip_planner'; data: TripPlannerOutput }
  | { type: 'workout'; data: WorkoutOutput }
  | { type: 'verdict'; data: VerdictOutput }
  | { type: 'highlights'; data: HighlightsOutput }
  | { type: 'music_guide'; data: MusicGuideOutput }
  | { type: 'project_guide'; data: ProjectGuideOutput };

// ─────────────────────────────────────────────────────
// Enrichment Data
// ─────────────────────────────────────────────────────

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface EnrichmentData {
  quiz?: QuizQuestion[];
  flashcards?: Flashcard[];
  cheatSheet?: CodeCheatSheetItem[];
}

// ─────────────────────────────────────────────────────
// Video Output
// ─────────────────────────────────────────────────────

export interface VideoOutput {
  outputType: OutputType;
  intent: IntentResult;
  output: OutputData;
  synthesis: SynthesisResult;
  enrichment?: EnrichmentData;
  /** Multi-output support: additional output sections beyond the primary. */
  additionalOutputs?: OutputData[];
}

// ─────────────────────────────────────────────────────
// SSE Event Types
// ─────────────────────────────────────────────────────

export interface SSEPreDetectionEvent {
  event: 'pre_detection';
  hint: string;
  confidence: number;
}

export interface SSEIntentDetectedEvent {
  event: 'intent_detected';
  outputType: OutputType;
  confidence: number;
  userGoal: string;
  sections: OutputSection[];
}

export interface SSEExtractionProgressEvent {
  event: 'extraction_progress';
  section: string;
  percent: number;
}

export interface SSEExtractionCompleteEvent {
  event: 'extraction_complete';
  outputType: OutputType;
  data: OutputData['data'];
}

export interface SSEEnrichmentCompleteEvent {
  event: 'enrichment_complete';
  quiz?: QuizQuestion[];
  flashcards?: Flashcard[];
  cheatSheet?: CodeCheatSheetItem[];
}

export interface SSESynthesisCompleteEvent {
  event: 'synthesis_complete';
  tldr: string;
  keyTakeaways: string[];
  masterSummary: string;
  seoDescription: string;
}

export type SSEStreamEvent =
  | SSEPreDetectionEvent
  | SSEIntentDetectedEvent
  | SSEExtractionProgressEvent
  | SSEExtractionCompleteEvent
  | SSEEnrichmentCompleteEvent
  | SSESynthesisCompleteEvent;

// ─────────────────────────────────────────────────────
// Type Guards
// ─────────────────────────────────────────────────────

export function isValidOutputType(value: string): value is OutputType {
  return OUTPUT_TYPE_VALUES.includes(value as OutputType);
}
