# Frontend Best Practices Refactor Plan

**Last Updated:** 2026-02-01
**Status:** Ready for Implementation
**Effort:** Medium (M) - 3-5 developer-days
**Priority:** High - Code quality and maintainability

---

## Executive Summary

This task addresses findings from a comprehensive frontend best practices audit. The `apps/web/` codebase scored **A- (8.5/10)** overall, with excellent patterns but several oversized components that violate Single Responsibility Principle and file size guidelines.

**Scope:**
- 3 Critical Issues (fix immediately)
- 5 Major Issues (fix this sprint)
- 12 Minor Issues (opportunistic)

**Goal:** Achieve 95%+ compliance with react-vite skill guidelines.

---

## Current State Analysis

### What's Working Well
- React Query for all server state (100% compliance)
- Zustand with granular selectors (no anti-patterns)
- Zero `any` types, strict TypeScript
- Proper useEffect cleanup patterns
- Excellent streaming implementation (token batching)
- Strong error handling

### What Needs Improvement
| Issue | Location | Lines | Violation |
|-------|----------|-------|-----------|
| God component | VideoDetailLayout.tsx | 382 | >300 lines, multiple concerns |
| Giant switch | ContentBlockRenderer.tsx | 451 | >400 lines, 8+ renderers |
| Complex tree | FolderItem.tsx | 366 | Borderline, multiple concerns |
| Size warning | VideoItem.tsx | 322 | >300 lines |
| Missing memoization | VideoGrid.tsx | 216 | Recreates maps every render |
| Export inconsistency | video-detail/*.tsx | N/A | Default exports instead of named |
| Missing displayName | CollapsibleVideoPlayer.tsx | N/A | forwardRef without displayName |

---

## Proposed Future State

### Target Architecture

```
components/video-detail/
├── VideoDetailLayout.tsx (~100 lines - orchestrator)
├── VideoDetailDesktop.tsx (~120 lines)
├── VideoDetailMobile.tsx (~80 lines)
├── VideoHeaderSection.tsx (~60 lines)
├── ContentBlockRenderer.tsx (~100 lines - dispatcher)
└── blocks/
    ├── index.ts
    ├── BulletsBlock.tsx
    ├── NumberedBlock.tsx
    ├── ExampleBlock.tsx
    ├── CalloutBlock.tsx
    ├── QuoteBlock.tsx
    ├── TextBlock.tsx
    ├── CodeBlock.tsx
    └── TableBlock.tsx

components/sidebar/
├── FolderItem.tsx (~150 lines - orchestrator)
├── FolderItemHeader.tsx (~80 lines)
├── FolderItemActions.tsx (~100 lines)
├── VideoItem.tsx (~200 lines)
└── VideoContextMenu.tsx (~100 lines)
```

### Success Metrics
| Metric | Current | Target |
|--------|---------|--------|
| Components under 300 lines | 94% | 98% |
| Named exports | 95% | 100% |
| forwardRef with displayName | Missing 1 | 100% |
| Proper memoization | Missing in VideoGrid | 100% |

---

## Implementation Phases

### Phase 1: Critical - VideoDetailLayout Split (Day 1)
**Effort:** Large (L)
**Risk:** Medium - Core layout component

Split the 382-line god component into focused sub-components.

**Tasks:**
1. Create `VideoDetailDesktop.tsx` - Desktop layout rendering
2. Create `VideoDetailMobile.tsx` - Mobile layout rendering
3. Create `VideoHeaderSection.tsx` - Video info header
4. Refactor `VideoDetailLayout.tsx` to orchestrator pattern
5. Update imports in VideoDetailPage.tsx
6. Visual regression test

**Acceptance Criteria:**
- [ ] VideoDetailLayout.tsx under 150 lines
- [ ] Each sub-component under 150 lines
- [ ] All named exports
- [ ] No behavior changes
- [ ] Tests pass

---

### Phase 2: Critical - ContentBlockRenderer Extraction (Day 1-2)
**Effort:** Large (L)
**Risk:** Low - Isolated rendering components

Extract 8+ block renderers into dedicated files.

**Tasks:**
1. Create `blocks/` directory structure
2. Extract BulletsBlock.tsx
3. Extract NumberedBlock.tsx
4. Extract ExampleBlock.tsx
5. Extract CalloutBlock.tsx
6. Extract remaining blocks (Quote, Text, Code, Table)
7. Create barrel export (blocks/index.ts)
8. Refactor ContentBlockRenderer.tsx to dispatcher
9. Update imports

**Acceptance Criteria:**
- [ ] ContentBlockRenderer.tsx under 150 lines
- [ ] Each block component under 100 lines
- [ ] Consistent props interface across blocks
- [ ] No behavior changes
- [ ] Tests pass

---

### Phase 3: Major - Sidebar Component Refactoring (Day 2-3)
**Effort:** Medium (M)
**Risk:** Medium - Drag-drop complexity

Extract sub-components from VideoItem and FolderItem.

**Tasks:**
1. Extract VideoContextMenu.tsx from VideoItem
2. Extract FolderItemHeader.tsx from FolderItem
3. Extract FolderItemActions.tsx from FolderItem
4. Update drag-drop context preservation
5. Test context menu behavior
6. Test drag-drop functionality

**Acceptance Criteria:**
- [ ] VideoItem.tsx under 250 lines
- [ ] FolderItem.tsx under 200 lines
- [ ] Drag-drop still works
- [ ] Context menus still work
- [ ] Long-press still works on mobile

---

### Phase 4: Major - Code Quality Fixes (Day 3)
**Effort:** Small (S)
**Risk:** Low

Fix memoization, exports, and displayName issues.

**Tasks:**
1. Add useMemo to VideoGrid.tsx grouping logic
2. Convert default exports to named exports in video-detail/
3. Add displayName to CollapsibleVideoPlayer
4. Clean up ref workarounds where possible

**Acceptance Criteria:**
- [ ] No unnecessary re-renders in VideoGrid
- [ ] 100% named exports in video-detail/
- [ ] All forwardRef have displayName
- [ ] npm run lint passes
- [ ] npm run typecheck passes

---

### Phase 5: Minor - Opportunistic Improvements (Ongoing)
**Effort:** Small (S) - As you touch these files
**Risk:** Very Low

Address minor issues when touching related code.

**Tasks (opportunistic):**
1. Create `useLongPress` hook (shared by VideoItem/FolderItem)
2. Extract pluralization helper to utils
3. Document Symbol pattern in AddVideoInput
4. Improve timestamp formatting extraction
5. Consider URL state for sidebar filters

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking drag-drop | High | Medium | Careful context preservation, thorough testing |
| Visual regression | Medium | Low | Side-by-side comparison before/after |
| State management issues | Medium | Low | Keep Zustand usage unchanged |
| Import path breaks | Low | Medium | IDE refactoring tools, grep verification |

---

## Testing Strategy

### Before Starting
```bash
cd apps/web
npm run lint
npm run typecheck
npm run build
```

### After Each Phase
1. Run lint and typecheck
2. Run existing tests
3. Manual visual testing of affected pages
4. Test responsive behavior (desktop/mobile)
5. Test drag-drop (sidebar refactor)

### Final Verification
- [ ] All components under 300 lines
- [ ] All exports are named exports
- [ ] All forwardRef have displayName
- [ ] VideoGrid uses useMemo
- [ ] npm run lint - no errors
- [ ] npm run typecheck - no errors
- [ ] Visual regression test on video detail page
- [ ] Drag-drop works in sidebar

---

## Dependencies

### Required Knowledge
- React component patterns
- Zustand state management
- React Query patterns
- Drag-drop (dnd-kit) library

### Files to Study Before Starting
- `apps/web/src/components/video-detail/VideoDetailLayout.tsx`
- `apps/web/src/components/video-detail/ContentBlockRenderer.tsx`
- `apps/web/src/components/sidebar/FolderItem.tsx`
- `apps/web/src/components/sidebar/VideoItem.tsx`

### Related Documentation
- `.claude/skills/react-vite/SKILL.md`
- `.claude/skills/react-vite/resources/react.md`
- `docs/FRONTEND.md`

---

## Timeline

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: VideoDetailLayout | Day 1 | None |
| Phase 2: ContentBlockRenderer | Day 1-2 | None (parallel) |
| Phase 3: Sidebar Components | Day 2-3 | None (parallel) |
| Phase 4: Code Quality | Day 3 | Phases 1-3 |
| Phase 5: Minor Improvements | Ongoing | None |

**Total Estimate:** 3-5 developer-days

---

## Notes

- This is a refactoring task - no new features
- Prioritize behavior preservation over optimization
- Each phase can be a separate PR for easier review
- Use IDE refactoring tools when possible
- Run tests frequently during extraction
