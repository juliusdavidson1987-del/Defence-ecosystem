-- ============================================================================
-- v4.12.2 — Organisation life cycles  (trust programme, phase 2b)
-- ----------------------------------------------------------------------------
-- Defence bodies get renamed, merged and dissolved constantly (DSME→Hanwha Ocean,
-- Improbable Defence→Skyral, the NAD restructure). Today that history lives only
-- in the label text ("Skyral (formerly Improbable Defence)"), so a search for the
-- OLD name can miss. This records life cycle as real data so old names resolve and
-- history survives. ADDITIVE ONLY — nullable columns, no drop/rename.
--
-- Run in the Supabase SQL editor (Run), then the Sync action. Idempotent.
--
--   lifecycle_status  active | renamed | merged | dissolved   (null = active)
--   successor_id      the node that supersedes this one (rename/merge target), nullable
--   former_names      jsonb array of prior names/aliases, for search resolution
-- ============================================================================

-- 1. Columns ------------------------------------------------------------------
alter table public.nodes add column if not exists lifecycle_status text;
alter table public.nodes add column if not exists successor_id     text;
alter table public.nodes add column if not exists former_names     jsonb;

-- 2. Constrain lifecycle_status (nulls allowed). Guarded for re-runs. ----------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nodes_lifecycle_status_chk') then
    alter table public.nodes add constraint nodes_lifecycle_status_chk
      check (lifecycle_status is null or lifecycle_status in ('active','renamed','merged','dissolved'));
  end if;
end $$;

-- 3. Backfill former_names deterministically from the "(formerly X)" labels.
--    Only touches rows with that pattern and no former_names yet. Matches "formerly"
--    or "Formerly" via [Ff] (NOT the (?i) flag — Postgres substring() rejects it, which
--    rolled the whole migration back the first time). WHERE and extraction use the same
--    pattern so a matched row always yields a value.
update public.nodes
   set former_names = to_jsonb(array[ trim(substring(label from '\([Ff]ormerly ([^)]+)\)')) ])
 where former_names is null
   and label ~ '\([Ff]ormerly [^)]+\)';

-- 4. Recreate published_nodes to expose the three new columns. Reproduces the
--    CURRENT column list (confirmed against the live API 2026-10-10, incl. the
--    provenance columns) and appends the life-cycle columns. `status` stays out.
create or replace view public.published_nodes as
  select
    id, label, parent, "order", depth, kind, entry, does, tags, affiliation,
    entry_point, opps_override, funding, entity_type_override, source,
    origin, evidence_status, last_verified_at, verified_by, evidence_note,
    lifecycle_status, successor_id, former_names
  from public.nodes
  where status = 'published';

-- Done. Check the backfill (optional):
--   select id, label, former_names from public.nodes where former_names is not null order by id;
