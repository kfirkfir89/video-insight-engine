#!/usr/bin/env node
/**
 * CI guard: fail when a vitest run skipped more tests than the allowed budget.
 *
 * Why: the api suite has ~9 legitimately-skipped tests, but when its backing
 * services are missing (redis/mongo binaries, docker deps) 200+ tests skip
 * SILENTLY and the suite still exits green. This guard makes that failure
 * mode loud instead of invisible.
 *
 * Usage: node ci-vitest-skip-guard.mjs <vitest-json-report> [maxSkipped]
 *   <vitest-json-report>  produced via: vitest run --reporter=json --outputFile=<file>
 *   [maxSkipped]          skip budget (default 15; env VITEST_MAX_SKIPPED overrides)
 */

import { readFileSync } from 'node:fs';

const [reportPath, maxArg] = process.argv.slice(2);
if (!reportPath) {
  console.error('usage: ci-vitest-skip-guard.mjs <vitest-json-report> [maxSkipped]');
  process.exit(2);
}

const maxSkipped = Number(maxArg ?? process.env.VITEST_MAX_SKIPPED ?? 15);
if (!Number.isFinite(maxSkipped) || maxSkipped < 0) {
  console.error(`ci-vitest-skip-guard: invalid skip budget "${maxArg}"`);
  process.exit(2);
}

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (err) {
  console.error(`ci-vitest-skip-guard: cannot read ${reportPath}: ${err.message}`);
  process.exit(2);
}

// Vitest's json reporter is jest-shaped: skipped tests are counted in
// numPendingTests, `.todo` tests in numTodoTests. Count per-assertion
// statuses too and take the max, so a reporter-shape change can only make
// the guard stricter, never silently lenient.
const pending = (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0);
const perAssertion = (report.testResults ?? [])
  .flatMap((file) => file.assertionResults ?? [])
  .filter((t) => ['skipped', 'pending', 'todo', 'disabled'].includes(t.status)).length;
const skipped = Math.max(pending, perAssertion);
const total = report.numTotalTests ?? 0;

console.log(`ci-vitest-skip-guard: ${skipped} skipped / ${total} total (budget ${maxSkipped})`);

if (total === 0) {
  console.error('ci-vitest-skip-guard: report contains zero tests — refusing to pass.');
  process.exit(1);
}

if (skipped > maxSkipped) {
  console.error(
    `ci-vitest-skip-guard: ${skipped} tests skipped exceeds budget of ${maxSkipped}.\n` +
      'This usually means a backing service (mongo/redis) was unavailable and ' +
      'suites bailed out silently. Fix the environment or, for genuinely new ' +
      'intentional skips, raise the budget in .github/workflows/ci.yml.'
  );
  process.exit(1);
}
