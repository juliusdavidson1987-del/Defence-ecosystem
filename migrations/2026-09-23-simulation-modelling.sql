-- ============================================================================
-- Simulation & modelling — add the missing UK M&S governance bodies flagged by
-- the head of the Defence Simulation Centre (the map had lots of M&S industry/
-- NATO orgs but not the UK MOD's own M&S "front door" or its standards authority).
-- Web-verified 2026-09-23. Run in the Supabase SQL editor, then sync. Idempotent.
--
-- Paired with a taxonomy change in index.html: `simulation` + `wargaming` now form
-- a dedicated "Simulation, modelling & wargaming" category so the area is findable.
-- ============================================================================
insert into public.nodes (id,label,parent,kind,does,entry,tags,status) values
 ('dsc','Defence Simulation Centre (DSC)','b_sti','org',
  'The MOD''s "front door" for modelling & simulation — a hub within the Defence College for Military Capability Integration (DCMCI) at the Defence Academy (Strategic Command) that enables access to, reuse and interoperability of M&S resources across Defence, via the Defence Simulation Centre Catalogue (DSCC) and the Synthetic Environment Service (SES). Enquiries: UKStratCom-DSC-Enquiries@mod.gov.uk.',
  'da.mod.uk',
  '{"w":["govmil","prime","sme"],"o":["advice","test"],"t":[1,9],"d":["simulation","wargaming"],"a":"restricted","g":"uk"}'::jsonb,'published'),
 ('dmso','Defence Modelling & Simulation Office (DMSO)','b_sti','org',
  'The MOD''s technical authority for modelling & simulation (Strategic Command) — owns Defence M&S policy and standards (JSP 939) and the M&S Standards Profile, driving coherence, reuse and interoperability across the Defence M&S enterprise.',
  'gov.uk',
  '{"w":["govmil"],"o":["advice"],"t":[1,9],"d":["simulation"],"a":"restricted","g":"uk"}'::jsonb,'published')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,does=excluded.does,entry=excluded.entry,tags=excluded.tags,status='published';
