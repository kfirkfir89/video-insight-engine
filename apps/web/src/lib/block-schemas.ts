/**
 * Content Block Zod Schemas — extracted from sse-validators.ts.
 *
 * Defines the discriminated union of all ContentBlock types used for
 * runtime validation of SSE event data. Kept separate to keep
 * sse-validators.ts focused on event-level validation.
 */

import { z } from 'zod';
import { ALLOWED_IMAGE_HOSTS, isAllowedS3Host } from './image-hosts';

// ─────────────────────────────────────────────────────
// Shared Helpers
// ─────────────────────────────────────────────────────

/** Base fields present on every content block. */
const baseBlockFields = {
  blockId: z.string(),
  variant: z.string().optional(),
};

/** Image URL refinement that restricts URLs to allowed hosts. */
const allowedImageUrl = z.string().url().refine(
  (url) => {
    try {
      const { hostname } = new URL(url);
      return ALLOWED_IMAGE_HOSTS.has(hostname) || isAllowedS3Host(hostname);
    } catch {
      return false;
    }
  },
  'Image URL must be from an allowed host',
);

// ─────────────────────────────────────────────────────
// File Tree (recursive with depth limit)
// ─────────────────────────────────────────────────────

/** Shape of a parsed file tree node (before depth limiting). */
interface FileTreeNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  expanded?: boolean;
}

/** Maximum nesting depth for file tree nodes. Prevents stack overflow from deeply nested LLM output. */
const FILE_TREE_MAX_DEPTH = 10;

/**
 * Recursively truncate children beyond maxDepth to prevent
 * unbounded recursion from malicious or malformed LLM responses.
 */
function limitFileTreeDepth(node: FileTreeNode, maxDepth: number, currentDepth = 0): FileTreeNode {
  if (currentDepth >= maxDepth) {
    return { ...node, children: [] };
  }
  return {
    ...node,
    children: node.children?.map(child => limitFileTreeDepth(child, maxDepth, currentDepth + 1)),
  };
}

// Recursive file tree node schema for file_tree blocks.
// Max 200 children per node to prevent stack overflow from malicious LLM responses.
// Depth is limited to FILE_TREE_MAX_DEPTH via a post-parse transform.
const fileTreeNodeSchema: z.ZodTypeAny = z.object({
  name: z.string().max(500),
  type: z.enum(['file', 'folder']),
  children: z.lazy(() => z.array(fileTreeNodeSchema).max(200)).optional(),
  expanded: z.boolean().optional(),
}).transform((node) => limitFileTreeDepth(node as FileTreeNode, FILE_TREE_MAX_DEPTH));

// ─────────────────────────────────────────────────────
// Content Block Discriminated Union
// ─────────────────────────────────────────────────────

/**
 * Content block schemas for dynamic chapter content.
 * Matches ContentBlock union type in @vie/types (V2.1).
 */
export const contentBlockSchema = z.discriminatedUnion('type', [
  // Base blocks
  z.object({ ...baseBlockFields, type: z.literal('paragraph'), text: z.string() }),
  z.object({ ...baseBlockFields, type: z.literal('bullets'), items: z.array(z.string()) }),
  z.object({ ...baseBlockFields, type: z.literal('numbered'), items: z.array(z.string()) }),
  z.object({
    ...baseBlockFields,
    type: z.literal('do_dont'),
    do: z.array(z.string()),
    dont: z.array(z.string()),
  }),
  z.object({
    ...baseBlockFields,
    type: z.literal('example'),
    title: z.string().optional(),
    code: z.string(),
    explanation: z.string().optional(),
  }),
  z.object({
    ...baseBlockFields,
    type: z.literal('callout'),
    style: z.enum(['tip', 'warning', 'note', 'chef_tip', 'security']),
    text: z.string(),
  }),
  z.object({ ...baseBlockFields, type: z.literal('definition'), term: z.string(), meaning: z.string() }),
  z.object({ ...baseBlockFields, type: z.literal('keyvalue'), items: z.array(z.object({ key: z.string(), value: z.string() })) }),
  z.object({
    ...baseBlockFields,
    type: z.literal('comparison'),
    left: z.object({ label: z.string(), items: z.array(z.string()) }),
    right: z.object({ label: z.string(), items: z.array(z.string()) }),
  }),
  z.object({ ...baseBlockFields, type: z.literal('timestamp'), time: z.string(), seconds: z.number(), label: z.string() }),
  z.object({ ...baseBlockFields, type: z.literal('quote'), text: z.string(), attribution: z.string().optional(), timestamp: z.number().optional() }),
  z.object({
    ...baseBlockFields,
    type: z.literal('statistic'),
    items: z.array(z.object({
      value: z.string(),
      label: z.string(),
      context: z.string().optional(),
      trend: z.enum(['up', 'down', 'neutral']).optional(),
    })),
  }),
  // Universal blocks (V2.1)
  z.object({
    ...baseBlockFields,
    type: z.literal('transcript'),
    lines: z.array(z.object({
      time: z.string(),
      seconds: z.number(),
      text: z.string(),
    })),
  }),
  z.object({ ...baseBlockFields, type: z.literal('timeline'), events: z.array(z.object({ date: z.string(), title: z.string(), description: z.string().optional() })) }),
  z.object({ ...baseBlockFields, type: z.literal('tool_list'), tools: z.array(z.object({ name: z.string(), notes: z.string().optional() })) }),
  // Cooking blocks (V2.1)
  z.object({
    ...baseBlockFields,
    type: z.literal('ingredient'),
    servings: z.number().optional(),
    items: z.array(z.object({
      name: z.string(),
      amount: z.string().optional(),
      unit: z.string().optional(),
      notes: z.string().optional(),
    })),
  }),
  z.object({
    ...baseBlockFields,
    type: z.literal('step'),
    steps: z.array(z.object({
      number: z.number(),
      instruction: z.string(),
      duration: z.number().optional(),
      tips: z.string().optional(),
    })),
  }),
  z.object({
    ...baseBlockFields,
    type: z.literal('nutrition'),
    servingSize: z.string().optional(),
    items: z.array(z.object({
      nutrient: z.string(),
      amount: z.string(),
      unit: z.string().optional(),
      dailyValue: z.string().optional(),
    })),
  }),
  // Coding blocks (V2.1)
  z.object({ ...baseBlockFields, type: z.literal('code'), language: z.string().optional(), code: z.string(), filename: z.string().optional() }),
  z.object({ ...baseBlockFields, type: z.literal('terminal'), command: z.string(), output: z.string().optional() }),
  z.object({ ...baseBlockFields, type: z.literal('file_tree'), tree: z.array(fileTreeNodeSchema) }),
  // Travel blocks (V2.1)
  z.object({ ...baseBlockFields, type: z.literal('location'), name: z.string(), address: z.string().optional(), description: z.string().optional() }),
  z.object({
    ...baseBlockFields,
    type: z.literal('itinerary'),
    days: z.array(z.object({
      day: z.number(),
      title: z.string().optional(),
      activities: z.array(z.object({
        time: z.string().optional(),
        activity: z.string(),
        duration: z.string().optional(),
        location: z.string().optional(),
      })),
    })),
  }),
  z.object({
    ...baseBlockFields,
    type: z.literal('cost'),
    currency: z.string().optional(),
    items: z.array(z.object({
      category: z.string(),
      amount: z.number(),
      notes: z.string().optional(),
    })),
    total: z.number().optional(),
  }),
  // Review blocks (V2.1)
  z.object({
    ...baseBlockFields,
    type: z.literal('pro_con'),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
  }),
  z.object({
    ...baseBlockFields,
    type: z.literal('rating'),
    score: z.number(),
    maxScore: z.number(),
    label: z.string().optional(),
    breakdown: z.array(z.object({
      category: z.string(),
      score: z.number(),
      maxScore: z.number().optional(),
    })).optional(),
  }),
  z.object({
    ...baseBlockFields,
    type: z.literal('verdict'),
    verdict: z.enum(['recommended', 'not_recommended', 'conditional', 'neutral']),
    summary: z.string(),
    bestFor: z.array(z.string()).optional(),
    notFor: z.array(z.string()).optional(),
  }),
  // Fitness blocks (V2.1)
  z.object({
    ...baseBlockFields,
    type: z.literal('exercise'),
    exercises: z.array(z.object({
      name: z.string(),
      sets: z.number().optional(),
      reps: z.string().optional(),
      duration: z.string().optional(),
      rest: z.string().optional(),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      notes: z.string().optional(),
      timestamp: z.number().optional(),
    })),
  }),
  z.object({
    ...baseBlockFields,
    type: z.literal('workout_timer'),
    intervals: z.array(z.object({
      name: z.string(),
      duration: z.number(),
      type: z.enum(['work', 'rest', 'warmup', 'cooldown']),
    })),
    rounds: z.number().optional(),
  }),
  // Education blocks (V2.1)
  z.object({
    ...baseBlockFields,
    type: z.literal('quiz'),
    questions: z.array(z.object({
      question: z.string(),
      options: z.array(z.string()),
      correctIndex: z.number(),
      explanation: z.string().optional(),
    })),
  }),
  z.object({ ...baseBlockFields, type: z.literal('formula'), latex: z.string(), description: z.string().optional(), inline: z.boolean().optional() }),
  // Podcast blocks (V2.1)
  z.object({
    ...baseBlockFields,
    type: z.literal('guest'),
    guests: z.array(z.object({
      name: z.string(),
      title: z.string().optional(),
      bio: z.string().optional(),
      imageUrl: allowedImageUrl.optional(),
      socialLinks: z.array(z.object({
        platform: z.string(),
        url: z.string(),
      })).optional(),
    })),
  }),
  // Quality blocks
  z.object({ ...baseBlockFields, type: z.literal('problem_solution'), problem: z.string(), solution: z.string(), context: z.string().optional() }),
  z.object({
    ...baseBlockFields,
    type: z.literal('visual'),
    description: z.string().optional(),
    timestamp: z.number().optional(),
    label: z.string().optional(),
    s3_key: z.string().optional(),
    imageUrl: allowedImageUrl.optional(),
    // Intentionally overrides baseBlockFields.variant with stricter enum
    variant: z.enum(['diagram', 'screenshot', 'demo', 'whiteboard', 'slideshow', 'gallery']).optional(),
    frames: z.array(z.object({
      timestamp: z.number(),
      s3_key: z.string().optional(),
      imageUrl: allowedImageUrl.optional(),
      caption: z.string().optional(),
    })).optional(),
  }),
]);
