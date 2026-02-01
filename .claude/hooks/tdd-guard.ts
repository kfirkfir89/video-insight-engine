#!/usr/bin/env npx tsx
/**
 * TDD Guard Hook - PreToolUse
 *
 * Blocks Edit/Write on source files if no corresponding test has been modified
 * in the current session. Enforces test-first development.
 *
 * Based on patterns from:
 * - ultimate-claude-infrastructure (cc10x TDD Guard)
 * - obra/superpowers (TDD Iron Law)
 *
 * States:
 * 🔴 RED:    Write failing test first
 * 🟢 GREEN:  Minimal code to pass
 * 🔵 REFACTOR: Clean up (tests still green)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';

interface PreToolInput {
  session_id: string;
  tool_name: string;
  tool_input: {
    file_path?: string;
    command?: string;
  };
}

interface TddState {
  session: string;
  testFilesModified: string[];
  sourceFilesAllowed: string[]; // Source files that have corresponding tests modified
  bypassUntil?: number; // Timestamp for temporary bypass
}

// Source file patterns (require test first)
const SOURCE_PATTERNS = [
  /\.ts$/,
  /\.tsx$/,
  /\.py$/,
];

// Exclude patterns (always allowed without test)
const EXCLUDE_PATTERNS = [
  /\.test\.(ts|tsx|py)$/,    // Test files
  /\.spec\.(ts|tsx|py)$/,    // Spec files
  /\/__tests__\//,           // Test directories
  /\/tests?\//,              // Test directories
  /\.d\.ts$/,                // Type definitions
  /\.md$/,                   // Markdown
  /\.json$/,                 // Config
  /\.yaml$/,                 // Config
  /\.yml$/,                  // Config
  /\.env/,                   // Environment
  /\.sh$/,                   // Shell scripts
  /\.css$/,                  // Styles
  /\.scss$/,                 // Styles
  /\.html$/,                 // HTML
  /vite\.config/,            // Vite config
  /tsconfig/,                // TypeScript config
  /eslint/,                  // ESLint config
  /prettier/,                // Prettier config
  /tailwind/,                // Tailwind config
  /postcss/,                 // PostCSS config
  /package\.json$/,          // Package config
  /package-lock\.json$/,     // Package lock
  /pnpm-lock\.yaml$/,        // PNPM lock
  /\.claude\//,              // Claude infrastructure
  /dev\//,                   // Dev docs
  /docs\//,                  // Documentation
  /scripts\//,               // Utility scripts
  /migrations\//,            // Database migrations
  /seeds?\//,                // Database seeds
  /fixtures?\//,             // Test fixtures
  /mocks?\//,                // Mock files
  /__mocks__\//,             // Jest mocks
  /types\.ts$/,              // Type-only files
  /index\.ts$/,              // Re-export files (often just exports)
  /constants\.ts$/,          // Constants
  /config\.ts$/,             // Config
];

function isSourceFile(path: string): boolean {
  // Check excludes first
  if (EXCLUDE_PATTERNS.some(p => p.test(path))) {
    return false;
  }
  // Then check if it matches source patterns
  return SOURCE_PATTERNS.some(p => p.test(path));
}

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx|py)$/.test(path) ||
         path.includes('__tests__/') ||
         path.includes('/tests/');
}

/**
 * Get possible test file paths for a source file
 * Handles multiple conventions:
 * - foo.ts → foo.test.ts
 * - src/routes/foo.ts → src/routes/foo.test.ts
 * - src/routes/foo.ts → src/routes/__tests__/foo.test.ts
 * - src/routes/foo.ts → tests/routes/foo.test.ts
 */
function getPossibleTestPaths(sourcePath: string): string[] {
  const ext = sourcePath.match(/\.(ts|tsx|py)$/)?.[1] || 'ts';
  const base = basename(sourcePath).replace(/\.(ts|tsx|py)$/, '');
  const dir = dirname(sourcePath);

  return [
    // Same directory: foo.test.ts
    join(dir, `${base}.test.${ext}`),
    join(dir, `${base}.spec.${ext}`),
    // __tests__ subdirectory
    join(dir, '__tests__', `${base}.test.${ext}`),
    join(dir, '__tests__', `${base}.spec.${ext}`),
    // tests/ at project root (mirror structure)
    sourcePath.replace(/^(api|apps\/web|services\/\w+)\/src\//, '$1/tests/'),
  ];
}

/**
 * Check if any test file related to the source has been modified
 */
function hasRelatedTestModified(sourcePath: string, testFilesModified: string[]): boolean {
  const sourceBase = basename(sourcePath).replace(/\.(ts|tsx|py)$/, '');

  return testFilesModified.some(testPath => {
    const testBase = basename(testPath)
      .replace(/\.(test|spec)\.(ts|tsx|py)$/, '')
      .replace(/\.test$/, '')
      .replace(/\.spec$/, '');

    // Direct match: videos.ts ↔ videos.test.ts
    if (testBase === sourceBase) {
      return true;
    }

    // Partial match for related tests: videos.ts ↔ videos-routes.test.ts
    if (testBase.includes(sourceBase) || sourceBase.includes(testBase)) {
      return true;
    }

    return false;
  });
}

function loadState(statePath: string, sessionId: string): TddState {
  const defaultState: TddState = {
    session: sessionId,
    testFilesModified: [],
    sourceFilesAllowed: [],
  };

  try {
    if (existsSync(statePath)) {
      const saved = JSON.parse(readFileSync(statePath, 'utf-8'));
      // Reset state for new session
      if (saved.session !== sessionId) {
        return defaultState;
      }
      return { ...defaultState, ...saved };
    }
  } catch {
    // Ignore parse errors, start fresh
  }

  return defaultState;
}

function saveState(statePath: string, state: TddState): void {
  const dir = dirname(statePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

async function main() {
  let input: string;
  try {
    input = readFileSync(0, 'utf-8');
  } catch {
    // No input, allow
    console.log(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  }

  let data: PreToolInput;
  try {
    data = JSON.parse(input);
  } catch {
    // Invalid JSON, allow
    console.log(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const statePath = join(projectDir, '.claude', 'tdd-state.json');
  const filePath = data.tool_input.file_path;

  // No file path (e.g., Bash command), allow
  if (!filePath) {
    console.log(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  }

  // Load state
  const state = loadState(statePath, data.session_id);

  // Check for temporary bypass
  if (state.bypassUntil && Date.now() < state.bypassUntil) {
    console.log(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  }

  // If editing a test file, track it and allow
  if (isTestFile(filePath)) {
    if (!state.testFilesModified.includes(filePath)) {
      state.testFilesModified.push(filePath);
      saveState(statePath, state);
    }
    console.log(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  }

  // If editing a source file, check for related test
  if (isSourceFile(filePath)) {
    // Check if already allowed (test was modified for this source)
    if (state.sourceFilesAllowed.includes(filePath)) {
      console.log(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
    }

    // Check if any related test has been modified
    if (hasRelatedTestModified(filePath, state.testFilesModified)) {
      // Track as allowed
      state.sourceFilesAllowed.push(filePath);
      saveState(statePath, state);
      console.log(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
    }

    // No test modified - block with helpful message
    const possibleTests = getPossibleTestPaths(filePath);
    const message = `🔴 TDD GUARD: Write a failing test first!

Source file: ${filePath}

Expected test locations:
${possibleTests.slice(0, 3).map(p => `  - ${p}`).join('\n')}

TDD Cycle:
1. 🔴 RED: Write a failing test
2. 🟢 GREEN: Write minimal code to pass
3. 🔵 REFACTOR: Clean up (tests still green)

To bypass temporarily (not recommended):
- Edit the test file first, then edit source
- Or add a comment explaining why TDD doesn't apply`;

    console.log(JSON.stringify({
      decision: 'block',
      reason: message,
    }));
    process.exit(0);
  }

  // Not a source file we care about, allow
  console.log(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
}

main().catch((err) => {
  console.error('TDD Guard error:', err);
  // On error, allow to not block workflow
  console.log(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
});
