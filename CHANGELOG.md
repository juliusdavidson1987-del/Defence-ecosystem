# Changelog — The Defence Ecosystem

Semantic **MAJOR.MINOR.PATCH**. Newest first. Data-only changes (Supabase → sync)
aren't stamped here unless they change a version.

## v4.7.0 — Taxonomy v2: two-level technology domains (2026-09-05)
- **The technology taxonomy is now two-level** (see `docs/TAXONOMY.md`): ~9 **categories**
  group ~30 finer **subcategory** tags. Tags stay flat & multi-valued — categories are a
  navigation/display layer, so a node can still span domains.
- **Fixes the coarse spots:** `human` split into `medical` (casualty care, med-devices, biotech)
  and `humanperf` (performance, augmentation); `quantum` promoted to its own subcategory; added
  `autonomy`, `software`, `ew`, `pnt`, `eoisr`, `cbrn`, `microelec`. Everything else maps 1:1.
- **Technology lens is now category → subcategory → nation** (`TECH_TAX` drives `TECH_META`/
  `TECH_ORDER`/`SUBCAT`/`CAT_META`; `buildTechTree` nests). **Find-your-door** domain chips are
  grouped under category headings. All old tags remain valid (back-compat aliases), so nothing
  breaks before the retag.
- Vocab updated across `KNOWN_DOMAINS` (drafter + draft-node), `validate-data.mjs`, and the
  Edge-Function tag prompts.
- **Full AI retag tool (shipped).** A one-off `retag` Edge Function + `scripts/retag-run.mjs` +
  `.github/workflows/retag.yml` walks every org node in batches and has `claude-opus-5` refine
  `tags.d` into the v2 subcategories (splitting `human`, adding the new keys). **Dry-run by default**
  (downloadable change list); applying snapshots old tags to `retag_backup` (`migrations/2026-09-05-retag-backup.sql`)
  for a one-line full revert, then re-syncs data.json. Additive/refining — never blindly overwrites.

## v4.6.0 — Events reworked: three-layer model + dates as data (2026-09-05)
- **Events are now a pathways-first, three-layer model** instead of a thin fixed list:
  **Anchor fairs** (the tentpoles, reparented under `ev_fairs`), **Aggregators & event
  calendars** (`ev_aggreg` — Defence IQ, Clarion Defence & Security, COGES/GICAT — the
  organisers who keep the always-current listings), and **Independent organisers &
  activities** (`ev_activities` — CWIX, Locked Shields; DIANA/SOFWERX/CCDCOE/Eurodefense.tech
  referenced from elsewhere). Web-verified nodes, real URLs.
- **Event dates moved out of `index.html` into `reference.event_next`** — `EVENT_NEXT` is now a
  `let` that `applyData()` overrides from the reference layer, so fixing a date is a data change
  (sync, no redeploy) instead of an HTML edit. `migrations/2026-09-05-events-rework.sql`.
- **Phase 2 — the date-refresh agent (shipped).** A weekly `event-refresh` Edge Function web-checks
  each anchor fair's next edition and, when the official source differs from `reference.event_next`,
  files a **proposed change** in `event_date_proposals`. Reviewed in `admin-drafter.html`
  ("Event dates — proposed" — Approve writes the new date into `reference.event_next`; Dismiss drops
  it) via `review-node` `eventprops-list`/`eventprop-set`. Orchestrated by
  `scripts/event-refresh-run.mjs` + `.github/workflows/event-refresh.yml` (weekly, manual-first),
  which opens an issue listing proposals. `migrations/2026-09-05-event-proposals.sql`.
  Optional **auto-apply** (`EVENTREFRESH_AUTOAPPLY=true`): high-confidence date changes are written
  straight into `reference.event_next` (logged as `auto_applied`, reported in the weekly digest, and
  the workflow re-syncs data.json); below the bar they're still filed for review.

## v4.5.0 — Auto-maintainer agent + on-demand web search (2026-09-05)
- **Find your door — wider-web search on demand.** The "🌐 Search the wider web"
  option is now always available in the finder results (a "Check the wider web"
  card), not just when the map is thin — the sector moves fast, so you can check
  for new/updated organisations even when the map already returns plenty. On the
  tag-only path (no free-text), the query is synthesised from the selected chips.
  The auto-run on thin results is unchanged.
- **Stage 4: a daily back-room agent.** New gated Edge Function `auto-maintain`
  works all five review queues (pending nodes, corrections, claims, feedback, web
  finds), verifying each item with `claude-opus-5` + web search. It **auto-applies
  the safe, clear-cut decisions and holds the uncertain ones** for the maintainer,
  recording a one-line recommendation (`auto_action` / `auto_reason`) on every held
  item. **New orgs are staged, not published, by default** (`AUTOPUB_NEW_ORGS=false`);
  policy is env-tunable.
- **Daily digest** by **GitHub issue + email** (Resend). Orchestrated by
  `scripts/auto-maintain-run.mjs` + `.github/workflows/auto-maintain.yml` (daily
  06:00 UTC), which loops the function until the queues drain, reports, then re-syncs
  `data.json`. The Anthropic + service-role keys stay server-side; the runner only
  holds the shared secret.
- **Bookkeeping:** `migrations/2026-09-05-auto-maintainer.sql` adds the `auto_*`
  columns + an `auto_runs` log. `review-node` gains `op:"auto-runs"` and returns the
  agent's recommendation in every review list. Setup: `automation/STAGE4_AUTO_MAINTAINER.md`.

## v4.4.5 — Web search stays in-country (2026-09-04)
- Node-panel web search returned UK companies for other nations (e.g. Iceland). Completed the nation-name map to all ~45 nations and added a stay-in-country guard so results never substitute off-country orgs.

## v4.4.4 — Web-finds capture fix (2026-09-04)
- "Beyond the map" finds weren't reaching the review queue: the `on_conflict=url` upsert was RLS-blocked (anon is insert-only). Switched to plain per-find inserts.

## v4.4.3 — Reliable web search + refine loop (2026-09-04)
- Loosened the `find-door` web prompt to surface real candidates (go wider); added a "search again" refine bar.

## v4.4.2 — Modal z-index fix (2026-09-03)
- The feedback (and reconcile) modal opened behind the map on phone and desktop; added them to the fixed-overlay z-index rules.

## v4.4.1 — Web-finds review queue + node-panel search (2026-09-03)
- Captured web finds to a `web_finds` table with a review queue; added "🌐 Search the web for this area" on node panels.

## v4.4.0 — Native feedback (2026-09-03)
- Replaced the Google Form with a native in-app feedback modal → Supabase `feedback` table + a review queue. Removed the `SUGGEST_FORM` constant.

## v4.3.2 — Synthetic gateway nationality (2026-09-03)
- US/NATO/EU synthetic `nat_*` gateways no longer default to UK opportunities (longest-prefix nation resolution).

## v4.3.1 — Per-nation gateway fix (2026-09-03)
- Per-nation gateway branches no longer default to UK; `nationCodeFor` resolves `nat_<code>` before the tags fallback.

## v4.3.0 — AI finder web mode (2026-09-03)
- `find-door` web mode surfaces real external orgs (verified URLs) when the map is thin; read-only, rate-limited.

## v4.2.0 — AI free-text finder (2026-09-03)
- "Find your door" gains an AI free-text mode: describe your situation → `find-door` ranks the best doors from the map with reasoning.
