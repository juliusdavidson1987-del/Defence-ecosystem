-- ============================================================================
-- US depth + bucket polish — make the still-light US Alliance-lens buckets
-- believable (frontline, science, test, supply) and fix two funcForOrg keyword
-- edge-cases (accented "école" -> France schools; "counter-UAS" -> Moog).
--
-- Re-homes 4 US orgs mis-filed in Industry, adds 14 web-verified US bodies, and
-- reroutes the 4 French schools to Academia + Moog to Supply.
-- Web-verified + dedupe-checked 2026-09-23. Idempotent. Run in Supabase, then sync.
-- ============================================================================

-- 1) Re-home US orgs stuck in Industry (drop audience-'prime'/'startup') ---------
update public.nodes set tags = jsonb_set(tags,'{w}', (tags->'w') - 'prime')            where id='afc';    -- -> frontline
update public.nodes set tags = jsonb_set(tags,'{w}', (tags->'w') - 'prime' - 'startup') where id='us_socom'; -- -> frontline
update public.nodes set tags = jsonb_set(tags,'{w}', (tags->'w') - 'prime')            where id='rccto';  -- -> innovation
update public.nodes set tags = jsonb_set(tags,'{w}', (tags->'w') - 'prime')            where id='aal';    -- -> science

-- 2) France schools -> Academia (accent-safe wording), Moog -> Supply -----------
update public.nodes set does='France''s foremost engineering grande école and a founding member of the Institut Polytechnique de Paris research university; trains armament-corps engineers and conducts defence-relevant research.' where id='fr_polytechnique';
update public.nodes set does='France''s leading aerospace engineering grande école — a research university overseen by the Ministry of the Armed Forces (DGA); trains armament-corps engineers and researches aerospace, space and defence systems.' where id='fr_isae';
update public.nodes set does='An engineering grande école of the Institut Polytechnique de Paris research university, with a Defence & Security programme spanning naval, systems, AI and cyber engineering.' where id='fr_ensta';
update public.nodes set does='A public research university federating France''s leading engineering grandes écoles (École Polytechnique, ENSTA, ENSAE, Télécom Paris and others) with an interdisciplinary Defence & Security research centre.' where id='fr_ip_paris';
update public.nodes set does='US specialist supplier of precision motion-control and actuation subsystems to defence primes — for vehicles, weapon stations, munitions and space systems.' where id='us_moog';

-- 3) NEW — Front-line commands & experimentation -------------------------------
insert into public.nodes (id,label,parent,kind,does,entry,tags,status) values
 ('us_indopacom','US Indo-Pacific Command (INDOPACOM)','us_departments','org',
  'The US combatant command responsible for military forces and operations across the Indo-Pacific theatre (Honolulu) — the priority theatre driving allied capability demand.',
  'pacom.mil',
  '{"w":["govmil"],"o":["advice"],"t":[7,9],"d":["xcut"],"a":"restricted","g":"us"}'::jsonb,'published'),
 ('us_nwdc','Navy Warfare Development Command (NWDC)','us_departments','org',
  'The US Navy command that develops warfighting concepts and doctrine for the fleet (Norfolk).',
  'nwdc.navy.mil',
  '{"w":["govmil"],"o":["advice"],"t":[6,9],"d":["maritime"],"a":"restricted","g":"us"}'::jsonb,'published')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,does=excluded.does,entry=excluded.entry,tags=excluded.tags,status='published';

-- 4) NEW — Test, evaluation & ranges (ATEC & Navy centres) ----------------------
insert into public.nodes (id,label,parent,kind,does,entry,tags,status) values
 ('us_yuma','Yuma Proving Ground (YPG)','us_labs','org',
  'US Army natural-environment test range (Arizona) under ATEC — developmental testing of vehicles, artillery, munitions and air-delivery systems in desert conditions.',
  'yuma.army.mil',
  '{"w":["govmil"],"o":["test"],"t":[5,9],"d":["land","xtest"],"a":"restricted","g":"us"}'::jsonb,'published'),
 ('us_nawcad','Naval Air Warfare Center Aircraft Division (NAWCAD)','us_labs','org',
  'The US Navy''s research, development, test and evaluation centre for naval aircraft and airborne systems (Patuxent River).',
  'navair.navy.mil/nawcad',
  '{"w":["govmil"],"o":["test"],"t":[4,9],"d":["air","xtest"],"a":"restricted","g":"us"}'::jsonb,'published'),
 ('us_aberdeen','Aberdeen Test Center (ATC)','us_labs','org',
  'The US Army''s principal developmental test centre for ground combat and support systems (Aberdeen Proving Ground) under ATEC.',
  'atec.army.mil',
  '{"w":["govmil"],"o":["test"],"t":[5,9],"d":["land","xtest"],"a":"restricted","g":"us"}'::jsonb,'published'),
 ('us_redstonetest','Redstone Test Center (RTC)','us_labs','org',
  'The US Army''s test centre for aviation, missiles and sensors (Redstone Arsenal) under ATEC.',
  'atec.army.mil',
  '{"w":["govmil"],"o":["test"],"t":[5,9],"d":["air","weapons","xtest"],"a":"restricted","g":"us"}'::jsonb,'published')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,does=excluded.does,entry=excluded.entry,tags=excluded.tags,status='published';

-- 5) NEW — Science (research funders & dual-use national labs) ------------------
insert into public.nodes (id,label,parent,kind,does,entry,tags,status) values
 ('us_aro','Army Research Office (ARO)','us_labs','org',
  'The US Army''s extramural basic-research funding agency (part of DEVCOM ARL) — sponsors university and industry research to secure long-term technological advantage.',
  'arl.devcom.army.mil',
  '{"w":["govmil","academic"],"o":["research"],"t":[1,4],"d":["xacad"],"a":"open","g":"us"}'::jsonb,'published'),
 ('us_afosr','Air Force Office of Scientific Research (AFOSR)','us_labs','org',
  'The US Air Force''s basic-research funding office (part of AFRL) — manages the Air Force''s extramural science programme across academia and industry.',
  'afrl.af.mil/AFOSR',
  '{"w":["govmil","academic"],"o":["research"],"t":[1,4],"d":["xacad"],"a":"open","g":"us"}'::jsonb,'published'),
 ('us_ornl','Oak Ridge National Laboratory (ORNL)','us_labs','org',
  'A US Department of Energy multipurpose national laboratory (Oak Ridge, TN) with major national-security research in advanced materials, high-performance computing and sensing.',
  'ornl.gov',
  '{"w":["govmil","academic"],"o":["research"],"t":[1,7],"d":["materials","microelec"],"a":"restricted","g":"us"}'::jsonb,'published'),
 ('us_pnnl','Pacific Northwest National Laboratory (PNNL)','us_labs','org',
  'A US Department of Energy national laboratory (Richland, WA) with national-security research in nonproliferation, CBRN detection, materials and computing.',
  'pnnl.gov',
  '{"w":["govmil","academic"],"o":["research"],"t":[1,7],"d":["cbrn","materials"],"a":"restricted","g":"us"}'::jsonb,'published')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,does=excluded.does,entry=excluded.entry,tags=excluded.tags,status='published';

-- 6) NEW — Industry supply chain & specialists ---------------------------------
insert into public.nodes (id,label,parent,kind,does,entry,tags,entity_type_override,status) values
 ('us_caes','CAES (Cobham Advanced Electronic Solutions)','us_midtier','org',
  'US supplier of RF, microwave and electronic-warfare electronic subsystems to defence primes (Arlington, VA).',
  'caes.com',
  '{"w":["sme"],"o":["product","contract"],"t":[6,9],"d":["ew","microelec"],"a":"prime","g":"us"}'::jsonb,'industry','published'),
 ('us_parsons','Parsons Corporation','us_midtier','org',
  'US provider of engineering, infrastructure and cyber and defence services to government customers.',
  'parsons.com',
  '{"w":["sme"],"o":["contract","product"],"t":[6,9],"d":["cyber","logistics"],"a":"prime","g":"us"}'::jsonb,'industry','published')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,does=excluded.does,entry=excluded.entry,tags=excluded.tags,entity_type_override=excluded.entity_type_override,status='published';
