# Changelog — The Defence Ecosystem

Semantic **MAJOR.MINOR.PATCH**. Newest first. Data-only changes (Supabase → sync)
aren't stamped here unless they change a version.

## v4.5.0 — Auto-maintainer agent (2026-09-05)
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
