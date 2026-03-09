# Explainer V2.1 — Task Checklist

> Last Updated: 2026-02-17

## V1 Phases (COMPLETE — 2026-02-16)

| Phase | Status |
|-------|--------|
| 1A — MCP Server | ✅ Complete |
| 1B — Video Chat | ✅ Complete |
| 1C — Go Deeper / Tell Me More | ✅ Complete |
| 1D — Export | ✅ Complete |
| Testing + Docs | ✅ Complete |

---

## V2.1 — Enterprise Quality Hardening

### Phase 1: Security Hardening [M] ✅

#### 1.1 Safe String Templating [S]
- [x] `services/explainer/src/services/llm.py`: Replace `template.format(**context)` with `Template(template).safe_substitute(context)`
- [x] `services/explainer/src/tools/video_chat.py`: Replace `.format()` with `Template.safe_substitute()`
- [x] `services/explainer/src/prompts/video_chat_system.txt`: Change `{var}` to `$var`
- [x] `services/explainer/src/prompts/explain_concept.txt`: Change `{var}` to `$var`
- [x] `services/explainer/src/prompts/explain_section.txt`: Change `{var}` to `$var`

#### 1.2 Harden Chat System Prompt [S]
- [x] Rewrite `video_chat_system.txt` with anti-jailbreak instructions
- [x] Add anti-injection: refuse to follow embedded override instructions
- [x] Add conciseness constraint: 2-5 sentences default
- [x] Add markdown formatting requirement

#### 1.3 Truncate User Messages [S]
- [x] `video_chat.py`: Truncate `user_message` to 2000 chars

#### 1.4 Anti-Injection in Expansion Prompts [S]
- [x] Prepend anti-injection instruction to `explain_concept.txt`
- [x] Prepend anti-injection instruction to `explain_section.txt`

---

### Phase 2: Response Quality [M] ✅

#### 2.1 Per-Use-Case max_tokens [S]
- [x] `llm.py`: Add `max_tokens` param to `generate_expansion()`, `chat_completion()`, `chat_completion_stream()`
- [x] `explain_auto.py`: concept=800, section=1500
- [x] `video_chat.py`: chat=1000

#### 2.2 Rewrite Concept Prompt [M]
- [x] Rewrite `explain_concept.txt` for short format (150-250 words)
- [x] NO headings, NO code blocks (unless concept is code)
- [x] Structure: define → why it matters → example → related concept

#### 2.3 Rewrite Section Prompt [M]
- [x] Rewrite `explain_section.txt` for medium format (300-500 words)
- [x] One ## heading, 2-3 ### sub-sections max
- [x] Structure: core explanation → key details → practical takeaway

---

### Phase 3: Frontend Markdown Rendering [M] ✅

#### 3.1 Install Typography Plugin [S]
- [x] Run `pnpm add @tailwindcss/typography` in `apps/web/`
- [x] Add `@plugin "@tailwindcss/typography";` to `index.css` (Tailwind v4 syntax)
- [x] Verify: `npm run build` passes

#### 3.2 Create Shared MarkdownContent Component [M]
- [x] Create `apps/web/src/components/ui/markdown-content.tsx`
- [x] Support `compact` mode (no headings, tighter spacing for popovers)
- [x] Support default mode (full markdown for drawers and chat)

#### 3.3 Update GoDeepDrawer [S]
- [x] Replace plain text with `<MarkdownContent content={data.expansion} />`
- [x] Remove `whitespace-pre-wrap` class

#### 3.4 Update TellMeMore Popover [S]
- [x] Use `<MarkdownContent compact />` in TellMeMore component
- [x] Widen popover: `max-w-xs` → `max-w-sm`
- [x] Add `max-h-64 overflow-y-auto` to expansion content

#### 3.5 Update VideoChatPanel [S]
- [x] Assistant messages: Use `<MarkdownContent />`
- [x] User messages: Keep plain text

#### 3.6 Refactor MasterSummaryModal [S]
- [x] Replace inline ReactMarkdown with shared `<MarkdownContent />`

#### 3.7 Build Verification [S]
- [x] TypeScript: 0 errors
- [x] Web tests: 49 files, 1057 tests passed
- [x] API tests: 29 files, 515 tests passed

---

### Phase 4: Error Handling [S] ✅

#### 4.1 Wrap LLM Errors [S]
- [x] `llm_provider.py`: Import `LLMError` from `exceptions.py`
- [x] `complete_with_messages()`: Wrap `RateLimitError`, `Timeout`, `AuthenticationError`, `ServiceUnavailableError`, `APIError` → `LLMError`
- [x] `stream_with_messages()`: Same wrapping

#### 4.2 Handle LLMError in MCP Tools [S]
- [x] `server.py` `explain_auto` wrapper: Catch `LLMError` → return friendly string
- [x] `server.py` `video_chat` wrapper: Same

---

### Playwright Visual Testing ✅ (2026-02-17)

| Viewport | Size | Result |
|----------|------|--------|
| Desktop | 1440x900 | ✅ Clean layout, sidebar + content + right panel icons |
| Tablet | 768x1024 | ✅ Sidebar collapses to icon strip, content fills width |
| Mobile | 375x812 | ✅ Icon strip + full content, no overflow |
| Go Deeper drawer | Desktop | ✅ Full markdown: h2/h3 headings, bold, bullet lists |
| Concept popover | Desktop | ✅ Wider max-w-sm, compact markdown, scroll overflow |

---

### Post-Deploy

- [ ] Clear `systemExpansionCache` collection in MongoDB (stale from old prompts)

---

## Progress Summary

| Phase | Status | Completed |
|-------|--------|-----------|
| Phase 1 — Security | ✅ Complete | 2026-02-17 |
| Phase 2 — Quality | ✅ Complete | 2026-02-17 |
| Phase 3 — Frontend | ✅ Complete | 2026-02-17 |
| Phase 4 — Errors | ✅ Complete | 2026-02-17 |
| Playwright Testing | ✅ Complete | 2026-02-17 |
| Post-Deploy | ⬜ Pending | — |
