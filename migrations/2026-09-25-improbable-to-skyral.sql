-- ============================================================================
-- Correction (from James Pryor feedback, web-verified 2026-09-25): "Improbable
-- Defence" is now the independent company **Skyral** (skyral.com) — the core
-- modelling & simulation provider in Team Omnia (Raytheon UK-led) delivering the
-- British Army Collective Training Service (ACTS). Keep the stable id; relabel,
-- fix the URL and refresh the description. Idempotent. Run in Supabase, then sync.
-- ============================================================================
update public.nodes set
  label='Skyral (formerly Improbable Defence)',
  entry='skyral.com',
  does='UK modelling, simulation and synthetic-environment company — the former Improbable Defence UK, now independent as Skyral; the core M&S technology provider in Team Omnia (Raytheon UK-led) delivering the British Army Collective Training Service (ACTS).'
where id='improbable';
