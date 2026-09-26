# Changelog — The Defence Ecosystem

Semantic **MAJOR.MINOR.PATCH**. Newest first. Data-only changes (Supabase → sync)
aren't stamped here unless they change a version.

## v4.11.1 — "Related organisations" needs a real link (2026-09-26)
- **Fix.** The node "Related organisations" panel could show a **random-looking** selection: the old
  scoring let an org qualify on *same country + same entity type with zero shared technology* (2+2 =
  the threshold), so unrelated bodies appeared just because they shared a nationality and a type; and
  orgs tagged only `xcut` (no real domain) got *only* those random matches. Now a **genuine link is
  required** — a shared technology domain (a tentative but real capability tie) or a shared network /
  corporate-family affiliation (a firm tie); same-country/same-type alone no longer counts. A single
  broad shared tag between unlike bodies is also excluded (needs ≥2 shared domains, or 1 shared domain
  *and* the same kind of body, or a shared affiliation). Comparable orgs in **peer nations** are still
  shown ("comparable elsewhere") but **capped at 2** so a node isn't overloaded. Nodes with no genuine
  link now correctly show **no** related orgs rather than filler.

## Feedback console: full text + multi-item drafter (2026-09-25)
- **Fix — truncated feedback.** The maintainer "Feedback — pending" queue cut each message off at 320
  characters (so multi-point feedback was unreadable). It now shows the **full message with line
  breaks preserved**.
- **Fix — drafter on multi-item feedback.** "🧩 Draft node(s) from this" previously drafted only one
  organisation; feedback that lists several (e.g. "1. Improbable Defence is now Skyral… 2. a new UK
  Centre for…") lost everything after the first. `draft-from-source` now extracts **every** distinct
  organisation and returns one draft per item — each flagged **new** or **correction** (matched to an
  existing node id where identifiable, via a candidate corpus), each web-verified — and the console
  lists them to load into Step 3 one at a time. The drafter is also now offered for **text-only
  feedback** (no source link/attachment needed). Requires redeploying the `draft-from-source` function.

## v4.11.0 — scope broadened to national security (2026-09-25)
- **Defence & dual-use → defence, SECURITY & dual-use.** The map now covers the national-security &
  resilience bodies that share the same innovation/procurement pipeline (agreed scope: protective
  security/CNI, cyber, counter-terrorism, border & law-enforcement technology, serious/organised
  crime, intelligence enablers, resilience; excludes pure private guarding/consumer security). No
  restructure — security bodies blend into the existing tree + tags.
- **First UK security tranche** (`migrations/2026-09-25-uk-security.sql`, 14 web-verified nodes):
  HMGCC + HMGCC Co-Creation, ACE (Accelerated Capability Environment), JSaRC, MI5, SIS/MI6, National
  Crime Agency, Counter Terrorism Policing, Border Force, Police Digital Service, BlueLight Commercial,
  College of Policing, Homeland Security Group, National Security Secretariat. (NCSC, NPSA, GCHQ,
  Home Office, DASA, Dstl were already in.) App framing (welcome/About/meta) updated to say defence,
  national security & dual-use.
- **Phase 2 — US** (`migrations/2026-09-25-us-security.sql`): DHS, DHS S&T Directorate, ODNI, FBI, CIA,
  Secret Service, TSA, CBP, FEMA (In-Q-Tel, CISA, NSA, NGA, DC3 already in).
- **Phase 3 — thin-nation gaps** (`migrations/2026-09-25-security-gaps.sql`): a per-nation audit found
  most allies already had their core intelligence + cyber agencies from the country builds; filled the
  genuine gaps — Portugal (SIS, SIED), Türkiye (USOM), South Korea (NIS, KISA), Denmark (FE/DDIS),
  Slovakia (SIS, NBÚ). Others (Slovenia, Croatia, UAE, NZ, etc.) were already covered.

## Event-refresh: fix the WORKER_RESOURCE_LIMIT failures (2026-09-24)
- The weekly `event-refresh` workflow was failing on Supabase `HTTP 546 WORKER_RESOURCE_LIMIT` —
  each invocation ran up to ~8 sequential Sonnet+web-search requests (2 events × up to 4 turns),
  exceeding the Edge Function's per-invocation compute budget, and the orchestrator aborted the whole
  run on the first error. Fixed by **trimming per-call work** — 1 event/call (was 2), `web_search`
  `max_uses` 1 (was 2), continuation turns capped at 2 (was 3), `max_tokens` 1024, effort `low` —
  and making the **orchestrator resilient** (retry/back-off on a flaky call, stop only after 3
  consecutive failures, and fail the job only if it made no progress at all; `MAX_ITERS` 20→40 to
  still cover every fair one-per-call). Requires redeploying the `event-refresh` Edge Function.

## v4.10.1 — guard against orphaned/synthetic parents (2026-09-24)
- **Root-caused the nightly Sync / Auto-maintainer failures** (failing since 21 Sep): they weren't an
  API-cost issue — the data validator was rejecting an orphaned parent. Adding an organisation in the
  app while a *runtime-only* Alliance/Technology branch (`nat_*` / `tech_*`) was selected stored that
  synthetic id as the node's parent; the auto-maintainer then published it, orphaning it and failing
  the validator (which blocks the whole sync). `migrations/2026-09-24-fix-orphan-parents.sql` repairs
  the three affected nodes (Beaten Zone Venture Partners → au_grp; Business Finland → eu_nordic;
  Marduk Technologies → eu_baltic).
- **Hardened every write path so it can't recur** (new `supabase/functions/_shared/parent.ts`):
  `insert-node` and the `auto-maintain` agent (web-finds, pending-node publish, corrections) now
  reject/remap any synthetic or non-existent parent to the real national container from `tags.g`
  (holding for review if it can't be placed); the in-app "Add an organisation" flow resolves a
  synthetic branch to a real container *before* writing, and stamps the correct geo. Requires
  redeploying the `insert-node` and `auto-maintain` Edge Functions.

## Map-wide categorisation audit & fix (data, 2026-09-23)
- Audited all ~2,040 nodes for the mis-tagging that surfaced during the US work and found it was
  map-wide. `migrations/2026-09-23-map-categorisation-fix.sql` (idempotent):
  - **Normalises 75 nodes** whose `tags.w`/`tags.o` were scalar strings instead of arrays (schema
    says arrays) — a latent inconsistency that also broke jsonb tag edits.
  - **7 research labs → RTO** (Dstl, NPL, AFRL, DEVCOM ARL, SEI, Draper, GTRI) — they were stuck in
    Industry via audience-`prime` / a stray `entity_type`.
  - **69 government / agency / command / procurement bodies → correct buckets** (drop audience-`prime`
    so `funcForOrg` routes them): e.g. DE&S, DGA, BAAINBw, NSPA, EDA, DAPA, ATLA and ~15 national
    MoD/armament agencies → procurement; ANSSI, COMCYBER, cyber/space commands, NCIA, CISA, USSF →
    intel; CDAO, DIB, NSIN, ACT → innovation. Map-wide **Industry 473→~414**.
  - **Left real companies, trade associations, events and shipyards untouched** (verified Darktrace,
    QinetiQ, SSTL, Roke, Smiths, 4iG, Excalibur, Rheinmetall Canada all stay in Industry) — the fix is
    per-type, not a blanket rule, after confirming a global `funcForOrg` change was unsafe (274 movers).

## US depth — make the light buckets believable (data, 2026-09-23)
- Topped up the still-light US Alliance-lens buckets (`migrations/2026-09-23-us-depth.sql`):
  **frontline** 1→4 (re-homed Army Futures Command + SOCOM from Industry; added INDOPACOM, Navy
  Warfare Development Command), **test** 6→10 (Yuma Proving Ground, NAWCAD Patuxent, Aberdeen &
  Redstone Test Centers), **science** 5→9 (Army Research Office, AFOSR, ORNL, PNNL), **supply** 5→8
  (CAES, Parsons + Moog fixed). Also re-homed RCCTO and Army Applications Lab (Industry→Innovation).
  No US bucket now sits in single-low digits except frontline (4), which is by design (operational
  commands are peripheral to an innovation/procurement map; the experimentation ecosystem sits in
  Innovation = 13).
- **Fixed two funcForOrg keyword edge-cases:** the four French schools were landing in RTO not
  Academia because the matcher checks unaccented `ecole`/`polytechnic` (reworded with "university");
  Moog was in Defence-tech because "counter-UAS" contains `uas` (reworded). France academia 0→4.

## US nuclear enterprise + acquisition build-out (data, 2026-09-23)
- **Built the US Nuclear enterprise properly.** The bucket held only LANL, a messy combined
  "Sandia/LANL/Livermore" node, and Infleqtion (a *quantum* firm mis-filed via the word "atomic").
  `migrations/2026-09-23-us-nuclear-enterprise.sql`: repurposes the combined node into proper
  **Sandia National Laboratories**, un-mis-tags **Infleqtion** (→ defence-tech), and adds the real
  complex — **NNSA, Lawrence Livermore, Pantex, Y-12, Kansas City NSC, Nevada NSS, Savannah River,
  Naval Reactors, AFNWC, US STRATCOM, AF Global Strike Command**. Nuclear 3 → **13**.
- **Strengthened Acquisition** with the major systems/contracting commands — **NAVSEA, NAVAIR,
  AFLCMC, Army Contracting Command** (procurement 5 → **9**). All web-verified, dedupe-checked, and
  tagged so `funcForOrg()` files them right (nuclear via `d:['nuclear']`; procurement via `o` +
  no audience-`prime`).

## US rebalance — fix mis-bucketing + fill empty Academia & Supply (data, 2026-09-23)
- **Root-caused two empty US Alliance-lens buckets.** The US-expansion nodes were tagged
  `w:['prime']` (meaning "serves primes"), but `funcForOrg()` reads `w:['prime']` as *being* a prime
  and files the org under **Industry** — so DEVCOM + its labs, the Navy warfare centers, NRO/NSA/
  ARCYBER, White Sands/AEDC/AFTC and JPEO-CBRND were all mis-shelved into Industry (87), draining
  Academia, Supply, Test, Intel and RTO. (Confirmed a global `funcForOrg` change was unsafe — 274
  orgs move, breaking correctly-classified ones like Dstl, QinetiQ, Darktrace, SSTL.)
- **Fix** (`migrations/2026-09-23-us-rebalance.sql`, idempotent): drop the audience-`prime` from ~24
  gov/lab/test nodes and set `entity_type` so each buckets correctly (labs → RTO, NRO/NSA → Intel,
  ranges → Test, JPEO-CBRND → Acquisition, NPS/AFIT → Academia); also un-mis-shelves the UK DSC.
- **Filled the two empty buckets with verified orgs:** Academia — **NDU, US Naval War College, US
  Army War College, Air University**; Supply chain — **Moog, Curtiss-Wright, Mercury Systems,
  Ducommun, HEICO, TransDigm**. Result (simulated): Academia 0→6, Supply 0→6, Industry 87→66,
  RTO 2→22, Intel 21→25, Test 3→6; no US bucket left empty.
- **Convention learned:** never put `prime` in `w` for government/lab/test/academia nodes — that
  audience tag is the signal for an industry *prime*. Fixed the same latent issue in the (not-yet-run)
  France DGA test nodes.

## France deepening — fill nuclear / T&E / academia / S&T (data, 2026-09-23)
- **13 web-verified French bodies added** (`migrations/2026-09-23-france-deepening.sql`) so France
  fills the same function buckets as the UK in the Alliance lens. France was strong on primes,
  defence-tech and intel/cyber but had **no nuclear, no test & evaluation, thin academia**. Adds:
  **CEA/DAM** (nuclear deterrent) + **CEA, CEA-List, CEA-Leti, ISL** (S&T/RTOs); **DGA Essais en vol,
  DGA Maîtrise de l'information, DGA centres d'expertise et d'essais** (T&E); **École Polytechnique,
  ISAE-SUPAERO, ENSTA Paris, Institut Polytechnique de Paris** (academia); **SGDSN** (government).
  Dedupe-checked (Bpifrance already existed, skipped); parented under `eu_fr`; tags set so
  `funcForOrg()` files each in the right bucket. First of the nation-coverage build-outs (after the
  US) — deepening allies toward UK-level depth rather than restructuring the tree (the Alliance lens
  is already nation-symmetric).

## Dedup: fold duplicate NSIN into one (data, 2026-09-23)
- NSIN was in the map twice — `nsin` (correct home under `us_diu_grp`, properly tagged) and
  `inc_nsin` (under `b_incubators`, with `tags:null`, a latent UK-geo default bug).
  `migrations/2026-09-23-nsin-merge.sql` keeps `nsin`, folds in the fuller description, and
  deletes `inc_nsin`. Neither had children. (Surfaced by the US audit below.)

## US deepening — fill the thin/empty US categories (data, 2026-09-23)
- **33 web-verified US organisations added** (`migrations/2026-09-23-us-expansion.sql`) to fix the
  genuinely thin/empty US pockets an audit surfaced: **military medical R&D** (USAMRDC/MRDC, WRAIR,
  USAMRIID, Naval Medical Research Command, DHA — was 1 node), **CBRN** (JPEO-CBRND, DEVCOM Chemical
  Biological Center — was 1), **microelectronics** (NSTC, Microelectronics Commons — was 2),
  **quantum** (QED-C — was 1), the **DEVCOM** command + its centers (Armaments, AvMC, C5ISR, GVSC,
  Soldier), the **Navy warfare-center network** (NSWC Dahlgren & Crane, NUWC, NAWCWD, NAVWAR),
  **intel S&T** (IARPA, NRO), **T&E** (DOT&E, White Sands, AEDC, Air Force Test Center), **cyber**
  (NSA/CSS, ARCYBER), and **DoD manufacturing (ManTech) institutes** (America Makes, ARM Institute)
  plus the graduate schools NPS & AFIT. Every URL verified on the day; dedupe-checked first
  (CDAO / NSIN / SpaceWERX already existed and were dropped). Homed in the existing `b_us` subtree.
- **Note on structure:** the US "empty higher categories" feeling is by design — the UK is the
  thematic spine (Strategy, Acquisition, Science/Tech/Innovation…); every other nation, incl. the US,
  is a country container with its own flatter structure (Departments · Labs & S&T · FFRDCs · Service
  units · Agencies · Primes · Scaleups · VC). No branch on the map is actually empty.

## Auto-maintainer: dedupe fix + auto-add web finds (2026-09-15)
- **Fixed a false-positive dedupe** that wrongly rejected real new organisations for "sharing 3
  letters." `findDupe` matched a short existing acronym label (SES, DIU, ADD…) as a substring of any
  find's name. Now it dedupes on **exact domain** (host equality / sub-parent) OR a **substantial
  name match** (identical, or whole-phrase containment where the shorter name is ≥12 chars and ≥2
  real words) — so acronym collisions no longer cause rejections.
- **Web finds now auto-add more.** They're already web-verified when drafted, so the publish gate
  uses a separate, lower bar `WEBFIND_MIN_CONFIDENCE` (default **0.7**, vs 0.85 for other new orgs) —
  verified, defence-relevant, reachable finds with valid tags get auto-published instead of piling up
  for manual review. Tunable lower if you want even more auto-added.

## Coverage sweep agent (2026-09-12)
- New gated `coverage-sweep` Edge Function runs the finder's web-search (the v2-taxonomy search
  that surfaces organisations not yet in the map) **systematically across every nation × technology
  category** (44 × 8 grid), deduping against the live map and writing new candidates to the
  `web_finds` review queue. **Resumable** via a cursor in `reference.sweep_cursor`. Read-only w.r.t.
  the live map; the daily auto-maintainer then verifies + stages/publishes what it surfaces.
  Orchestrated by `scripts/coverage-sweep-run.mjs` + `.github/workflows/coverage-sweep.yml`
  (bounded per run so cost stays controllable; opens an issue listing what surfaced).

## v4.10.0 — Simulation & modelling as a clear area (2026-09-23)
- **New dedicated technology category "Simulation, modelling & wargaming"** (`simulation` +
  `wargaming`) — previously `simulation` sat under Human & medical and `wargaming` under AI/autonomy,
  so the M&S area (56+21 orgs: CAE, Improbable, Hadean, NATO M&S CoE…) had no findable home. It's now
  its own category in the Technology lens and finder. Raised by the head of the UK Defence Simulation
  Centre. `TECH_TAX` + finder chips + docs/TAXONOMY.md updated.
- **Added the missing UK M&S governance bodies:** the **Defence Simulation Centre (DSC)** (the MOD's
  M&S "front door", DCMCI/Defence Academy, Strategic Command) and the **Defence Modelling & Simulation
  Office (DMSO)** (M&S technical/standards authority, JSP 939), under `b_sti`.
  `migrations/2026-09-23-simulation-modelling.sql`. Web-verified.

## v4.9.2 — Support call-out (2026-09-19)
- Added a "☕ Buy me a coffee" support call-out ([buymeacoffee.com/juliusdavit](https://www.buymeacoffee.com/juliusdavit))
  prominently on the home/welcome screen (below Enter) and persistently in the About panel — the map is
  free and independent; contributions go to running costs and further expansion.

## v4.9.1 — Ranked top search (2026-09-10)
- The top search bar highlighted every match (including broad synonym/description matches) and
  centred on the **first in iteration order**, so "DSTL" could land on NATO STO. Added
  `scoreNodeQuery`: exact id/serial (100) > whole-word/acronym in the name (90) > name substring
  (70) > website (50) > description (42) > synonyms only if nothing direct matched (≤28). The view
  now centres on the **best-scored** hit. Verified: "DSTL" → Dstl (100), NATO STO off the list.

## v4.9.0 — "Ask the guide" conversational assistant (2026-09-10)
- **A multi-turn AI guide** in the app (floating "💬 Ask the guide" → chat panel) that helps users
  **find the right door, understand how bodies relate, use the tool, and draft an approach**. Grounded
  in the map: each turn the client sends the conversation + a retrieved shortlist of relevant orgs +
  a branch/category overview; Claude answers from the mapped bodies and returns them as `[[id]]` refs
  the client renders as **clickable chips that focus the map**. **Map-first**, with a wider-web
  fallback (flagged unverified) when the map is thin.
- Public, **rate-limited** `guide` Edge Function (`claude-opus-5` + `web_search`, own `GUIDE_*` caps
  via `increment_rate`), **read-only** — no dataset writes, keys stay server-side. Same security model
  as Find your door. Starter questions seed first use; conversations aren't stored.

## v4.8.0 — Feedback attachments → agent drafts the node (2026-09-05)
- **Feedback can now carry a source link and an attached fact sheet** (PDF / image / text, ≤10 MB)
  so the maintainer's agent can build the right node from an authoritative source. Uploads go to a
  **private, size/type-limited Storage bucket** (`feedback-uploads`, anon upload-only, no public read);
  `migrations/2026-09-05-feedback-attachments.sql`.
- **Agent drafts, you review.** New gated `draft-from-source` Edge Function reads the attachment
  (as an untrusted document — facts only, instructions ignored) + the source link + message, verifies
  on the web with `claude-opus-5`, and proposes node fields into the drafter's Step 3. Surfaced in
  `admin-drafter.html` → Feedback: **🧩 Draft node from this** and **📎 View** (short-lived signed URL
  via `review-node` `feedback-attachment`). Nothing goes live unreviewed.
- Plain text feedback is unchanged and stays working even before the migration (the client only sends
  the new columns when used).
- **Drafter improvements:** loading a web find / gap suggestion now **auto-drafts the rest** — nation,
  type, TRL and description are inferred (not just name + URL), and seeded notes carry the find's
  context, so a new node starts from good information. `applyReply` writes the inferred nation/type/TRL
  back into Step 1. Added **NATO / EU / Multinational-joint** to the nation options (→ `b_nato` /
  `eu_inst` / `b_multi`, geo `nato`/`eu`, no country-prefixed label) so big joint bodies get a sensible
  parent. `draft-node` and the manual prompt now recognise those as a "nation".

## v4.7.1 — Fix black-on-black input text (2026-09-05)
- Several boxes (finder description, "search again" bars, modal fields) set `color:var(--ink)` — a
  near-black background token — so typed text was dark-on-dark. Now use `var(--txt)` + a theme-aware
  background; readable in dark, light and high-contrast.

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
