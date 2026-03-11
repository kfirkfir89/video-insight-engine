// ═══════════════════════════════════════════════════
// VIE Response — Domain-Based Composable Types
// ═══════════════════════════════════════════════════

import type { ScenarioItem } from './output-types.js';

// ─────────────────────────────────────────────────────
// Content Tags & Modifiers
// ─────────────────────────────────────────────────────

export type ContentTag =
  | 'travel'
  | 'food'
  | 'tech'
  | 'fitness'
  | 'music'
  | 'learning'
  | 'review'
  | 'project';

export const CONTENT_TAG_VALUES: readonly ContentTag[] = [
  'travel', 'food', 'tech', 'fitness',
  'music', 'learning', 'review', 'project',
] as const;

export type Modifier = 'narrative' | 'finance';

export const MODIFIER_VALUES: readonly Modifier[] = [
  'narrative', 'finance',
] as const;

// ─────────────────────────────────────────────────────
// Tab & Section Definitions (LLM-designed)
// ─────────────────────────────────────────────────────

export interface TabDefinition {
  id: string;
  label: string;
  emoji: string;
  dataSource: string;
}

// ─────────────────────────────────────────────────────
// Triage Result
// ─────────────────────────────────────────────────────

export interface TriageResult {
  contentTags: ContentTag[];
  modifiers: Modifier[];
  primaryTag: ContentTag;
  userGoal: string;
  tabs: TabDefinition[];
  confidence: number;
}

// ─────────────────────────────────────────────────────
// Shared Item Types
// ─────────────────────────────────────────────────────

export interface SpotItem {
  name: string;
  emoji: string;
  description: string;
  cost?: string;
  currency?: string;
  duration?: string;
  mapQuery?: string;
  bookingSearch?: string;
  tips?: string;
  specs?: string;
  rating?: number;
}

export interface TipItem {
  type: string;
  text: string;
}

export interface StepItem {
  number: number;
  title?: string;
  instruction: string;
  duration?: string;
  tips?: string;
  safetyNote?: string;
  timestamp?: number;
}

export interface ConceptItem {
  name: string;
  emoji: string;
  definition: string;
  example?: string;
  analogy?: string;
  connections: string[];
}

export interface KeyPointItem {
  emoji: string;
  title: string;
  detail: string;
  timestamp?: number;
}

export interface TimestampItem {
  time: string;
  seconds: number;
  label: string;
}

export interface QuizItem {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface FlashcardItem {
  front: string;
  back: string;
  emoji?: string;
  category?: string;
}

// ScenarioItem imported from output-types.ts

// ─────────────────────────────────────────────────────
// Domain Data Interfaces (8 primary domains)
// ─────────────────────────────────────────────────────

// --- Travel ---
export interface TravelDay {
  day: number;
  city?: string;
  theme?: string;
  dailyCost?: string;
  spots: SpotItem[];
  tips: string[];
}

export interface TravelBudget {
  total: number;
  currency: string;
  breakdown: { category: string; amount: number; notes?: string }[];
}

export interface TravelPackingItem {
  item: string;
  category: string;
  essential: boolean;
}

export interface TravelTip {
  text: string;
  type: 'tip' | 'warning' | 'info';
}

export interface TravelData {
  bestSeason?: string;
  accommodationTips: TravelTip[];
  transportationTips: TravelTip[];
  itinerary: TravelDay[];
  budget: TravelBudget;
  packingList: TravelPackingItem[];
}

// --- Food ---
export interface FoodIngredient {
  name: string;
  amount: number;
  displayAmount: string;
  unit?: string;
  group?: string;
  notes?: string;
}

export interface FoodMeta {
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine?: string;
}

export interface FoodData {
  meta: FoodMeta;
  ingredients: FoodIngredient[];
  steps: StepItem[];
  tips: TipItem[];
  substitutions: { original: string; substitute: string; notes?: string }[];
  nutrition: { nutrient: string; amount: string; unit?: string }[];
  equipment: string[];
}

// --- Tech ---
export interface TechSetup {
  commands: string[];
  dependencies: { name: string; version?: string }[];
  envVars: { name: string; description: string; example?: string }[];
}

export interface TechSnippet {
  filename?: string;
  language: string;
  code: string;
  explanation: string;
  timestamp?: number;
}

export interface TechPattern {
  title: string;
  doExample: string;
  dontExample: string;
  explanation: string;
}

export interface TechCheatSheetItem {
  title: string;
  code: string;
  description: string;
}

export interface TechData {
  languages: string[];
  frameworks: string[];
  concepts: string[];
  setup: TechSetup;
  snippets: TechSnippet[];
  patterns: TechPattern[];
  cheatSheet: TechCheatSheetItem[];
}

// --- Fitness ---
export interface FitnessExercise {
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

export interface FitnessTimer {
  intervals: { name: string; duration: number; type: 'work' | 'rest' | 'warmup' | 'cooldown' }[];
  rounds: number;
}

export interface FitnessData {
  meta: {
    type: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    duration: number;
    muscleGroups: string[];
    equipment: string[];
    caloriesBurned?: number;
  };
  warmup: FitnessExercise[];
  exercises: FitnessExercise[];
  cooldown: FitnessExercise[];
  timer: FitnessTimer | null;
  tips: TipItem[];
}

// --- Music ---

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

export interface MusicAnalysisItem {
  aspect: string;
  emoji: string;
  detail: string;
}

export interface MusicData {
  title: string;
  artist: string;
  genre: string[];
  credits: MusicCredit[];
  analysis: MusicAnalysisItem[];
  structure: MusicSection[];
  lyrics: { timestamp?: number; line: string }[];
  themes: string[];
}

// --- Learning ---
export interface LearningData {
  keyQuestion?: string;
  keyPoints: KeyPointItem[];
  concepts: ConceptItem[];
  takeaways: string[];
  timestamps: TimestampItem[];
  summary?: string;
}

// --- Review ---
export interface ReviewRating {
  score: number;
  maxScore: number;
  label: string;
}

export interface ReviewSpec {
  key: string;
  value: string;
}

export interface ReviewComparison {
  feature: string;
  thisProduct: string;
  competitor: string;
  competitorName: string;
}

export interface ReviewVerdict {
  badge: 'recommended' | 'not_recommended' | 'conditional' | 'best_in_class';
  bestFor: string[];
  notFor: string[];
  bottomLine: string;
}

export interface ReviewData {
  product: string;
  price?: string;
  rating: ReviewRating;
  pros: string[];
  cons: string[];
  specs: ReviewSpec[];
  comparisons: ReviewComparison[];
  verdict: ReviewVerdict;
}

// --- Project ---

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

export interface ProjectData {
  projectName: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  estimatedCost?: string;
  materials: ProjectMaterial[];
  tools: ProjectTool[];
  steps: StepItem[];
  safetyWarnings: string[];
}

// ─────────────────────────────────────────────────────
// Modifier Data Interfaces
// ─────────────────────────────────────────────────────

export interface NarrativeKeyMoment {
  timestamp: number;
  description: string;
  mood?: string;
  emoji?: string;
}

export interface NarrativeQuote {
  text: string;
  speaker: string;
  timestamp?: number;
  context?: string;
}

export interface NarrativeData {
  keyMoments: NarrativeKeyMoment[];
  quotes: NarrativeQuote[];
  takeaways: string[];
}

export interface FinanceBudget {
  total: number;
  currency: string;
  breakdown: { category: string; amount: number; notes?: string }[];
}

export interface FinanceData {
  costs: { item: string; amount: number; currency: string; category: string }[];
  savingTips: string[];
}

// ─────────────────────────────────────────────────────
// VIE Response Meta
// ─────────────────────────────────────────────────────

export interface VIEResponseMeta {
  videoId: string;
  videoTitle: string;
  creator: string;
  contentTags: ContentTag[];
  modifiers: Modifier[];
  primaryTag: ContentTag;
  userGoal: string;
}

// ─────────────────────────────────────────────────────
// VIE Response
// ─────────────────────────────────────────────────────

export interface VIEResponse {
  meta: VIEResponseMeta;
  tabs: TabDefinition[];

  // Domain data — only populated domains present
  travel?: TravelData;
  food?: FoodData;
  tech?: TechData;
  fitness?: FitnessData;
  music?: MusicData;
  learning?: LearningData;
  review?: ReviewData;
  project?: ProjectData;

  // Modifier enrichment
  narrative?: NarrativeData;
  finance?: FinanceData;

  // Stage 3 enrichment
  quizzes?: QuizItem[];
  scenarios?: ScenarioItem[];
  flashcards?: FlashcardItem[];
}

// ─────────────────────────────────────────────────────
// Celebration Config (resolved by post-processing)
// ─────────────────────────────────────────────────────

export interface CelebrationConfig {
  tabId: string;
  emoji: string;
  title: string;
  subtitle?: string;
  nextTabId?: string;
  nextLabel?: string;
}

// ─────────────────────────────────────────────────────
// SSE Events
// ─────────────────────────────────────────────────────

export interface SSETriageCompleteEvent {
  event: 'triage_complete';
  contentTags: ContentTag[];
  modifiers: Modifier[];
  primaryTag: ContentTag;
  userGoal: string;
  tabs: TabDefinition[];
  confidence: number;
}

export interface SSEDomainExtractionCompleteEvent {
  event: 'extraction_complete';
  data: Partial<Pick<VIEResponse, 'travel' | 'food' | 'tech' | 'fitness' | 'music' | 'learning' | 'review' | 'project'>>;
}

// ─────────────────────────────────────────────────────
// Type Guards
// ─────────────────────────────────────────────────────

export function isContentTag(value: string): value is ContentTag {
  return CONTENT_TAG_VALUES.includes(value as ContentTag);
}

export function isModifier(value: string): value is Modifier {
  return MODIFIER_VALUES.includes(value as Modifier);
}

export function isVIEResponse(response: unknown): response is VIEResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'meta' in response &&
    'tabs' in response
  );
}
