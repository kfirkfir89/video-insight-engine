#!/usr/bin/env npx tsx
/**
 * Pre-Edit Guard — PreToolUse hook (matcher: Edit|Write|MultiEdit)
 *
 * Single merged guard (one tsx spawn per edit instead of two):
 *
 * 1. SKILL BLOCK (blocking): prevents edits when a skill with
 *    enforcement:"block" was activated but not yet read — but ONLY for
 *    files inside that skill's domain (fileTriggers.pathPatterns in
 *    skill-rules.json). Markdown, dev/, docs/, and .claude/ files are
 *    never blocked.
 *
 * 2. TDD REMINDER (warn only): if a source file is edited with no
 *    related test modified this session, emits a non-blocking warning.
 *    State is per-session (.claude/tsc-cache/<session>/tdd-state.json)
 *    so concurrent sessions don't clobber each other.
 *
 * Fail-open on any error.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

function resolveProjectDir(): string {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  // This file lives at <project>/.claude/hooks/ — walk up two levels.
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

interface PreToolInput {
  session_id: string;
  tool_name: string;
  tool_input: {
    file_path?: string;
    command?: string;
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

interface SkillRules {
  skills: Record<string, {
    fileTriggers?: { pathPatterns?: string[] };
  }>;
}

interface TddState {
  session: string;
  testFilesModified: string[];
  sourceFilesAllowed: string[];
}

// ────────────────────────────── output ──────────────────────────────

function emit(result: { decision: string; reason?: string; systemMessage?: string }): void {
  console.log(JSON.stringify(result));
  process.exit(0);
}

// ─────────────────────────── skill guard ────────────────────────────

// Minimal glob → RegExp: ** crosses directories, * stays within a segment.
function globToRegExp(glob: string): RegExp {
  let re = '';
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 3;
        } else {
          re += '.*';
          i += 2;
        }
      } else {
        re += '[^/]*';
        i += 1;
      }
    } else if ('.+?^${}()|[]\\'.includes(ch)) {
      re += '\\' + ch;
      i += 1;
    } else {
      re += ch;
      i += 1;
    }
  }
  return new RegExp(`^${re}$`);
}

function toRelativePath(filePath: string, projectDir: string): string {
  let rel = filePath;
  if (rel.startsWith(projectDir)) {
    rel = rel.slice(projectDir.length);
  }
  return rel.replace(/^\.?\//, '');
}

function checkSkillBlock(data: PreToolInput, projectDir: string, relPath: string): string | null {
  const statePath = join(projectDir, '.claude', 'tsc-cache', data.session_id, 'skill-state.json');
  if (!existsSync(statePath)) return null;

  let state: SkillState;
  try {
    state = JSON.parse(readFileSync(statePath, 'utf-8'));
  } catch {
    return null;
  }
  if (state.session_id !== data.session_id) return null;

  const unconsumed = Object.entries(state.activated)
    .filter(([, entry]) => entry.enforcement === 'block' && !entry.consumed);
  if (unconsumed.length === 0) return null;

  // Path-scope: a skill only blocks files matching its own pathPatterns.
  let rules: SkillRules;
  try {
    rules = JSON.parse(readFileSync(join(projectDir, '.claude', 'skills', 'skill-rules.json'), 'utf-8'));
  } catch {
    return null;
  }

  const blocking = unconsumed.filter(([name]) => {
    const patterns = rules.skills[name]?.fileTriggers?.pathPatterns;
    if (!patterns || patterns.length === 0) return false;
    return patterns.some(p => {
      try {
        return globToRegExp(p).test(relPath);
      } catch {
        return false;
      }
    });
  });

  if (blocking.length === 0) return null;

  const skillList = blocking
    .map(([name, entry]) => `    - ${name} → Read: ${entry.skillPath}`)
    .join('\n');

  return `⛔ SKILL BLOCK: Read required skills before editing!

Unconsumed skills for this file's domain (${relPath}):
${skillList}

Read the SKILL.md file(s) above, then retry your edit.`;
}

// ──────────────────────────── tdd reminder ──────────────────────────

const SOURCE_PATTERNS = [/\.ts$/, /\.tsx$/, /\.py$/];

const EXCLUDE_PATTERNS = [
  /\.test\.(ts|tsx|py)$/,
  /\.spec\.(ts|tsx|py)$/,
  /\/__tests__\//,
  /\/tests?\//,
  /\.d\.ts$/,
  /\.md$/,
  /\.json$/,
  /\.ya?ml$/,
  /\.env/,
  /\.sh$/,
  /\.s?css$/,
  /\.html$/,
  /vite\.config/,
  /tsconfig/,
  /eslint/,
  /prettier/,
  /tailwind/,
  /postcss/,
  /package\.json$/,
  /package-lock\.json$/,
  /pnpm-lock\.yaml$/,
  /\.claude\//,
  /dev\//,
  /docs\//,
  /scripts\//,
  /migrations\//,
  /seeds?\//,
  /fixtures?\//,
  /mocks?\//,
  /__mocks__\//,
  /types\.ts$/,
  /index\.ts$/,
  /constants\.ts$/,
  /config\.ts$/,
];

function isSourceFile(path: string): boolean {
  if (EXCLUDE_PATTERNS.some(p => p.test(path))) return false;
  return SOURCE_PATTERNS.some(p => p.test(path));
}

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx|py)$/.test(path) ||
         path.includes('__tests__/') ||
         path.includes('/tests/') ||
         /\/test_[^/]+\.py$/.test(path);
}

function hasRelatedTestModified(sourcePath: string, testFilesModified: string[]): boolean {
  const sourceBase = basename(sourcePath).replace(/\.(ts|tsx|py)$/, '');

  return testFilesModified.some(testPath => {
    const testBase = basename(testPath)
      .replace(/\.(test|spec)\.(ts|tsx|py)$/, '')
      .replace(/^test_/, '')
      .replace(/\.test$/, '')
      .replace(/\.spec$/, '');

    if (testBase === sourceBase) return true;
    if (testBase.includes(sourceBase) || sourceBase.includes(testBase)) return true;
    return false;
  });
}

function loadTddState(statePath: string, sessionId: string): TddState {
  const fresh: TddState = { session: sessionId, testFilesModified: [], sourceFilesAllowed: [] };
  try {
    if (existsSync(statePath)) {
      const saved = JSON.parse(readFileSync(statePath, 'utf-8'));
      if (saved.session !== sessionId) return fresh;
      return { ...fresh, ...saved };
    }
  } catch { /* start fresh */ }
  return fresh;
}

function saveTddState(statePath: string, state: TddState): void {
  try {
    const dir = dirname(statePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch { /* best-effort */ }
}

// Returns a warning string or null. Never blocks.
function checkTdd(data: PreToolInput, projectDir: string): string | null {
  const filePath = data.tool_input.file_path!;
  const statePath = join(projectDir, '.claude', 'tsc-cache', data.session_id, 'tdd-state.json');
  const state = loadTddState(statePath, data.session_id);

  if (isTestFile(filePath)) {
    if (!state.testFilesModified.includes(filePath)) {
      state.testFilesModified.push(filePath);
      saveTddState(statePath, state);
    }
    return null;
  }

  if (!isSourceFile(filePath)) return null;

  if (state.sourceFilesAllowed.includes(filePath)) return null;

  if (hasRelatedTestModified(filePath, state.testFilesModified)) {
    state.sourceFilesAllowed.push(filePath);
    saveTddState(statePath, state);
    return null;
  }

  return `🟡 TDD: no related test modified this session for ${basename(filePath)} — consider writing/updating the test first (red → green → refactor).`;
}

// ──────────────────────────────── main ──────────────────────────────

async function main() {
  let input: string;
  try {
    input = readFileSync(0, 'utf-8');
  } catch {
    return emit({ decision: 'allow' });
  }

  let data: PreToolInput;
  try {
    data = JSON.parse(input);
  } catch {
    return emit({ decision: 'allow' });
  }

  const filePath = data.tool_input?.file_path;
  if (!filePath) {
    return emit({ decision: 'allow' });
  }

  const projectDir = resolveProjectDir();
  const relPath = toRelativePath(filePath, projectDir);

  // Exempt from skill blocking: infrastructure, planning, docs, markdown
  const skillExempt =
    relPath.startsWith('.claude/') || filePath.includes('/.claude/') ||
    relPath.startsWith('dev/') ||
    relPath.startsWith('docs/') ||
    relPath.endsWith('.md');

  if (!skillExempt) {
    let blockReason: string | null = null;
    try {
      blockReason = checkSkillBlock(data, projectDir, relPath);
    } catch { /* fail open */ }
    if (blockReason) {
      return emit({ decision: 'block', reason: blockReason });
    }
  }

  let tddWarning: string | null = null;
  try {
    tddWarning = checkTdd(data, projectDir);
  } catch { /* fail open */ }

  if (tddWarning) {
    return emit({ decision: 'allow', systemMessage: tddWarning });
  }

  return emit({ decision: 'allow' });
}

main().catch(() => {
  console.log(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
});
