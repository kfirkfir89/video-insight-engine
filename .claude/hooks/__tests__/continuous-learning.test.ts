import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const PROJECT_DIR = join(import.meta.dirname, '..', '..', '..');
const HOOKS_DIR = join(PROJECT_DIR, '.claude', 'hooks');
const TEST_SESSION = 'test-session-continuous-learning';
const CACHE_DIR = join(PROJECT_DIR, '.claude', 'tsc-cache', TEST_SESSION);
const INSIGHTS_PATH = join(CACHE_DIR, 'insights.json');
const EDITED_LOG = join(CACHE_DIR, 'edited-files.log');
const REPOS_FILE = join(CACHE_DIR, 'affected-repos.txt');

function runHook(input: Record<string, unknown>): { stdout: string; exitCode: number } {
  // Write input to temp file to avoid shell escaping issues with newlines
  const inputPath = join(CACHE_DIR, '_test-input.json');
  writeFileSync(inputPath, JSON.stringify(input));
  try {
    const stdout = execSync(
      `cat ${inputPath} | npx tsx continuous-learning.ts`,
      { cwd: HOOKS_DIR, encoding: 'utf-8', env: { ...process.env, CLAUDE_PROJECT_DIR: PROJECT_DIR }, timeout: 10000 }
    );
    return { stdout: stdout.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number };
    return { stdout: (e.stdout || '').trim(), exitCode: e.status || 1 };
  }
}

function readInsights(): { insights: Array<{ type: string; file_path: string; metadata: Record<string, unknown> }> } {
  return JSON.parse(readFileSync(INSIGHTS_PATH, 'utf-8'));
}

function writeLog(entries: Array<{ ts: number; path: string; repo: string }>): void {
  const content = entries.map(e => `${e.ts}:${e.path}:${e.repo}`).join('\n') + '\n';
  writeFileSync(EDITED_LOG, content);
}

function writeRepos(repos: string[]): void {
  writeFileSync(REPOS_FILE, repos.join('\n') + '\n');
}

describe('continuous-learning', () => {
  beforeEach(() => {
    mkdirSync(CACHE_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(CACHE_DIR)) {
      rmSync(CACHE_DIR, { recursive: true, force: true });
    }
  });

  it('should detect new file creation (Write tool, no prior log entries)', () => {
    // Empty log — file has no prior edits
    writeLog([]);

    runHook({
      session_id: TEST_SESSION,
      tool_name: 'Write',
      tool_input: {
        file_path: join(PROJECT_DIR, 'api/src/routes/new-route.ts'),
        content: 'export const foo = 1;\n',
      },
    });

    expect(existsSync(INSIGHTS_PATH)).toBe(true);
    const insights = readInsights();
    expect(insights.insights).toHaveLength(1);
    expect(insights.insights[0].type).toBe('new_file');
    expect(insights.insights[0].file_path).toContain('new-route.ts');
  });

  it('should detect high iteration (file edited 3+ times)', () => {
    const filePath = join(PROJECT_DIR, 'api/src/services/video.service.ts');
    writeLog([
      { ts: 1000, path: filePath, repo: 'api' },
      { ts: 1001, path: filePath, repo: 'api' },
      { ts: 1002, path: filePath, repo: 'api' },
    ]);

    runHook({
      session_id: TEST_SESSION,
      tool_name: 'Edit',
      tool_input: {
        file_path: filePath,
        new_string: 'const x = 1;',
      },
    });

    const insights = readInsights();
    const highIter = insights.insights.find(i => i.type === 'high_iteration');
    expect(highIter).toBeDefined();
    expect(highIter!.metadata.editCount).toBe(3);
  });

  it('should detect large edits (50+ lines)', () => {
    writeLog([]);
    const bigContent = Array(60).fill('const line = "content";').join('\n');

    runHook({
      session_id: TEST_SESSION,
      tool_name: 'Write',
      tool_input: {
        file_path: join(PROJECT_DIR, 'api/src/routes/big-file.ts'),
        content: bigContent,
      },
    });

    const insights = readInsights();
    const large = insights.insights.find(i => i.type === 'large_edit');
    expect(large).toBeDefined();
    expect((large!.metadata.lineCount as number)).toBeGreaterThanOrEqual(50);
  });

  it('should detect cross-service work (2+ repos)', () => {
    writeLog([]);
    writeRepos(['api', 'apps/web']);

    runHook({
      session_id: TEST_SESSION,
      tool_name: 'Edit',
      tool_input: {
        file_path: join(PROJECT_DIR, 'api/src/routes/foo.ts'),
        new_string: 'const x = 1;',
      },
    });

    const insights = readInsights();
    const cross = insights.insights.find(i => i.type === 'cross_service');
    expect(cross).toBeDefined();
    expect(cross!.metadata.repos).toEqual(['api', 'apps/web']);
  });

  it('should deduplicate: one high_iteration per file', () => {
    const filePath = join(PROJECT_DIR, 'api/src/services/video.service.ts');
    writeLog([
      { ts: 1000, path: filePath, repo: 'api' },
      { ts: 1001, path: filePath, repo: 'api' },
      { ts: 1002, path: filePath, repo: 'api' },
      { ts: 1003, path: filePath, repo: 'api' },
      { ts: 1004, path: filePath, repo: 'api' },
    ]);

    // Run twice
    runHook({
      session_id: TEST_SESSION,
      tool_name: 'Edit',
      tool_input: { file_path: filePath, new_string: 'a' },
    });
    runHook({
      session_id: TEST_SESSION,
      tool_name: 'Edit',
      tool_input: { file_path: filePath, new_string: 'b' },
    });

    const insights = readInsights();
    const highIters = insights.insights.filter(i => i.type === 'high_iteration' && i.file_path === filePath);
    expect(highIters).toHaveLength(1);
  });

  it('should handle missing edited-files.log gracefully', () => {
    // Don't create the log file
    const result = runHook({
      session_id: TEST_SESSION,
      tool_name: 'Edit',
      tool_input: {
        file_path: join(PROJECT_DIR, 'api/src/routes/foo.ts'),
        new_string: 'const x = 1;',
      },
    });

    expect(result.exitCode).toBe(0);
  });

  it('should handle corrupt insights.json gracefully', () => {
    writeLog([]);
    writeFileSync(INSIGHTS_PATH, '{invalid json!!!');

    const result = runHook({
      session_id: TEST_SESSION,
      tool_name: 'Write',
      tool_input: {
        file_path: join(PROJECT_DIR, 'api/src/routes/fresh.ts'),
        content: 'export const x = 1;\n',
      },
    });

    expect(result.exitCode).toBe(0);
    // Should have overwritten with fresh state
    const insights = readInsights();
    expect(insights.session_id).toBe(TEST_SESSION);
  });

  it('should produce no stdout output (silent)', () => {
    writeLog([]);

    const result = runHook({
      session_id: TEST_SESSION,
      tool_name: 'Write',
      tool_input: {
        file_path: join(PROJECT_DIR, 'api/src/routes/silent.ts'),
        content: 'export const x = 1;\n',
      },
    });

    expect(result.stdout).toBe('');
  });
});
