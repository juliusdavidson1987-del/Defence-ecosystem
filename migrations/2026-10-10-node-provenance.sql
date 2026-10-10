-- ============================================================================
-- v4.12.0 — Node provenance layer  (Phase 1 of the trust improvements)
-- ----------------------------------------------------------------------------
-- Adds an evidence record to every organisation node so an AI-drafted or
-- unverified entry is distinguishable from a maintainer-verified one — the core
-- defence against the "pollution effect" now that the auto-maintainer writes to
-- the DB daily. ADDITIVE ONLY: new nullable columns, no drop/rename/repurpose;
-- the existing affiliation layer, finder and every query keep working unchanged.
--
-- Run in the Supabase SQL editor (Run, not just Save), then run the
-- "Sync data.json from Supabase" GitHub Action. Idempotent — safe to re-run.
--
-- Columns (all nullable):
--   origin           how the entry got here: curated | community | ai_drafted | auto_maintainer | manual
--   evidence_status  verified | unverified | ai_drafted
--   last_verified_at the date the facts were last checked (date)
--   verified_by      who checked them (free text / handle)
--   evidence_note    one-line note on what was verified
-- (The existing `source` column already holds the source/official URL — reused,
--  not duplicated.)
-- ============================================================================

-- 1. Columns ------------------------------------------------------------------
alter table public.nodes add column if not exists origin           text;
alter table public.nodes add column if not exists evidence_status  text;
alter table public.nodes add column if not exists last_verified_at date;
alter table public.nodes add column if not exists verified_by      text;
alter table public.nodes add column if not exists evidence_note    text;

-- 2. Constrain the vocab (nulls allowed). Guarded so re-runs don't error. ------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nodes_evidence_status_chk') then
    alter table public.nodes add constraint nodes_evidence_status_chk
      check (evidence_status is null or evidence_status in ('verified','unverified','ai_drafted'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nodes_origin_chk') then
    alter table public.nodes add constraint nodes_origin_chk
      check (origin is null or origin in ('curated','community','ai_drafted','auto_maintainer','manual'));
  end if;
end $$;

-- 3. Backfill a baseline origin for existing published entries. Leave
--    evidence_status NULL (= "not recorded") rather than falsely stamping 2,000
--    legacy rows "unverified"; the app treats a plain curated entry neutrally
--    and reserves the ⚠ badge for ai_drafted. Only touches NULL rows.
update public.nodes
   set origin = 'curated'
 where origin is null
   and status = 'published';

-- 4. Expose the new columns through the published_nodes view. --------------------
--    Reproduces the view's CURRENT column list EXACTLY (confirmed against the live
--    API on 2026-10-10) and appends the five provenance columns. `status` stays
--    excluded as before. If your live view differs (CREATE OR REPLACE will error
--    on a column mismatch), run  select pg_get_viewdef('public.published_nodes'::regclass, true);
--    and reconcile before applying this block.
create or replace view public.published_nodes as
  select
    id, label, parent, "order", depth, kind, entry, does, tags, affiliation,
    entry_point, opps_override, funding, entity_type_override, source,
    origin, evidence_status, last_verified_at, verified_by, evidence_note
  from public.nodes
  where status = 'published';

-- Done. Sanity check (optional):
--   select origin, evidence_status, count(*) from public.nodes group by 1,2 order by 3 desc;
