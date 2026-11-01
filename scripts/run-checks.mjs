// Every structural check this repository owns, in one run. CI and the pre-push
// hook both call this, so the list lives in one place and a check added here is
// enforced in both.
//
// Each check is its own script and stays runnable alone (`pnpm check:<name>`).
// This runs them all, even after one fails, so a push reports every problem at
// once instead of one per attempt.
//
// The checks that need the platform beside this repository find it through
// scripts/lib/platform-dir.mjs. Locally, with no platform checkout, they say
// they were skipped; in CI a missing checkout fails them.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { SPARX } from './lib/platform-dir.mjs';

const CHECKS = ['check-k8s', 'check-transpile-packages'];

const quiet = process.argv.includes('--quiet');
const failed = [];

for (const name of CHECKS) {
  const run = spawnSync(process.execPath, [join(SPARX, 'scripts', `${name}.mjs`)], {
    cwd: SPARX,
    encoding: 'utf8',
  });
  if (run.status === 0) {
    if (!quiet) process.stdout.write(run.stdout);
    continue;
  }
  failed.push(name);
  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr);
}

if (failed.length > 0) {
  console.error(`\n✗ ${String(failed.length)} of ${String(CHECKS.length)} check(s) failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`✓ all ${String(CHECKS.length)} checks pass`);
