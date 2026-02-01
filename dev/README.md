# Development Tasks & Documentation

This directory contains active development tasks, plans, and documentation for Video Insight Engine.

---

## Directory Structure

```
dev/
├── README.md                    # This file
├── scratchpad.md                # Quick notes, current context
└── active/                      # Active development tasks
    └── [task-name]/             # Individual task directories
        ├── [task-name]-plan.md       # Comprehensive implementation plan
        ├── [task-name]-context.md    # Key files, decisions, dependencies
        └── [task-name]-tasks.md      # Checklist for tracking progress
```

---

## Active Tasks

### API Best Practices Refactor
**Status**: Ready for Implementation
**Location**: `dev/active/api-best-practices/`
**Effort**: XL (5-7 developer-days)

Comprehensive refactor to address critical gaps from best practices audit: no tests (0%), missing helmet, no DI, no repository layer, no process handlers.

**Files**:
- `api-best-practices-plan.md` - Full implementation plan (4 phases)
- `api-best-practices-context.md` - Code patterns, key files, decisions
- `api-best-practices-tasks.md` - 31 tasks with acceptance criteria

**Phases**:
1. **Security Hardening** (S) - Helmet, process handlers, rate limits
2. **Bootstrap Refactor** (M) - buildApp(), DI container, indexes
3. **Repository Layer** (L) - Separate data access, entity mapping
4. **Test Suite** (L) - Vitest, 80% coverage, CI integration

**Quick Wins** (Do First):
- Register helmet plugin
- Add process exception handlers
- Fix exponential backoff
- Add playlist rate limit

**Current Score**: 6.5/10 → **Target**: 9/10

---

### Video Processing Auto-Resume & Sidebar Sync
**Status**: Ready for Implementation
**Location**: `dev/active/processing-auto-resume/`
**Effort**: Medium (M) - 3 phases, ~8 hours

Fix critical UX issues where video processing doesn't auto-resume after browser refresh and sidebar shows stale data.

**Files**:
- `processing-auto-resume-plan.md` - Implementation plan (3 phases)
- `processing-auto-resume-context.md` - Key files, decisions, data flow
- `processing-auto-resume-tasks.md` - 15 tasks with acceptance criteria

**Key Features**:
- App-level Processing Manager auto-starts SSE for all processing videos
- WebSocket metadata events for sidebar title sync
- Shared state between sidebar and detail page
- No duplicate SSE connections

**Next Steps**:
1. Backend WebSocket enhancement (Phase 1)
2. Frontend Processing Manager (Phase 2)
3. Integration & Testing (Phase 3)

---

### YouTube Playlist Support
**Status**: Ready for Implementation
**Location**: `dev/active/playlist-support/`
**Effort**: Large (XL) - 5 phases

Add playlist import support to summarize entire YouTube playlists into a single folder with preserved ordering.

**Files**:
- `playlist-support-plan.md` - Comprehensive implementation plan (5 phases)
- `playlist-support-context.md` - Key files, patterns, database schemas
- `playlist-support-tasks.md` - 28 tasks with acceptance criteria

**Key Features**:
- Mode toggle (Single Video | Playlist) in UI
- yt-dlp playlist extraction via summarizer
- Auto-create folder with playlist name
- Preserve video ordering via playlistInfo
- Cache deduplication (no re-processing)

**Next Steps**:
1. URL parsing foundation (Phase 1)
2. Add types and data model (Phase 2)
3. Summarizer playlist extraction (Phase 3)
4. Backend API and service (Phase 4)
5. Frontend implementation (Phase 5)

---

### Dev Tool for Model Selection
**Status**: Ready for Implementation
**Location**: `dev/active/dev-tool/`
**Effort**: Small (2-3 hours)

Add a dev-only UI panel to select LLM provider (anthropic/openai/gemini) for re-summarizing videos.

**Files**:
- `dev-tool-plan.md` - Implementation plan (9 files, 3 phases)
- `dev-tool-context.md` - Key files, model mapping, data flow
- `dev-tool-tasks.md` - Task checklist with acceptance criteria

**Key Features**:
- Dev-only panel (hidden in production)
- Provider selection: anthropic, openai, gemini
- Extends existing routes (no new endpoints)
- Request-scoped provider override

**Next Steps**:
1. Create frontend components (Phase 1)
2. Add API pass-through (Phase 2)
3. Implement summarizer override (Phase 3)

---

### Multi-Provider LLM Integration
**Status**: ✅ Complete
**Location**: `dev/active/multi-provider-llm/`

LiteLLM migration for multi-provider support (Anthropic, OpenAI, Gemini).

**Files**:
- `multi-provider-llm-plan.md` - Architecture and implementation details
- `multi-provider-llm-context.md` - Technical context
- `multi-provider-llm-tasks.md` - Completed task checklist

---

### Frontend Best Practices Refactor
**Status**: Ready for Implementation
**Location**: `dev/active/frontend-refactor/`
**Effort**: Medium (M) - 3-5 developer-days

Address findings from frontend best practices audit. Split oversized components, fix export patterns, add missing memoization.

**Files**:
- `frontend-refactor-plan.md` - Comprehensive refactoring plan
- `frontend-refactor-context.md` - Key files, architecture decisions
- `frontend-refactor-tasks.md` - 31 tasks with acceptance criteria

**Key Targets**:
- VideoDetailLayout.tsx (382 → ~100 lines)
- ContentBlockRenderer.tsx (451 → ~100 lines)
- FolderItem.tsx (366 → ~180 lines)
- VideoItem.tsx (322 → ~220 lines)

**Next Steps**:
1. Phase 1: Split VideoDetailLayout
2. Phase 2: Extract ContentBlockRenderer blocks
3. Phase 3: Refactor sidebar components
4. Phase 4: Fix code quality issues

---

### Backend Python Services Refactor
**Status**: Ready for Implementation
**Location**: `dev/active/backend-python-refactor/`
**Effort**: Large (L) - 4-6 developer-days

Refactor `services/summarizer/` and `services/explainer/` to align with backend-python skill best practices.

**Files**:
- `backend-python-refactor-plan.md` - Comprehensive implementation plan (5 phases)
- `backend-python-refactor-context.md` - Key files, patterns, migration details
- `backend-python-refactor-tasks.md` - 33 tasks with acceptance criteria

**Key Fixes**:
- Replace blocking PyMongo with Motor async driver (Critical)
- Extract business logic from stream.py (928 → ~300 lines)
- Add FastAPI Depends() DI pattern to explainer
- Create repository pattern for explainer

**Phases**:
1. **Explainer Async MongoDB** (M) - Motor migration
2. **Explainer DI** (S) - FastAPI Depends()
3. **Explainer Repository** (M) - Repository pattern
4. **Summarizer Stream** (M) - Extract pipeline service
5. **Cross-Cutting** (S) - Structured logging

---

## Other Active Tasks

See `dev/active/` for all active tasks:
- `integration-testing/` - Integration test suite
- `llm-context-reorganization/` - Context window optimization
- `master-summary/` - Master summary feature
- `progressive-summarization/` - Progressive loading
- `transcript-system/` - Transcript processing
- `video-context/` - Video context extraction
- `vie-explainer/` - Explainer service development

---

## Task Management Guidelines

### Creating a New Task

When starting a new major feature or refactoring:

1. **Create task directory**: `dev/active/[task-name]/`
2. **Generate three files**:
   - `[task-name]-plan.md` - The comprehensive plan
   - `[task-name]-context.md` - Key technical information
   - `[task-name]-tasks.md` - Checklist for progress tracking

### Using Claude Code Commands

```bash
/task-plan {name}      # Create new task documentation
/task-plan-update      # Update docs before context reset
/list-tasks            # List all active tasks
/resume {task}         # Resume after chat clear
```

---

**Last Updated**: 2026-02-01
**Maintained By**: Development Team
