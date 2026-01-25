# Claude Code Infrastructure

This directory contains Claude Code's configuration, commands, skills, rules, and hooks for the Video Insight Engine project.

---

## Quick Reference

| I want to...                    | Use this                      |
| ------------------------------- | ----------------------------- |
| Start a new task                | `/task-plan {task-name}`      |
| See active tasks                | `/list-tasks`                 |
| Resume after chat clear         | `/resume {task-name}`         |
| Complete a task (full workflow) | `/complete-task {task-name}`  |
| Update docs for changes         | `/update-docs {what changed}` |
| Save context before clearing    | `/task-plan-update`           |
| Review code                     | `/review`                     |
| Generate tests                  | `/test {file}`                |
| Security audit                  | `/security-check`             |
| Pre-deploy checklist            | `/ship`                       |

---

## Complete Task Workflow

### Starting a New Feature

```
1. /task-plan add-user-preferences
   → Creates dev/active/add-user-preferences/
   → Generates plan.md, context.md, tasks.md

2. [Implement the feature]
   → Skills auto-activate based on your prompts
   → MUST read suggested skills before writing code

3. /complete-task add-user-preferences
   → Runs: Plan verification → Tests → Security → Review → Docs
   → Reports any issues to fix

4. /ship
   → Final checklist before deploy
```

### Resuming After Chat Clear

```
1. /list-tasks
   → Shows all active tasks with progress

2. /resume add-user-preferences
   → Loads context, tasks, and plan
   → Shows current state and next steps

3. [Continue working]
```

### Before Clearing Chat

```
1. /task-plan-update
   → Saves current context to dev/active/{task}/
   → Updates progress in tasks.md
   → Documents blockers and next steps
```

---

## Directory Structure

```
.claude/
├── README.md              ← You are here
├── settings.json          # Global config + hooks
├── settings.local.json    # Local permissions (gitignored)
│
├── commands/              # Slash commands
│   ├── task-plan.md       # Create task documentation
│   ├── task-plan-update.md# Save context before chat clear
│   ├── list-tasks.md      # List all active tasks
│   ├── resume.md          # Resume an active task
│   ├── complete-task.md   # Full completion workflow
│   ├── update-docs.md     # Update project documentation
│   ├── review.md          # Code review
│   ├── test.md            # Generate tests
│   ├── security-check.md  # Security audit
│   └── ship.md            # Pre-deploy checklist
│
├── skills/                # Domain expertise (auto-activated)
│   ├── skill-rules.json   # Activation rules
│   ├── backend-node/      # Node.js/Fastify patterns
│   ├── backend-python/    # Python/FastAPI patterns
│   └── react-vite/        # React/Vite patterns
│
├── rules/                 # Enforced guidelines
│   ├── README.md          # Rules overview
│   ├── skill-enforcement.md # MANDATORY: read skills
│   ├── code-quality.md    # Code standards
│   ├── security.md        # Security requirements
│   ├── testing.md         # Testing standards
│   └── git-workflow.md    # Git conventions
│
├── agents/                # Specialized assistants
│   ├── test-writer.md
│   ├── debug-investigator.md
│   ├── refactor-planner.md
│   └── doc-generator.md
│
└── hooks/                 # Automatic triggers
    ├── skill-activation-prompt.ts  # Suggests skills on prompt
    └── post-tool-use-tracker.sh    # Tracks file changes
```

---

## Skills System

### How Skills Work

1. **Auto-Activation**: When you submit a prompt, the hook checks for keyword matches
2. **Skill Suggestion**: Matching skills appear in the output
3. **MANDATORY Reading**: You MUST read the suggested SKILL.md and resources
4. **Apply Patterns**: Use the patterns from skills in your code

### Example Flow

```
User: "Create a new API endpoint for user preferences"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 SKILL ACTIVATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 backend-node
   ↳ Matched: "api" (keyword)
   📄 Resources:
      • resources/fastify.md
      • resources/services.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 Read skill + resources BEFORE responding
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Claude MUST:
1. Read .claude/skills/backend-node/SKILL.md
2. Read .claude/skills/backend-node/resources/fastify.md
3. Read .claude/skills/backend-node/resources/services.md
4. THEN write code following those patterns
```

### Available Skills

| Skill | Triggers | Resources |
|-------|----------|-----------|
| [backend-node](./skills/backend-node/SKILL.md) | API, route, fastify, endpoint | fastify.md, services.md, mongodb.md |
| [backend-python](./skills/backend-python/SKILL.md) | Python, FastAPI, summarizer, explainer | fastapi.md, services.md |
| [react-vite](./skills/react-vite/SKILL.md) | Component, React, frontend, UI | react.md, state.md, forms.md |

---

## Rules System

### Enforcement Levels

| Level           | Meaning                                    |
| --------------- | ------------------------------------------ |
| **MANDATORY**   | Must follow without exception              |
| **Required**    | Follow unless user explicitly overrides    |
| **Recommended** | Best practice, may skip with justification |

### Active Rules

| Rule          | File                                                 | Level         |
| ------------- | ---------------------------------------------------- | ------------- |
| Skill Reading | [skill-enforcement.md](./rules/skill-enforcement.md) | **MANDATORY** |
| Code Quality  | [code-quality.md](./rules/code-quality.md)           | Required      |
| Security      | [security.md](./rules/security.md)                   | Required      |
| Testing       | [testing.md](./rules/testing.md)                     | Required      |
| Git Workflow  | [git-workflow.md](./rules/git-workflow.md)           | Required      |

---

## Commands in Detail

### `/task-plan {name}`

Creates structured task documentation for complex features.

**When to use:**

- Starting a new feature
- Planning a refactoring effort
- Breaking down a complex bug fix

**Creates:**

```
dev/active/{name}/
├── {name}-plan.md      # Comprehensive plan
├── {name}-context.md   # Key decisions, dependencies
└── {name}-tasks.md     # Progress checklist
```

**Example:**

```
/task-plan add-caching-layer

→ Creates dev/active/add-caching-layer/
→ Generates plan with phases, tasks, risks
→ Tracks progress through implementation
```

---

### `/list-tasks`

Shows all active tasks with progress.

**When to use:**

- Starting a new session
- Checking overall progress
- Deciding which task to work on

**Output:**

```
## 📋 Active Tasks

| Task | Progress | Last Updated |
|------|----------|--------------|
| add-caching | 3/5 (60%) | 2025-01-20 |
| auth-refactor | 1/8 (12%) | 2025-01-18 |
```

---

### `/resume {task-name}`

Loads context and continues an active task.

**When to use:**

- After clearing chat
- Switching between tasks
- Starting a new session

**Example:**

```
/resume add-caching

→ Loads context from dev/active/add-caching/
→ Shows completed tasks, current state
→ Lists next steps and blockers
→ Ready to continue working
```

---

### `/complete-task {task-name}`

Runs the full completion workflow.

**When to use:**

- Task implementation is done
- Ready to finalize and verify
- Before merging to main

**Workflow:**

```
1. ✅ Plan Verification - Implementation matches plan?
2. ✅ Tests - Generate/run tests, check coverage
3. ✅ Security - Audit for vulnerabilities
4. ✅ Code Review - Quality, patterns, cleanup
5. ✅ Documentation - Update docs/, CLAUDE.md, README
```

**Example:**

```
/complete-task add-caching

## ✅ Task Completion Report: add-caching

### 1. Plan Verification
✅ Implementation matches plan

### 2. Tests
✅ Tests passing (85% coverage)

### 3. Security
✅ No issues found

### 4. Code Review
✅ Code quality good

### 5. Documentation
✅ Updated docs/CACHING.md

---
**Task complete! Run /ship when ready to deploy.**
```

---

### `/update-docs {changes}`

Updates project documentation for recent changes.

**When to use:**

- After completing a feature
- After architecture changes
- When APIs change

**Example:**

```
/update-docs added Redis caching layer

→ Checks docs/ARCHITECTURE.md
→ Updates docs/CACHING.md
→ Updates CLAUDE.md tech stack
→ Reports what was changed
```

---

### `/task-plan-update`

Saves current context before clearing chat.

**When to use:**

- Context getting long
- Before clearing chat
- Switching to different work

**Saves:**

- Current implementation state
- Key decisions made
- Files modified
- Next immediate steps

---

## Hooks

### Skill Activation Hook

**Trigger:** Every prompt submission

**Actions:**

1. Checks prompt for skill keywords
2. Displays matching skills and resources
3. Shows active tasks reminder

### Post-Tool-Use Tracker

**Trigger:** After file edits

**Actions:**

- Tracks which files were modified
- Helps with documentation updates

---

## Best Practices

### 1. Always Read Activated Skills

When you see the skill activation banner, STOP and read the suggested files before writing any code.

### 2. Use Task Planning for Complex Work

If a task involves more than 3-4 files or will take multiple sessions, create task docs with `/task-plan`.

### 3. Save Context Before Clearing

Always run `/task-plan-update` before clearing chat. Your future self will thank you.

### 4. Run Complete Workflow Before Merging

Use `/complete-task` to ensure tests pass, security is checked, and docs are updated.

### 5. Keep Tasks Focused

One task = one feature or fix. Don't combine unrelated work in a single task.

---

## Troubleshooting

### Skills Not Activating

Check that [skill-rules.json](./skills/skill-rules.json) exists and has valid configuration.

### Task Not Found

Verify the task exists in [dev/active/](../dev/active/). Use `/list-tasks` to see available tasks.

### Hook Not Running

Check [settings.local.json](./settings.local.json) for hook configuration. Hooks must be executable.
Check [settings.json](./settings.json) for hook configuration. Hooks must be executable.

---

## Adding New Commands

1. Create `.claude/commands/{command-name}.md`
2. Add frontmatter with description and argument-hint
3. Write instructions for Claude to follow
4. Update this README and CLAUDE.md

### Command Template

```markdown
---
description: Brief description of what this command does
argument-hint: What arguments it accepts (e.g., "file path", "task name")
---

Instructions for Claude to follow when this command is invoked.

## Instructions

1. Step one
2. Step two

## Output Format

What the output should look like.
```

---

## Adding New Rules

1. Create `.claude/rules/{rule-name}.md`
2. Define the rule with clear requirements
3. Set enforcement level (MANDATORY/Required/Recommended)
4. Add to `.claude/rules/README.md` table
5. Reference in CLAUDE.md if critical
