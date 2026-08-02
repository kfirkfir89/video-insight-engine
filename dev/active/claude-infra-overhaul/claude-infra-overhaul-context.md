# Claude Infrastructure Overhaul — Context

Last Updated: 2026-07-05

## Why this task exists
Full `.claude/` audit on 2026-07-05 scored the infrastructure 6/10 (memory: `infra-audit-20260705`, `project_infra_audit_20260705.md`). Goal: 9/10. The audit was performed live in-session; three of its findings self-demonstrated during the audit itself (see "Live evidence" below).

## Key files (the surface being changed)

### Hooks (`.claude/hooks/`)
| File | Role | Defect |
|---|---|---|
| `skill-activation-prompt.ts` | UserPromptSubmit — matches skill-rules, writes skill-state | Substring matching (line ~87 `prompt.includes`); literal `'$HOME/project'` fallback (line 69); ignores `globalSettings`; noisy no-match box |
| `skill-block-guard.ts` | PreToolUse — blocks Edit/Write until skill read | NOT path-scoped: blocks ALL files for any unconsumed skill; exemption only `.claude/` |
| `skill-read-tracker.ts` | PostToolUse Read — marks skill consumed | OK |
| `tdd-guard.ts` | PreToolUse — test-first enforcement | Dead `bypassUntil`; loose bidirectional-substring test↔source match (line ~137-147); global state file `.claude/tdd-state.json` (session clobber); outputs `decision:'allow'` (invalid legacy value, works by accident) |
| `post-tool-use-tracker.sh` | PostToolUse — edited-files/affected-repos log | Template repo-list not tailored (frontend/client/prisma cases); works |
| `auto-format.sh` | PostToolUse — eslint/ruff | Only formats apps/web TS; api/packages never linted |
| `continuous-learning.ts` | PostToolUse — insights.json | Write-only; nothing consumes insights |
| `tsc-check-stop.sh` | Stop — tsc on affected repos | Line ~94 `echo \| while` subshell loses error detail lines |
| `auto-save-context.sh` | Stop — session snapshot | Writes SAME snapshot to EVERY active task dir (clobbers unrelated tasks) |
| `__tests__/*.test.ts` | vitest suite | Exists + green — extend with regression prompts |

### Config
- `.claude/settings.json` — hook wiring; blanket `Bash`+`Edit`+`Write` allow; decorative deny list; `mcpServers.filesystem` inline.
- `.claude/settings.local.json` — JWT baked in an allow rule; ~40 price-comparison-app leftovers.
- `.mcp.json` (gitignored, NOT committed) — **GitHub PAT `ghp_…` plaintext (github server env)** + **Figma key `figd_…` as CLI arg**; 12 servers, `enableAllProjectMcpServers: true`.
- `.claude/skills/skill-rules.json` — triggers; `fileTriggers` + `globalSettings.maxSkillsPerPrompt` are DEAD CONFIG (no hook reads them); stale keywords `explain_auto/explain_chat/pinecone/pgvector/celery/beanie/mongoose`; MCP triggers on wrong skill (python, SDK is node).
- `.claude/tsc-cache/` — 335 session dirs, no GC; also holds skill-state.json + insights.json (misnamed general session cache).

### Skills (freshness vs real stack)
| Claim in skill | Reality | Evidence |
|---|---|---|
| backend-node SKILL.md:19 Fastify 5.x | Fastify **4.x** | api/package.json `fastify ^4.26`, fastify-plugin ^4.5 |
| SKILL.md:74-83 controller layer + feature folders | No `*.controller.ts` anywhere; layer dirs | `api/src/{routes,services,repositories,plugins}` |
| infrastructure.md BullMQ | RabbitMQ/**amqplib** | `api/src/plugins/rabbitmq.ts`, `queue-publisher.service.ts` |
| backend-python SKILL.md:24 PydanticAI | Hand-rolled agent | `services/assistant/src/services/tool_router.py`, `agent_tools.py` |
| SKILL.md:109 Celery | **aio-pika** worker | `services/summarizer/src/worker/{topology,runner}.py` |
| SKILL.md:21-22 Motor+Beanie universal | Motor only assistant/admin; summarizer **sync pymongo**; Beanie nowhere | requirements.txt per service |
| (missing) | **Qdrant** in both py services | `qdrant_repository.py`; `query_points()` not `search()` |
| react-vite SKILL.md:21 Vite 6 | Vite **7** | apps/web `vite ^7.2.4` |
| react-vite NON-NEGOTIABLE react-hook-form | **Not installed**, zero imports | apps/web/package.json |
| design-system SKILL.md:55 BlockWrapper (5 variants) | Doesn't exist; real lib `components/vie/**` | grep BlockWrapper → 0 hits |
| SKILL.md:55 all tokens in index.css | Split into `src/styles/{categories,dark-effects,animations,transitions,overdrive}.css` | grep |
| (coverage) | `services/admin` (py + React UI) + `packages/llm-common` (py) match NO skill / wrong skill | skill-rules pathPatterns |

### Agents (`.claude/agents/`)
- Frontmatter OK (register): api-tester, frontend-error-fixer, security-auditor.
- NO frontmatter (dead): code-reviewer, debug-investigator, doc-generator, plan-auditor, refactor-planner, test-writer.
- Keep+fix: debug-investigator (3-Fix-Rule + dev/gotchas.md), plan-auditor, refactor-planner. Delete (redundant): code-reviewer, test-writer, doc-generator.
- test-writer/debug-investigator omit `services/admin`.

### Commands (`.claude/commands/`)
- ship.md:23-40 — npm + nonexistent `typecheck/lint/format:check` scripts (repo = pnpm; no prettier anywhere).
- test.md:10-11,51-54 — pre-monorepo paths `web/`, `summarizer/`.
- task-plan.md:48-50 — phantom `PROJECT_KNOWLEDGE.md`/`BEST_PRACTICES.md`/`TROUBLESHOOTING.md`.
- Good: resume.md, complete-task.md, list-tasks.md, update-docs.md, review.md (heavy but accurate), security-check.md, task-plan-update.md.

## Live evidence collected during audit (use in regression tests)
1. Prompt "analyze … infrastructure hooks skill …" → `hook` keyword activated react-vite (block-enforced) on a non-frontend question.
2. Agent task-notification text containing "api"/"python"/"component" activated 3 blocking skills — hook input wasn't even a user prompt.
3. Writing `dev/active/.../plan.md` (a markdown planning file) was BLOCKED by backend-node/backend-python/design-system until 3 SKILL.md reads.
4. Prompt "retry" alone activated backend-node + backend-python (`retry` keyword).
5. Measured: single `npx tsx` hook ≈ 0.6s; substring proofs: "build"⊃"ui", "rapid"⊃"api", "iconic"⊃"icon".

## Decisions made
- Target ordering P0→P5 by risk ROI; minimum-viable-9 = P0+P1+P2+5.1.
- Delete (not fix) the 3 redundant agents; fold unique content into commands.
- Git guard: deny destructive, **ask** for commit/push (aligns with `feedback_never_commit` — explicit verb required).
- `.md` files (and `dev/`, `docs/`) exempt from skill-block-guard.

## Decisions PENDING (user)
1. Secret rotation timing (0.1 — blocks nothing else, do first).
2. tdd-guard: demote to warn (recommended) vs tighten-and-keep (2.3).
3. react-vite forms: rewrite forms.md for Zod+controlled state (recommended) vs install react-hook-form (3.3).
4. Remove `impeccable` in favor of `impeccable2` (3.6).
5. MCP diet final list (4.5): propose removing filesystem, fetch, puppeteer, memory, sequential-thinking.
6. Confirm agent deletions (0.3).

## Dependencies / constraints
- DON'T touch product code or uncommitted dev-2 work (VideoHero, index.css, etc. are dirty — unrelated).
- Hooks tests: `cd .claude/hooks && npm test` (vitest). Node modules present.
- All hook changes must stay fail-open.
- Working-tree safety rules apply to THIS task too: no commits/stash without explicit ask.

## Related memories
- `infra-audit-20260705` (defect list) · `feedback_never_commit` (git guard rationale) · `project_web_typecheck_gotcha` (tsc -b for web) · `project_qdrant_client_api` (query_points) · `memory-archive-20260705` (background).
