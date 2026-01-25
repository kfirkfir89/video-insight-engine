---
description: Update project documentation for changes (docs/, CLAUDE.md, README.md)
argument-hint: Describe what changed (e.g., "added caching layer", "new auth flow")
---

Update project documentation to reflect recent changes: $ARGUMENTS

## Instructions

### 1. Analyze Changes

Identify what documentation needs updating based on $ARGUMENTS:
- New features added
- Architecture changes
- Pattern changes
- New technologies/dependencies
- API changes
- Configuration changes

### 2. Update docs/ Folder

Check and update relevant files in `docs/`:

| Change Type | Files to Check |
|-------------|----------------|
| New API endpoints | `docs/API-REFERENCE.md` |
| Architecture changes | `docs/ARCHITECTURE.md`, `docs/PROJECT-STRUCTURE.md` |
| New service | `docs/SERVICE-*.md` (create if needed) |
| Data model changes | `docs/DATA-MODELS.md` |
| Security changes | `docs/SECURITY.md` |
| Error handling | `docs/ERROR-HANDLING.md` |
| Caching changes | `docs/CACHING.md` |
| Infrastructure | `docs/INFRASTRUCTURE.md` |
| Cross-cutting | `docs/CROSS-CUTTING.md` |
| Frontend changes | `docs/FRONTEND.md` |

### 3. Update CLAUDE.md

Check if changes affect:
- Tech stack table
- Available commands table
- Available agents table
- Key design decisions
- Quick start instructions
- Full documentation index

### 4. Update README.md

Check if changes affect:
- Project description
- Features list
- Installation/setup instructions
- Usage examples
- Architecture overview
- Contributing guidelines

## Output Format

```
## 📚 Documentation Update Report

### Changes Made

#### docs/ Folder
- ✏️ Updated: docs/API-REFERENCE.md
  - Added new /api/cache endpoints
- ✏️ Updated: docs/ARCHITECTURE.md
  - Added caching layer diagram
- ➕ Created: docs/CACHING.md
  - New caching strategy documentation

#### CLAUDE.md
- ✏️ Updated: Tech stack table (added Redis)
- ✏️ Updated: Key design decisions

#### README.md
- ✏️ Updated: Features list
- ✏️ Updated: Architecture section

### No Changes Needed
- docs/SECURITY.md (no security-related changes)
- docs/ERROR-HANDLING.md (existing patterns sufficient)

### Recommendations
- Consider adding usage examples for new cache API
- May want to update related skill resources
```

## Quality Standards

- Keep documentation consistent with existing style
- Use same markdown formatting patterns
- Update "Last Updated" dates where applicable
- Cross-reference related documentation
- Include code examples where helpful
- Don't add unnecessary documentation
- Focus on changes that affect how others use or understand the system
