-- ============================================================================
-- US nuclear enterprise + acquisition build-out. The US "Nuclear enterprise"
-- bucket held only LANL, a messy combined "Sandia/LANL/Livermore" node, and a
-- mis-tagged quantum firm (Infleqtion). This builds the real complex and adds the
-- major acquisition commands. All tagged so funcForOrg() buckets them correctly
-- (nuclear via d:['nuclear']; procurement via o:['procurement']; NO audience-'prime').
--
-- Web-verified + dedupe-checked 2026-09-23. Idempotent. Run in Supabase, then sync.
-- ============================================================================

-- 1) Repurpose the combined catch-all node into proper Sandia National Laboratories
update public.nodes set
  label='Sandia National Laboratories (SNL)',
  does='NNSA laboratory and the engineering arm of the US nuclear-weapons enterprise — systems engineering and the non-nuclear components of the stockpile (Albuquerque, NM and Livermore, CA).',
  entry='sandia.gov',
  tags='{"w":["govmil","academic"],"o":["research"],"t":[1,9],"d":["nuclear","microelec"],"a":"restricted","g":"us"}'::jsonb,
  entity_type_override=null, status='published'
where id='sandia';

-- 2) Un-mis-tag Infleqtion (a cold-atom QUANTUM company, wrongly in 'nuclear' via
--    the word "atomic") -> route to defence-tech by marking it as industry.
update public.nodes set entity_type_override='industry' where id='infleqtion';

-- 3) Nuclear enterprise (NNSA labs, plants, sites; naval propulsion; commands) ---
insert into public.nodes (id,label,parent,kind,does,entry,tags,status) values
 ('us_nnsa','National Nuclear Security Administration (NNSA)','us_govagencies','org',
  'The Department of Energy''s semi-autonomous agency that maintains the US nuclear-weapons stockpile and runs the nuclear security enterprise of labs, plants and sites.',
  'nnsa.energy.gov',
  '{"w":["govmil"],"o":["research","procurement"],"t":[1,9],"d":["nuclear"],"a":"restricted","g":"us"}'::jsonb,'published'),
 ('us_llnl','Lawrence Livermore National Laboratory (LLNL)','us_labs','org',
  'NNSA nuclear-weapons design and science laboratory (Livermore, CA), home to the National Ignition Facility and broad national-security research.',
  'llnl.gov',
  '{"w":["govmil","academic"],"o":["research"],"t":[1,9],"d":["nuclear"],"a":"restricted","g":"us"}'::jsonb,'published'),
 ('us_pantex','Pantex Plant','us_labs','org',
  'NNSA production plant (Amarillo, TX) — assembly, disassembly, high-explosives work and life-extension of US nuclear weapons.',
  'pantex.energy.gov',
  '{"w":["govmil"],"o":["product"],"t":[6,9],"d":["nuclear"],"a":"restricted","g":"us"}'::jsonb,'published'),
 ('us_y12','Y-12 National Security Complex','us_labs','org',
  'NNSA production complex (Oak Ridge, TN) — the sole source of enriched-uranium nuclear-weapon components and of naval reactor fuel.',
  'y12.doe.gov',
  '{"w":["govmil"],"o":["product"],"t":[6,9],"d":["nuclear"],"a":"restricted","g":"us"}'::jsonb,'published'),
 ('us_kcnsc','Kansas City National Security Campus (KCNSC)','us_labs','org',
  'NNSA campus (Kansas City, MO) producing around 80% of the non-nuclear components of the US nuclear stockpile — electronics, mechanisms and engineered materials.',
  'kcnsc.doe.gov',
  '{"w":["govmil"],"o":["product"],"t":[6,9],"d":["nuclear","microelec"],"a":"restricted","g":"us"}'::jsonb,'published'),
 ('us_nnss','Nevada National Security Site (NNSS)','us_labs','org',
  'NNSA site (Nye County, NV) for subcritical nuclear experiments and stockpile-stewardship research supporting the US deterrent.',
  'nnss.gov',
  '{"w":["govmil"],"o":["research","test"],"t":[3,9],"d":["nuclear"],"a":"restricted","g":"us"}'::jsonb,'published'),
 ('us_srs','Savannah River Site (SRS)','us_labs','org',
  'NNSA/DOE site (Aiken, SC) responsible for tritium production and nuclear-materials work supporting the US nuclear deterrent.',
  'srs.gov',
  '{"w":["govmil"],"o":["product","research"],"t":[4,9],"d":["nuclear"],"a":"restricted","g":"us"}'::jsonb,'published'),
 ('us_navalreactors','Naval Nuclear Propulsion Program (Naval Reactors)','us_labs','org',
  'The joint US Navy/NNSA programme (Washington Navy Yard) that designs and sustains naval nuclear propulsion and oversees the Naval Nuclear Laboratory.',
  'energy.gov/nnsa/powering-navy',
  '{"w":["govmil"],"o":["research"],"t":[3,9],"d":["nuclear","maritime"],"a":"restricted","g":"us"}'::jsonb,'published'),
 ('us_afnwc','Air Force Nuclear Weapons Center (AFNWC)','us_labs','org',
  'The US Air Force''s centre for nuclear-systems acquisition and sustainment (Kirtland AFB) — ICBMs, nuclear-capable bombers and nuclear command, control and communications.',
  'afnwc.af.mil',
  '{"w":["govmil"],"o":["procurement","product"],"t":[4,9],"d":["nuclear"],"a":"restricted","g":"us"}'::jsonb,'published'),
 ('us_stratcom','US Strategic Command (USSTRATCOM)','us_departments','org',
  'The US combatant command responsible for strategic deterrence and the nuclear triad (Offutt AFB).',
  'stratcom.mil',
  '{"w":["govmil"],"o":["advice"],"t":[6,9],"d":["nuclear"],"a":"restricted","g":"us"}'::jsonb,'published'),
 ('us_afgsc','Air Force Global Strike Command (AFGSC)','us_departments','org',
  'The US Air Force command for intercontinental ballistic missiles and nuclear-capable bombers (Barksdale AFB).',
  'afgsc.af.mil',
  '{"w":["govmil"],"o":["advice"],"t":[6,9],"d":["nuclear"],"a":"restricted","g":"us"}'::jsonb,'published')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,
  does=excluded.does,entry=excluded.entry,tags=excluded.tags,status='published';

-- 4) Major acquisition / systems commands -> 'procurement' bucket --------------
insert into public.nodes (id,label,parent,kind,does,entry,tags,status) values
 ('us_navsea','Naval Sea Systems Command (NAVSEA)','us_govagencies','org',
  'The US Navy''s largest systems command — engineers, buys and maintains the fleet''s ships, submarines and combat systems.',
  'navsea.navy.mil',
  '{"w":["govmil","sme","startup"],"o":["procurement"],"t":[6,9],"d":["maritime"],"a":"portal","g":"us"}'::jsonb,'published'),
 ('us_navair','Naval Air Systems Command (NAVAIR)','us_govagencies','org',
  'The US Navy''s systems command for naval aviation — acquires and sustains aircraft, weapons and related systems.',
  'navair.navy.mil',
  '{"w":["govmil","sme","startup"],"o":["procurement"],"t":[6,9],"d":["air"],"a":"portal","g":"us"}'::jsonb,'published'),
 ('us_aflcmc','Air Force Life Cycle Management Center (AFLCMC)','us_govagencies','org',
  'The US Air Force''s centre for total life-cycle acquisition and sustainment of aircraft, weapons and systems (Wright-Patterson AFB).',
  'aflcmc.af.mil',
  '{"w":["govmil","sme","startup"],"o":["procurement"],"t":[6,9],"d":["air"],"a":"portal","g":"us"}'::jsonb,'published'),
 ('us_armycontracting','Army Contracting Command (ACC)','us_govagencies','org',
  'The US Army''s command for contracting and procurement of goods and services across the force.',
  'acc.army.mil',
  '{"w":["govmil","sme","startup"],"o":["procurement","contract"],"t":[6,9],"d":["xproc"],"a":"portal","g":"us"}'::jsonb,'published')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,
  does=excluded.does,entry=excluded.entry,tags=excluded.tags,status='published';
