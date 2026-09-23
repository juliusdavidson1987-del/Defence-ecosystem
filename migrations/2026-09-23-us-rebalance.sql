-- ============================================================================
-- US rebalance — fix mis-bucketed nodes + fill the two EMPTY Alliance-lens
-- buckets (Academia & Research; Industry — supply chain).
--
-- Root cause: the US-expansion nodes were tagged w:['prime'] meaning "serves
-- primes", but funcForOrg() reads w:['prime'] as "IS a prime" and files them under
-- Industry. Gov/lab/test bodies must NOT carry 'prime' in w (that signal is for
-- actual industry primes). This drops the audience-'prime' and sets entity_type so
-- each lands in the right bucket, then adds real Academia and Supply-chain orgs.
--
-- Web-verified + dedupe-checked 2026-09-23. Idempotent. Run in Supabase, then sync.
-- ============================================================================

-- 1) Research labs / RTOs -> 'rto' (drop audience-'prime', set entity_type=research)
update public.nodes set entity_type_override='research',
  tags = jsonb_set(tags, '{w}', (tags->'w') - 'prime')
where id in (
  'us_devcom','us_devcom_ac','us_devcom_avmc','us_devcom_c5isr','us_devcom_cbc',
  'us_devcom_gvsc','us_devcom_sc','us_nswc_dahlgren','us_nswc_crane','us_nuwc',
  'us_nawcwd','us_usamrdc','us_wrair','us_usamriid','us_nmrc','us_nstc',
  'us_microcommons','us_qedc','us_americamakes','us_arm','dsc'
);

-- 2) Intelligence/cyber/space, T&E ranges, and acquisition -> drop 'prime' so
--    funcForOrg buckets them by domain/offer (intel / test / procurement)
update public.nodes set tags = jsonb_set(tags, '{w}', (tags->'w') - 'prime')
where id in (
  'us_navwar','us_nro','us_nsa','us_arcyber',   -- -> intel (via d: cyber/space)
  'us_wsmr','us_aedc','us_aftc',                 -- -> test (via o: test)
  'us_jpeocbrnd'                                 -- -> procurement (via o: procurement)
);
-- JPEO-CBRND: reword does so the word 'nuclear' (spelled out in CBRN) doesn't route
-- it to the Nuclear bucket; it is an acquisition PEO -> procurement.
update public.nodes set does='The Joint Services'' lead program executive office for developing, acquiring and fielding CBRN defence equipment and medical countermeasures for the joint force.' where id='us_jpeocbrnd';

-- 3) Federal graduate schools -> 'academia' (entity_type=research + school keyword)
update public.nodes set entity_type_override='research' where id='us_nps';
update public.nodes set entity_type_override='research',
  does='The US Air Force''s graduate university of engineering and management (Wright-Patterson AFB), collocated with the Air Force Research Laboratory.'
where id='us_afit';

-- 4) NEW — Academia & research (bucket was empty) ---------------------------
insert into public.nodes (id,label,parent,kind,does,entry,tags,entity_type_override,status) values
 ('us_ndu','National Defense University (NDU)','us_ffrdc','org',
  'The US Department of Defense''s senior joint professional military education university (Washington, DC) — degree-granting graduate colleges for military officers and defence civilians.',
  'ndu.edu',
  '{"w":["govmil","academic"],"o":["research","advice"],"t":[1,6],"d":["xacad"],"a":"open","g":"us"}'::jsonb,'research','published'),
 ('us_navalwarcollege','US Naval War College (NWC)','us_ffrdc','org',
  'The US Navy''s senior graduate war college (Newport, Rhode Island) — professional military education and the home of US Navy wargaming, taught since 1887.',
  'usnwc.edu',
  '{"w":["govmil","academic"],"o":["research","advice"],"t":[1,6],"d":["xacad","wargaming"],"a":"open","g":"us"}'::jsonb,'research','published'),
 ('us_armywarcollege','US Army War College (AWC)','us_ffrdc','org',
  'The US Army''s senior graduate war college (Carlisle, Pennsylvania) — professional military education and defence-focused graduate research on landpower.',
  'armywarcollege.edu',
  '{"w":["govmil","academic"],"o":["research","advice"],"t":[1,6],"d":["xacad"],"a":"open","g":"us"}'::jsonb,'research','published'),
 ('us_airuniversity','Air University','us_ffrdc','org',
  'The US Air Force''s university for professional military education and research (Maxwell AFB), including the Air War College and its associated research centres.',
  'airuniversity.af.edu',
  '{"w":["govmil","academic"],"o":["research","advice"],"t":[1,6],"d":["xacad"],"a":"open","g":"us"}'::jsonb,'research','published')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,
  does=excluded.does,entry=excluded.entry,tags=excluded.tags,entity_type_override=excluded.entity_type_override,status='published';

-- 5) NEW — Industry supply chain & specialists (bucket was empty) -----------
--    Tier-2/3 suppliers: entity_type=industry + w without 'prime' -> 'supply'.
insert into public.nodes (id,label,parent,kind,does,entry,tags,entity_type_override,status) values
 ('us_moog','Moog Inc.','us_midtier','org',
  'US specialist supplier of precision motion-control and actuation subsystems to defence primes, spanning vehicles, weapon stations, counter-UAS and space.',
  'moog.com',
  '{"w":["sme"],"o":["product","contract"],"t":[6,9],"d":["land","directed"],"a":"prime","g":"us"}'::jsonb,'industry','published'),
 ('us_curtisswright','Curtiss-Wright Corporation','us_midtier','org',
  'US supplier of rugged embedded electronics, sensors and flow-control subsystems to defence primes and naval programmes.',
  'curtisswright.com',
  '{"w":["sme"],"o":["product","contract"],"t":[6,9],"d":["c4isr","maritime"],"a":"prime","g":"us"}'::jsonb,'industry','published'),
 ('us_mercury','Mercury Systems','us_midtier','org',
  'US supplier of secure embedded processing and trusted microelectronics subsystems to defence primes and the US government.',
  'mrcy.com',
  '{"w":["sme"],"o":["product","contract"],"t":[6,9],"d":["microelec","c4isr"],"a":"prime","g":"us"}'::jsonb,'industry','published'),
 ('us_ducommun','Ducommun Incorporated','us_midtier','org',
  'US supplier of engineered structures and electronic subsystems to defence and aerospace primes.',
  'ducommun.com',
  '{"w":["sme"],"o":["product","contract"],"t":[6,9],"d":["materials","c4isr"],"a":"prime","g":"us"}'::jsonb,'industry','published'),
 ('us_heico','HEICO Corporation','us_midtier','org',
  'US supplier of aftermarket components, subsystems and electronics to defence and aerospace primes.',
  'heico.com',
  '{"w":["sme"],"o":["product","contract"],"t":[6,9],"d":["c4isr","materials"],"a":"prime","g":"us"}'::jsonb,'industry','published'),
 ('us_transdigm','TransDigm Group','us_midtier','org',
  'US supplier of engineered aerospace components and subsystems to defence and commercial primes.',
  'transdigm.com',
  '{"w":["sme"],"o":["product","contract"],"t":[6,9],"d":["materials","air"],"a":"prime","g":"us"}'::jsonb,'industry','published')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,
  does=excluded.does,entry=excluded.entry,tags=excluded.tags,entity_type_override=excluded.entity_type_override,status='published';
