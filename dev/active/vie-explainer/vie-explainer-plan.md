# vie-explainer Implementation Plan

**Last Updated:** 2026-01-08

---

## Executive Summary

Implement vie-explainer - a Python MCP server providing two AI-powered tools for the Video Insight Engine:

| Tool | Purpose | Caching |
|------|---------|---------|
| `explain_auto` | Generate documentation for video sections/concepts | Cached (system-wide) |
| `explain_chat` | Interactive conversation about memorized items | Not cached (per-user) |

**Tech Stack:** Python 3.11, FastMCP, Anthropic SDK, PyMongo, Pydantic

---

## Current State Analysis

### What Exists
- Docker Compose configuration (port 8001)
- MongoDB with indexed collections (`systemExpansionCache`, `userChats`)
- Shared types package (`@vie/types`)
- Complete documentation (SERVICE-EXPLAINER.md, API-MCP-EXPLAINER.md)
- Empty `services/explainer/` directory (only `.gitkeep`)

### What's Needed
- Complete Python service implementation
- MCP server with two tools
- MongoDB integration for caching
- LLM integration for content generation
- Prompt templates for different content types

---

## Proposed Architecture

```
services/explainer/
├── Dockerfile
├── requirements.txt
├── pyproject.toml
└── src/
    ├── __init__.py
    ├── server.py              # FastMCP entry point
    ├── config.py              # Pydantic settings
    ├── tools/
    │   ├── __init__.py
    │   ├── explain_auto.py    # Cached expansion
    │   └── explain_chat.py    # Interactive chat
    ├── services/
    │   ├── __init__.py
    │   ├── mongodb.py         # Database operations
    │   └── llm.py             # Claude API wrapper
    └── prompts/
        ├── explain_section.txt
        ├── explain_concept.txt
        └── chat_system.txt
```

---

## Implementation Phases

### Phase 1: Project Setup (S)
Create project structure and dependencies.

**Deliverables:**
- `requirements.txt` with MCP, Anthropic, PyMongo, Pydantic
- `pyproject.toml` with project metadata and ruff config
- `Dockerfile` based on Python 3.11-slim
- `src/__init__.py` package marker

**Acceptance Criteria:**
- [ ] `pip install -r requirements.txt` succeeds
- [ ] Docker build succeeds

---

### Phase 2: Configuration (S)
Pydantic settings with environment variable support.

**Deliverables:**
- `src/config.py` with Settings class

**Acceptance Criteria:**
- [ ] Settings loads from environment variables
- [ ] Default values work for local development
- [ ] ANTHROPIC_API_KEY is required (validation)

---

### Phase 3: MongoDB Service (M)
Database connection and collection operations.

**Deliverables:**
- `src/services/mongodb.py` with:
  - Database connection singleton
  - `get_video_summary(id)` - Load from videoSummaryCache
  - `get_expansion(videoSummaryId, targetType, targetId)` - Check cache
  - `save_expansion(...)` - Save to cache
  - `get_memorized_item(id, userId)` - User-scoped lookup
  - `get_chat(id, userId)` / `create_chat(...)` / `add_messages(...)`

**Acceptance Criteria:**
- [ ] Connection establishes on first use
- [ ] ObjectId conversion works correctly
- [ ] User-scoped queries enforce userId match

---

### Phase 4: LLM Service (M)
Anthropic Claude API wrapper.

**Deliverables:**
- `src/services/llm.py` with:
  - `load_prompt(name)` - Load template from prompts/
  - `generate_expansion(template_name, context)` - Format and call Claude
  - `chat_completion(system_prompt, messages)` - Conversation completion

**Acceptance Criteria:**
- [ ] Templates load correctly from src/prompts/
- [ ] Claude API calls succeed with valid API key
- [ ] Errors are caught and wrapped appropriately

---

### Phase 5: Prompt Templates (S)
Template files for LLM prompts.

**Deliverables:**
- `src/prompts/explain_section.txt`
- `src/prompts/explain_concept.txt`
- `src/prompts/chat_system.txt`

**Acceptance Criteria:**
- [ ] Templates match SERVICE-EXPLAINER.md specifications
- [ ] All placeholder variables are documented

---

### Phase 6: explain_auto Tool (L)
Cache-first expansion generation.

**Deliverables:**
- `src/tools/explain_auto.py` with main function

**Logic Flow:**
1. Check systemExpansionCache for existing entry
2. If cached: return content
3. If not cached:
   - Load videoSummaryCache entry
   - Find target section or concept by ID
   - Build context from target data
   - Generate expansion via LLM
   - Save to systemExpansionCache
   - Return content

**Acceptance Criteria:**
- [ ] Returns cached content without LLM call
- [ ] Generates and caches new content correctly
- [ ] Handles "section not found" and "concept not found"
- [ ] Handles "video summary not found"

---

### Phase 7: explain_chat Tool (L)
Interactive chat about memorized items.

**Deliverables:**
- `src/tools/explain_chat.py` with main function

**Logic Flow:**
1. Load memorizedItem (verify userId ownership)
2. Load or create userChat
3. Build system prompt from memorized content
4. Format conversation history
5. Call LLM with conversation
6. Save messages to chat
7. Return `{response, chatId}`

**Acceptance Criteria:**
- [ ] Creates new chat when chatId not provided
- [ ] Continues existing chat when chatId provided
- [ ] Enforces user ownership of memorized items
- [ ] Persists all messages correctly

---

### Phase 8: MCP Server Entry Point (M)
FastMCP server with tool registration.

**Deliverables:**
- `src/server.py` with:
  - FastMCP instance creation
  - `@mcp.tool()` decorated functions
  - Entry point for `python -m src.server`

**Acceptance Criteria:**
- [ ] MCP server starts without errors
- [ ] Tools are discoverable via MCP protocol
- [ ] Tool calls route to correct implementations
- [ ] Errors return JSON error objects

---

### Phase 9: Docker & Integration (M)
Verify Docker build and container operation.

**Deliverables:**
- Working Docker container
- Verified environment variable handling

**Acceptance Criteria:**
- [ ] `docker-compose build vie-explainer` succeeds
- [ ] Container starts and connects to MongoDB
- [ ] Logs show server initialization
- [ ] Environment variables are read correctly

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| MCP SDK API changes | High | Low | Pin version in requirements.txt |
| PyMongo async compatibility | Medium | Low | Use sync client, wrap in to_thread if needed |
| Prompt template paths in Docker | Medium | Medium | Use `__file__` relative paths |
| Claude API rate limits | Medium | Medium | Add retry logic with backoff |

---

## Success Metrics

1. **Functional:** Both MCP tools work end-to-end
2. **Performance:** Cached lookups < 100ms, LLM calls < 30s
3. **Reliability:** Graceful error handling for all failure modes
4. **Observability:** Structured logging for debugging

---

## Timeline Estimate

| Phase | Effort |
|-------|--------|
| Phase 1: Project Setup | S |
| Phase 2: Configuration | S |
| Phase 3: MongoDB Service | M |
| Phase 4: LLM Service | M |
| Phase 5: Prompt Templates | S |
| Phase 6: explain_auto Tool | L |
| Phase 7: explain_chat Tool | L |
| Phase 8: MCP Server Entry Point | M |
| Phase 9: Docker & Integration | M |

**Effort Key:** S = Small, M = Medium, L = Large
