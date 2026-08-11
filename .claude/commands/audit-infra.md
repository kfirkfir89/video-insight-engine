---
description: Audit .claude/ infrastructure for drift — skill claims vs lockfiles, agent frontmatter, trigger keywords, command scripts, secrets, cache hygiene, hook tests
---

Audit the `.claude/` infrastructure for drift against the real codebase. This is the
permanent regression check for the rot classes found in the 2026-07-05 audit
(stale skill claims, dead agents, keyword false-positives, phantom scripts, plaintext
secrets, unbounded caches). Run quarterly or after major stack bumps.

Run every check below, collect findings, then output the scored report.

## 1. Skill version/tech claims vs reality

For each of `backend-node`, `backend-python`, `react-vite`, `design-system`
(SKILL.md + resources/): extract every framework/version/library claim and verify:

```bash
jq -r '.dependencies' api/package.json apps/web/package.json     # Fastify major, Vite major, RHF absence…
cat services/{summarizer,assistant,admin}/requirements.txt        # motor vs pymongo, litellm, aio-pika, qdrant
```

Also grep skills for known-dead tech — any hit is a finding:

```bash
grep -rn -iE 'bullmq|celery|beanie|pydanticai|mongoose|blockwrapper|pinecone|pgvector|react-hook-form' \
  .claude/skills/{backend-node,backend-python,react-vite,design-system}/ \
  | grep -viE 'not installed|no beanie|no pydanticai|there is no|removed|do not import'
```

Verify referenced code paths exist (e.g. `components/vie/index.ts`, `agent_loop.py`,
`plugins/rabbitmq.ts`, `src/styles/*.css`).

## 2. Agent frontmatter

Every `.claude/agents/*.md` must start with `---` and declare `name:` + `description:`:

```bash
for f in .claude/agents/*.md; do head -1 "$f" | grep -q '^---$' || echo "NO FRONTMATTER: $f"; done
```

## 3. Trigger keywords vs codebase

For each keyword in `.claude/skills/skill-rules.json`, flag keywords naming tech
absent from lockfiles/requirements (e.g. a keyword for a library no longer installed).
Also confirm `fileTriggers.pathPatterns` directories still exist.

## 4. Command scripts vs real package scripts

Every shell command referenced in `.claude/commands/*.md` must exist:

```bash
jq '.scripts' package.json api/package.json apps/web/package.json
```

Flag phantom scripts (e.g. `format:check`, `typecheck` in packages that lack it) and
pre-monorepo paths (`web/`, `summarizer/` at root).

## 5. Secrets grep

```bash
grep -rnE 'ghp_[A-Za-z0-9]{20,}|github_pat_|figd_[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|eyJhbGciOi' \
  .mcp.json .claude/ --exclude-dir=node_modules --exclude-dir=tsc-cache \
  | grep -v 'grep'   # self-referential pattern docs in commands/*.md are not secrets
```

Any live secret = CRITICAL. `.mcp.json` values must be `${ENV_VAR}` references.

## 6. Cache hygiene

```bash
ls .claude/tsc-cache | wc -l   # should stay small (7-day GC in tsc-check-stop.sh)
```

Flag if > 50 session dirs (GC broken) or if any global state files reappear at
`.claude/` root (e.g. `tdd-state.json` — state must be per-session).

## 7. Hooks test suite

```bash
cd .claude/hooks && npm test   # must be green; includes 20-prompt activation regression set
```

## 8. Settings sanity

- `settings.json` hooks reference only files that exist in `.claude/hooks/`
- `settings.local.json` contains no hooks (personal permissions only) and no secrets
- `.mcp.json` servers all launch (spot-check one)

## Report format

```markdown
## 🔍 Infra Drift Audit — YYYY-MM-DD

| Area | Score /10 | Findings |
|---|---|---|
| Skill content accuracy | | |
| Agents | | |
| Trigger precision | | |
| Commands/docs | | |
| Security/secrets | | |
| Hygiene (cache/state) | | |
| Hook tests | | |

**Overall: X/10** (target ≥9, no area <7)

### Findings (ordered by severity)
1. file:line — claim vs reality — suggested fix
```

Do not fix anything during the audit — report only, then offer to fix.
