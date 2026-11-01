// Where the platform's source is, for the few tests that hold this console to
// the server it talks to (the scan kinds api-rest accepts, the price order the
// commerce service charges by, the page sign-up links to). That source lives in
// wizeworksllc/platform; this repository left it in docs/153 Phase 5 and
// installs the platform as published packages, which carry only what a browser
// needs.
//
// Found, in order: $PLATFORM_DIR; then the directory this repository sits in,
// when that is a platform checkout (CI checks this repository out INSIDE the
// platform, at platform/sparx); then a checkout beside this repository named
// `sparx.works` or `platform`. GitHub Actions sets PLATFORM_DIR, so there a
// missing checkout FAILS. A local run without one skips these tests and says
// so, rather than passing as though it had compared anything.
//
// The structural checks find the platform the same way, in
// scripts/lib/platform-dir.mjs. Keep the two in step.

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** This repository's root, found rather than counted. */
export function repoRoot(from: string = import.meta.dirname): string {
  let dir = from;
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error(`No pnpm-workspace.yaml above ${from}. A test would scan nothing.`);
}

/** A platform checkout is one that has its packages where this expects them. */
function isPlatform(dir: string): boolean {
  return existsSync(join(dir, 'wizeworks', 'packages'));
}

function findPlatform(): string | null {
  const named = process.env.PLATFORM_DIR;
  if (named) {
    const dir = resolve(named);
    if (!isPlatform(dir)) {
      throw new Error(`PLATFORM_DIR is ${dir}, which has no wizeworks/packages.`);
    }
    return dir;
  }
  const parent = dirname(repoRoot());
  if (isPlatform(parent)) return parent;
  for (const name of ['sparx.works', 'platform']) {
    const dir = join(parent, name);
    if (isPlatform(dir)) return dir;
  }
  if (process.env.GITHUB_ACTIONS === 'true') {
    throw new Error(
      'CI has no platform checkout. Check the platform repository out and set PLATFORM_DIR.'
    );
  }
  return null;
}

/** The platform root, or null on a local run with no checkout beside this one. */
export const PLATFORM_ROOT = findPlatform();

if (PLATFORM_ROOT === null) {
  console.warn(
    'platform-source: no platform checkout beside this repository and no ' +
      'PLATFORM_DIR, so the tests that compare this console with the server are skipped.'
  );
}

/** A path inside the platform. Only call it where PLATFORM_ROOT is not null. */
export function platformPath(...parts: string[]): string {
  if (PLATFORM_ROOT === null) throw new Error('platformPath called with no platform checkout');
  return join(PLATFORM_ROOT, ...parts);
}
