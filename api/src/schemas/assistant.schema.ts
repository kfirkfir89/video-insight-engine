import { z } from 'zod';
import { ASSISTANT_ACTIONS } from '../services/assistant-client.js';

// Bound the param map so the assistant action routes can't be used to push
// megabytes through to the assistant service. Limits chosen to comfortably
// cover save_note text, quiz_me topic, find_moment query, and explain concept
// while rejecting abuse.
const ACTION_PARAM_VALUE_MAX = 4000;
const ACTION_PARAM_KEY_MAX = 64;
const ACTION_PARAMS_MAX_ENTRIES = 16;

/**
 * Shared, bounded param map for every assistant action route. Both the
 * video-scoped `/api/videos/:id/action` route and the library-wide
 * `/api/assistant/action` proxy import this so the bounds can't drift apart.
 */
export const actionParamsSchema = z
  .record(
    z.string().min(1).max(ACTION_PARAM_KEY_MAX),
    z.union([z.string().max(ACTION_PARAM_VALUE_MAX), z.number(), z.boolean()]),
  )
  .refine(
    (obj) => Object.keys(obj).length <= ACTION_PARAMS_MAX_ENTRIES,
    `too many params (max ${ACTION_PARAMS_MAX_ENTRIES})`,
  );

/**
 * Full action enum for the library-wide action proxy, derived from the single
 * source of truth in `assistant-client` so the validator tracks the union.
 */
export const actionEnumSchema = z.enum(ASSISTANT_ACTIONS);
