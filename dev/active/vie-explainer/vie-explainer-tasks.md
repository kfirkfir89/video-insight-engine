# vie-explainer Tasks

**Last Updated:** 2026-01-08
**Status:** COMPLETE

---

## Phase 1: Project Setup

- [x] Create `services/explainer/requirements.txt`
- [x] Create `services/explainer/pyproject.toml`
- [x] Create `services/explainer/Dockerfile`
- [x] Create `services/explainer/src/__init__.py`
- [x] Verify `pip install -r requirements.txt` succeeds (via Docker build)

---

## Phase 2: Configuration

- [x] Create `services/explainer/src/config.py`
  - [x] Settings class with MONGODB_URI, ANTHROPIC_API_KEY, ANTHROPIC_MODEL
  - [x] Environment variable loading
  - [x] Default values for optional settings

---

## Phase 3: MongoDB Service

- [x] Create `services/explainer/src/services/__init__.py`
- [x] Create `services/explainer/src/services/mongodb.py`
  - [x] Database connection singleton
  - [x] `get_video_summary(video_summary_id)` function
  - [x] `get_expansion(video_summary_id, target_type, target_id)` function
  - [x] `save_expansion(...)` function
  - [x] `get_memorized_item(item_id, user_id)` function
  - [x] `get_chat(chat_id, user_id)` function
  - [x] `create_chat(user_id, memorized_item_id)` function
  - [x] `add_messages(chat_id, messages)` function

---

## Phase 4: LLM Service

- [x] Create `services/explainer/src/services/llm.py`
  - [x] `load_prompt(name)` function
  - [x] `generate_expansion(template_name, context)` async function
  - [x] `chat_completion(system_prompt, messages)` async function
  - [x] Error handling for API failures

---

## Phase 5: Prompt Templates

- [x] Create `services/explainer/src/prompts/` directory
- [x] Create `services/explainer/src/prompts/explain_section.txt`
- [x] Create `services/explainer/src/prompts/explain_concept.txt`
- [x] Create `services/explainer/src/prompts/chat_system.txt`

---

## Phase 6: explain_auto Tool

- [x] Create `services/explainer/src/tools/__init__.py`
- [x] Create `services/explainer/src/tools/explain_auto.py`
  - [x] Cache check logic
  - [x] Video summary loading
  - [x] Section/concept target finding
  - [x] Context building for sections
  - [x] Context building for concepts
  - [x] LLM generation call
  - [x] Cache save logic
  - [x] Error handling (NOT_FOUND, LLM_ERROR)

---

## Phase 7: explain_chat Tool

- [x] Create `services/explainer/src/tools/explain_chat.py`
  - [x] Memorized item loading (user-scoped)
  - [x] Chat loading or creation
  - [x] System prompt building from memorized content
  - [x] Message history formatting
  - [x] LLM chat completion call
  - [x] Message persistence
  - [x] Response formatting (JSON)
  - [x] Error handling (NOT_FOUND, UNAUTHORIZED)

---

## Phase 8: MCP Server Entry Point

- [x] Create `services/explainer/src/server.py`
  - [x] Server instance creation
  - [x] `@server.list_tools()` with tool schemas
  - [x] `@server.call_tool()` with routing logic
  - [x] Main entry point function
  - [x] Error wrapping for tool responses

---

## Phase 9: Docker & Integration

- [x] Verify Dockerfile builds successfully
- [x] Test `docker build` (docker-compose has WSL issue)
- [x] Verify imports work in container
- [x] Verify environment variables are loaded
- [ ] End-to-end test with real MongoDB and Anthropic API

---

## Verification Checklist

- [x] MCP server starts in Docker container
- [x] Tools are discoverable (list_tools returns both tools)
- [ ] explain_auto returns cached content on cache hit (needs integration test)
- [ ] explain_auto generates and caches new content (needs integration test)
- [ ] explain_chat creates new chat correctly (needs integration test)
- [ ] explain_chat continues existing chat (needs integration test)
- [x] Error responses are valid JSON

---

## Notes

- Used `@server.list_tools()` and `@server.call_tool()` API instead of `@server.tool()` decorator (MCP SDK v1.25.0)
- Docker-compose build has WSL bind mount issue, but direct `docker build` works fine
- Integration tests require running MongoDB with test data and valid Anthropic API key
