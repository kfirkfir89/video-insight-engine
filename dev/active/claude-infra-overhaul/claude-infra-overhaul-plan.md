# Claude Infrastructure Overhaul — Plan

Last Updated: 2026-07-05
Status: PLANNED (not started)
Source: Full infrastructure audit 2026-07-05 (memory: `infra-audit-20260705`). Overall score 6/10 → target **9/10**.

## Executive Summary

The `.claude/` infrastructure is architecturally excellent (skill auto-activation state machine with tests, TDD guard, affected-repo tsc-on-Stop, session snapshots + `/resume`) but ~⅓ of it is silently broken, stale, or misfiring. This overhaul fixes security lapses (plaintext secrets), registers 6 dead agent files, replaces substring trigger matching (the root cause of false-positive edit blocking — it fired twice during the audit itself, once blocking this very plan file), fixes 4 concrete hook bugs, refreshes skill content that teaches tech the repo doesn't use, and adds the two missing capabilities that make the system self-protecting and self-healing: a **git working-tree guard hook** (mechanical enforcement of the #1 workflow rule) and an **`/audit-infra` drift auditor**.

Six phases, strictly ordered by risk-reduction ROI. Each phase is independently shippable and verified before the next. No product code is touched — zero interaction with uncommitted dev-2 work.

## Current State (audit summary — evidence in context.md)

| Area | Score | Core defect |
|---|---|---|
| Security/permissions | 3/10 | GitHub PAT + Figma key plaintext in `.mcp.json`; blanket `Bash` allow; working-tree rule prose-only |
| Trigger system | 4/10 | `prompt.includes(kw)` substring matching ("build"→`ui`, "rapid"→`api`, "hook"→react-vite); block-guard blocks ALL edits regardless of file domain; `fileTriggers`/`maxSkillsPerPrompt` are dead config |
| Agents | 4/10 | 6/9 files lack YAML frontmatter → never register |
| Hygiene | 4/10 | 138MB node_modules in hooks, 335 un-GC'd tsc-cache dirs, copied-template docs |
| Hooks engineering | 6/10 | 4 bugs (tsc-check subshell, snapshot clobber, tdd-guard dead code/loose match, `'$HOME/project'` literal); 2–4s latency per edit |
| Skills content | 6/10 | Fastify 5→4, Vite 6→7, BullMQ→RabbitMQ, PydanticAI/Celery/Beanie/RHF unused, fictional controller layer, dead BlockWrapper, admin/llm-common uncovered |
| Commands | 7/10 | ship.md npm+phantom scripts, test.md pre-monorepo paths, task-plan.md phantom files |

## Target State (9/10 definition)

1. Zero plaintext secrets in any config; permission posture intentional (ask-gates on destructive git).
2. Trigger precision: word-boundary matching, pruned keywords, path-scoped block guard — 0 false activations on the 20-prompt regression set; cross-domain edit-blocking impossible.
3. All retained agents register and are tool-scoped; no dead files, no triple-redundancy with built-ins.
4. All 4 hook bugs fixed; per-edit hook latency < 1s; cache GC automatic.
5. Skill content matches the real codebase (spot-check protocol passes); `services/admin` + `packages/llm-common` covered.
6. Git working-tree guard hook live (stash/reset --hard/checkout --/clean/force-push denied; commit/push ask).
7. `/audit-infra` drift auditor exists and passes clean; hooks vitest suite green and runnable in one command.

## Implementation Phases

### Phase 0 — Security & Registration (S–M, no behavior risk) 🔴
Unblock the outright-broken. No trigger/hook logic changes.

- **0.1 Rotate + externalize secrets (M, USER ACTION REQUIRED)**
  - User rotates GitHub PAT (`ghp_…`) and Figma key (both plaintext in `.mcp.json`; Figma key also visible in `ps` as a CLI arg).
  - Edit `.mcp.json`: `"GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"`; Figma key via env expansion (verify figma-developer-mcp supports `FIGMA_API_KEY` env or `${...}` arg expansion; else a tiny wrapper script).
  - Keys land in `~/.zshrc`/`~/.claude` env (never in repo).
  - AC: `grep -rE 'ghp_|figd_' .mcp.json .claude/` → no live secrets; MCP servers still connect.
- **0.2 Clean settings.local.json (S)** — remove JWT-in-allow-rule, all price-comparison-app entries, stale SlashCommand grants. AC: every remaining entry applies to this repo.
- **0.3 Agent frontmatter + scoping (M)** — add `name`/`description` (+ `tools:` for read-only auditors: `Read, Grep, Glob, Bash`) to `debug-investigator`, `plan-auditor`, `refactor-planner`; **delete** `code-reviewer`, `test-writer`, `doc-generator` (triple-redundant with `/review`+built-in `/code-review`, `/test`, `/update-docs`) — fold any unique lines into the surviving command docs first. AC: all remaining `.claude/agents/*.md` have valid frontmatter; deleted agents' unique content preserved.

### Phase 1 — Trigger Engine Precision (M–L, highest behavioral risk → test-first) 🔴
- **1.1 Word-boundary matching (M)** — `skill-activation-prompt.ts`: replace `prompt.includes(kw)` with `\b`-regex (escape keywords; multi-word keywords phrase-matched). Honor `globalSettings.maxSkillsPerPrompt` (currently dead config; code hardcodes slice(0,3)). Fix the literal `'$HOME/project'` fallback at line 69 (reuse the `.sh` wrapper's script-dir detection).
- **1.2 Keyword prune (M)** — skill-rules.json: remove generic collision keywords (design-system's bare `ui`/`icon`/`color`/`theme`/`button`/`card`/`component`; react-vite `hook`→`react hook|custom hook|useEffect`; backend-node `service`/`security`/`validation`/`retry`/`llm`/`claude`/`agents` narrowed or moved to intent patterns). Delete stale: `explain_auto`, `explain_chat`, `pinecone`, `pgvector`, `celery`, `beanie`, `mongoose`. Move MCP-server triggers backend-python→backend-node (SDK is a Node dep in api/).
- **1.3 Path-scoped block guard (L)** — `skill-block-guard.ts`: only block an edit if the target file matches the activated skill's `fileTriggers.pathPatterns` (finally consuming the dead config). A Python edit can never be blocked by react-vite; a `dev/**.md` plan file is never blocked at all (extend the existing `.claude/` exemption to `dev/`, `docs/`, `*.md`). Keep fail-open.
- **1.4 Silence no-match noise (S)** — no-match → emit nothing (keep context-size warning + active-tasks reminder). Matched box shrinks to ≤6 lines.
- **1.5 Test regression set (M)** — extend `__tests__/skill-enforcement.test.ts`: 20-prompt fixture set (10 legit triggers, 10 historic false positives incl. "build a feature", "the rapid fix", "claude code hook", agent-notification text). AC: all 20 assert correctly; full suite green.

### Phase 2 — Hook Bugs, Perf & Hygiene (M)
- **2.1 tsc-check-stop.sh subshell fix (S)** — error detail lines lost in `echo | while` subshell (line ~94) → process substitution/mapfile so first-5 errors actually print. AC: induced TS error shows detail lines in Stop output.
- **2.2 Snapshot scoping (M)** — `auto-save-context.sh` writes an identical snapshot to EVERY active task dir (clobbers unrelated tasks — observed: integration-advanced snapshot modified by unrelated sessions). Write only to tasks whose tracked repos/files overlap the session's `edited-files.log` (fallback: skip + single log line). AC: session touching only task A's files does not modify task B's snapshot.
- **2.3 tdd-guard decision + fix (M, USER DECISION)** — Option A (recommended): demote block→warn via `additionalContext` (the huge exclusion list + loose bidirectional-substring matching means it currently mostly ritual-gates); Option B: keep blocking but exact-match test↔source mapping, remove dead `bypassUntil`, move state from global `.claude/tdd-state.json` to per-session cache dir (concurrent sessions currently clobber).
- **2.4 Merge hook processes (M)** — 1 PreToolUse script (tdd+skill-guard), 1 PostToolUse script (tracker+learning); auto-format stays separate. `npx tsx` startup is ~0.6s each (measured); target < 1s total per edit (from ~2–4s). Fix the root-cwd `npx tsx` invocation (tsx not in root node_modules). Measure before/after.
- **2.5 Cache GC (S)** — Stop hook sweeps session dirs > 7 days old (currently 335 dirs). Optional: rename `tsc-cache/` → `session-cache/` (grep all references incl. tests first; GC is the non-negotiable part, rename is cosmetic).

### Phase 3 — Skill Content Refresh (L)
Fix the concrete lies (agents faithfully apply them under MANDATORY-read rules). Exact anchors:
- **3.1 backend-node**: SKILL.md:19 Fastify 5.x→**4.x** (api/package.json: `fastify ^4.26`, fastify-plugin ^4.5, @fastify/cors ^9, @fastify/jwt ^8); SKILL.md:74-83 delete `user.controller.ts` + feature-folder claim (real: layer dirs `routes/ services/ repositories/ plugins/`); services.md UserController pattern removed; SKILL.md:108 + infrastructure.md BullMQ→**RabbitMQ/amqplib** (`plugins/rabbitmq.ts`, `services/queue-publisher.service.ts`).
- **3.2 backend-python**: SKILL.md:24 drop PydanticAI (hand-rolled agent: `tool_router.py`/`agent_tools.py`); SKILL.md:22 drop Beanie; SKILL.md:109 + infrastructure.md Celery→**aio-pika** (worker `topology.py`/`runner.py`); SKILL.md:21 Motor split — motor(assistant/admin) vs **sync pymongo(summarizer)**; add **Qdrant** (`query_points()` not `search()` — see memory `project_qdrant_client_api`); add `services/admin` to scope; ai-patterns.md PydanticAI sections rewritten.
- **3.3 react-vite**: SKILL.md:21 Vite 6→**7** (`vite ^7.2.4`); forms.md + NON-NEGOTIABLE RHF rule rewritten for actual pattern (Zod + controlled state — `react-hook-form` NOT installed, zero imports) unless user opts to install RHF; document `contexts/` (DirectionContext).
- **3.4 design-system**: SKILL.md:55 + components.md — BlockWrapper (zero grep hits) → real `components/vie/**` library; token locations → `src/styles/{categories,dark-effects,animations,transitions,overdrive}.css` + what actually remains in index.css.
- **3.5 skill-rules coverage**: register `services/admin/**` (backend-python) + `services/admin/ui/**` (react-vite); `packages/llm-common/**` → backend-python (currently caught by node's `packages/**/*.ts`).
- **3.6 impeccable dedupe (S, USER CONFIRM)**: deprecate `impeccable` (superseded by `impeccable2`; they double-trigger on the same design prompts).

### Phase 4 — Commands, Docs, MCP Diet (M)
- **4.1 ship.md** → pnpm + real scripts (`pnpm --filter` typecheck/lint per package; web typecheck via `tsc -b` — root `tsc --noEmit` is hollow, memory `project_web_typecheck_gotcha`); drop nonexistent `format:check`/`npm audit` lines or replace with `pnpm audit`.
- **4.2 test.md** paths → `apps/web/`, `services/summarizer/`; absorb deleted test-writer agent content.
- **4.3 task-plan.md** phantom refs (`PROJECT_KNOWLEDGE.md`/`BEST_PRACTICES.md`/`TROUBLESHOOTING.md`) → `PROJECT-BRIEFING.md`, `CLAUDE.md`, `dev/README.md`.
- **4.4 hooks/README.md** rewrite for THIS repo (currently copied template: "your-project", nonexistent `tsc-check.sh`/`trigger-build-resolver`; `skill-activation-prompt.sh` comment mentions price-comparison-app). `.claude/README.md`: skills table 4→actual (~30), agent roster update.
- **4.5 MCP diet (USER CONFIRM)**: remove `filesystem` (native tools), `fetch` (WebFetch), `puppeteer` (playwright dup), `memory` (file-based memory active), `sequential-thinking` (native thinking); keep context7, playwright, github(env token), mongodb-readonly, octocode, figma. Also remove `mcpServers.filesystem` block from settings.json and consider `enableAllProjectMcpServers: false` + explicit list.

### Phase 5 — New Capabilities: Self-Protecting + Self-Healing (M–L) ⭐
- **5.1 Git working-tree guard (M, HIGHEST ROI)** — new PreToolUse hook, matcher `Bash`: **deny** `git stash` (except `stash list/show`), `reset --hard`, `checkout -- `/`restore` (discard), `clean -f`, `push --force*`/`-f`, `branch -D`; **ask** `git commit`, `git push`. Must handle compound commands (`&&`, `;`, `|`), `git -C <dir>`, and env-prefixed forms. Fail-open on parse errors but run deny-check first. Mechanically enforces `feedback_never_commit` (2026-05-28 stash incident). AC: adversarial test list all blocked; `git status/diff/log/show/stash list` unaffected.
- **5.2 Close continuous-learning loop (S)** — Stop hook appends 2-line insight summary (high-iteration files, cross-service edits) to the tsc-check output; suggests a gotcha-memory when a file was edited ≥5×. (Alternative: delete the hook — user call; currently write-only.)
- **5.3 `/audit-infra` drift auditor (L)** — new command: verifies skill version claims vs package.json/requirements.txt; agent frontmatter validity; skill-rules keywords vs codebase symbols (flags keywords for tech absent from lockfiles); command script references vs real package scripts; secrets grep; cache-dir count; hooks test suite green. Output: scored report + fix list. Run quarterly / after major stack bumps — makes today's rot class self-catching.
- **5.4 Hooks CI (S)** — one documented command runs the hooks vitest suite (`cd .claude/hooks && npm test`); optionally wire into root `package.json` as `check:infra`.

### Verification (gates each phase)
- Hooks vitest suite green after every phase touching hooks.
- Phase 1: 20-prompt regression set + live-fire 3 real prompts in a fresh session.
- Phase 2: latency benchmark ≥50% reduction; induced-error tsc output check; multi-task snapshot isolation check.
- Phase 5: adversarial git-command test list (incl. `cd x && git stash`, `git -C . stash`, `GIT_DIR=. git stash`).
- Final: re-run audit rubric → every area ≥7, overall ≥9.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Buggy PreToolUse hook blocks ALL edits | Med | High | Fail-open everywhere; regression tests BEFORE enabling; keep old scripts until new green |
| Git-guard blocks legitimate ops | Med | Med | Narrow deny-list + ask (not deny) for commit/push; read-only git always allowed; adversarial tests |
| Secret rotation breaks MCP servers | Low | Med | Rotate → update env → verify connections → then revoke old keys |
| Skill refresh introduces new inaccuracies | Med | Med | Every claim spot-checked against lockfiles/real files; `/audit-infra` (5.3) becomes the permanent regression |
| tsc-cache rename breaks hidden consumers | Med | Low | grep-first; GC-without-rename is the fallback |
| TDD-guard change alters workflow feel | Low | Low | Explicit user decision point (2.3) before implementing |

## Success Metrics
1. Re-audit ≥ 9/10 overall; no area < 7.
2. 0/20 false activations on the regression prompt set; cross-domain edit-block impossible (test-proven).
3. Per-edit hook overhead < 1s (baseline ~2–4s measured).
4. `grep -rE 'ghp_|figd_|eyJhbGciOi'` over `.claude/` + `.mcp.json` → clean.
5. All banned git mutations blocked in adversarial tests; working-tree rule no longer prose-only.
6. `/audit-infra` runs clean end-to-end.

## Dependencies & Resources
- **User actions**: rotate 2 secrets (0.1). **User decisions**: tdd-guard fate (2.3), RHF install-vs-rewrite (3.3), impeccable removal (3.6), MCP diet list (4.5), agent deletions (0.3 — confirm before delete).
- No product code touched; no docker needed; hooks tests need `.claude/hooks/node_modules` (present).
- Order: P0 → P1 → P2 → P3/P4 (parallelizable) → P5. 5.1 is independent and can be pulled forward any time.

## Timeline (focused sessions)
- P0: 0.5 session · P1: 1 session · P2: 1 session · P3: 1–1.5 sessions · P4: 0.5–1 session · P5: 1–1.5 sessions
- Total: ~5–6 sessions. **Minimum-viable-9**: P0 + P1 + P2 + 5.1 (~3 sessions) removes every red finding; P3/P4/5.3 secure the score against regression.
