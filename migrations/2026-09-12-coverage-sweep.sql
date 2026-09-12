-- ============================================================================
-- Coverage sweep — verified per-nation additions (thinnest nations first).
-- Each entry is web-verified (real body + official site) and deduped against the
-- live map. Idempotent: safe to re-run. Run in the Supabase SQL editor, then sync.
-- Working down the ascending per-nation org counts.
-- ============================================================================

-- ── North Macedonia (mk) — was 10 orgs; already covers MoD, army, intel, Military
--    Academy + cyber institute, national CERT, and the 2 real domestic defence
--    firms (ATS, Eurokompozit). One verified gap: the national procurement bureau.
insert into public.nodes (id,label,parent,kind,does,entry,tags,status) values
 ('mk_ppb','North Macedonia — Public Procurement Bureau (PPB)','eu_central','org',
  'National public-procurement authority within the Ministry of Finance; runs the e-procurement portal (e-nabavki). State defence/security procurement is exempt from the general law and runs through the Ministry of Defence.',
  'bjn.gov.mk',
  '{"w":["prime","sme"],"o":["procurement"],"t":[1,9],"d":["xcut"],"a":"portal","g":"eu"}'::jsonb,'published')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,does=excluded.does,entry=excluded.entry,tags=excluded.tags,status='published';
