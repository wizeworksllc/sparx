#!/usr/bin/env node
// EVERY PLATFORM PACKAGE AN APP INSTALLS IS ONE IT COMPILES.
//
// The @wizeworksllc/* packages publish as TypeScript source, and Next.js
// compiles a package inside node_modules only when the app's next.config.mjs
// lists it in `transpilePackages`. A package left off the list does not fail
// install, lint, typecheck or the tests. It fails `next build`, inside the image
// build, with "Unknown module type" on the package's src/index.ts.
//
// That is how Piggles' first release failed when its apps left the platform:
// they were copied out before the platform listed the whole closure (platform
// PR #160), and nothing noticed until all three images broke. This repository
// left after that fix, and this check keeps the list whole from here on.
//
// ── WHAT COUNTS ─────────────────────────────────────────────────────────────
//
// The CLOSURE, not only the direct dependencies. A package an app installs can
// depend on another platform package, and Next.js compiles that one from source
// too. So this walks each installed @wizeworksllc/* package's own dependencies
// and peer dependencies, through node_modules, and requires every one it finds.
//
// A package that cannot be found in node_modules fails by name: a walk that
// skips it in silence would pass while checking nothing.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

import { SPARX } from './lib/platform-dir.mjs';

const SCOPE = '@wizeworksllc/';
const APPS = ['web', 'market', 'workbench'];

const problems = [];

function closureOf(appDir) {
  const found = new Set();
  const walk = (dir) => {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })) {
      if (!dep.startsWith(SCOPE) || found.has(dep)) continue;
      found.add(dep);
      // pnpm links a package's own dependencies into the node_modules folder
      // that holds it in the store, so that folder is looked in after the
      // package's own node_modules.
      const own = join(dir, 'node_modules', dep);
      const at = dir.lastIndexOf('node_modules');
      const holder = at === -1 ? null : join(dir.slice(0, at + 'node_modules'.length), dep);
      const where = [own, holder].find((p) => p && existsSync(p));
      if (!where) {
        problems.push(`${dep} (needed from ${dir}) is not installed; run pnpm install`);
        continue;
      }
      walk(realpathSync(where));
    }
  };
  walk(appDir);
  return found;
}

for (const app of APPS) {
  const appDir = join(SPARX, 'apps', app);
  const config = readFileSync(join(appDir, 'next.config.mjs'), 'utf8');
  for (const dep of [...closureOf(appDir)].sort()) {
    if (!config.includes(`'${dep}'`)) {
      problems.push(`apps/${app}/next.config.mjs: transpilePackages does not list '${dep}'`);
    }
  }
}

if (problems.length > 0) {
  console.error(
    '✗ transpile-packages: every platform package an app installs must be compiled by it.'
  );
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `✓ transpile-packages: ${String(APPS.length)} apps list every platform package they install`
);
