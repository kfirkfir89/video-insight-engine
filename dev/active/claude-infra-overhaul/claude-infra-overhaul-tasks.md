# Claude Infrastructure Overhaul — Tasks

Last Updated: 2026-07-16
Progress: 34/34 — ALL PHASES COMPLETE (except 0.1a key rotation, a user-only action). Hooks suite 104/104 green. NOT committed (per user instruction).

> **Reconciliation (2026-07-14, project-score-9 Phase 7):** 0.2, git-safety-guard base,
> partial 1.2, and auto-save-context fix (2.2) were delivered under project-score-9.
> Everything else landed 2026-07-16 in a single session (see log).

Target: infra score 6/10 → 9/10. **Re-audit 2026-07-16: 9/10** (see V2 below).

## Phase 0 — Security & Registration 🔴 (5/5)

- [ ] 0.1a **USER (STILL OPEN)**: Rotate GitHub PAT + Figma key. Current (compromised-in-repo) values were moved to `~/.zshrc` exports (`GITHUB_TOKEN`, `FIGMA_API_KEY`) in a marked block — replace the values there after rotating.
- [x] 0.1b `.mcp.json` → `${GITHUB_TOKEN}` / `${FIGMA_API_KEY}` env expansion (figma-developer-mcp verified to read `FIGMA_API_KEY` from env). AC met: `grep -rE 'ghp_|figd_'` clean.
- [x] 0.2 settings.local.json purged (ps9) + 2026-07-16: removed duplicate hook definitions (were double-running tdd-guard/tracker/activation), stale MCP allows, stale `enabledMcpjsonServers`.
- [x] 0.3a Frontmatter added: debug-investigator (full tools), plan-auditor (Read/Grep/Glob/Bash/Write), refactor-planner (read-only).
- [x] 0.3b Deleted code-reviewer/test-writer/doc-generator after folding unique content into review.md / test.md / update-docs.md.

## Phase 1 — Trigger Engine Precision 🔴 (5/5)

- [x] 1.1 Word-boundary matching (`(?<![\w-])kw(?![\w-])`, multi-word phrase match), `maxSkillsPerPrompt` honored (2), `'$HOME/project'` fallback → script-location fallback.
- [x] 1.2 skill-rules.json v2.1.0: pruned generic keywords (ui/icon/color/theme/button/card/component/hook/retry/llm/claude/agents/security/validation/async/…), deleted stale tech (celery/beanie/mongoose), MCP triggers moved python→node, `\b`-hardened intent patterns, added litellm/aio-pika/qdrant/pymongo.
- [x] 1.3 Block guard path-scoped via `fileTriggers.pathPatterns`; `dev/`, `docs/`, `*.md`, `.claude/` exempt; fail-open (unknown skill/no patterns → allow). (Merged into `pre-edit-guard.ts` — see 2.4.)
- [x] 1.4 No-match → silent; matched box compacted to ≤6 lines.
- [x] 1.5 Regression set: 10 historic false-positives (all → zero activations) + 10 legit triggers + maxSkills + end-to-end cross-domain test. 43 tests in skill-enforcement.test.ts.

## Phase 2 — Hook Bugs, Perf & Hygiene (6/6)

- [x] 2.1 tsc-check-stop.sh subshell fix (sed capture instead of pipe-into-while). Verified: induced TS2322 error detail line prints.
- [x] 2.2 auto-save-context.sh — already fixed via ps9 6.6 (task-scoped snapshots + `.last-session-snapshot.json` fallback). Verified in source.
- [x] 2.3 tdd-guard: Option A — demoted to WARN (`systemMessage`), state moved to per-session cache dir, dead `bypassUntil` removed, global `.claude/tdd-state.json` deleted.
- [x] 2.4 Merged tdd-guard + skill-block-guard → `pre-edit-guard.ts` (1 tsx spawn per edit, run from hooks cwd). Benchmark: **0.47s/edit** (baseline 2–4s; target <1s). Duplicate hooks in settings.local.json removed.
- [x] 2.5 Stop-hook GC: session cache dirs >7 days swept (346 → 8 dirs on first run). No rename (tsc-cache name kept — grep showed test references).
- [x] 2.6 Full suite green: 104/104 + `tsc --noEmit` clean.

## Phase 3 — Skill Content Refresh (7/7)

- [x] 3.1 backend-node: Fastify 4.x; controller layer removed everywhere (SKILL.md, services.md) → real layer dirs + route-handler pattern; BullMQ → RabbitMQ/amqplib (real plugin/publisher patterns); mongoose remnants in testing.md → native driver.
- [x] 3.2 backend-python: dropped PydanticAI/Beanie/Celery; added aio-pika worker (terminal-states pattern from runner.py), Qdrant (`query_points()`, sync client), motor-vs-pymongo split, hand-rolled agent loop (agent_loop.py caps documented), services/admin + llm-common in scope.
- [x] 3.3 react-vite: Vite 7; forms rewritten for the REAL pattern (controlled useState + Zod safeParse + fieldErrorsFrom — from LoginPage.tsx); RHF removed from stack table/rules/state.md with explicit "not installed" warnings; contexts/ (DirectionContext) documented.
- [x] 3.4 design-system: BlockWrapper → `components/vie/**` library (real categories + rules); token locations → index.css + `src/styles/*.css` split; Accent-Only-In-Outputs noted.
- [x] 3.5 Coverage: `services/**/*.py` + `packages/llm-common/**` → backend-python; `services/admin/ui/**` → react-vite; `apps/web/src/styles/**` + `components/vie/**` → design-system; phantom `packages/utils` removed.
- [x] 3.6 `impeccable` removed (impeccable2 supersedes; git-recoverable).
- [x] 3.7 Spot-check sweep: stale-tech grep CLEAN across all 4 skills.

## Phase 4 — Commands, Docs, MCP Diet (5/5)

- [x] 4.1 ship.md → pnpm + real per-package scripts (web via `tsc -b` with hollow-root warning); phantom format:check dropped; pnpm audit; hooks-suite line added.
- [x] 4.2 test.md → monorepo paths + test-writer content + real runners table (incl. admin, QdrantClient sync-mock gotcha).
- [x] 4.3 task-plan.md → PROJECT-BRIEFING.md / CLAUDE.md / docs/ / dev/README.md.
- [x] 4.4 hooks/README.md rewritten for this repo (inventory, test command, design rules); skill-activation-prompt.sh comment fixed; .claude/README.md: agents roster, hooks tables, skills table (4 enforced + design family), settings troubleshooting.
- [x] 4.5 MCP diet: removed filesystem/fetch/puppeteer/memory/sequential-thinking from .mcp.json (kept Figma, context7, playwright, github, octocode, mongodb-readonly); `mcpServers.filesystem` block + filesystem allows removed from settings.json.

## Phase 5 — New Capabilities ⭐ (4/4)

- [x] 5.1 git-safety-guard verified + extended: ask-gate on `git commit`/`git push` (permissionDecision:"ask" JSON), adversarial cases added (`git -C . stash`, `GIT_DIR=… git stash`, compound separators). 53 tests green.
- [x] 5.2 Learning loop closed: Stop hook prints ≥5-edit hot files (gotcha-memory nudge) + cross-service contract reminder from insights.json. Verified with synthetic session.
- [x] 5.3 `/audit-infra` command created (skill claims vs lockfiles, agent frontmatter, keyword drift, command scripts, secrets, cache count, hooks suite; scored report). Ran end-to-end — found + fixed 2 real issues (phantom packages/utils pattern, self-referential secrets-grep hits).
- [x] 5.4 `pnpm check:infra` (root script) + documented one-liner in hooks/README.md.

## Final Verification (2/2)

- [x] V1 Live-fire: activation → api edit BLOCKED → py edit ALLOWED (same session) → md ALLOWED → SKILL.md read → api edit ALLOWED. Per-edit latency 0.47s. Bonus fix: pre-edit-guard/skill-read-tracker got script-location projectDir fallback (cwd fallback failed without CLAUDE_PROJECT_DIR).
- [x] V2 Re-audit rubric (2026-07-16): Security/permissions 9 (secrets externalized — pending user rotation; git ask-gates mechanical), Trigger system 9 (word-boundary + path-scoped + 20-prompt regression), Agents 9 (6/6 registered, tool-scoped), Hygiene 9 (GC live, dupes gone, per-session state), Hooks engineering 9 (bugs fixed, 0.47s, 104 tests), Skills content 9 (spot-check clean), Commands 9 (real scripts, /audit-infra). **Overall ≈9/10.** Remaining to 10: user key rotation (0.1a), periodic /audit-infra runs.

## Session Log
- 2026-07-05: Task created from audit findings. No implementation started.
- 2026-07-14: Reconciliation — several items delivered under project-score-9.
- 2026-07-16: ALL phases implemented + verified in one session (uncommitted per user instruction). Hooks suite 43→104 tests. Files touched: `.mcp.json`, `~/.zshrc` (secret exports, marked TODO-rotate), `.claude/settings.json`, `.claude/settings.local.json`, `.claude/agents/*` (3 frontmatter, 3 deleted), `.claude/skills/skill-rules.json`, 4 skills' SKILL.md+resources, `.claude/hooks/{skill-activation-prompt.ts, pre-edit-guard.ts(new), skill-read-tracker.ts, git-safety-guard.sh, tsc-check-stop.sh, auto-format(untouched), README.md}`, deleted `tdd-guard.ts`/`skill-block-guard.ts`/`.claude/tdd-state.json`/`skills/impeccable/`, `.claude/commands/{ship,test,task-plan,review,update-docs,audit-infra(new)}.md`, `.claude/README.md`, root `package.json` (check:infra).
- **NEXT USER ACTION**: rotate GitHub PAT + Figma key, update values in `~/.zshrc`, revoke old keys. Then restart Claude Code session so MCP servers pick up env expansion.
