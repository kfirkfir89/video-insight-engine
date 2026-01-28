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

## Other Active Tasks

See `dev/active/` for all active tasks:
- `integration-testing/` - Integration test suite
- `llm-context-reorganization/` - Context window optimization
- `master-summary/` - Master summary feature
- `progressive-summarization/` - Progressive loading
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

**Last Updated**: 2026-01-28
**Maintained By**: Development Team
