# Maintaining The Defence Ecosystem

This is the operating manual for keeping the tool accurate, stable, and scalable
over time. It exists so the knowledge of how this works doesn't live only in one
person's head or in past chat transcripts.

---

## 1. What the tool is (one paragraph)

A single self-contained HTML file (`The_Defence_Ecosystem_v2.html`, ~360 KB) that
maps the UK / NATO / allied defence innovation and procurement ecosystem. All data,
rendering, and styling live in that one file — no server, no build step, no
dependencies. It's deployed on GitHub Pages by renaming the file to `index.html`.

---

## 2. The golden rules

1. **Accuracy over speed.** Verified links only. Hedge contested facts. Never
   inflate a small nation's capability to hit a number. A truthful "this country's
   defence activity is essentially procurement plus NATO membership" is more useful
   than padding.
2. **Never ship an unverified link.** Every clickable domain must be on the
   `VERIFIED_DOMAINS` allowlist. If you can't confirm a URL loads, don't make it a
   link — describe how to find the body instead.
3. **Validate before every release.** Run `node validate.mjs <file>` and make sure
   it's all green. CI enforces this, but check locally too.
4. **One principal body per slot.** Resist mapping every firm in every country;
   decide what "done enough" looks like per region and hold that line. Scope
   discipline *is* a stability strategy.

---

## 3. How the data is structured (the mental model)

Inside the single `<script>` at the end of `<body>`:

- **Nodes** are created with two helpers:
  - `L(id, label, entry, does)` — a leaf (an organisation / body). `entry` is the
    contact line (may contain a domain, which becomes a link if verified).
  - `B(id, label, does, [children])` — a branch (a category).
  - `const TREE = B("root", …)` is the whole tree.
- **European nations are flat leaves** grouped at render time by a 2-letter id
  prefix (`fr_`, `de_`, …). The prefix is how an org routes to its nation.
- Key maps you'll edit alongside a new node:
  - `TAGS` — routing metadata per node id: `{w:[who], o:[offers], t:[trlLo,trlHi], d:[domains], a:access, g:geo}`
  - `VERIFIED_DOMAINS` — the link allowlist (a `Set`, built from several arrays)
  - `NAT_OPPS` — national tender-portal guidance, keyed by nation code
  - `GATEWAY` — nation → its "front door" body id (surfaced first in Find your door)
  - `EVENT_NEXT` — event id → next occurrence + venue (the fairs)
  - `NATION_ORDER` / `NATION_META` / `PREFIX_NATION` — nation registry for the lens
  - `TECH_ORDER` / `TECH_META` — the technology lens groups
  - `VERIFIED_BATCHES` / `VERIFIED_OVERRIDES` — per-node "last reviewed" dates

### To add an organisation, touch these in order:
1. Add the `L(...)` node in the right nation/branch.
2. Add its `TAGS` entry (routing).
3. Add its domain to `VERIFIED_DOMAINS` (only if you've confirmed the URL).
4. If it's a whole new nation: also update `NATION_ORDER`, `NATION_META`,
   `PREFIX_NATION`, the `nationCodeFor` prefix map, `NAT_OPPS`, and the home-nation
   picker list.
5. Run `node validate.mjs <file>`.

---

## 4. The tooling

| Script | What it does | When to run |
|---|---|---|
| `validate.mjs` | Structural checks: syntax, CSS braces, id uniqueness, orphan tags, unverified links, GATEWAY/CONNECTORS/EVENT_NEXT/NAT_OPPS integrity, node-count floor. No network. | Before every release; CI runs it on every push. |
| `check-links.mjs` | Fetches every clickable URL and reports dead/redirected links. Needs network. | Monthly, and after adding new domains. `--all` also tests plain text domains. |

Both are dependency-free (Node 18+). Exit code 1 on failure, so both work in CI.

```bash
node validate.mjs The_Defence_Ecosystem_v2.html
node check-links.mjs The_Defence_Ecosystem_v2.html          # verified links
node check-links.mjs The_Defence_Ecosystem_v2.html --all    # + plain-text domains
```

CI (`.github/workflows/ci.yml`) runs `validate.mjs` on every push/PR and
`check-links.mjs` weekly + on demand. Point `TARGET` at whatever the deployed file
is named.

---

## 5. The maintenance cadence (the ritual that keeps it credible)

The tool decays silently without this. A light quarterly pass is enough:

- **Monthly:** run `check-links.mjs`; fix any dead links.
- **Quarterly:**
  - Refresh the fastest-moving content: **fairs** (`EVENT_NEXT` dates), **new funds
    / VCs**, **agency reorganisations** (these change most).
  - Re-research 1–2 regions in depth; bump their dates in `VERIFIED_BATCHES`.
  - Add a line to the changelog in the About panel.
  - Re-stamp `DATA_AS_OF`.
- **When a user reports a problem:** check they've hard-refreshed (GitHub Pages
  caches aggressively) before assuming the file is wrong.

Fastest-drifting content, in order: fair dates → startups/VCs → agency names →
procurement portals → primes → multinational bodies.

---

## 6. Deploying

1. Validate: `node validate.mjs The_Defence_Ecosystem_v2.html` (must be green).
2. Copy to `index.html`.
3. Commit & push (CI validates automatically).
4. Hard-refresh the live page (Ctrl+Shift+R) to beat the Pages cache. The
   `DATA_AS_OF` stamp in a node's panel confirms which build is live.

---

## 7. The scaling ceiling — and the plan to raise it

**Honest assessment:** the single-file architecture is why this was easy to build
and why it will eventually be hard to sustain. Data and rendering are married in one
literal, so every data edit risks a structural error and can only be tested by
reconstructing the app in a sandbox. The `validate.mjs` + CI safety net makes this
*safe* up to maybe ~1,500 nodes. Beyond that, the friction compounds.

The real fix, when you're ready, is a **data/render split** — described below so you
can decide with the costs in front of you. It is optional. The tool is stable as-is
with the CI net; this is about the *next* order of magnitude.

### Migration plan: split data from render (keep shipping one file)

**Goal:** develop with data separate from code, but still *ship* a single
self-contained HTML file (preserving the offline / no-dependency principle).

**Target shape:**
```
/data
  organisations.json   # the nodes: id, label, entry, does, parent, tags
  nations.json         # NATION_META, order, prefixes, NAT_OPPS
  domains.json         # the verified allowlist
  events.json          # EVENT_NEXT
/src
  index.template.html  # the app shell + render code, with a {{DATA}} placeholder
build.mjs              # inlines the JSON into the template -> dist/index.html
schema/*.json          # JSON Schema for each data file
```

**How it works:** you edit JSON (or the render code) separately. `build.mjs` reads
the JSON, validates it against the schemas, and writes `dist/index.html` with the
data inlined — byte-for-byte the same kind of self-contained file you ship today.
CI validates the JSON on every push; releases run the build.

**Phases (each independently shippable, low-risk):**
1. **Extract data, no behaviour change.** Write a one-off script that parses the
   current `L()/B()/TAGS/…` literals into the JSON files above. Add `build.mjs` that
   re-inlines them. Verify the built file is functionally identical to today's
   (same node count, same validator output). *This is the big step; everything else
   is easy after it.*
2. **Add JSON Schemas.** Now that data is JSON, a schema enforces every invariant
   `validate.mjs` checks — plus new ones — declaratively. Duplicate ids, bad tag
   enums, and unverified domains fail at build time.
3. **Split the render code** out of the template into `/src` modules (optional;
   improves readability, not required for scaling).
4. **Retire the bespoke harness.** The sandbox-reconstruction validation we do now
   is replaced by schema validation on clean JSON — simpler and more reliable.

**Cost:** phase 1 is the real work — maybe a focused session to write and verify the
extractor and build step. Risk is contained because the acceptance test is exact:
the built file must match the current one's structure and pass the same validator.

**What you gain:** data editable without touching code; automatic schema validation;
no growth ceiling on the file; contributors can add organisations safely; the render
code becomes readable and testable on its own.

**What you lose / must accept:** a build step now exists (you no longer hand-edit the
shipped file — you edit sources and build). For a project whose whole ethos is "one
file, no tooling," that's a genuine philosophical shift. It's worth it only when the
maintenance friction of the single file starts to hurt — which is a *when*, not an
*if*, but it may not be today.

**Recommendation:** stay single-file with the CI net for now. Do phase 1 the first
time a data edit causes a nasty structural break that CI catches but is annoying to
fix by hand — that's the signal the marriage has become a liability.
