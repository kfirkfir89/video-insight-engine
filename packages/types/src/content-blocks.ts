// ═══════════════════════════════════════════════════
// Content Block Types — Dynamic Chapter Content
// ═══════════════════════════════════════════════════

// Base interface for all content blocks - provides stable block identifiers.
// blockId is injected by inject_block_ids() in the summarizer before reaching
// the frontend — always present at runtime.
export interface BaseBlock {
  /** Stable UUID for tracking, analytics, and React keys. Injected server-side. */
  blockId: string;
  type: string;
  variant?: string;
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  text: string;
}

export interface BulletsBlock extends BaseBlock {
  type: 'bullets';
  variant?: 'ingredients' | string;
  items: string[];
}

export interface NumberedBlock extends BaseBlock {
  type: 'numbered';
  variant?: 'cooking_steps' | string;
  items: string[];
}

export interface DoDoNotBlock extends BaseBlock {
  type: 'do_dont';
  do: string[];
  dont: string[];
}

export interface ExampleBlock extends BaseBlock {
  type: 'example';
  variant?: 'terminal_command' | string;
  title?: string;
  code: string;
  explanation?: string;
}

export type CalloutStyle = 'tip' | 'warning' | 'note' | 'chef_tip' | 'security';

export interface CalloutBlock extends BaseBlock {
  type: 'callout';
  variant?: 'chef_tip' | string;
  style: CalloutStyle;
  text: string;
}

export interface DefinitionBlock extends BaseBlock {
  type: 'definition';
  term: string;
  meaning: string;
}

export interface KeyValueBlock extends BaseBlock {
  type: 'keyvalue';
  variant?: 'specs' | 'cost' | 'stats' | 'info' | 'location';
  items: { key: string; value: string }[];
}

export interface ComparisonBlock extends BaseBlock {
  type: 'comparison';
  variant?: 'dos_donts' | 'pros_cons' | 'versus' | 'before_after';
  left: { label: string; items: string[] };
  right: { label: string; items: string[] };
}

export interface TimestampBlock extends BaseBlock {
  type: 'timestamp';
  time: string;
  seconds: number;
  label: string;
}

export interface QuoteBlock extends BaseBlock {
  type: 'quote';
  variant?: 'speaker' | 'testimonial' | 'highlight';
  text: string;
  attribution?: string;
  timestamp?: number;
}

export interface StatisticBlock extends BaseBlock {
  type: 'statistic';
  variant?: 'metric' | 'percentage' | 'trend';
  items: {
    value: string;
    label: string;
    context?: string;
    trend?: 'up' | 'down' | 'neutral';
  }[];
}

// ===== Universal Blocks =====

export interface TranscriptBlock extends BaseBlock {
  type: 'transcript';
  lines: {
    time: string;
    seconds: number;
    text: string;
  }[];
}

export interface TimelineBlock extends BaseBlock {
  type: 'timeline';
  events: {
    date?: string;
    time?: string;
    title: string;
    description?: string;
  }[];
}

export interface ToolListBlock extends BaseBlock {
  type: 'tool_list';
  tools: {
    name: string;
    quantity?: string;
    notes?: string;
    checked?: boolean;
  }[];
}

// ===== Category-Specific Blocks =====

// Cooking blocks
export interface IngredientBlock extends BaseBlock {
  type: 'ingredient';
  servings?: number;
  items: {
    name: string;
    amount?: string;
    unit?: string;
    notes?: string;
    checked?: boolean;
  }[];
}

export interface StepBlock extends BaseBlock {
  type: 'step';
  steps: {
    number: number;
    instruction: string;
    duration?: number;
    tips?: string;
  }[];
}

export interface NutritionBlock extends BaseBlock {
  type: 'nutrition';
  servingSize?: string;
  items: {
    nutrient: string;
    amount: string;
    unit?: string;
    dailyValue?: string;
  }[];
}

// Coding blocks
export interface CodeBlock extends BaseBlock {
  type: 'code';
  language?: string;
  code: string;
  filename?: string;
  highlightLines?: number[];
}

export interface TerminalBlock extends BaseBlock {
  type: 'terminal';
  command: string;
  output?: string;
}

export interface FileTreeBlock extends BaseBlock {
  type: 'file_tree';
  tree: FileTreeNode[];
}

export interface FileTreeNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  expanded?: boolean;
}

// Travel blocks
export interface LocationBlock extends BaseBlock {
  type: 'location';
  name: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  description?: string;
  imageUrl?: string;
  mapUrl?: string;
}

export interface ItineraryBlock extends BaseBlock {
  type: 'itinerary';
  days: {
    day: number;
    title?: string;
    activities: {
      time?: string;
      activity: string;
      location?: string;
      duration?: string;
      notes?: string;
    }[];
  }[];
}

export interface CostBlock extends BaseBlock {
  type: 'cost';
  currency?: string;
  items: {
    category: string;
    amount: number;
    notes?: string;
  }[];
  total?: number;
}

// Review blocks
export interface ProConBlock extends BaseBlock {
  type: 'pro_con';
  pros: string[];
  cons: string[];
}

export interface RatingBlock extends BaseBlock {
  type: 'rating';
  score: number;
  maxScore: number;
  label?: string;
  breakdown?: {
    category: string;
    score: number;
    maxScore?: number;
  }[];
}

export interface VerdictBlock extends BaseBlock {
  type: 'verdict';
  verdict: 'recommended' | 'not_recommended' | 'conditional' | 'neutral';
  summary: string;
  bestFor?: string[];
  notFor?: string[];
}

// Fitness blocks
export interface ExerciseBlock extends BaseBlock {
  type: 'exercise';
  exercises: {
    name: string;
    sets?: number;
    reps?: string;
    duration?: string;
    rest?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    notes?: string;
    timestamp?: number;
  }[];
}

export interface WorkoutTimerBlock extends BaseBlock {
  type: 'workout_timer';
  intervals: {
    name: string;
    duration: number;
    type: 'work' | 'rest' | 'warmup' | 'cooldown';
  }[];
  rounds?: number;
}

// Education blocks
export interface QuizBlock extends BaseBlock {
  type: 'quiz';
  questions: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }[];
}

// Podcast blocks
export interface GuestBlock extends BaseBlock {
  type: 'guest';
  guests: {
    name: string;
    title?: string;
    bio?: string;
    imageUrl?: string;
    socialLinks?: { platform: string; url: string }[];
  }[];
}

// Generic table block
export interface TableBlock extends BaseBlock {
  type: 'table';
  caption?: string;
  columns: {
    key: string;
    label: string;
    align?: 'left' | 'center' | 'right';
  }[];
  rows: Record<string, string | number>[];
  highlightRows?: number[];
}

// Problem/Solution blocks
export interface ProblemSolutionBlock extends BaseBlock {
  type: 'problem_solution';
  problem: string;
  solution: string;
  context?: string;
}

// Visual moment blocks
export interface VisualFrame {
  timestamp: number;
  /** S3 object key — snake_case matches Python backend wire format. */
  s3_key?: string;
  imageUrl?: string;
  caption?: string;
}

export interface VisualBlock extends BaseBlock {
  type: 'visual';
  description?: string;
  timestamp?: number;
  label?: string;
  /** S3 object key — snake_case matches Python backend wire format. */
  s3_key?: string;
  /** Ephemeral presigned URL — refreshed at response time from s3_key. */
  imageUrl?: string;
  variant?: 'diagram' | 'screenshot' | 'demo' | 'whiteboard' | 'slideshow' | 'gallery';
  frames?: VisualFrame[];
}

// ===== Content Block Union =====

export type ContentBlock =
  | ParagraphBlock
  | BulletsBlock
  | NumberedBlock
  | DoDoNotBlock
  | ExampleBlock
  | CalloutBlock
  | DefinitionBlock
  | KeyValueBlock
  | ComparisonBlock
  | TimestampBlock
  | QuoteBlock
  | StatisticBlock
  | TranscriptBlock
  | TimelineBlock
  | ToolListBlock
  | IngredientBlock
  | StepBlock
  | NutritionBlock
  | CodeBlock
  | TerminalBlock
  | FileTreeBlock
  | LocationBlock
  | ItineraryBlock
  | CostBlock
  | ProConBlock
  | RatingBlock
  | VerdictBlock
  | ExerciseBlock
  | WorkoutTimerBlock
  | QuizBlock
  | GuestBlock
  | ProblemSolutionBlock
  | VisualBlock
  | TableBlock;

/** All possible block type strings */
export type ContentBlockType = ContentBlock['type'];
