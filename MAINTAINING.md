# Maintaining The Defence Ecosystem

This is the operating manual for keeping the tool accurate, stable, and scalable
over time. It exists so the knowledge of how this works doesn't live only in one
person's head or in past chat transcripts.

> **Deeper reference:** [`CLAUDE.md`](CLAUDE.md) is the canonical, detailed brief
> (data model, tags, tree structure, automation stages, current state). This file
> is the shorter operational manual. If the two ever disagree, `CLAUDE.md` wins —
> and please fix the mismatch.

---

## 1. What the tool is (one paragraph)

A single self-contained `index.html` (~570 KB, all HTML/CSS/JS inline) that maps the
UK / NATO / allied defence innovation and procurement ecosystem. **The app hardcodes
no organisation data.** It loads its data at runtime, in order: **Supabase**
(`published_nodes` view + `reference` table) → **`data.json`** (a mirror of Supabase,
served from the repo root) → a tiny embedded fallback. It's deployed on GitHub Pages.

**The consequence that governs everything below:** adding or editing an organisation
is a **data** change (Supabase → `data.json`), *never* an edit to `index.html`.
`index.html` changes only when the *app itself* changes — a feature, layout, or the
version stamp.

---

## 2. The golden rules

1. **Accuracy over speed.** Verified facts and verified links only. Hedge contested
   facts. Never inflate a small nation's capability to hit a number. A truthful "this
   country's defence activity is essentially procurement plus NATO membership" is more
   useful than padding. Never invent an organisation, a URL, or a capability.
2. **Check first before adding anything.** Things you assume are missing are often
   already in the map under a different id. Always search the data (or use the drafter's
   dedupe check) before creating a node.
3. **Representative, not exhaustive.** Cover the landscape sensibly; one principal body
   per slot. Scope discipline *is* a stability strategy.
4. **Validate before every release.** Run `node scripts/validate-data.mjs data.json`
   and make sure it's green. CI enforces this on every push, but check locally too.
5. **Neutral, factual tone.** No marketing language in descriptions; write in your own
   words (don't paste site copy).

---

## 3. How the data is structured (the mental model)

Data is a **flat list of nodes** (in Supabase, mirrored to `data.json`), not literals
in the HTML. Each node:

```
{ id, label, parent, kind:'org'|'branch', entry:<URL/display>, does:<one-sentence desc>,
  tags:{ w, o, t, d, a, g }, affiliation:{ net, role, note }, order }
```

- **`parent`** builds the tree; depth is derived from nesting (a stored `depth` is
  ignored). `order` (default 0) sorts siblings.
- **`tags`** drives both runtime lenses (Alliance/country and Technology) and the
  "Find your door" finder — `w` (who for), `o` (what it offers), `t` (TRL band `[lo,hi]`),
  `d` (tech domains), `a` (access), `g` (geo). Both lenses are computed from tags at
  runtime; **there is no separate technology structure to maintain.**
- **`affiliation`** `{ net, role, note }` renders the `◇` network line (DIANA, NATO CoEs,
  Catapults, corporate/prime families).

Full field enumerations, the branch/parent id map, and the NAD Group structure live in
[`CLAUDE.md`](CLAUDE.md) § "Data model".

---

## 4. The tooling

All scripts are dependency-free (Node 18+), exit 1 on failure, and live in `scripts/`.

| Script | What it does | When to run |
|---|---|---|
| `scripts/validate-data.mjs` | Structural checks on `data.json`: valid JSON shape, node-count floor, unique ids, every parent exists, exactly one root, valid `kind`, tag/affiliation shape, affiliation-count floor. No network. | Before every release; CI runs it on every push/PR. |
| `scripts/sync-datajson.mjs` | Pulls Supabase (`published_nodes` + `reference`, paginated) → writes `data.json`. Needs `SUPABASE_URL` / `SUPABASE_ANON_KEY`. | Via the sync GitHub Action (nightly or on demand); rarely by hand. |
| `scripts/check-links.mjs` | Fetches every clickable URL in `data.json` and reports dead/redirected links. Needs network. | Monthly, and after adding new domains. CI runs it weekly. |

```bash
node scripts/validate-data.mjs data.json
node scripts/validate-data.mjs data.json --min-nodes=1200 --min-affiliations=150
node scripts/check-links.mjs data.json
```

> **Note:** `drafter-engine.mjs` also exists at the repo root (not just in `scripts/`)
> because `admin-drafter.html` imports `./drafter-engine.mjs` from there. Keep both in
> sync if you edit the engine. The AI-assisted drafter and issue-ingest are documented
> in [`CLAUDE.md`](CLAUDE.md) § "Build & automation tooling".

CI lives in `.github/workflows/`: `ci.yml` (validate on every push/PR + weekly link
check), `sync-datajson.yml` (regenerate `data.json` from Supabase), and
`ingest-suggestion.yml` (community suggestions → drafted node).

---

## 5. The maintenance cadence (the ritual that keeps it credible)

The tool decays silently without this. A light quarterly pass is enough:

- **Monthly:** run `scripts/check-links.mjs`; fix any dead links.
- **Quarterly:**
  - Refresh the fastest-moving content: **fairs** (event dates), **new funds / VCs**,
    **agency reorganisations** (these change most).
  - Re-research 1–2 regions in depth; bump their "last reviewed" dates.
  - Add a line to the changelog in the About panel.
  - Re-stamp the version (see § 7).
- **When a user reports a problem:** check they've hard-refreshed (GitHub Pages caches
  aggressively — `Ctrl+Shift+R`, or load `…/Defence-ecosystem/?v=N`) before assuming the
  data is wrong.

Fastest-drifting content, in order: fair dates → startups/VCs → agency names →
procurement portals → primes → multinational bodies.

---

## 6. Deploying

Supabase is the single source of truth; `data.json` is generated from it.

1. **Edit data in Supabase** (SQL editor, or the drafter). This is the *only* place you
   edit organisation data. Remember: in the Supabase SQL editor, **Run** commits the SQL
   (this is what changes data); **Save** only bookmarks the query text.
2. **Run the "Sync data.json from Supabase" GitHub Action** (or wait for the nightly run).
   It pulls Supabase → writes `data.json` → validates → commits. GitHub Pages redeploys.
   *Never paste `data.json` into the GitHub web editor — it's ~525 KB and the editor
   silently truncates large pastes. Upload the file instead.*
3. **`index.html`** is uploaded only when the *app* changes (a feature or the version
   stamp), never for data.
4. **Hard-refresh** the live page (`Ctrl+Shift+R`) to beat the Pages cache. The version
   stamp in a node's panel confirms which build is live.

> **Supabase "Max rows" must stay 5000.** The default of 1000 silently clipped nodes —
> a real past bug. The sync script paginates so it can't be clipped, but keep the setting
> high anyway.

---

## 7. Versioning

Semantic **MAJOR.MINOR.PATCH** (see [`CLAUDE.md`](CLAUDE.md) § "Versioning" for the full
rules). On release, stamp the version in **three** places or the About panel will lie:

1. the HTML `DATA_AS_OF` constant,
2. the `class="aver"` About string in the HTML,
3. `data.json` `meta.version` (and the deploy SQL header).

Keep a `CHANGELOG.md`. (Version drift here has bitten before — the About panel was stuck
at v2.0 for several releases.)

---

## 8. On architecture (the data/render split is done)

Earlier versions married data and rendering in a single HTML literal, and this file used
to describe a future migration to split them. **That migration has effectively happened:**
data now lives in Supabase and is mirrored to `data.json`, and the app renders it at
runtime. The single-file *shipping* artefact (`index.html`) is preserved, but you no
longer hand-edit data inside it. The remaining structural work — JSON Schema on the data,
splitting the render code into modules — is optional polish, not a growth ceiling.
