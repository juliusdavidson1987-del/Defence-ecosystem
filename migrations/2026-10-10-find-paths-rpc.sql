-- ============================================================================
-- v4.13.0 — Path-finding RPC  (relationship stage D; for UNITI / external use)
-- ----------------------------------------------------------------------------
-- A server-side twin of the app's JS path-finder: given two node ids it returns the
-- simple paths between them (undirected walk over the relationship edges, cycle-
-- prevented, bounded), ranked shortest-first then most-verified. The app itself uses
-- the in-browser JS version; this RPC lets UNITI (or any client) query paths with the
-- public anon key. Read-only, STABLE. Semantics match the JS exactly so a parity test
-- (scripts/path-parity-test.mjs) can confirm they agree.
--
-- Run in the Supabase SQL editor (Run). Idempotent (create or replace).
--
--   select * from find_paths('albionvc','amadeuscap');            -- all defaults
--   select * from find_paths('x','y', 4, true, array['member_of']); -- bounded/filtered
-- ============================================================================

create or replace function public.find_paths(
  from_id       text,
  to_id         text,
  max_hops      int     default 4,
  current_only  boolean default false,
  allowed_types text[]  default null
)
returns table(hops int, path text[], types text[], verified_hops int, edge_ids uuid[])
language sql stable as $$
  with recursive undirected as (
    -- each edge is traversable in both directions (navigational, like the app)
    select source_node_id as a, target_node_id as b, relationship_type as ty, id, evidence_status, valid_to, last_verified_at from public.relationships
    union all
    select target_node_id as a, source_node_id as b, relationship_type as ty, id, evidence_status, valid_to, last_verified_at from public.relationships
  ),
  walk as (
    select from_id as node, array[from_id] as path, array[]::text[] as types,
           0 as hops, array[]::uuid[] as edge_ids, 0 as verified_hops
    union all
    select u.b, w.path || u.b, w.types || u.ty, w.hops + 1, w.edge_ids || u.id,
           w.verified_hops + (case when u.evidence_status = 'verified' then 1 else 0 end)
    from walk w
    join undirected u on u.a = w.node
    where w.hops < max_hops
      and not (u.b = any(w.path))                                   -- cycle prevention
      and (allowed_types is null or u.ty = any(allowed_types))
      and (not current_only or (
             (u.valid_to is null or u.valid_to > now()::date)       -- not expired
         and (u.last_verified_at is null or u.last_verified_at > (now()::date - interval '12 months')) -- not known-stale (undated passes, as in the app)
      ))
  )
  select hops, path, types, verified_hops, edge_ids
  from walk
  where node = to_id and hops >= 1
  order by hops asc, verified_hops desc, path
  limit 20;
$$;

-- Callable with the public anon key (read-only).
grant execute on function public.find_paths(text, text, int, boolean, text[]) to anon, authenticated;

-- Quick check (optional):
--   select hops, path from find_paths('albionvc','amadeuscap');
