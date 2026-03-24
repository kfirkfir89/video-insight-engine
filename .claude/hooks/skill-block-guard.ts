#!/usr/bin/env npx tsx
/**
 * Skill Block Guard — PreToolUse hook
 *
 * Prevents Edit/Write/MultiEdit when a skill with enforcement:"block"
 * was activated but hasn't been read yet. Fail-open on any error.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface PreToolInput {
  session_id: string;
  tool_name: string;
  tool_input: {
    file_path?: string;
  };
}

interface SkillStateEntry {
  enforcement: string;
  skillPath: string;
  skillDir: string;
  activatedAt: string;
  consumed: boolean;
}

interface SkillState {
  session_id: string;
  activated: Record<string, SkillStateEntry>;
}

function allow(): void {
  console.log(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
}

function block(reason: string): void {
  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

async function main() {
  let input: string;
  try {
    input = readFileSync(0, 'utf-8');
  } catch {
    return allow();
  }

  let data: PreToolInput;
  try {
    data = JSON.parse(input);
  } catch {
    return allow();
  }

  const filePath = data.tool_input.file_path;
  if (!filePath) {
    return allow();
  }

  // Exempt: edits to .claude/ infrastructure files
  if (filePath.includes('.claude/')) {
    return allow();
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const cacheDir = join(projectDir, '.claude', 'tsc-cache', data.session_id);
  const statePath = join(cacheDir, 'skill-state.json');

  // No state file = no blocked skills → allow
  if (!existsSync(statePath)) {
    return allow();
  }

  let state: SkillState;
  try {
    state = JSON.parse(readFileSync(statePath, 'utf-8'));
  } catch {
    return allow();
  }

  // Stale session → allow
  if (state.session_id !== data.session_id) {
    return allow();
  }

  // Find unconsumed blocked skills
  const unconsumed = Object.entries(state.activated)
    .filter(([, entry]) => entry.enforcement === 'block' && !entry.consumed);

  if (unconsumed.length === 0) {
    return allow();
  }

  // Block with helpful message
  const skillList = unconsumed
    .map(([name, entry]) => `    - ${name} → Read: ${entry.skillPath}`)
    .join('\n');

  const reason = `⛔ SKILL BLOCK: Read required skills before editing!

Unconsumed skills:
${skillList}

Read the SKILL.md file(s) above, then retry your edit.`;

  return block(reason);
}

main().catch(() => {
  // On any error, fail open
  console.log(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
});
