# CLAUDE.md — The Defence Ecosystem

Context for working on this project. Read this first every session.

---

## What this is

**The Defence Ecosystem** is an interactive, single-file HTML tool that maps the UK / NATO /
allied / partner-nation defence *innovation and procurement* landscape — the organisations,
who they are, what they do, and how to approach them. It renders as a radial collapsible
mind-map with an "Explore" list, a **"Find your door"** graded finder, detail panels, and
**two runtime lenses** (by Alliance/country, and by Technology). It runs on phone and desktop.

Live at: **https://juliusdavidson1987-del.github.io/Defence-ecosystem/**
Repo: **juliusdavidson1987-del/Defence-ecosystem** (deploy the app as `index.html`).

**Owner:** Julius Davidson — ex-UK MOD Defence BattleLab, Project Mercury / NATO ACT.
Prefers brief decisive direction, dislikes excessive clarifying questions, wants proactive
error-catching, version stamps, and automation. **Working principle throughout: accuracy
over speed.**

---

## Guiding principles (non-negotiable)

- **Accuracy over speed.** A truthful thin entry beats a padded false one. Verified facts and
  verified links only. Never invent an organisation, a URL, or a capability.
- **Representative, not exhaustive.** Cover the landscape sensibly; don't pad to hit a quota.
- **Dual-use and exercises are included** where genuinely defence-relevant.
- **CHECK FIRST before adding anything.** A recurring lesson: things you assume are missing
  are often already in the map under a different id (NATO CoEs were under `coe_*`, SHAPE is
  `aco`, NCI Agency is `ncia`, COVE/Janus were under DIANA, In-Space Missions already existed).
  Always search the data before creating a node. The drafter/ingest tooling automates this.
- **Neutral, factual tone** in all descriptions. No marketing language.

---

## Architecture & how data flows

Single 570 KB `index.html` (all HTML/CSS/JS inline). It loads data **at runtime** in this order:

1. **Supabase** (primary) — the `published_nodes` view + the `reference` key/value table.
2. **`data.json`** (fallback) — a mirror of Supabase, served from the repo root.
3. Embedded minimal fallback (last resort, inside the HTML).

**Consequence that matters:** the app hardcodes *no* organisation data. Adding/editing orgs is
a **data** change (Supabase → `data.json`), never an HTML change. `index.html` only changes when
the *app itself* (a feature, layout, or the version stamp) changes.

### Supabase
- URL: `https://igvxlmbndpuegibykygq.supabase.co`
- anon key (public, already in the client): `sb_publishable_Z2z6XuJERV6eosZsnnFnAA_AiBfHkyf`
- Table: `public.nodes(id, label, parent, kind, does, entry, tags jsonb, status, affiliation jsonb)`
  plus snake_case extras `entry_point, opps_override, entity_type_override, source`.
- App reads `published_nodes?select=*` (a view of published rows) and `reference?select=key,value`.
- **"Max rows" must stay 5000** (default was 1000 and silently clipped nodes — a real past bug).
- The **anon key READS only.** Inserts need the service-role key (server-side) or SQL editor.

---

## Data model

A node:
```
{ id, label, parent, kind:'org'|'branch', entry:<URL/display>, does:<one-sentence desc>,
  tags:{...}, affiliation:{...}, order, depth }
```
- `applyData` **ignores `depth`** (it derives depth from tree nesting) and only uses `order`
  (default 0) to sort siblings. So `data.json` is a faithful dump of `published_nodes`; depth is cosmetic.
- **`tags`** drives both lenses and the finder:
  - `w` (who it's for): `govmil, academic, prime, sme, startup, investor`
  - `o` (what it offers): `advice, contract, procurement, research, product, investment, grant, test`
  - `t` (TRL band): `[low, high]` integers 1–9
  - `d` (tech domains): `ai, space, cyber, c4isr, comms, maritime, land, air, counteruas, weapons,
    directed, hypersonic, nuclear, simulation, training, logistics, energy, materials, human, quantum, xcut`
    (plus cross-cutting function buckets `xfund, xtest, xacad, xproc, xother` used by the tech lens)
  - `a` (access): `open, restricted, portal, prime`
  - `g` (geo): `uk, us, eu, nato, ca, au, nz, kr, jp, il, in, sg, ae, sa, fr, de, it, nl`
- **`affiliation`**: `{ net, role, note }` → renders as a light navigation line
  `◇ {net} {role} — {note}`. Used for network memberships (DIANA, NATO CoEs, Catapults) and
  sister-org families (corporate groups, prime divisions, national champions). ~187 nodes carry one.
- **Both lenses are runtime-computed from tags** — the Technology lens buckets by `d` via
  `techForOrg()`; there is **no separate technology structure to maintain**. New nodes appear in
  both lenses automatically as long as they have sensible tags.

### Tree / branch structure (key parent ids)
UK is the **thematic spine** (not a country bucket). Top branches include:
`b_strat` (strategy), `b_acq` (**Acquisition — NAD Group**), `b_flc` (front-line commands),
`b_sti` (science/tech/innovation), `b_nuke`, `b_te` (test & eval), `b_primes`, `b_supply`,
`b_tech` (Defence-Tech & SMEs), `b_fund` (Funding → `f_public`, `f_vc`, …), `b_gov`,
`b_nato`, `b_media`.

Nations:
- **`b_eu`** → `eu_fr, eu_de, eu_it, eu_nl` (own containers), `eu_nordic, eu_baltic, eu_central`
  (flat multi-country buckets), `eu_turkey, eu_ukraine`.
- **`b_5eyes`** → `ca_grp, au_grp, nz_grp`.
- **`b_partners`** ("Indo-Pacific & Other Allies") → `pt_kr, pt_jp, pt_il, pt_in, pt_sg, pt_ae, pt_sa`.

**NAD Group** (`b_acq`) is restructured into **9 National Armaments areas**:
`na_intl` (International), `na_pp` (Plans & Portfolios), `na_materiel` (←DE&S/FCG),
`na_innov` (←Dstl + UK Defence Innovation/DASA), `na_ls` (Logistics & Support),
`na_dd` (←Defence Digital), `na_ci` (Commercial & Industry, +NSO), `na_corp` (+DBS),
`na_infra` (←DIO). SDA/AWE stay under `b_nuke` (separate Quad group).

**40 nations total:** 36 non-UK/US + UK + US.

---

## Deployment workflow

Since Stage 1, **Supabase is the single source of truth** and `data.json` is generated from it.

1. **Edit data in Supabase** (SQL editor, or the drafter tool). This is the only place you edit data.
2. **Run the "Sync data.json from Supabase" GitHub Action** (or wait for the nightly run). It
   pulls Supabase → writes `data.json` → validates → commits. GitHub Pages redeploys.
3. **`index.html`** is uploaded only when the *app* changes (feature/version), not for data.

### Gotchas (all learned the hard way)
- **Supabase "Run" ≠ "Save".** *Run* executes/commits the SQL (this is what changes data).
  *Save* only bookmarks the query text. You almost never need Save.
- **Never paste `data.json` into the GitHub web editor** — it's ~525 KB and the editor silently
  truncates large pastes, corrupting the JSON. **Upload the file** (Add file → Upload files).
- **Cache:** after deploying, hard-refresh **Ctrl+Shift+R**; or load `…/Defence-ecosystem/?v=N`
  to bypass the CDN.
- **Row cap:** keep Supabase "Max rows" at 5000. The sync script paginates so it can't be clipped.
- **Version drift:** the About panel (`class="aver"`) has its own version string *separate* from
  the `DATA_AS_OF` JS constant. **Update both together** or the About lies (it was stuck at v2.0
  for several releases). Current: **v4.1.1**.

---

## Versioning

Semantic **MAJOR.MINOR.PATCH**:
- MAJOR = new feature or structural release (v4 = graded finder + partner nations + NADG + affiliations)
- MINOR = new data domain/section (v4.1 = funding expansion: NSSIF partners + Ante-Bellum Angels)
- PATCH = fixes (v4.1.1 = corrected the About version display)

Stamp on release: the HTML `DATA_AS_OF` **and** the `class="aver"` About string, plus
`data.json` `meta.version`, plus the deploy SQL header. Keep a `CHANGELOG.md`.

---

## Build & automation tooling

Deterministic build scripts (Node, no deps, Node 18+):
- **`build-import.mjs`** — CSV → SQL inserts. Has the country→[prefix,parent] map and the
  type→tags table. Used for bulk additions.
- **`build-datajson.mjs`** — regenerate `data.json` from a base + CSVs (legacy; superseded by the sync).
- **`drafter-engine.mjs`** — the shared engine: `dedupeCheck`, `suggestParent`, `makeId`,
  `buildTags`, `buildNode`, `nodeToSQL`. Used by the drafter and the issue-ingest.

### Automation (in `automation/` — three stages, each with a STAGE*_SETUP.md)
- **Stage 1 — Supabase = source of truth** (`scripts/sync-datajson.mjs`,
  `.github/workflows/sync-datajson.yml`, `ci.yml`, `scripts/validate-data.mjs`,
  `scripts/check-links.mjs`). Auto-generates `data.json`, validates on every push, weekly link check.
  *CI runs `validate-data.mjs data.json` only — the old `validate.mjs` (embedded-HTML validator)
  is obsolete and was removed from CI.*
- **Stage 2 — AI-assisted drafter** (`admin-drafter.html` + `drafter-engine.mjs` at repo root;
  optional `supabase/functions/draft-node` + `insert-node`). Paste name+URL → dedupe → AI draft
  (copy-paste to your own Claude, *or* Edge Function) → review → SQL (or one-click insert).
- **Stage 3 — community loop** (`.github/workflows/ingest-suggestion.yml`, `scripts/ingest-issue.mjs`).
  Add the **`approved`** label to a "Suggest an organisation" issue → the action drafts the node
  (dedupe-checked, tagged) and posts it back with SQL. Optional `ANTHROPIC_API_KEY` secret enables
  AI enrichment; without it, it drafts deterministically from the form.
- **Stage 4 — auto-maintainer agent** (`supabase/functions/auto-maintain` + `scripts/auto-maintain-run.mjs`
  + `.github/workflows/auto-maintain.yml`; `automation/STAGE4_AUTO_MAINTAINER.md`). A daily agent that
  works all five review queues (pending nodes, corrections, claims, feedback, web finds): verifies each
  with `claude-opus-5` + web search, **auto-applies the safe decisions and holds the uncertain ones**
  (recording a recommendation in `auto_action`/`auto_reason`), then sends a **digest by GitHub issue +
  email** and re-syncs `data.json`. **New orgs are staged, not published, by default**
  (`AUTOPUB_NEW_ORGS=false`); the whole policy is env-tunable. The Anthropic + service-role keys stay
  server-side (the GitHub runner only holds the shared secret). Run log in `auto_runs`.

**Security:** anon key reads only. The Anthropic key and Supabase service-role key live *only*
inside Edge Functions (server-side secrets), never in the client. The `insert-node` shared-secret
gate (`x-drafter-secret`) is implemented and deployed (2026-09-03) — the client sends it from a
browser-only config field, never committed.

---

## How to work on this project

- **Adding organisations:** research → verify → draft via the drafter (or a CSV + `build-import.mjs`)
  → **dedupe-check first** → run the SQL in Supabase → run the sync. Deep country builds use a
  14-category sweep (gov, military, intel, cyber, space, academia, RTO, primes, supply,
  defence-tech, funding, test, strategy, cross-gov).
- **Editing/restructuring:** do it in Supabase (SQL `update`/`insert ... on conflict`). Every insert
  should be idempotent (`on conflict (id) do update set …, status='published'`).
- **Before running any build script, verify the base data isn't stale** — check node and
  affiliation counts before *and* after. A stale `data.json` base once nearly wiped 105 affiliations.
- **Validate after data changes:** `node scripts/validate-data.mjs data.json` (unique ids, no
  orphaned parents, valid tags/affiliations, count floors, **org geo-tag check** — warns on org
  nodes missing `tags.g`, which the app would treat as UK; catches the v4.3.1 bug class in data).
- **Test HTML changes:** extract the app `<script>` and `node --check` it; grep for critical
  features (`rtier-exact`, `affiliationLine`, `published_nodes`, `two-finger pinch-zoom`); then
  a Playwright smoke test (dismiss the `#welcome` overlay before interacting).

---

## Current state (v4.5.0, Sep 2026)

- ~**1,501 nodes**, **187 affiliations**, **40 nations**.
- Newest partner nations: India, Singapore, UAE, Saudi Arabia (under `b_partners`).
- NAD Group as 9 National Armaments areas.
- Graded "Find your door" (Exact / Close / Potential collaboration) + partner-nation region chips,
  **now with an AI free-text mode** (v4.2.0–v4.3.0): describe your situation → the public `find-door`
  Edge Function has `claude-opus-5` rank the best doors *from the map* with reasoning, and (v4.3.0)
  **search the wider web** when the map is thin, returning real external orgs as "not yet in the map"
  suggestions (read-only, rate-limited, no dataset writes). Phases 1–2 of the AI-finder plan.
- Stages 1–4 automation available; Stage 1 deployed and live. **Stage 4 (v4.5.0) — the daily
  auto-maintainer agent** (`auto-maintain` Edge Function + `auto-maintain.yml` workflow): assesses all
  five review queues with `claude-opus-5` + web search, auto-applies the safe items, holds the rest
  with a recommendation, and sends a daily digest by GitHub issue + email. New-org auto-publish is OFF
  by default (staged for one-click approval). See `automation/STAGE4_AUTO_MAINTAINER.md`.
- Funding branch includes NSSIF (fixed to `nssif.gov.uk`) + its 19 fund-of-funds partners +
  Ante-Bellum Angels.

### Known open items / next ideas
- ✅ **Confirmed live (2026-09-03):** the deployed site runs the current build — About reads
  **v4.1.1**, the graded finder returns EXACT/CLOSE/POTENTIAL tiers, and `affiliationLine()`
  renders `◇` lines from live data (e.g. EDGE Group family). The old About-version bug is fixed.
- ✅ **Stage 2 "Mode B" deployed & verified (2026-09-03):** `draft-node` + `insert-node`
  Edge Functions live at `…functions.supabase.co`, gated by an `x-drafter-secret` shared
  secret (fail-closed; verified 401 without it). `draft-node` uses `claude-opus-5`. Secrets
  `ANTHROPIC_API_KEY` + `DRAFTER_SHARED_SECRET` set in Supabase; service-role key auto-injected.
  Client sends the secret from a browser-only config field. See `supabase/functions/README.md`.
- ✅ **Done (2026-09-03):** Angels now have their own Funding sub-branch `f_angels` (Ante-Bellum
  moved out of `f_vc`); Ploughshare/Serapis/DAIC re-parented under NADG `na_innov`; Comand AI
  added via Mode B. Node count → ~1,501.
- ✅ **AI finder Phase 2 shipped (2026-09-03, v4.3.0):** `find-door` web mode uses the `web_search`
  tool to surface real external orgs (verified URLs) when the map is thin; client dedupes
  already-mapped domains and labels them "unverified suggestion". Still no dataset writes. Web mode
  runs ~40s; own tighter rate caps (`FINDDOORWEB_*`).
- ✅ **AI finder Phase 3 shipped (2026-09-03):** maintainer review console in `admin-drafter.html` —
  "Find gaps on the web" (runs `find-door` web mode), "Stage for review" (`insert-node` with
  `status='pending'`; invisible on the live map / `published_nodes`), and a "Review queue — pending"
  list with Publish/Reject via the new gated `review-node` function. The public path still writes
  nothing; ingestion is fully maintainer-gated. `reject` only ever deletes still-`pending` rows.
- ✅ **Admin analytics (2026-09-03):** `admin-drafter.html` "Analytics & submissions" dashboard reads
  counts via `review-node` `op:"stats"` (service-role) — published/pending `nodes`, corrections
  (`edits`), `claims`, usage `events`, and find-door search usage (from `rate_limits`), plus recent
  corrections/claims. The public tool already writes `edits`/`claims`/`events`/pending `nodes` via
  the anon key; counts show "—" for any table not present.
- ✅ **Corrections review (2026-09-03):** `admin-drafter.html` "Corrections — pending" queue via
  `review-node` `edits-list` / `edit-set`. Each correction: **Load node to edit** (fetches the live
  node into Step 3 → fix the field → ⚡ Insert directly upserts = rewrite), **Resolve** (applied) or
  **Dismiss** (dropped). `edit-set` marks the `edits` row `resolved`/`dismissed` (kept for history,
  leaves the pending bucket).
- ✅ **AI repair (2026-09-03):** each correction has a "🔧 Repair with AI" button → gated
  `repair-node` function (`claude-opus-5` + `web_search`) that verifies the correction (renames,
  mergers, defunct bodies, reference URLs) and proposes a fully-rewritten node
  (label/parent/does/entry/tags + a note), loaded into Step 3 for review → ⚡ Insert directly applies
  → Resolve. Built for complex corrections (wrong parent, rename, defunct/merged, country confusion).
  Corrections targeting a synthetic per-nation id (`nat_<code>` — a runtime branch, **not** a DB
  node) can't be node-repaired; the drafter detects the absent node and shows the live `reference`
  values (`nations_procurement`/`gateways`) so you fix the reference layer instead.
- ✅ **Fix (v4.3.1, 2026-09-03):** synthetic per-nation gateway branches (`nat_<code>`) were showing
  **UK** opportunities for every nation. Root cause: `tagsFor()` returns a default `{g:'uk'}` for
  tagless nodes, and `nationCodeFor` trusted that `g` (the `^([a-z]{2})_` prefix regex doesn't match
  `nat_…`). `nationCodeFor` now resolves `nat_<code>` → code *before* the tags fallback, so each
  nation's gateway shows its own procurement text (e.g. Ukraine → Prozorro/Brave1).
  **v4.3.2** extends the resolver to multi-part region codes the 2-letter map missed
  (`us`, `nato`, `eu_inst`, `multi`, via a longest-prefix match), so the US gateway shows
  SAM.gov/DIU and the NATO gateway shows NSPA/NCIA instead of UK. NB: the bug was only in the
  synthetic `nat_*` branches — real org nodes resolve nationality via `ORG_NATION`/id-prefix, so
  the validator's tagless-`g` warning is finder-geo completeness, not a nationality error.
- ✅ **Claims review (2026-09-03):** `admin-drafter.html` "Claims — pending" via `review-node`
  `claims-list` / `claim-set` — **Approve** (verified contact) or **Dismiss**, with an
  email-domain-vs-website match check to flag legit vs spam. Row kept for history.
- ✅ **Native feedback (2026-09-03, v4.4.0):** the in-app "Send feedback" (and gateway / other
  suggestions) now post to a Supabase `feedback` table instead of the Google Form. Reviewed in
  `admin-drafter.html` "Feedback — pending" via `review-node` `feedback-list`/`feedback-set`, and
  counted in analytics. `openSuggestForm()` was rewritten to open a native in-app modal; the
  `SUGGEST_FORM` Google-Form constant is removed. Anon inserts, service-role reads.
- ✅ **Web-finds capture (2026-09-04, v4.4.1):** the finder's "Beyond the map" web suggestions
  (previously ephemeral) are saved to a Supabase `web_finds` table (public inserts, `url` unique so
  no dupes). Reviewed in `admin-drafter.html` "Web finds — pending" via `review-node`
  `webfinds-list`/`webfind-set` — **Add →** loads a find into Step 1 to draft & stage, **Dismiss**
  drops it; counted in analytics. Note the "Web gap-fills" analytics tile is a *run* meter
  (`rate_limits`), while "Web finds" counts *captured* orgs. The web search can also be launched
  from **any node panel** ("🌐 Search the web for this area", `nodeWebSearch()`) — useful at an
  unfilled branch / dead end to check for orgs the map is missing; captures the same way
  (`source='node'`).
