-- ============================================================================
-- v4.12.2 — Organisation life cycles  (trust programme, phase 2b)  [ROBUST RE-RUN]
-- ----------------------------------------------------------------------------
-- Defence bodies get renamed, merged and dissolved constantly (DSME→Hanwha Ocean,
-- Improbable Defence→Skyral, the NAD restructure). This records life cycle as real
-- data so old names resolve in search and history survives. ADDITIVE ONLY.
--
-- NOTE: the Supabase SQL editor runs the whole script as ONE transaction — if any
-- statement errors, the entire script rolls back. The first version's former_names
-- backfill used an (?i) regex flag that substring() rejects, which rolled back the
-- column adds too. This version (a) drops (?i), and (b) wraps the backfill in an
-- exception handler so it can NEVER roll back the structural changes.
--
-- >>> Paste THIS fresh file into a clean SQL editor tab (don't re-run an old tab). <<<
-- Run (not just Save), then run the "Sync data.json from Supabase" Action. Idempotent.
--
--   lifecycle_status  active | renamed | merged | dissolved   (null = active)
--   successor_id      the node that supersedes this one (rename/merge target), nullable
--   former_names      jsonb array of prior names/aliases, for search resolution
-- ============================================================================

-- 1. Columns (cannot fail on a normal table) ----------------------------------
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

-- 3. Recreate published_nodes to expose the three columns. This mirrors the
--    provenance migration's recreate (which succeeded), with the life-cycle
--    columns appended. `status` stays excluded.
create or replace view public.published_nodes as
  select
    id, label, parent, "order", depth, kind, entry, does, tags, affiliation,
    entry_point, opps_override, funding, entity_type_override, source,
    origin, evidence_status, last_verified_at, verified_by, evidence_note,
    lifecycle_status, successor_id, former_names
  from public.nodes
  where status = 'published';

-- 4. Best-effort backfill of former_names from "(formerly X)" labels. Wrapped in
--    an exception handler: if it errors for ANY reason it is skipped with a notice,
--    and the structural changes above still commit. Matches "formerly"/"Formerly".
do $$
begin
  update public.nodes
     set former_names = to_jsonb(array[ trim(substring(label from '\([Ff]ormerly ([^)]+)\)')) ])
   where former_names is null
     and label ~ '\([Ff]ormerly [^)]+\)';
exception when others then
  raise notice 'former_names backfill skipped (non-fatal): %', sqlerrm;
end $$;

-- Verify (optional):
--   select id, label, former_names from public.nodes where former_names is not null order by id;
--   select count(*) from public.published_nodes;   -- confirms the view still resolves
