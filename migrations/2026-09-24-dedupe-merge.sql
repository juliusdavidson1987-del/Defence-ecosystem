-- ============================================================================
-- Merge duplicate organisations found in the integrity sweep — the same body had
-- been entered more than once (usually once as a UK/global node and again as a
-- national node during a country build). Keep the canonical id (the one referenced
-- in the app's CONNECTORS list, or the correct-nation node), delete the rest.
-- All duplicates are childless, so nothing is orphaned. Idempotent. Run in Supabase, then sync.
--
-- NOTE: RR / BAE / MBDA / Lockheed / DIANA "duplicates" on a shared domain are
-- legitimately DISTINCT divisions or national entities and are left as-is.
-- ============================================================================

-- RUSI was in three places (b_cat, b_trade, b_policy). Keep 'rusi' (referenced in
-- CONNECTORS) and move it to the policy branch where a think tank belongs.
update public.nodes set parent='b_policy' where id='rusi';
delete from public.nodes where id in ('rusi2','pol_rusi');

-- Make UK Defence twice. Keep 'makeuk' (in CONNECTORS), home it under trade bodies.
update public.nodes set parent='b_trade' where id='makeuk';
delete from public.nodes where id='makeukdef';

-- Keep the canonical / correct-nation node, drop the duplicate:
--   Quantum Systems (German)   -> keep de_quantum,      drop quantumsys
--   Tekever (Portuguese)       -> keep pt_tekever,      drop tekever
--   NATO Innovation Fund       -> keep natofund (CONNECTORS), drop nato_nif_ref
--   Decisive Point (US VC)     -> keep us_decisivepoint, drop decisivepoint
--   Plexal                     -> keep plexal (CONNECTORS),   drop inc_plexal
--   Starburst Aerospace        -> keep starburst (CONNECTORS), drop inc_starburst
delete from public.nodes where id in ('quantumsys','tekever','nato_nif_ref','decisivepoint','inc_plexal','inc_starburst');
