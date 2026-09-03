-- ============================================================================
-- Reword contextual DASA mentions -> "UKDI (formerly DASA)" now that UKDI has
-- absorbed DASA. Uses targeted replace() so it's safe and idempotent (a second
-- run is a no-op). Leaves the ukdi/na_innov/dasa/dstl nodes, which are already
-- correctly framed. Run in Supabase, then re-sync.
-- ============================================================================

-- "via UKDI/DASA" (parallel-routes phrasing) -> "via UKDI (formerly DASA)"
update public.nodes set opps_override = replace(opps_override, 'UKDI/DASA', 'UKDI (formerly DASA)')
 where id in ('daic','dcto','fcg','jhub','rafrco');

update public.nodes set entry = replace(entry, 'UKDI/DASA', 'UKDI (formerly DASA)')
 where id in ('anduril','helsing');

-- standalone contextual mentions
update public.nodes set does = replace(does, 'a DASA customer', 'a UKDI (formerly DASA) customer')
 where id = 'ho';

update public.nodes set does = replace(does, 'for DASA and NCSC', 'for UKDI (formerly DASA) and NCSC')
 where id = 'inc_plexal';
