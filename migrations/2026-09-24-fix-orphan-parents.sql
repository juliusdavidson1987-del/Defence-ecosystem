-- ============================================================================
-- Fix orphaned/invalid parents that were breaking the nightly validator
-- (and therefore the "Sync data.json" and "Auto-maintainer" GitHub Actions since
-- 2026-09-21). Three nodes were auto-added with bad parents:
--   * Beaten Zone Venture Partners -> parent 'nat_au_capital' (a SYNTHETIC runtime
--     gateway id, not a real node) — an Australian defence VC.
--   * Business Finland -> parent null.
--   * Marduk Technologies -> parent null.
-- Reparent each to its real national container. Idempotent. Run in Supabase, then sync.
-- ============================================================================
update public.nodes set parent='au_grp'    where id='sub-beaten-zone-venture-part';   -- Australia
update public.nodes set parent='eu_nordic' where id='fi_finlandbusinessfinland';       -- Finland (Nordics)
update public.nodes set parent='eu_baltic' where id='ee_estoniamarduktechnolog';       -- Estonia (Baltic states)
