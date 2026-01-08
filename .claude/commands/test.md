# /test Command

Generate tests for specified code.

## Usage

```
/test api/src/services/video.service.ts
/test web/src/components/VideoCard.tsx
/test summarizer/src/services/transcript.py
```

## What It Does

1. **Analyze the file** - Understand exports, functions, classes
2. **Identify test cases** - Happy paths, edge cases, errors
3. **Generate test file** - Following project patterns
4. **Apply test-writer agent**

## Test Strategy

### Unit Tests

For pure functions and classes:
- Test each public method
- Test edge cases
- Test error conditions
- Mock dependencies

### Component Tests

For React components:
- Test rendering
- Test user interactions
- Test props handling
- Test accessibility

### Integration Tests

For services:
- Test with real (test) database
- Test full request flow
- Test error scenarios

## Output

Creates test file adjacent to source:
- `video.service.ts` → `video.service.test.ts`
- `VideoCard.tsx` → `VideoCard.test.tsx`
- `transcript.py` → `test_transcript.py`

## Example Output

```typescript
// video.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VideoService } from './video.service';

describe('VideoService', () => {
  // ... generated tests
});
```
