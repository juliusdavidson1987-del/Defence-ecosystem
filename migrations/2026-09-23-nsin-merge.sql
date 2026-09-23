-- ============================================================================
-- Fold the duplicate NSIN nodes into one.
--
-- NSIN (National Security Innovation Network) was in the map twice:
--   * `nsin`     — under `us_diu_grp` (United States -> DIU network), properly tagged.
--   * `inc_nsin` — under `b_incubators` (Dual-Use Incubators & Accelerators), tags NULL
--                  (a latent bug: a US org with no `g` tag defaults to UK in the finder).
-- NSIN is organisationally part of DIU, so `nsin` is the accurate home. Keep it, fold in
-- the fuller description from `inc_nsin`, and delete `inc_nsin`.
--
-- Neither node has children, so nothing is orphaned. Idempotent.
-- Run in the Supabase SQL editor, then run the "Sync data.json" action.
-- (The embedded last-resort fallback in index.html still lists inc_nsin; that snapshot
--  is only used if both Supabase and data.json fail to load, so it is left untouched.)
-- ============================================================================

update public.nodes set
  does = 'The US Department of Defense''s innovation network (part of the Defense Innovation Unit) that connects the department to universities and early-stage founders to build defence-technology talent and ventures.'
where id = 'nsin';

delete from public.nodes where id = 'inc_nsin';
