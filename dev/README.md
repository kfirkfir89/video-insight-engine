# Development Tasks & Documentation

This directory contains active development tasks, plans, and documentation for the Price Comparison Platform.

---

## Directory Structure

```
dev/
├── README.md                    # This file
└── active/                      # Active development tasks
    └── [task-name]/             # Individual task directories
        ├── [task-name]-plan.md       # Comprehensive implementation plan
        ├── [task-name]-context.md    # Key files, decisions, dependenciesw
        └── [task-name]-tasks.md      # Checklist for tracking progress
```

---

## Active Tasks

### Schema-Driven Scraping
**Status**: Ready for Implementation
**Location**: `dev/active/schema-driven-scraping/`

Transform the scraper service from hardcoded scrapers into a self-healing, schema-driven system.

**Files**:
- `schema-driven-scraping-plan.md` - Complete 6-phase implementation plan (42 days)
- `schema-driven-scraping-context.md` - Technical context, configuration, architecture decisions
- `schema-driven-scraping-tasks.md` - Task checklist with ~150 actionable items

**Key Features**:
- Automatic schema discovery from any e-commerce site
- Self-validation and auto-activation (>80% success threshold)
- Automatic schema updates when sites change
- Proxy rotation + advanced stealth mode
- Hebrew language support for Israeli shops

**Next Steps**:
1. Review plan with team
2. Create feature branch: `feature/schema-driven-scraping`
3. Begin Phase 1: Core Schema System

---

## Task Management Guidelines

### Creating a New Task

When starting a new major feature or refactoring:

1. **Create task directory**: `dev/active/[task-name]/`
2. **Generate three files**:
   - `[task-name]-plan.md` - The comprehensive plan
   - `[task-name]-context.md` - Key technical information
   - `[task-name]-tasks.md` - Checklist for progress tracking

---

**Last Updated**: 2025-11-26
**Maintained By**: Development Team
