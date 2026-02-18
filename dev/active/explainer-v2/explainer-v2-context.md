# Explainer V2.1 — Key Context

> Last Updated: 2026-02-17 (V2.1 COMPLETE)

## Status: COMPLETE (V2.1 Enterprise Quality Hardening)

V1 complete (2026-02-16). V2.1 complete (2026-02-17) — security, quality, rendering, and error handling all hardened.

---

## Critical Files to Modify

### Backend (Python) — `services/explainer/src/`

| File | Line(s) | Issue |
|------|---------|-------|
| `services/llm.py` | 67 | `template.format(**context)` — format string vulnerability |
| `tools/video_chat.py` | 69 | `.format()` on system prompt with user-influenced data |
| `tools/video_chat.py` | 81 | `user_message` not truncated |
| `tools/explain_auto.py` | 86 | `max_tokens=2000` hardcoded for all types |
| `services/llm_provider.py` | 149-163 | Raw LiteLLM exceptions re-raised |
| `services/llm_provider.py` | 290-299 | Same in streaming path |
| `server.py` | 42-68, 72-98 | No LLMError catch in tool wrappers |
| `prompts/video_chat_system.txt` | All | No anti-injection, no conciseness |
| `prompts/explain_concept.txt` | All | 400-800 words for popover (too long) |
| `prompts/explain_section.txt` | All | 500-1000 words, no structure |

### Frontend (React) — `apps/web/src/`

| File | Line(s) | Issue |
|------|---------|-------|
| `components/video-detail/GoDeepDrawer.tsx` | 65 | `whitespace-pre-wrap` plain text |
| `components/video-detail/ConceptHighlighter.tsx` | 59-66 | Plain `<p>` in 320px popover |
| `components/video-detail/ConceptHighlighter.tsx` | 197 | `max-w-xs` too narrow |
| `components/video-detail/VideoChatPanel.tsx` | 43-52 | Plain text message bubbles |
| `components/video-detail/MasterSummaryModal.tsx` | 51-87 | Inline ReactMarkdown (reuse as pattern) |

### Not installed
| Package | Where | Purpose |
|---------|-------|---------|
| `@tailwindcss/typography` | `apps/web/` | Makes `prose` classes functional |

### Already available
| Resource | Location | Notes |
|----------|----------|-------|
| `react-markdown` v10.1.0 | `apps/web/package.json` | Installed, used in MasterSummaryModal |
| `LLMError` class | `services/explainer/src/exceptions.py:41-48` | Defined, never imported |
| ReactMarkdown overrides | `MasterSummaryModal.tsx:51-87` | Pattern to extract into shared component |

---

## Key Decisions from V1 (Still Apply)

1. **Starlette over FastAPI** — FastAPI lifespan bug with MCP mounting
2. **Streamable HTTP** — MCP spec 2025-03-26 standard
3. **Video Chat is Ephemeral** — No server-side persistence, React state only
4. **VideoSummaryIdContext** — Threads videoSummaryId to nested components

## New Decisions for V2.1

5. **`string.Template` over `.format()`** — Immune to `{__class__}` format string injection
6. **Per-use-case token limits** — concept=800, section=1500, chat=1000
7. **Shared MarkdownContent** — One component, two modes (full + compact)
8. **Widen concept popover** — `max-w-xs` → `max-w-sm` with scroll overflow
9. **Cache invalidation** — Clear `systemExpansionCache` after prompt changes

---

## Dependencies Between Phases

```
Phase 1 (Security)  ──→  Phase 2 (Quality)    [Phase 2 needs $var syntax from Phase 1]
Phase 3 (Frontend)  ──  independent            [Can run in parallel with P1+P2]
Phase 4 (Errors)    ──  independent            [Can run in parallel]
```

---

## Test Coverage (V2.1 verified)

| Suite | Files | Tests | Status |
|-------|-------|-------|--------|
| API unit tests | 29 | 515 | ✅ All pass |
| Web unit tests | 49 | 1057 | ✅ All pass |
| TypeScript (API + Web) | - | 0 errors | ✅ Clean |
| Playwright E2E | 1 | 16 | ✅ All pass |
| Playwright manual (V2.1) | - | 5 viewports | ✅ All verified |

**V2.1 testing:** All existing tests pass. Playwright manual tests verified layout at desktop (1440px), tablet (768px), mobile (375px), plus Go Deeper drawer and concept popover markdown rendering.
