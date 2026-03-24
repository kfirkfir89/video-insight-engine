import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const PROJECT_DIR = join(import.meta.dirname, '..', '..', '..');
const HOOKS_DIR = join(PROJECT_DIR, '.claude', 'hooks');
const TEST_SESSION = 'test-session-skill-enforcement';
const CACHE_DIR = join(PROJECT_DIR, '.claude', 'tsc-cache', TEST_SESSION);
const STATE_PATH = join(CACHE_DIR, 'skill-state.json');

function runHook(hookFile: string, input: Record<string, unknown>): { stdout: string; exitCode: number } {
  const inputPath = join(CACHE_DIR, '_test-input.json');
  writeFileSync(inputPath, JSON.stringify(input));
  try {
    const stdout = execSync(
      `cat ${inputPath} | npx tsx ${hookFile}`,
      { cwd: HOOKS_DIR, encoding: 'utf-8', env: { ...process.env, CLAUDE_PROJECT_DIR: PROJECT_DIR }, timeout: 10000 }
    );
    return { stdout: stdout.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number };
    return { stdout: (e.stdout || '').trim(), exitCode: e.status || 1 };
  }
}

function writeState(state: Record<string, unknown>): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function readState(): Record<string, unknown> {
  return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
}

describe('skill-block-guard', () => {
  beforeEach(() => {
    mkdirSync(CACHE_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(CACHE_DIR)) {
      rmSync(CACHE_DIR, { recursive: true, force: true });
    }
  });

  it('should block when unconsumed skill exists', () => {
    writeState({
      session_id: TEST_SESSION,
      activated: {
        'backend-node': {
          enforcement: 'block',
          skillPath: '.claude/skills/backend-node/SKILL.md',
          skillDir: '.claude/skills/backend-node/',
          activatedAt: new Date().toISOString(),
          consumed: false,
        },
      },
    });

    const result = runHook('skill-block-guard.ts', {
      session_id: TEST_SESSION,
      tool_name: 'Edit',
      tool_input: { file_path: join(PROJECT_DIR, 'api/src/routes/foo.ts') },
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain('SKILL BLOCK');
    expect(parsed.reason).toContain('backend-node');
  });

  it('should allow when skill is consumed', () => {
    writeState({
      session_id: TEST_SESSION,
      activated: {
        'backend-node': {
          enforcement: 'block',
          skillPath: '.claude/skills/backend-node/SKILL.md',
          skillDir: '.claude/skills/backend-node/',
          activatedAt: new Date().toISOString(),
          consumed: true,
        },
      },
    });

    const result = runHook('skill-block-guard.ts', {
      session_id: TEST_SESSION,
      tool_name: 'Edit',
      tool_input: { file_path: join(PROJECT_DIR, 'api/src/routes/foo.ts') },
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe('allow');
  });

  it('should allow when no state file exists (fail open)', () => {
    // Don't write any state file
    if (existsSync(STATE_PATH)) rmSync(STATE_PATH);

    const result = runHook('skill-block-guard.ts', {
      session_id: TEST_SESSION,
      tool_name: 'Edit',
      tool_input: { file_path: join(PROJECT_DIR, 'api/src/routes/foo.ts') },
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe('allow');
  });

  it('should allow when session ID differs (stale state)', () => {
    writeState({
      session_id: 'old-session-id',
      activated: {
        'backend-node': {
          enforcement: 'block',
          skillPath: '.claude/skills/backend-node/SKILL.md',
          skillDir: '.claude/skills/backend-node/',
          activatedAt: new Date().toISOString(),
          consumed: false,
        },
      },
    });

    const result = runHook('skill-block-guard.ts', {
      session_id: TEST_SESSION,
      tool_name: 'Edit',
      tool_input: { file_path: join(PROJECT_DIR, 'api/src/routes/foo.ts') },
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe('allow');
  });

  it('should allow edits to .claude/ files (exempt)', () => {
    writeState({
      session_id: TEST_SESSION,
      activated: {
        'backend-node': {
          enforcement: 'block',
          skillPath: '.claude/skills/backend-node/SKILL.md',
          skillDir: '.claude/skills/backend-node/',
          activatedAt: new Date().toISOString(),
          consumed: false,
        },
      },
    });

    const result = runHook('skill-block-guard.ts', {
      session_id: TEST_SESSION,
      tool_name: 'Edit',
      tool_input: { file_path: join(PROJECT_DIR, '.claude/hooks/something.ts') },
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe('allow');
  });

  it('should allow when no file_path in tool_input', () => {
    const result = runHook('skill-block-guard.ts', {
      session_id: TEST_SESSION,
      tool_name: 'Edit',
      tool_input: {},
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe('allow');
  });
});

describe('skill-read-tracker', () => {
  beforeEach(() => {
    mkdirSync(CACHE_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(CACHE_DIR)) {
      rmSync(CACHE_DIR, { recursive: true, force: true });
    }
  });

  it('should mark skill as consumed when SKILL.md is read', () => {
    writeState({
      session_id: TEST_SESSION,
      activated: {
        'backend-node': {
          enforcement: 'block',
          skillPath: '.claude/skills/backend-node/SKILL.md',
          skillDir: '.claude/skills/backend-node/',
          activatedAt: new Date().toISOString(),
          consumed: false,
        },
      },
    });

    runHook('skill-read-tracker.ts', {
      session_id: TEST_SESSION,
      tool_name: 'Read',
      tool_input: { file_path: join(PROJECT_DIR, '.claude/skills/backend-node/SKILL.md') },
    });

    const state = readState();
    const activated = state.activated as Record<string, { consumed: boolean }>;
    expect(activated['backend-node'].consumed).toBe(true);
  });

  it('should mark skill as consumed when resource file is read', () => {
    writeState({
      session_id: TEST_SESSION,
      activated: {
        'backend-node': {
          enforcement: 'block',
          skillPath: '.claude/skills/backend-node/SKILL.md',
          skillDir: '.claude/skills/backend-node/',
          activatedAt: new Date().toISOString(),
          consumed: false,
        },
      },
    });

    runHook('skill-read-tracker.ts', {
      session_id: TEST_SESSION,
      tool_name: 'Read',
      tool_input: { file_path: join(PROJECT_DIR, '.claude/skills/backend-node/resources/fastify.md') },
    });

    const state = readState();
    const activated = state.activated as Record<string, { consumed: boolean }>;
    expect(activated['backend-node'].consumed).toBe(true);
  });

  it('should not change state when unrelated file is read', () => {
    writeState({
      session_id: TEST_SESSION,
      activated: {
        'backend-node': {
          enforcement: 'block',
          skillPath: '.claude/skills/backend-node/SKILL.md',
          skillDir: '.claude/skills/backend-node/',
          activatedAt: new Date().toISOString(),
          consumed: false,
        },
      },
    });

    runHook('skill-read-tracker.ts', {
      session_id: TEST_SESSION,
      tool_name: 'Read',
      tool_input: { file_path: join(PROJECT_DIR, 'api/src/routes/foo.ts') },
    });

    const state = readState();
    const activated = state.activated as Record<string, { consumed: boolean }>;
    expect(activated['backend-node'].consumed).toBe(false);
  });

  it('should handle missing state file gracefully', () => {
    // No state file — should not crash
    const result = runHook('skill-read-tracker.ts', {
      session_id: TEST_SESSION,
      tool_name: 'Read',
      tool_input: { file_path: join(PROJECT_DIR, '.claude/skills/backend-node/SKILL.md') },
    });

    expect(result.exitCode).toBe(0);
  });
});
