# Development Scratchpad

**Last Updated:** 2026-02-02 (TDD Infrastructure Session)

---

## Session Handoff Notes

### What Was Being Worked On

**Task: TDD Infrastructure & Test Coverage**

**Status: ~85% COMPLETE** - Major test coverage expansion across all services

### Current State

| Service | Before | After | Status |
|---------|--------|-------|--------|
| vie-api | 9 test files, 75 tests | 29 test files, 551 tests | ⚠️ 19 failing |
| vie-web | 0 unit tests | 15 test files, 418 tests | ⚠️ 8 failing |
| vie-summarizer | 3 test files | 12+ test files | ✅ Created |

### Immediate Next Steps

1. **Fix 27 failing tests** (19 vie-api + 8 vie-web)
2. **Verify vie-summarizer tests in Docker**: `docker exec vie-summarizer python -m pytest -v`
3. **Complete Phase 4** (3 remaining tasks)
4. **Optional: Phase 5** component tests

### Commands to Run on Resume

```bash
# Check test status
cd /home/kfir/projects/video-insight-engine

# vie-api
cd api && npm test -- --run 2>&1 | tail -10

# vie-web
cd ../apps/web && npm test -- --run 2>&1 | tail -10

# vie-summarizer (in Docker)
docker exec vie-summarizer python -m pytest -v 2>&1 | head -50
```

### Known Issues to Fix

1. **BUG-1**: `summarizer-client.test.ts` - Timer mocking with retry logic
2. **BUG-2**: `rate-limit.test.ts` - Mock timing issues
3. **BUG-3**: `youtube-utils.ts` - `extractVideoId()` fails when `v` param not first
4. **BUG-4**: Various hook test timing issues

---

## Previous Session (2026-01-21) - Video Context Backend

**Status: ALL PHASES COMPLETE**

- Backend phases 1-3 already implemented (discovered during code review)
- All context extraction, persona loading, and SSE integration in place
- Remaining: Verification testing with real videos

---

## Architecture Notes

### Test Infrastructure Architecture (NEW)

```
vie-api/
├── vitest.config.ts           # Vitest + coverage
├── src/test/
│   ├── setup.ts               # Global mocks
│   ├── helpers.ts             # buildTestApp(), factories
│   └── factories/             # Test data factories
└── src/**/__tests__/*.test.ts # Co-located tests

vie-web/
├── vitest.config.ts           # jsdom environment
├── src/test/
│   ├── setup.ts               # MSW, global mocks
│   ├── test-utils.tsx         # createWrapper(), renderWithProviders()
│   └── mocks/
│       ├── server.ts          # MSW server
│       └── handlers.ts        # API handlers
└── src/**/__tests__/*.test.ts # Co-located tests

vie-summarizer/
├── pytest.ini                 # pytest config
├── requirements.txt           # pytest deps
└── tests/
    ├── conftest.py            # Shared fixtures
    └── test_*.py              # Test files
```

### Test Patterns Established

**vie-api (DI + Mocking)**:
```typescript
const mockRepo = { findById: vi.fn() };
const service = new VideoService(mockRepo);
mockRepo.findById.mockResolvedValue(video);
await service.findById('123');
expect(mockRepo.findById).toHaveBeenCalledWith('123');
```

**vie-web (MSW + Hooks)**:
```typescript
server.use(
  http.get('/api/videos', () => HttpResponse.json({ data: videos }))
);
const { result } = renderHook(() => useVideos(), { wrapper: createWrapper() });
await waitFor(() => expect(result.current.videos).toEqual(videos));
```

**vie-summarizer (pytest + AsyncMock)**:
```python
@pytest.fixture
def mock_http_client():
    return AsyncMock()

@pytest.mark.asyncio
async def test_fetch(service, mock_http_client):
    mock_http_client.get.return_value = {"title": "Test"}
    result = await service.fetch("id")
    assert result["title"] == "Test"
```

### Timestamp Playback Architecture

```
User clicks timestamp "4:12" (252 seconds)
  → TimestampRenderer calls onPlay(252)
  → ContentBlocks calls onPlay(252)
  → ArticleSection calls onPlay(sectionId, 252)
  → VideoDetailLayout.handlePlayFromSection(sectionId, 252)
    → setActivePlaySection(sectionId)
    → setActiveStartSeconds(252)
    → Scrolls to section
  → ArticleSection re-renders with isVideoActive=true, startSeconds=252
    → YouTubePlayer renders with startSeconds=252, autoplay=true
    → ContentBlocks receives isVideoActive=true, activeStartSeconds=252
      → TimestampRenderer with seconds=252 shows STOP (isActive=true)
      → Other timestamps show PLAY (isActive=false)
```

### Persona System Flow
```
Video URL submitted
  → YouTube metadata extracted (category, tags)
  → _determine_persona() checks against persona_rules.json
  → Returns: 'code', 'recipe', 'interview', 'review', or 'standard'
  → load_persona(name) loads prompts/personas/{name}.txt
  → load_examples(name) loads prompts/examples/{name}.txt
  → LLM generates summary with persona-specific blocks
```

---

## Quick Reference

### Test Accounts
- Admin: `admin@admin.com` / `Admin123`

### Service URLs
- Frontend: http://localhost:5173
- API: http://localhost:3000
- Summarizer: http://localhost:8000

### Key Files

**Test Infrastructure:**
- vie-api config: `api/vitest.config.ts`
- vie-api helpers: `api/src/test/helpers.ts`
- vie-web config: `apps/web/vitest.config.ts`
- vie-web helpers: `apps/web/src/test/test-utils.tsx`
- vie-summarizer config: `services/summarizer/pytest.ini`
- vie-summarizer fixtures: `services/summarizer/tests/conftest.py`

**Application Code:**
- Timestamp rendering: `apps/web/src/components/video-detail/blocks/TimestampRenderer.tsx`
- Content blocks container: `apps/web/src/components/video-detail/ContentBlocks.tsx`
- Video layout state: `apps/web/src/components/video-detail/VideoDetailLayout.tsx`
- Persona loading: `services/summarizer/src/services/llm.py`
- Persona detection: `services/summarizer/src/services/youtube.py`
- SSE streaming: `apps/web/src/hooks/use-summary-stream.ts`

---

## Active Task Documentation

### TDD Infrastructure (IN PROGRESS)
See `/dev/active/tdd-infrastructure/` for:
- `tdd-infrastructure-plan.md` - Full implementation plan
- `tdd-infrastructure-context.md` - Decisions and patterns
- `tdd-infrastructure-tasks.md` - Task checklist (55/65 done)

**Progress:**
- ✅ Phase 1: Infrastructure Setup (8/8)
- ✅ Phase 2: Critical Path Tests (13/13)
- ✅ Phase 3: Core Feature Tests (16/16)
- ⏳ Phase 4: Supporting Tests (18/22)
- 🔲 Phase 5: Component Tests (0/6)

**Blockers:** 27 failing tests need fixes before Phase 5

### Video Context Enhancement (COMPLETE)
See `/dev/active/video-context/` for:
- All phases complete
- Need verification testing with real videos

### LLM Context Reorganization (COMPLETE)
See `/dev/active/llm-context-reorganization/` for:
- All tasks complete
- Persona system file-based

---

## Uncommitted Changes

**Large amount of new test files - review git status**

New test files created:
- 20 new vie-api test files
- 15 new vie-web test files
- 9 new vie-summarizer test files
- Test infrastructure (vitest.config.ts, setup.ts, etc.)

**Recommendation:**
1. Fix failing tests first
2. Commit passing tests in batches by service
3. Create separate commits for infrastructure vs tests
