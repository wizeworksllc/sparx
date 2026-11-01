// Where this repository and the platform's source are, for the checks that hold
// sparx's apps to the platform: the platform's cross-console checks read the
// workbench beside its own code, and they were written when both lived in one
// repository. That source lives in wizeworksllc/platform; sparx's apps left that
// repository in docs/153 Phase 5.
//
// Found, in order: $PLATFORM_DIR; then the directory this repository sits in,
// when that is a platform checkout (CI checks this repository out INSIDE the
// platform, at platform/sparx); then a checkout beside this repository named
// `sparx.works` or `platform`. GitHub Actions checks the platform out and sets
// PLATFORM_DIR, so there a missing checkout FAILS. A local run without one
// skips the comparison and says so, rather than passing as though it had
// compared anything.
//
// The console's tests find the platform the same way, in
// apps/workbench/test/platform-source.ts. Keep the two in step.

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** This repository's root. */
export const SPARX = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A platform checkout is one that has its packages where the checks expect them. */
function isPlatform(dir) {
  return existsSync(join(dir, 'wizeworks', 'packages'));
}

function findPlatform() {
  const named = process.env.PLATFORM_DIR;
  if (named) {
    const dir = resolve(named);
    if (!isPlatform(dir)) {
      console.error(`✗ PLATFORM_DIR is ${dir}, which has no wizeworks/packages.`);
      process.exit(1);
    }
    return dir;
  }
  if (isPlatform(dirname(SPARX))) return dirname(SPARX);
  for (const name of ['sparx.works', 'platform']) {
    const dir = join(dirname(SPARX), name);
    if (isPlatform(dir)) return dir;
  }
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.error(
      '✗ CI has no platform checkout. Check out wizeworksllc/platform and set PLATFORM_DIR.'
    );
    process.exit(1);
  }
  return null;
}

/** The platform root, or null on a local run with no checkout beside this one. */
export const PLATFORM = findPlatform();

/**
 * The platform root for a check that cannot run without it. Locally, with no
 * checkout, it prints that the check was skipped and exits 0; in CI
 * `findPlatform` has already failed.
 */
export function requirePlatform(check) {
  if (PLATFORM !== null) return PLATFORM;
  console.warn(
    `${check} skipped: no wizeworksllc/platform checkout beside this repository and no ` +
      'PLATFORM_DIR. CI runs it against a fresh checkout.'
  );
  process.exit(0);
}
