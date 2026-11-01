#!/usr/bin/env node
// THE RULES THE RENDERED MANIFESTS MUST KEEP.
//
// Renders k8s/ with `kubectl kustomize` (client side only, nothing is sent to a
// cluster) and checks each rule against the object it is about. Needs kubectl
// on PATH, as every CI runner has.
//
// It renders TWICE. Once as shipped, which is what the release applies. And
// once with every file under k8s/apps/ listed, because the app manifests are
// written before they are listed (kustomization.yaml, "THE MOVE OUT OF
// sparx-prod"): a manifest nobody renders is one that can be broken for weeks
// and fail only on the day it is switched on.
//
//   - Every Deployment's image is in the kustomization's `images:` list, or the
//     release's `kustomize edit set image` never pins it and `:latest` ships.
//   - Every probe waits at least 5s. The 1s default SIGKILLed the workbench on
//     a slow render on 2026-07-22, and it rolled a healthy pod.
//   - Each app requests at least the memory it was measured at in sparx-prod.
//     A request below what a pod uses makes it the kubelet's first eviction
//     (the 2026-08-08 outage, in the platform's Azure overlay).

import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SPARX } from './lib/platform-dir.mjs';

const K8S = join(SPARX, 'k8s');

/** Measured resident size in sparx-prod, in Mi. The request must cover it. */
const MEASURED_MI = {
  'sparx-web': 419,
  'sparx-market': 88,
  'sparx-workbench': 232,
};

function render(dir) {
  return execFileSync('kubectl', ['kustomize', dir], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Every rendered document of a kind. */
function docsOf(rendered, kind) {
  return rendered.split(/^---$/m).filter((d) => new RegExp(`^kind: ${kind}$`, 'm').test(d));
}

function nameOf(doc) {
  return /^ {2}name: (\S+)$/m.exec(doc)?.[1] ?? '?';
}

/** Memory request of a Deployment's first container, in Mi (0 when absent). */
function memoryRequestMi(doc) {
  const m = /requests:\n(?:\s+cpu: \S+\n)?\s+memory: "?(\d+)(Mi|Gi)"?/.exec(doc);
  if (!m) return 0;
  return m[2] === 'Gi' ? Number(m[1]) * 1024 : Number(m[1]);
}

const problems = [];

// 1. As shipped.
let shipped = '';
try {
  shipped = render(K8S);
} catch (err) {
  problems.push(`k8s/ does not render: ${String(err.message).split('\n')[0]}`);
}
if (shipped && docsOf(shipped, 'Namespace').length !== 1) {
  problems.push('the shipped render has no Namespace');
}

// 2. With every app listed, from a copy, so the real kustomization is untouched.
const apps = readdirSync(join(K8S, 'apps')).filter((f) => f.endsWith('.yaml'));
const scratch = mkdtempSync(join(tmpdir(), 'sparx-k8s-'));
let full = '';
try {
  cpSync(K8S, scratch, { recursive: true });
  const kustomization = join(scratch, 'kustomization.yaml');
  const listed = readFileSync(kustomization, 'utf8').replace(
    /^ {2}- namespace\.yaml$/m,
    ['  - namespace.yaml', ...apps.map((f) => `  - apps/${f}`)].join('\n')
  );
  writeFileSync(kustomization, listed);
  full = render(scratch);
} catch (err) {
  problems.push(`k8s/ with every app listed does not render: ${String(err.message).split('\n')[0]}`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

const pinned = new Set(
  [...readFileSync(join(K8S, 'kustomization.yaml'), 'utf8').matchAll(/^ {2}- name: (\S+)$/gm)].map(
    (m) => m[1]
  )
);

const deployments = full ? docsOf(full, 'Deployment') : [];
if (full && deployments.length !== apps.length) {
  problems.push(`${String(apps.length)} app files rendered ${String(deployments.length)} Deployments`);
}
for (const doc of deployments) {
  const name = nameOf(doc);
  const image = /image: ([^:\s]+)(?::\S+)?$/m.exec(doc)?.[1];
  if (!image || !pinned.has(image)) {
    problems.push(`${name}: image ${String(image)} is not in kustomization.yaml's images list`);
  }
  for (const m of doc.matchAll(/timeoutSeconds: (\d+)/g)) {
    if (Number(m[1]) < 5) problems.push(`${name}: a probe times out in ${m[1]}s (at least 5)`);
  }
  if ((doc.match(/timeoutSeconds:/g) ?? []).length < 2) {
    problems.push(`${name}: both probes need an explicit timeoutSeconds (the default is 1s)`);
  }
  const floor = MEASURED_MI[name];
  if (floor === undefined) {
    problems.push(`${name}: no measured memory in check-k8s.mjs; measure it and add it`);
  } else if (memoryRequestMi(doc) < floor) {
    problems.push(`${name}: requests ${String(memoryRequestMi(doc))}Mi, below the ${String(floor)}Mi it uses`);
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(`✗ k8s: ${p}`);
  process.exit(1);
}
console.log(
  `✓ k8s: the shipped render holds, and all ${String(deployments.length)} app manifests render and keep the rules`
);
