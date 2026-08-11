import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const PROJECT_DIR = join(import.meta.dirname, '..', '..', '..');
const HOOKS_DIR = join(PROJECT_DIR, '.claude', 'hooks');
const HOOK = join(HOOKS_DIR, 'git-safety-guard.sh');
const OVERRIDE_FILE = join(HOOKS_DIR, '.git-safety-override');

function runHook(command: string): { stdout: string; stderr: string; exitCode: number } {
  const input = JSON.stringify({ tool_input: { command } });
  try {
    const stdout = execSync(`bash ${HOOK}`, {
      input,
      cwd: HOOKS_DIR,
      encoding: 'utf-8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: PROJECT_DIR },
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout: stdout ?? '', stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { stdout: (e.stdout || '').trim(), stderr: (e.stderr || '').trim(), exitCode: e.status ?? 1 };
  }
}

describe('git-safety-guard', () => {
  afterEach(() => {
    if (existsSync(OVERRIDE_FILE)) rmSync(OVERRIDE_FILE);
  });

  describe('blocked commands', () => {
    it.each([
      'git stash',
      'git stash pop',
      'git stash drop',
      'cd /somewhere && git stash',
      'git reset --hard HEAD~1',
      'git reset --hard origin/main',
      'git checkout -- apps/web/src/index.css',
      'git checkout .',
      'git checkout main -- file.ts',
      'git clean -fd',
      'git push --force origin dev-2',
      'git push -f',
      'git push origin main --force-with-lease',
      'git branch -D main',
      'git restore apps/web/src/index.css',
      'git restore --worktree file.ts',
      'git restore --staged --worktree file.ts',
      'git restore -s HEAD~1 file.ts',
      // quoted-token evasion must not bypass detection
      'git "stash"',
      "git stas'h' pop",
      'git reset "--hard" HEAD~1',
      // plan 5.1 adversarial forms: -C, env prefix, compound separators
      'git -C . stash',
      'git -C /some/dir stash pop',
      'GIT_DIR=.git git stash',
      'true; git stash',
      'echo hi | tee log && git reset --hard',
    ])('should block: %s', (cmd) => {
      const { exitCode, stderr } = runHook(cmd);
      expect(exitCode).toBe(2);
      expect(stderr).toContain('BLOCKED by git-safety-guard');
    });
  });

  describe('allowed commands', () => {
    it.each([
      'git status',
      'git diff HEAD',
      'git log --oneline -5',
      'git show HEAD:apps/web/src/index.css',
      'git stash list',
      'git stash show -p stash@{0}',
      'git checkout -b feature/new-branch',
      'git checkout dev-2',
      'git reset HEAD file.ts',
      'git reset --soft HEAD~1',
      'git push origin dev-2',
      'git branch -D feature/old-branch',
      'git add -A && git commit -m "feat: something"',
      'npm test',
      'echo "git stash is banned" > note.txt',
      'git restore --staged file.ts',
      'git commit -m "docs: explain why reset --hard is banned"',
    ])('should allow: %s', (cmd) => {
      expect(runHook(cmd).exitCode).toBe(0);
    });
  });

  describe('ask-gated commands (commit/push exit 0 with permissionDecision ask)', () => {
    it.each([
      'git commit -m "feat: x"',
      'git add -A && git commit -m "feat: y"',
      'git push origin dev-2',
      'git -C api push',
    ])('should ask: %s', (cmd) => {
      const { exitCode, stdout } = runHook(cmd);
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout.trim());
      expect(parsed.hookSpecificOutput.permissionDecision).toBe('ask');
    });

    it.each([
      'git status',
      'git log --oneline',
      'npm test',
      'git show HEAD:file.ts',
    ])('should not ask (plain allow, no JSON): %s', (cmd) => {
      const { exitCode, stdout } = runHook(cmd);
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe('');
    });

    it('should allow non-Bash input with no command', () => {
      const input = JSON.stringify({ tool_input: { file_path: '/x.ts' } });
      const out = execSync(`bash ${HOOK}`, {
        input,
        cwd: HOOKS_DIR,
        encoding: 'utf-8',
        env: { ...process.env, CLAUDE_PROJECT_DIR: PROJECT_DIR },
      });
      expect(out).toBeDefined();
    });
  });

  describe('override flag', () => {
    it('should allow a blocked command when override file exists, then consume it', () => {
      writeFileSync(OVERRIDE_FILE, '');
      const first = runHook('git stash');
      expect(first.exitCode).toBe(0);
      expect(existsSync(OVERRIDE_FILE)).toBe(false);

      const second = runHook('git stash');
      expect(second.exitCode).toBe(2);
    });
  });
});
