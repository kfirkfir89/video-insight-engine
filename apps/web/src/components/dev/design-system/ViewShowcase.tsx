/**
 * View Showcase Component - Dev Only
 *
 * Displays all 10 category views with mock chapter data.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('ViewShowcase should not be imported in production');
}

import { useState } from 'react';
import { VIDEO_CATEGORY_VALUES, type VideoCategory, type SummaryChapter, type ContentBlock } from '@vie/types';
import {
  ChefHat,
  Code,
  Plane,
  Star,
  Dumbbell,
  GraduationCap,
  Mic,
  Hammer,
  Gamepad2,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import view components
import { StandardView } from '@/components/video-detail/views/StandardView';
import { CodeView } from '@/components/video-detail/views/CodeView';
import { RecipeView } from '@/components/video-detail/views/RecipeView';
import { TravelView } from '@/components/video-detail/views/TravelView';
import { ReviewView } from '@/components/video-detail/views/ReviewView';
import { FitnessView } from '@/components/video-detail/views/FitnessView';
import { EducationView } from '@/components/video-detail/views/EducationView';
import { PodcastView } from '@/components/video-detail/views/PodcastView';
import { DIYView } from '@/components/video-detail/views/DIYView';
import { GamingView } from '@/components/video-detail/views/GamingView';

// Import mock blocks
import {
  createParagraphBlock,
  createBulletsBlock,
  createCalloutBlock,
  createCodeBlock,
  createIngredientBlock,
  createStepBlock,
  createLocationBlock,
  createProConBlock,
  createExerciseBlock,
  createQuizBlock,
  createGuestBlock,
  createToolListBlock,
} from '@/lib/dev/mock-blocks';

const categoryIcons: Record<VideoCategory, React.ReactNode> = {
  cooking: <ChefHat className="h-4 w-4" />,
  coding: <Code className="h-4 w-4" />,
  travel: <Plane className="h-4 w-4" />,
  reviews: <Star className="h-4 w-4" />,
  fitness: <Dumbbell className="h-4 w-4" />,
  education: <GraduationCap className="h-4 w-4" />,
  podcast: <Mic className="h-4 w-4" />,
  diy: <Hammer className="h-4 w-4" />,
  gaming: <Gamepad2 className="h-4 w-4" />,
  standard: <FileText className="h-4 w-4" />,
};

// Create mock chapters for each view
function createMockChapter(title: string, content: ContentBlock[]): SummaryChapter {
  return {
    id: crypto.randomUUID(),
    timestamp: '0:00',
    startSeconds: 0,
    endSeconds: 300,
    title,
    isCreatorChapter: true,
    content,
  };
}

const viewMockChapters: Record<VideoCategory, SummaryChapter> = {
  standard: createMockChapter('Introduction', [
    createParagraphBlock('This is a standard video with general content that covers multiple topics.'),
    createBulletsBlock(['Point one about the topic', 'Point two with more detail', 'Final point summarizing key ideas']),
    createCalloutBlock('tip', 'This is a helpful tip for viewers to remember.'),
  ]),
  cooking: createMockChapter('Preparing the Sauce', [
    createIngredientBlock([
      { name: 'Tomatoes', amount: '400', unit: 'g', notes: 'San Marzano' },
      { name: 'Garlic', amount: '3', unit: 'cloves' },
      { name: 'Olive oil', amount: '2', unit: 'tbsp' },
    ], 4),
    createStepBlock([
      { number: 1, instruction: 'Heat olive oil in a large pan over medium heat', duration: 60 },
      { number: 2, instruction: 'Add minced garlic and cook until fragrant', duration: 120, tips: 'Don\'t let it brown' },
    ]),
    createCalloutBlock('chef_tip', 'Use the best quality tomatoes you can find for the best flavor.'),
  ]),
  coding: createMockChapter('Setting Up the Project', [
    createCodeBlock(
      `import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}`,
      'typescript',
      'Counter.tsx'
    ),
    createParagraphBlock('This example shows the basic usage of the useState hook in React.'),
    createCalloutBlock('tip', 'Always initialize state with an appropriate default value.'),
  ]),
  travel: createMockChapter('Day 1: Arrival', [
    createLocationBlock('Fushimi Inari Shrine', 'Kyoto, Japan', 'Famous for its thousands of orange torii gates'),
    createParagraphBlock('Start your trip at this iconic shrine, best visited early morning to avoid crowds.'),
    createBulletsBlock(['Wear comfortable shoes', 'Bring water', 'Plan 2-3 hours for the full hike']),
  ]),
  reviews: createMockChapter('Build Quality', [
    createParagraphBlock('The build quality of this product is exceptional, featuring premium materials throughout.'),
    createProConBlock(
      ['Premium aluminum construction', 'Excellent fit and finish', 'IP68 water resistance'],
      ['Fingerprints show easily', 'No included case', 'Heavy for its size']
    ),
  ]),
  fitness: createMockChapter('Warm Up', [
    createExerciseBlock([
      { name: 'Jumping Jacks', duration: '30s', difficulty: 'beginner' },
      { name: 'High Knees', duration: '30s', difficulty: 'beginner' },
      { name: 'Arm Circles', duration: '20s', difficulty: 'beginner' },
    ]),
    createCalloutBlock('warning', 'Always warm up before intense exercise to prevent injury.'),
  ]),
  education: createMockChapter('Understanding the Concept', [
    createParagraphBlock('Quantum entanglement is a phenomenon where two particles become connected in such a way that the quantum state of each particle cannot be described independently.'),
    createQuizBlock([{
      question: 'What happens when you measure one entangled particle?',
      options: ['Nothing', 'The other particle is affected instantly', 'Both particles disappear', 'Time reverses'],
      correctIndex: 1,
      explanation: 'Measuring one particle instantly affects the other, regardless of distance.',
    }]),
  ]),
  podcast: createMockChapter('Guest Introduction', [
    createGuestBlock([{
      name: 'Dr. Jane Smith',
      title: 'AI Researcher at Stanford',
      bio: 'Leading expert in machine learning and neural networks with over 20 years of experience.',
    }]),
    createParagraphBlock('In this episode, we discuss the future of artificial intelligence and its implications for society.'),
  ]),
  diy: createMockChapter('Materials Needed', [
    createToolListBlock([
      { name: 'Power drill', quantity: '1', notes: 'With drill bits' },
      { name: 'Wood screws', quantity: '24', notes: '2-inch' },
      { name: 'Sandpaper', quantity: '3 sheets', notes: '120 grit' },
      { name: 'Wood stain', quantity: '1 can', notes: 'Your choice of color' },
    ]),
    createCalloutBlock('warning', 'Always wear safety glasses when using power tools.'),
  ]),
  gaming: createMockChapter('Getting Started', [
    createParagraphBlock('This guide will help you navigate the opening hours of the game and set you up for success.'),
    createBulletsBlock([
      'Choose Vagabond class for an easier start',
      'Grab the horse as soon as possible',
      'Don\'t fight the first boss immediately - explore first',
      'Level vigor early for more survivability',
    ]),
    createCalloutBlock('tip', 'Dying is part of the experience - don\'t give up!'),
  ]),
};

// View component mapping
const viewComponents: Record<VideoCategory, React.ComponentType<{ chapter: SummaryChapter }>> = {
  standard: StandardView,
  cooking: RecipeView,
  coding: CodeView,
  travel: TravelView,
  reviews: ReviewView,
  fitness: FitnessView,
  education: EducationView,
  podcast: PodcastView,
  diy: DIYView,
  gaming: GamingView,
};

export function ViewShowcase() {
  const [selectedView, setSelectedView] = useState<VideoCategory>('standard');

  const ViewComponent = viewComponents[selectedView];
  const chapter = viewMockChapters[selectedView];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Category Views</h2>
        <p className="text-muted-foreground">
          All 10 category-specific views with mock chapter content.
          Each view renders blocks differently based on the content type.
        </p>
      </div>

      {/* View Selector */}
      <div className="flex flex-wrap gap-2">
        {VIDEO_CATEGORY_VALUES.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedView(category)}
            className={cn(
              'category-' + category,
              'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all',
              selectedView === category
                ? 'ring-2 ring-offset-2'
                : 'opacity-70 hover:opacity-100'
            )}
            style={{
              backgroundColor: 'var(--category-accent-soft)',
              color: 'var(--category-accent)',
              ...(selectedView === category && { ringColor: 'var(--category-accent)' }),
            }}
          >
            {categoryIcons[category]}
            <span className="capitalize">{category}</span>
          </button>
        ))}
      </div>

      {/* Selected View Preview */}
      <div className={cn('category-' + selectedView, 'rounded-lg border overflow-hidden')}>
        <div
          className="px-4 py-2 border-b flex items-center gap-2"
          style={{ backgroundColor: 'var(--category-accent-soft)' }}
        >
          <span style={{ color: 'var(--category-accent)' }}>{categoryIcons[selectedView]}</span>
          <span className="font-medium capitalize" style={{ color: 'var(--category-accent)' }}>
            {selectedView} View
          </span>
        </div>
        <div className="p-4" style={{ backgroundColor: 'var(--category-surface)' }}>
          <ViewComponent chapter={chapter} />
        </div>
      </div>

      {/* View Details */}
      <div className="rounded-lg border p-4 bg-muted/30">
        <h3 className="font-semibold mb-2">View Component Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Component</p>
            <code className="text-sm text-muted-foreground">{ViewComponent.name}</code>
          </div>
          <div>
            <p className="text-sm font-medium">Chapter Title</p>
            <span className="text-sm text-muted-foreground">{chapter.title}</span>
          </div>
          <div>
            <p className="text-sm font-medium">Block Count</p>
            <span className="text-sm text-muted-foreground">{chapter.content?.length ?? 0}</span>
          </div>
          <div>
            <p className="text-sm font-medium">Block Types</p>
            <span className="text-sm text-muted-foreground">
              {chapter.content?.map(b => b.type).join(', ') ?? 'None'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
