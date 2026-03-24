#!/usr/bin/env npx tsx
/**
 * Skill Read Tracker — PostToolUse hook (matcher: Read)
 *
 * When a file under a skill directory is read, marks that skill
 * as "consumed" in skill-state.json so the block guard allows edits.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

interface PostToolInput {
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

async function main() {
  let input: string;
  try {
    input = readFileSync(0, 'utf-8');
  } catch {
    process.exit(0);
  }

  let data: PostToolInput;
  try {
    data = JSON.parse(input!);
  } catch {
    process.exit(0);
  }

  // Only track Read tool
  if (data.tool_name !== 'Read') {
    process.exit(0);
  }

  const filePath = data.tool_input.file_path;
  if (!filePath) {
    process.exit(0);
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const cacheDir = join(projectDir, '.claude', 'tsc-cache', data.session_id);
  const statePath = join(cacheDir, 'skill-state.json');

  if (!existsSync(statePath)) {
    process.exit(0);
  }

  let state: SkillState;
  try {
    state = JSON.parse(readFileSync(statePath, 'utf-8'));
  } catch {
    process.exit(0);
  }

  // Stale session
  if (state.session_id !== data.session_id) {
    process.exit(0);
  }

  // Normalize file path for comparison
  const normalizedPath = filePath.replace(projectDir + '/', '').replace(projectDir, '');

  let changed = false;

  for (const [, entry] of Object.entries(state.activated)) {
    if (entry.consumed) continue;

    // Check if the read file is under this skill's directory
    // Match: .claude/skills/backend-node/SKILL.md or .claude/skills/backend-node/resources/fastify.md
    if (normalizedPath.includes(entry.skillDir) || filePath.includes(entry.skillDir)) {
      entry.consumed = true;
      changed = true;
    }
  }

  if (changed) {
    try {
      const dir = dirname(statePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(statePath, JSON.stringify(state, null, 2));
    } catch {
      // Silent failure — don't block workflow
    }
  }

  process.exit(0);
}

main().catch(() => {
  process.exit(0);
});
