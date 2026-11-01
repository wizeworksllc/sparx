// The platform's checks over sparx's apps, run here against this repository.
//
// ── WHY THESE LIVE IN THE PLATFORM AND RUN FROM HERE ───────────────────────
//
// sparx's apps lived in the platform repository until docs/153 Phase 5, at
// sparx/apps and sparx/packages. The platform guards their shape with checks
// that read them beside its own code (console parity, the brand check, every
// layout and copy guard that lists `sparx/apps/workbench`). Each one joins
// `sparx/...` onto the platform root.
//
// So CI rebuilds that layout instead of forking forty-odd scripts: it checks
// the platform out, removes the platform's own sparx/ tree, checks this
// repository out at `sparx/` INSIDE it, and runs the platform's scripts
// unchanged. This repository's tree is exactly that old sparx/ subtree (apps/,
// packages/, docs/), so every path those checks join still lands on a file.
//
//   PLATFORM_DIR=<platform checkout with this repository at sparx/> \
//     node scripts/platform-checks.mjs
//
// ── WHAT IS NOT IN THE LIST ────────────────────────────────────────────────
//
// The platform's checks about its own repository: which packages publish, the
// Dockerfile paths and dependencies (relative to the platform's root, and this
// repository's Dockerfiles install the platform as packages), the
// server-action key wiring of the platform's release, the database (migrations,
// seeds, Prisma selects), the event and worker topology, the service
// environment and the Kubernetes overlays. Those either do not apply to a
// repository that installs the platform as packages, or are proved here by
// other means (the image build proves the Dockerfiles; check-k8s holds the
// manifests).
//
// A NEW check in the platform that reads sparx/ is not picked up by itself.
// Add its name below, or it guards only the platform's own code.

import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { SPARX } from './lib/platform-dir.mjs';

const CHECKS = [
  'check-action-labels',
  'check-american-spelling',
  'check-api-hrefs',
  'check-app-data-access',
  'check-app-names',
  'check-automation-health',
  'check-billing-plans',
  'check-boundaries',
  'check-brand-wordmark',
  'check-cancelled-in-sql',
  'check-cms-routes',
  'check-color-names',
  'check-column-floor',
  'check-console-parity',
  'check-count-ink',
  'check-counted-in-words',
  'check-counts-before-known',
  'check-country-picker',
  'check-currency-picker',
  'check-date-conversions',
  'check-day-boxes',
  'check-destructive-confirm',
  'check-em-dash',
  'check-exposed-headers',
  'check-field-names',
  'check-host-cores',
  'check-load-error-reason',
  'check-load-failure-words',
  'check-module-graph',
  'check-open-targets',
  'check-orphan-surfaces',
  'check-pane-breakpoints',
  'check-pane-load',
  'check-platform-brand',
  'check-price-offers',
  'check-running-meta',
  'check-saved-view-targets',
  'check-scroll-squash',
  'check-select-name-width',
  'check-sellable-terms',
  'check-shadowed-relations',
  'check-silica-color-utilities',
  'check-surface-routes',
  'check-table-stack',
  'check-toolbar-glyph',
  'check-toolbar-primary',
  'check-wrap-rows',
];

const named = process.env.PLATFORM_DIR;
if (!named) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.error(
      '✗ platform-checks: PLATFORM_DIR is not set. CI must check the platform repository out and set it.'
    );
    process.exit(1);
  }
  console.warn(
    'platform-checks skipped: they need a platform checkout with this repository at sparx/ ' +
      'inside it, named by PLATFORM_DIR. CI builds that layout on every pull request.'
  );
  process.exit(0);
}

const PLATFORM = resolve(named);

// The layout is the whole point: checks that scan `sparx/...` under the
// platform's root must be scanning THIS repository, not the platform's own copy.
const inside = join(PLATFORM, 'sparx');
if (!existsSync(inside) || realpathSync(inside) !== realpathSync(SPARX)) {
  console.error(
    `✗ platform-checks: ${inside} is not this repository (${SPARX}). Check this ` +
      'repository out at sparx/ inside the platform checkout, or the checks read the wrong apps.'
  );
  process.exit(1);
}

const failed = [];
for (const name of CHECKS) {
  const script = join(PLATFORM, 'scripts', `${name}.mjs`);
  if (!existsSync(script)) {
    // Renamed or deleted in the platform. Fail by name: skipping it would guard nothing in silence.
    failed.push(`${name} (missing from the platform)`);
    continue;
  }
  const run = spawnSync(process.execPath, [script], { cwd: PLATFORM, encoding: 'utf8' });
  if (run.status === 0) continue;
  failed.push(name);
  console.error(`\n── ${name} ──`);
  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr);
}

if (failed.length > 0) {
  console.error(
    `\n✗ ${String(failed.length)} of ${String(CHECKS.length)} platform check(s) failed: ${failed.join(', ')}`
  );
  process.exit(1);
}
console.log(`✓ all ${String(CHECKS.length)} platform checks pass against this repository`);
