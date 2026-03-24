#!/usr/bin/env npx tsx
/**
 * Continuous Learning Hook — PostToolUse (Edit|MultiEdit|Write)
 *
 * Silently accumulates session insights from tool use patterns.
 * Writes to insights.json in the session cache — no stdout output.
 * Runs AFTER post-tool-use-tracker and auto-format.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';

interface PostToolInput {
  session_id: string;
  tool_name: string;
  tool_input: {
    file_path?: string;
    content?: string;       // Write tool
    new_string?: string;    // Edit tool
  };
}

interface Insight {
  type: 'new_file' | 'high_iteration' | 'test_pairing' | 'large_edit' | 'cross_service';
  timestamp: string;
  file_path: string;
  repo: string;
  metadata: Record<string, unknown>;
}

interface InsightsState {
  session_id: string;
  started_at: string;
  insights: Insight[];
}

const HIGH_ITERATION_THRESHOLD = 3;
const LARGE_EDIT_LINE_THRESHOLD = 50;

function countLines(text: string): number {
  if (!text) return 0;
  return text.split('\n').length;
}

function extractRepo(filePath: string, projectDir: string): string {
  const relative = filePath.replace(projectDir + '/', '').replace(projectDir, '');
  const first = relative.split('/')[0];
  if (first === 'packages' || first === 'apps') {
    const second = relative.split('/')[1];
    return second ? `${first}/${second}` : first;
  }
  return first || 'root';
}

function loadInsights(insightsPath: string, sessionId: string): InsightsState {
  const fresh: InsightsState = {
    session_id: sessionId,
    started_at: new Date().toISOString(),
    insights: [],
  };

  try {
    if (existsSync(insightsPath)) {
      const parsed = JSON.parse(readFileSync(insightsPath, 'utf-8'));
      if (parsed.session_id === sessionId) {
        return { ...fresh, ...parsed };
      }
    }
  } catch {
    // Corrupt file — start fresh
  }

  return fresh;
}

function saveInsights(insightsPath: string, state: InsightsState): void {
  const dir = dirname(insightsPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(insightsPath, JSON.stringify(state, null, 2));
}

function parseEditedFilesLog(logPath: string): Array<{ timestamp: number; filePath: string; repo: string }> {
  if (!existsSync(logPath)) return [];

  try {
    const content = readFileSync(logPath, 'utf-8');
    return content
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [ts, fp, r] = line.split(':').length >= 3
          ? [line.split(':')[0], line.split(':').slice(1, -1).join(':'), line.split(':').slice(-1)[0]]
          : [line.split(':')[0], line.split(':')[1] || '', line.split(':')[2] || ''];
        return { timestamp: parseInt(ts, 10), filePath: fp, repo: r };
      });
  } catch {
    return [];
  }
}

function getAffectedRepos(reposPath: string): string[] {
  if (!existsSync(reposPath)) return [];
  try {
    return readFileSync(reposPath, 'utf-8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function hasInsight(state: InsightsState, type: string, filePath?: string): boolean {
  return state.insights.some(i =>
    i.type === type && (filePath ? i.file_path === filePath : true)
  );
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
    data = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  // Only process edit tools
  if (!['Edit', 'MultiEdit', 'Write'].includes(data.tool_name)) {
    process.exit(0);
  }

  const filePath = data.tool_input.file_path;
  if (!filePath) {
    process.exit(0);
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const cacheDir = join(projectDir, '.claude', 'tsc-cache', data.session_id);
  const insightsPath = join(cacheDir, 'insights.json');
  const editedFilesLog = join(cacheDir, 'edited-files.log');
  const affectedReposPath = join(cacheDir, 'affected-repos.txt');

  const state = loadInsights(insightsPath, data.session_id);
  const repo = extractRepo(filePath, projectDir);
  const now = new Date().toISOString();
  let changed = false;

  // 1. New file detection (Write tool only)
  if (data.tool_name === 'Write') {
    const logEntries = parseEditedFilesLog(editedFilesLog);
    const priorEdits = logEntries.filter(e => e.filePath === filePath);
    // If no prior edits in log, this is a new file
    if (priorEdits.length === 0 && !hasInsight(state, 'new_file', filePath)) {
      state.insights.push({
        type: 'new_file',
        timestamp: now,
        file_path: filePath,
        repo,
        metadata: { extension: extname(filePath) },
      });
      changed = true;
    }
  }

  // 2. High iteration detection
  const logEntries = parseEditedFilesLog(editedFilesLog);
  const fileEditCount = logEntries.filter(e => e.filePath === filePath).length;
  if (fileEditCount >= HIGH_ITERATION_THRESHOLD && !hasInsight(state, 'high_iteration', filePath)) {
    state.insights.push({
      type: 'high_iteration',
      timestamp: now,
      file_path: filePath,
      repo,
      metadata: { editCount: fileEditCount },
    });
    changed = true;
  }

  // 3. Test pairing detection
  const isTest = /\.(test|spec)\.(ts|tsx|py)$/.test(filePath) || filePath.includes('__tests__/');
  if (isTest) {
    const sourceBase = filePath
      .replace(/\.(test|spec)\.(ts|tsx|py)$/, '')
      .replace(/__tests__\//, '');
    const hasMatchingSource = logEntries.some(e =>
      !e.filePath.includes('.test.') && !e.filePath.includes('.spec.') && e.filePath.includes(sourceBase)
    );
    if (hasMatchingSource && !hasInsight(state, 'test_pairing', filePath)) {
      state.insights.push({
        type: 'test_pairing',
        timestamp: now,
        file_path: filePath,
        repo,
        metadata: { sourcePattern: sourceBase },
      });
      changed = true;
    }
  }

  // 4. Large edit detection
  const editContent = data.tool_input.content || data.tool_input.new_string || '';
  if (countLines(editContent) >= LARGE_EDIT_LINE_THRESHOLD && !hasInsight(state, 'large_edit', filePath)) {
    state.insights.push({
      type: 'large_edit',
      timestamp: now,
      file_path: filePath,
      repo,
      metadata: { lineCount: countLines(editContent) },
    });
    changed = true;
  }

  // 5. Cross-service detection
  const repos = getAffectedRepos(affectedReposPath);
  if (repos.length >= 2 && !hasInsight(state, 'cross_service')) {
    state.insights.push({
      type: 'cross_service',
      timestamp: now,
      file_path: filePath,
      repo,
      metadata: { repos },
    });
    changed = true;
  }

  if (changed) {
    saveInsights(insightsPath, state);
  }

  // Silent — no stdout output
  process.exit(0);
}

main().catch(() => {
  process.exit(0);
});
