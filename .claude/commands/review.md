# /review Command

Professional code review with structured output, severity levels, and before/after suggestions.

## Usage

```
/review                    # Review all uncommitted changes (Critical + top 10 Warnings)
/review api                # Review changes in api/ only
/review video.service.ts   # Review specific file
/review --all              # Show all severities including Info suggestions
/review services/summarizer --all  # Full detail for a specific area
```

---

## Review Process

**Important:** Run `/review` ONCE per review cycle. After fixing Critical and Warning issues, the code is ready. Do NOT re-run looking for more — diminishing returns will waste tokens. For deeper review of a specific area, scope it: `/review services/summarizer`

1. **Identify changes** - `git diff` or specified files
2. **Detect technologies** - Map files to skills (backend-node, backend-python, react-vite)
3. **Load skill files** - Read the detected skill SKILL.md files:
   - `api/` changes → read `.claude/skills/backend-node/SKILL.md`
   - `services/` changes → read `.claude/skills/backend-python/SKILL.md`
   - `apps/web/` changes → read `.claude/skills/react-vite/SKILL.md`
4. **Run compliance checks** - Verify against BOTH the checks below AND patterns/conventions from loaded skills
5. **Analyze with labels** - Categorize each issue
6. **Assign severity** - Critical, Warning, or Info
7. **Filter by severity** - Default: show all Critical + top 10 Warnings. Use `--all` to include Info.
8. **Large diff triage** - When reviewing >20 changed files, prioritize: (1) new files, (2) files with security-sensitive changes, (3) complex logic changes. Skim test files and config changes.
9. **Generate report** - Structured output with before/after code

---

## Issue Labels

| Label             | When to Use                                         |
| ----------------- | --------------------------------------------------- |
| `security`        | Secrets exposure, injection, XSS, CSRF, auth bypass |
| `bug`             | Logic errors, crashes, incorrect behavior           |
| `possible bug`    | Suspicious patterns that might be bugs              |
| `performance`     | Inefficient operations, N+1 queries, blocking calls |
| `best practice`   | Pattern violations from project skills              |
| `maintainability` | High coupling, complexity, poor readability         |
| `enhancement`     | Optional improvements, nice-to-haves                |

---

## Severity Levels & Filtering

| Severity        | Criteria                                           | Action                      | Default Display        |
| --------------- | -------------------------------------------------- | --------------------------- | ---------------------- |
| 🔴 **Critical** | Security issues, crashes, data loss, blocking bugs | Must fix before merge       | **Always shown (all)** |
| 🟡 **Warning**  | Performance issues, pattern violations, tech debt  | Should fix, creates debt    | **Top 10 by impact**   |
| 🔵 **Info**     | Style improvements, optional suggestions           | Consider for next iteration | **Hidden by default**  |

> **Default mode:** All Critical issues + top 10 Warnings (prioritized by impact).
> Info-level suggestions are hidden to prevent infinite nitpick loops.
> Use `/review --all` to see everything including Info suggestions.

---

## Compliance Checks

> **Important:** These checks are the MINIMUM. Always cross-reference
> with the loaded SKILL.md files for project-specific patterns,
> naming conventions, architectural rules, and best practices.
> Only flag skill pattern deviations that could cause bugs, security issues,
> or significant maintenance problems. Do NOT flag style preferences or
> minor convention differences.

### All Code

| Check                    | Objective                                 | Failure Criteria                                |
| ------------------------ | ----------------------------------------- | ----------------------------------------------- |
| Single Responsibility    | Each function has ONE reason to change    | Function combines multiple unrelated operations |
| Guard Clauses            | Early returns prevent deep nesting        | More than 2-3 levels of nesting                 |
| Functions Under 50 Lines | Target 10-30 lines                        | Function exceeds 50 lines                       |
| Dependency Injection     | External services injected, not hardcoded | Direct instantiation of dependencies            |
| Error Handling           | Typed errors, no swallowed exceptions     | Empty catch blocks, generic errors              |

### Backend Node.js (api/)

| Check                     | Objective                          | Failure Criteria                                  |
| ------------------------- | ---------------------------------- | ------------------------------------------------- |
| No `any` Types            | Proper TypeScript types everywhere | Using `any` or implicit any                       |
| Layer Separation          | Services don't know HTTP           | Services use status codes, reply objects          |
| Async Parallelization     | Independent ops run in parallel    | Sequential await for independent operations       |
| Repository Returns Domain | No raw `_id` documents             | Repository returns MongoDB documents directly     |
| Structured Logging        | Context included in logs           | Using console.log or logs without request context |

### Backend Python (services/)

| Check                  | Objective                             | Failure Criteria                      |
| ---------------------- | ------------------------------------- | ------------------------------------- |
| Type Hints             | Parameters and return types annotated | Missing type hints on functions       |
| No Blocking in Async   | Use httpx, asyncio primitives         | Using requests, time.sleep in async   |
| Layer Separation       | Services don't know HTTP              | Services raise HTTPException directly |
| Pydantic at Boundaries | API inputs/outputs validated          | Raw dicts at API boundaries           |
| Specific Exceptions    | Always specify exception type         | Bare `except:` clauses                |

### React/Frontend (apps/web/)

| Check                         | Objective                       | Failure Criteria                             |
| ----------------------------- | ------------------------------- | -------------------------------------------- |
| Components Under 50 JSX Lines | Keep components focused         | JSX return exceeds 50 lines                  |
| No Conditional Hooks          | Hooks at top level only         | Hooks inside if/loops/conditions             |
| Server State Uses React Query | Not local useState for API data | useState for remote data fetching            |
| Props Typed With Interfaces   | Named interfaces for props      | Inline types or missing types                |
| No Storing Derived State      | Compute during render           | useState for values derived from other state |

---

## Output Format

Generate the following markdown structure. **Filtering rules:**
- **Critical:** Always show ALL critical issues. No cap.
- **Warnings:** Show top 10 warnings, prioritized by impact. If more exist, note count at bottom.
- **Info:** Only show if `--all` flag is used. Otherwise omit the section entirely.

````markdown
## Code Review Report

**Files:** {count} | **Effort:** ⭐⭐⭐ ({1-5}/5) | **Issues:** {n} critical, {n} warnings{, {n} info if --all}

---

### 🔴 Critical Issues

| Label      | File                           | Lines | Issue                             |
| ---------- | ------------------------------ | ----- | --------------------------------- |
| `security` | `api/src/routes/auth.ts`       | 45-48 | API key exposed in error response |
| `bug`      | `api/src/services/playlist.ts` | 67    | Unhandled promise rejection       |

#### Issue #1: {Short Title}

**File:** `{path}:{start_line}-{end_line}`
**Label:** `{label}`

{Description of why this is a problem}

```{language}
// ❌ Current
{existing_code}

// ✅ Fixed
{improved_code}
```
````

**Summary:** {one_sentence_summary}

---

### 🟡 Warnings (top 10 by impact)

| Label           | File                               | Lines | Issue                                 |
| --------------- | ---------------------------------- | ----- | ------------------------------------- |
| `performance`   | `api/src/services/video.ts`        | 23-26 | Sequential awaits for independent ops |
| `best practice` | `apps/web/src/components/List.tsx` | 15    | Derived state stored in useState      |

#### Warning #1: {Short Title}

**File:** `{path}:{line}`
**Label:** `{label}`

{Description}

```{language}
// ❌ Current
{existing_code}

// ✅ Improved
{improved_code}
```

**Summary:** {one_sentence_summary}

---

### 🔵 Suggestions _(only shown with --all)_

> **This section is ONLY included when `/review --all` is used.**
> In default mode, skip this section entirely.

| Label             | File                             | Suggestion                                    |
| ----------------- | -------------------------------- | --------------------------------------------- |
| `maintainability` | `api/src/services/auth.ts`       | Extract token validation to separate function |
| `enhancement`     | `apps/web/src/hooks/useVideo.ts` | Add loading state to improve UX               |

---

### ✅ Compliance Passed

**Detected Skills:** {list detected skills}

- [x] No `any` types found
- [x] Guard clauses used correctly
- [x] Components under 50 lines JSX
- [x] Proper dependency injection
- [x] Type hints on all Python functions
- [x] No bare except clauses

---

### Not Shown

- {N} additional warnings (run `/review --all` to see)
- {N} info-level suggestions (run `/review --all` to see)
- Tip: Use `/review {path}` to review a specific area in detail

> If all issues fit within the caps, replace this section with:
> "All issues shown. No additional warnings or suggestions were found."

---

### Summary

{2-3 sentence summary of overall code quality and main areas to address}

````

---

## Effort Scale

| Score | Description |
|-------|-------------|
| ⭐ (1/5) | Trivial - Minor changes, quick review |
| ⭐⭐ (2/5) | Small - Few files, straightforward logic |
| ⭐⭐⭐ (3/5) | Medium - Multiple files, some complexity |
| ⭐⭐⭐⭐ (4/5) | Large - Many files, significant logic changes |
| ⭐⭐⭐⭐⭐ (5/5) | Complex - Architectural changes, careful review needed |

---

## Example Output

```markdown
## Code Review Report

**Files:** 3 | **Effort:** ⭐⭐ (2/5) | **Issues:** 1 critical, 2 warnings

---

### 🔴 Critical Issues

| Label | File | Lines | Issue |
|-------|------|-------|-------|
| `security` | `api/src/routes/auth.ts` | 45-48 | API key logged in error handler |

#### Issue #1: API Key Exposure in Logs
**File:** `api/src/routes/auth.ts:45-48`
**Label:** `security`

Error handler logs the full error object which may contain sensitive API keys from environment variables. This could expose secrets in log aggregation systems.

```typescript
// ❌ Current
catch (error) {
  request.log.error({ error, config: process.env }, 'Auth failed');
  reply.status(500).send({ message: 'Internal error' });
}

// ✅ Fixed
catch (error) {
  request.log.error({ message: error.message, code: error.code }, 'Auth failed');
  reply.status(500).send({ message: 'Internal error' });
}
````

**Summary:** Sanitize logged objects to prevent secret exposure.

---

### 🟡 Warnings (top 10 by impact)

| Label           | File                                    | Lines | Issue                                        |
| --------------- | --------------------------------------- | ----- | -------------------------------------------- |
| `performance`   | `api/src/services/video.ts`             | 23-26 | Sequential awaits for independent operations |
| `best practice` | `apps/web/src/components/VideoList.tsx` | 15-18 | Storing derived state in useState            |

#### Warning #1: Sequential Awaits

**File:** `api/src/services/video.ts:23-26`
**Label:** `performance`

Two independent async operations are awaited sequentially, doubling the latency unnecessarily.

```typescript
// ❌ Current
const metadata = await fetchMetadata(videoId);
const transcript = await fetchTranscript(videoId);

// ✅ Improved
const [metadata, transcript] = await Promise.all([
  fetchMetadata(videoId),
  fetchTranscript(videoId),
]);
```

**Summary:** Parallelize independent async operations with Promise.all.

#### Warning #2: Derived State in useState

**File:** `apps/web/src/components/VideoList.tsx:15-18`
**Label:** `best practice`

`filteredVideos` is derived from `videos` and `searchQuery` but stored in separate state, causing sync issues.

```tsx
// ❌ Current
const [videos, setVideos] = useState<Video[]>([]);
const [filteredVideos, setFilteredVideos] = useState<Video[]>([]);

useEffect(() => {
  setFilteredVideos(videos.filter((v) => v.title.includes(searchQuery)));
}, [videos, searchQuery]);

// ✅ Improved
const [videos, setVideos] = useState<Video[]>([]);
const filteredVideos = useMemo(
  () => videos.filter((v) => v.title.includes(searchQuery)),
  [videos, searchQuery],
);
```

**Summary:** Compute derived values during render instead of syncing state.

---

### ✅ Compliance Passed

**Detected Skills:** backend-node, react-vite

- [x] No `any` types found
- [x] Guard clauses used correctly
- [x] Components under 50 lines JSX
- [x] Proper layer separation
- [x] Props typed with interfaces

---

### Not Shown

- 0 additional warnings
- 1 info-level suggestion (run `/review --all` to see)
- Tip: Use `/review {path}` to review a specific area in detail

---

### Summary

Overall code quality is good. One critical security issue needs immediate attention: API keys could be exposed through error logging. Two warnings should be addressed to prevent tech debt. Run `/review --all` if you want to see info-level suggestions.

```

---

## Skill Resources

For deeper guidance on patterns:

| Skill | Resource |
|-------|----------|
| backend-node | `.claude/skills/backend-node/SKILL.md` |
| backend-python | `.claude/skills/backend-python/SKILL.md` |
| react-vite | `.claude/skills/react-vite/SKILL.md` |
```
