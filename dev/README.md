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

**Last Updated**: 2025-01-25
**Maintained By**: Development Team
