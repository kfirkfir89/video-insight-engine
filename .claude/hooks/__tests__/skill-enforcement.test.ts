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

    const result = runHook('pre-edit-guard.ts', {
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

    const result = runHook('pre-edit-guard.ts', {
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

    const result = runHook('pre-edit-guard.ts', {
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

    const result = runHook('pre-edit-guard.ts', {
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

    const result = runHook('pre-edit-guard.ts', {
      session_id: TEST_SESSION,
      tool_name: 'Edit',
      tool_input: { file_path: join(PROJECT_DIR, '.claude/hooks/something.ts') },
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe('allow');
  });

  it('should allow when no file_path in tool_input', () => {
    const result = runHook('pre-edit-guard.ts', {
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

// ────────────────────────────────────────────────────────────────────
// Path-scoped block guard (skills only block files in their own domain)
// ────────────────────────────────────────────────────────────────────

function stateWith(skills: Record<string, { consumed?: boolean }>): Record<string, unknown> {
  const activated: Record<string, unknown> = {};
  for (const [name, opts] of Object.entries(skills)) {
    activated[name] = {
      enforcement: 'block',
      skillPath: `.claude/skills/${name}/SKILL.md`,
      skillDir: `.claude/skills/${name}/`,
      activatedAt: new Date().toISOString(),
      consumed: opts.consumed ?? false,
    };
  }
  return { session_id: TEST_SESSION, activated };
}

function guardDecision(filePath: string): string {
  const result = runHook('pre-edit-guard.ts', {
    session_id: TEST_SESSION,
    tool_name: 'Edit',
    tool_input: { file_path: filePath },
  });
  return JSON.parse(result.stdout).decision;
}

describe('skill-block-guard path scoping', () => {
  beforeEach(() => {
    mkdirSync(CACHE_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(CACHE_DIR)) {
      rmSync(CACHE_DIR, { recursive: true, force: true });
    }
  });

  it('should NOT block a python file when only react-vite is unconsumed', () => {
    writeState(stateWith({ 'react-vite': {} }));
    expect(guardDecision(join(PROJECT_DIR, 'services/assistant/src/services/rag.py'))).toBe('allow');
  });

  it('should NOT block an api ts file when only react-vite is unconsumed', () => {
    writeState(stateWith({ 'react-vite': {} }));
    expect(guardDecision(join(PROJECT_DIR, 'api/src/routes/videos.routes.ts'))).toBe('allow');
  });

  it('should block a python file when backend-python is unconsumed', () => {
    writeState(stateWith({ 'backend-python': {} }));
    expect(guardDecision(join(PROJECT_DIR, 'services/admin/src/auth.py'))).toBe('block');
  });

  it('should block an admin UI tsx file when react-vite is unconsumed', () => {
    writeState(stateWith({ 'react-vite': {} }));
    expect(guardDecision(join(PROJECT_DIR, 'services/admin/ui/src/App.tsx'))).toBe('block');
  });

  it('should block a styles css file when design-system is unconsumed', () => {
    writeState(stateWith({ 'design-system': {} }));
    expect(guardDecision(join(PROJECT_DIR, 'apps/web/src/styles/categories.css'))).toBe('block');
  });

  it('should block llm-common python when backend-python is unconsumed', () => {
    writeState(stateWith({ 'backend-python': {} }));
    expect(guardDecision(join(PROJECT_DIR, 'packages/llm-common/src/tracing.py'))).toBe('block');
  });

  it('should never block markdown files (live evidence: plan.md was blocked)', () => {
    writeState(stateWith({ 'backend-node': {}, 'backend-python': {}, 'design-system': {} }));
    expect(guardDecision(join(PROJECT_DIR, 'dev/active/some-task/some-task-plan.md'))).toBe('allow');
    expect(guardDecision(join(PROJECT_DIR, 'docs/API-REFERENCE.md'))).toBe('allow');
    expect(guardDecision(join(PROJECT_DIR, 'README.md'))).toBe('allow');
    expect(guardDecision(join(PROJECT_DIR, 'api/src/notes.md'))).toBe('allow');
  });

  it('should not block root config files outside any skill domain (live evidence: .mcp.json)', () => {
    writeState(stateWith({ 'backend-node': {} }));
    expect(guardDecision(join(PROJECT_DIR, '.mcp.json'))).toBe('allow');
    expect(guardDecision(join(PROJECT_DIR, 'docker-compose.yml'))).toBe('allow');
  });

  it('should fail open for a skill missing from skill-rules.json', () => {
    writeState(stateWith({ 'ghost-skill': {} }));
    expect(guardDecision(join(PROJECT_DIR, 'api/src/routes/foo.ts'))).toBe('allow');
  });

  it('should still block in-domain files when multiple skills are active but only report matching ones', () => {
    writeState(stateWith({ 'backend-node': {}, 'react-vite': {} }));
    const result = runHook('pre-edit-guard.ts', {
      session_id: TEST_SESSION,
      tool_name: 'Edit',
      tool_input: { file_path: join(PROJECT_DIR, 'api/src/routes/foo.ts') },
    });
    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain('backend-node');
    expect(parsed.reason).not.toContain('react-vite');
  });
});

// ────────────────────────────────────────────────────────────────────
// Activation regression set — word-boundary matching + keyword pruning
// ────────────────────────────────────────────────────────────────────

function runActivation(prompt: string): string {
  const result = runHook('skill-activation-prompt.ts', {
    session_id: TEST_SESSION,
    transcript_path: '',
    cwd: PROJECT_DIR,
    permission_mode: 'default',
    prompt,
  });
  return result.stdout;
}

function activatedSkills(stdout: string): string[] {
  return [...stdout.matchAll(/✅ ([\w-]+) ←/g)].map(m => m[1]);
}

describe('skill-activation regression set', () => {
  beforeEach(() => {
    mkdirSync(CACHE_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(CACHE_DIR)) {
      rmSync(CACHE_DIR, { recursive: true, force: true });
    }
  });

  // ---- historic false positives: must activate NOTHING ----
  const falsePositives: [string, string][] = [
    ['infra-analysis prompt (live evidence 1)', 'analyze the .claude infrastructure hooks skill activation system'],
    ['bare "retry" (live evidence 4)', 'retry'],
    ['agent task-notification text (live evidence 2)', 'Background task claude-abc123 completed successfully. The agent finished its analysis.'],
    ['"build" ⊅ "ui" (live evidence 5)', 'build a feature'],
    ['"rapid" ⊅ "api" (live evidence 5)', 'the rapid fix worked'],
    ['"iconic" ⊅ "icon" (live evidence 5)', 'iconic branding decisions'],
    ['generic security discussion', "let's discuss the security implications of this approach"],
    ['"summarize" ⊅ "summarizer"', 'please summarize our conversation so far'],
    ['docker-compose edit request', 'update the docker-compose file'],
    ['"colorful" ⊅ "color"', 'what a colorful explanation, thanks'],
  ];

  for (const [label, prompt] of falsePositives) {
    it(`should activate nothing for: ${label}`, () => {
      const stdout = runActivation(prompt);
      expect(stdout).not.toContain('SKILLS ACTIVATED');
      expect(activatedSkills(stdout)).toEqual([]);
    });
  }

  // ---- legitimate triggers: correct skill must activate ----
  const truePositives: [string, string, string][] = [
    ['fastify route', 'add a new fastify route for playlists', 'backend-node'],
    ['pydantic summarizer', 'fix the pydantic model in the summarizer', 'backend-python'],
    ['react component', 'create a react component for the video card', 'react-vite'],
    ['icon choice', 'which icon should I use for the delete action', 'design-system'],
    ['auth endpoint', 'add rate limiting to the auth endpoint', 'backend-node'],
    ['rabbitmq worker', 'debug the rabbitmq worker connection', 'backend-python'],
    ['tailwind styles', 'update the tailwind styles on the sidebar component', 'react-vite'],
    ['design token', 'add a design token for the category accent', 'design-system'],
    ['qdrant search', 'implement qdrant vector search for the assistant', 'backend-python'],
    ['api validation', 'add input validation to the videos endpoint', 'backend-node'],
  ];

  for (const [label, prompt, expected] of truePositives) {
    it(`should activate ${expected} for: ${label}`, () => {
      const stdout = runActivation(prompt);
      expect(activatedSkills(stdout)).toContain(expected);
    });
  }

  it('should honor globalSettings.maxSkillsPerPrompt (2)', () => {
    const stdout = runActivation(
      'create a react component form page with tailwind for the api endpoint using fastify and pydantic in the summarizer'
    );
    expect(activatedSkills(stdout).length).toBeLessThanOrEqual(2);
  });

  it('should emit no skill box at all on no-match (only reminders)', () => {
    const stdout = runActivation('hello there');
    expect(stdout).not.toContain('NO SKILLS LOADED');
    expect(stdout).not.toContain('SKILLS ACTIVATED');
  });

  it('cross-domain guarantee: prompt-activated react-vite never blocks python edit end-to-end', () => {
    // Activate react-vite via prompt, then attempt python edit
    runActivation('create a react component for the dashboard');
    expect(guardDecision(join(PROJECT_DIR, 'services/summarizer/src/worker/runner.py'))).toBe('allow');
  });
});
