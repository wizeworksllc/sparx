# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

sparx (sparx.works) is WizeWorks' modular content and commerce OS. **This repository holds its
apps**: the marketing site, the marketplace, the operator console, and the brand package they share.
The platform under them (the API, the MCP servers, the workers, the database, the shared packages)
lives in [wizeworksllc/platform](https://github.com/wizeworksllc/platform). These apps left it in
platform docs/153 Phase 5, with their history.

## RULE #0 — finish the whole surface; never explain a gap you could close

**The unit of work is the entire surface, not its hardest or most interesting part.** A site is
ALL of its pages; a module is every screen and state; a committed capability is its whole surface.
"Done" means every part is built to production quality — not a representative slice with the rest
left as the generic base, a stub, or a "later." Shipping the headline part and reporting done while
the boring parts are still stock is an **unfinished** deliverable that reads as finished, which is
worse than an obviously partial one because it hides the gap.

**Before you start:** enumerate the parts (list every page/screen/state). That list is the
definition of done. **Before you say done:** re-check the list — if any part is still stock/base/TODO,
it is not done, so keep going.

**Never substitute an explanation for the work.** If you know what needs doing and doing it is
available, DO IT — do not narrate why it isn't done, do not ask permission for the obvious
continuation, do not deliver a slice plus a note describing the gap. Explaining a gap costs more
than closing it. The reliable tell that you are about to under-deliver: you're writing a paragraph
about scope instead of building. Stop writing, start building.

This rule sits above the others because monochrome-minimum output satisfies every _prohibition_ at
once (RULE #4 makes the same point about color); completeness is the thing nothing else forces.

## RULE #1 — silicaui first, Tailwind second, everything else needs approval

**Build every UI on silicaui.** Reach for a `@wizeworks/silicaui-react` component and its
`color × variant × size × shape` props before anything else. **Tailwind utility classes are also
allowed** — layout, spacing, sizing, positioning, one-off chrome. That is the whole sanctioned
toolbox.

**Why this rule exists — the single point of change.** silicaui is the design system; feature code
**chooses**, it does not **paint**. Change `--color-primary` once and every button, badge, tab, link
and focus ring across workbench, web and market follows. Change `--radius-field` and every input
re-shapes. Add a hover treatment to `.btn` and the whole platform gets it — no hunting, no sweep, no
migration PR. **That propagation is the entire reason silicaui was built, and it holds only where
nothing downstream has painted over it.** Every local override is a place the change stops and a
place someone has to find later. The test on any UI you write: _if a token or a component changed
tomorrow, would this screen follow with zero edits here?_

**This is not "never improve" — it is "improve where it propagates."** When a silica default is
genuinely wrong: (1) check for a prop (`get_component` — there usually is one); (2) if it's a value,
change the token in `@sparx/brand/theme.css`; (3) if it's a missing variant or component, add it to
silicaui or a composition to `@wizeworksllc/ui`; (4) only then, with approval, a local exception documented
as debt. **A call-site patch is not a fix — it is a deferred fix everyone else pays interest on.**
Full contract + ownership table: [DESIGN.md](DESIGN.md).

**Anything that is not silicaui or Tailwind requires Brandon's explicit approval, asked for
up front — not shipped and explained afterwards.** That includes: a new dependency or component
library, a hand-rolled replacement for something silicaui already provides, a bespoke CSS file,
and any inline `style` that paints a control.

**If you are touching a file that does it the old way, migrate it** — don't match the surrounding
mistake. And never "re-skin" a silicaui component:

```tsx
// NEVER — an inline hex fill on a control. Stays black inside a dark themed
// island, ignores the token system, and is exactly what this rule exists to stop.
<Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>Start free</Button>

// ALWAYS — props resolve to the plugin's real classes: `btn btn-primary btn-lg`.
<Button color="primary" size="lg">Start free</Button>                // `neutral` would need approval (RULE #4)
<Button color="module-commerce" size="xl">Start selling</Button>   // module hues are registered colors
<Button variant="outline" size="lg">Talk to sales</Button>         // inside <Section surface="dark">, the
                                                                   // theme island resolves border + ink
```

Colors come from tokens, never hex: `--color-neutral`, `--color-primary`, `--color-module-<slug>`
(all registered with the plugin in each app's `globals.css`). A hardcoded hex cannot respond to
light/dark, so it is wrong even when it looks right on the screen you tested. There are exactly
**two** sanctioned literal-hex contexts, both because a token genuinely cannot express the value:

1. **Edge-runtime OG images** — Satori can't resolve CSS custom properties; those read `MODULE_HEX`
   from `@sparx/brand`.
2. **Other companies' brand marks** — Pinterest red, Facebook blue. They are not ours, mean nothing
   else, and have no light/dark variant to respond with. Confined to
   [apps/workbench/components/platform-mark.tsx](apps/workbench/components/platform-mark.tsx)
   (approved 2026-07-28); the glyph on them is fixed white, which is theme-independent by
   construction. Do not let this spread — a third-party logo is the only thing it covers.

Detail: [wizeworks/packages/ui/CLAUDE.md](https://github.com/wizeworksllc/platform/blob/main/wizeworks/packages/ui/CLAUDE.md), [docs/35-ui-variant-system.md](https://github.com/wizeworksllc/platform/blob/main/docs/35-ui-variant-system.md).

## RULE #2 — no eyebrows, no eyebrow badges, no editorial formatting

**Nothing sits above a heading to introduce it.** No kicker, no label, no category chip, no
`01 / 02 / 03` step marker, no uppercase-mono micro-caps — and **no `<Badge>` used as one either.**
Swapping an uppercase `<span>` for a `<Badge>` in the same slot is the same anti-pattern wearing a
component; the ban is on the _slot_, not the markup.

```tsx
// NEVER — all four are the same eyebrow.
<span className="font-mono text-xs uppercase tracking-wide">Confident</span><h3>…</h3>
<Badge color="success" variant="soft">Confident</Badge><h3>…</h3>
<span>01</span><h3>…</h3>
<p className="uppercase">How it works</p><h2>…</h2>

// ALWAYS — the heading carries itself; hierarchy comes from scale, weight, and color.
<h3>…</h3>
```

**No editorial formatting** either: no pull quotes, no drop caps, no rules/dividers used as
decoration, no magazine-style label columns. This is product marketing, not a magazine spread.
A `<Badge>` is for **state on a thing** (`<Badge color={statusTone(s)}>` on a row, a card, a
record) — never a decorative label introducing a section.

## RULE #3 — soft/muted/transparent is a deliberate signal, not a default

**Text:** never `soft`, `muted`, `/opacity`, or a `color-mix(… , transparent)` ink on anything a
person is meant to READ. Readable text gets a real ink token (`--color-base-content`, or the
surface's `-content`). Faded text is reserved for text deliberately not meant to be read —
decorative watermarks, disabled controls, a de-emphasized duplicate.

**This is not an instruction to write `text-base-content`.** On a component, that ink token is
already resolved for you from `color × variant` — reach for the component's `color` prop, never a
text-color utility on top of it (RULE #4). For bare prose it is inherited from `body`. If a silica
component genuinely renders readable text too faint at rest, that is a silica-level issue to raise,
**not** something to patch per call site — patching it is how `<TabsTab className="text-base-content">`
spread to 5+ workbench call sites.

**Backgrounds:** the same. `bg-soft` is **not** part of the primary theme — it is an accent applied
on purpose, to the ONE thing that earns it. Applying `soft` everywhere drains the exact power it
exists for and flattens the design system into mush. **If everything were meant to be soft, soft
would be the theme color.** It isn't.

Practical test before typing `soft`/`muted`/`/opacity`: _what is this de-emphasized relative to,
and is that contrast actually doing work on this screen?_ If the answer is "nothing in particular,
it just looked nicer," use the real token. Hierarchy comes from **scale, weight, and color** —
not from fading things out. Related: [DESIGN.md](DESIGN.md), and the
base font floor of 16px for body text.

## RULE #4 — `neutral` requires Brandon's approval, every time

**A screen where everything is the same color is a design failure**, with the same weight as a
gradient hero. Rules #1–#3 are prohibitions, and monochrome is the one output that satisfies every
prohibition at once — so grey is what gets built unless something requires otherwise. This rule
requires otherwise.

**`color="neutral"` is not yours to choose. Ask Brandon, get a yes, then use it — and never ship it
on the assumption that this instance is obviously fine.** A COLORLESS control — no `color` prop at
all — is a different thing and is fine without asking; it is the right control for a genuinely
untyped action. The rule is about naming `neutral`. This rule used to read "neutral has to be
earned" and listed what earned it (the chassis, bare prose, the dismiss half of a pair, an untyped
value). That list was treated as a checklist to argue past rather than a bar to clear, and grey went
on shipping — so the list is gone and the approval is the bar.

If an element distinguishes A from B, its color carries the distinction; two badges that mean
different things and render the same grey are wrong, not safe. When you reach for grey, you have
almost always skipped the question of what the thing MEANS: a destructive control is `danger`, a
favourite is `primary`, anything belonging to an app is `module`. Work that out first — the answer
is usually a real color, and the approval is only needed for what genuinely has no meaning to carry.

**"Readable ink" does NOT mean `text-base-content`.** A silica color class only sets CSS variables
(`--btn-fg`, `--tabs-accent-content`, …); the component paints itself from them, so its foreground is
already resolved from `color × variant` and stays correct on fills, soft tints, outlines and dark
islands. Writing a text color onto a component overrides that and is a RULE #1 re-skin — set its
`color` prop instead. Bare prose needs nothing: `body` sets `color: var(--color-base-content)`, so it
inherits. Write a text color only to deliberately color bare text (`text-module`, `text-success`).

There are **27 registered colors** (10 semantic + 18 module identities), but `SilicaColor` is
`… | (string & {})`, so autocomplete shows 8 and TypeScript catches nothing. Pick from the real
list, not the one the editor offers.

**The positive form — color IS the design, not decoration on it.** A filled tab says _you are here_
faster than a label can be read; a solid button says _this is the point_ before the eye reaches the
word. So: **selection is a filled shape, not a 2px underline** (`<Tabs variant="pills">`); **the
action a surface exists for is solid and colored**, never `outline`/`ghost`; and **if every row in a
list says it, it cannot be the headline** — lead with what differs, demote the repeat to a badge.
The test: _when the color is right, the explanation becomes redundant._ **If adding color didn't let
you delete any words, you decorated rather than designed.** Worked before/after: [DESIGN.md](DESIGN.md) §5.

Full palette, the per-element assignment table, the ship gate, and a worked example:
[DESIGN.md](DESIGN.md).

## Where things live

```
apps/
  web/          @sparx/web: sparx.works, the marketing site and public docs
  market/       @sparx/market: the template and app marketplace
  workbench/    @sparx/workbench: app.sparx.works, the operator console
  b2b-portal/   empty placeholder
packages/
  brand/        @sparx/brand: the spark, the wordmark, the theme tokens (theme.css)
docs/personas/  the persona test pack
k8s/            the manifests for namespace `sparx` (see k8s/kustomization.yaml)
scripts/        this repository's structural checks, and the runner for the platform's
DESIGN.md       the design contract: palette, color axes, the ship gate
```

The workbench has its own [apps/workbench/CLAUDE.md](apps/workbench/CLAUDE.md). The platform's
design and architecture docs are in [wizeworksllc/platform/docs](https://github.com/wizeworksllc/platform/tree/main/docs);
start at its [brain](https://github.com/wizeworksllc/platform/blob/main/docs/brain/README.md).

## The platform is a set of published packages

- **Every `@wizeworksllc/*` dependency is a pinned version from GitHub Packages**, published from
  wizeworksllc/platform. Never a `workspace:` link, never a path. To take a platform change, bump the
  pin in each app's package.json (all apps on one version) and run `pnpm install`.
- **The packages publish as TypeScript source**, so every one an app installs, directly or through
  another, must be in that app's `transpilePackages`. `pnpm check:transpile-packages` walks the
  closure and fails by name; without it the failure is `next build` inside the image build.
- **`@sparx/brand` is the only workspace package.** It stays here, and its tokens are the single
  point of change for the whole design (RULE #1).
- **Installing needs two tokens** in the environment, because `.npmrc` reads both and pnpm ignores
  the whole file when either is unset:
  `export GITHUB_PACKAGES_TOKEN=$(gh auth token)` and `FONTAWESOME_NPM_TOKEN`.
- **Nothing here holds a database connection or an auth instance** (platform docs/154). The
  workbench's `/api/auth` proxy and `/api/token` BFF forward to api-rest. A feature that needs a new
  endpoint is a platform change first (API-first), released there, then consumed here.

## Checks, CI and release

- **The gate:** `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm format:check`, `pnpm lint`,
  `pnpm typecheck`, `CI=true pnpm test`. The pre-push hook ([.githooks/pre-push](.githooks/pre-push))
  runs exactly that; `--no-verify` is not an acceptable bypass.
- **The platform's checks over these apps** (console parity, spelling, em-dashes, the layout and copy
  guards) still live in the platform. CI checks the platform out at `platform/` and this repository
  at `platform/sparx/`, the layout they were written for, and runs them through
  [scripts/platform-checks.mjs](scripts/platform-checks.mjs). A few workbench tests read the
  platform's source the same way ([apps/workbench/test/platform-source.ts](apps/workbench/test/platform-source.ts));
  locally they find a `sparx.works` or `platform` checkout beside this one, and skip and say so
  when there is none.
- **Release** ([.github/workflows/release.yml](.github/workflows/release.yml)): every push to `main`
  runs CI, builds `ghcr.io/wizeworksllc/sparx-{web,market,workbench}`, proves each pulls
  anonymously, applies `k8s/` to namespace `sparx` on `aks-sparx-prod-cus`, and tags last
  (`feat:` minor, `fix:`/`perf:` patch, `feat!:` major). Shared infrastructure (the cluster, the
  vault, Caddy routes, DNS) is wize-infrastructure's: a new route is a PR there, released first.
- **The apps are still served from `sparx-prod`** by the platform's release. Their manifests here
  are written and checked (`pnpm check:k8s` renders them) but not listed in k8s/kustomization.yaml;
  that file says how an app moves.

## Environment

Run builds, tests, lint and typecheck through the shared queue:
`node G:/code/@wizeworks/agent-queue/run.mjs <command>`. Never raise Node's heap locally. Never start
or restart the dev server. Never commit or push unless asked; leave work in the tree and report the
changed files.

## Document style

Every doc starts with a `Version`, `Author`, and `Last Updated` header. When editing a doc
materially, bump the version and update the date. The author is Brandon Korous. Dates are absolute
ISO (`2026-11-01`).
