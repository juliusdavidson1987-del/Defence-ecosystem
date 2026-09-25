-- ============================================================================
-- Security expansion (Phase 1 — UK). Broadens the map from "defence & dual-use"
-- to "defence, SECURITY & dual-use": the national-security & resilience bodies that
-- share the defence innovation/procurement pipeline (agreed scope — national
-- security, protective security/CNI, cyber, counter-terrorism, border & law-
-- enforcement technology, serious/organised crime, intelligence enablers,
-- resilience). Excludes pure private guarding/consumer security.
--
-- Blends into the existing tree + tags (no restructure). Each is web-verified and
-- dedupe-checked (NCSC, NPSA, GCHQ, Home Office, DASA, Dstl already in). Tags set
-- so funcForOrg() buckets them correctly (NO audience-'prime' on gov bodies).
-- Idempotent. Run in Supabase, then sync.
-- ============================================================================
insert into public.nodes (id,label,parent,kind,does,entry,tags,entity_type_override,status) values

-- Intelligence & national-security technology ------------------------------
 ('mi5','Security Service (MI5)','b_ics','org',
  'The UK''s domestic security and counter-intelligence agency — protects against terrorism, espionage and state threats.',
  'mi5.gov.uk',
  '{"w":["govmil"],"o":["advice"],"t":[1,9],"d":["cyber","c4isr"],"a":"restricted","g":"uk"}'::jsonb,null,'published'),
 ('sis','Secret Intelligence Service (SIS / MI6)','b_ics','org',
  'The UK''s foreign human-intelligence service — covert overseas collection and analysis on threats to national security.',
  'sis.gov.uk',
  '{"w":["govmil"],"o":["advice"],"t":[1,9],"d":["cyber","c4isr"],"a":"restricted","g":"uk"}'::jsonb,null,'published'),
 ('hmgcc','HMGCC — HM Government Communications Centre','b_ics','org',
  'The UK government''s technology and engineering centre (Hanslope Park) — designs electronics, software and communications for national security, defence and law enforcement.',
  'hmgcc.gov.uk',
  '{"w":["govmil"],"o":["research","product"],"t":[3,9],"d":["comms","c4isr","microelec"],"a":"restricted","g":"uk"}'::jsonb,'research','published'),

-- Security innovation & industry-engagement front doors ---------------------
 ('hmgcc_cocreation','HMGCC Co-Creation','b_sti','org',
  'HMGCC''s co-creation programme (with Dstl) — opens national-security engineering challenges to industry and academia to accelerate solutions.',
  'co-creation.hmgcc.gov.uk',
  '{"w":["govmil","sme","startup","academic"],"o":["grant","advice"],"t":[2,8],"d":["xcut"],"a":"portal","g":"uk"}'::jsonb,null,'published'),
 ('ace','Accelerated Capability Environment (ACE)','b_sti','org',
  'A Home Office (Homeland Security Group) industry-led innovation environment that solves public-safety and security challenges at pace via a vetted network of industry and academia.',
  'gov.uk/government/organisations/accelerated-capability-environment',
  '{"w":["govmil","sme","startup","academic"],"o":["grant","advice"],"t":[2,8],"d":["software","xcut"],"a":"portal","g":"uk"}'::jsonb,null,'published'),
 ('jsarc','Joint Security & Resilience Centre (JSaRC)','b_sti','org',
  'A Home Office (Homeland Security Group) centre, jointly funded with the security industry, that connects industry and academia with government to turn security innovation into capability and exports.',
  'jsarc.org.uk',
  '{"w":["govmil","sme","startup","academic"],"o":["advice","grant"],"t":[2,9],"d":["xcut"],"a":"portal","g":"uk"}'::jsonb,null,'published'),

-- Government & law-enforcement security bodies ------------------------------
 ('hsg','Homeland Security Group (Home Office)','b_gov','org',
  'The Home Office group responsible for homeland security — counter-terrorism, state threats, borders and public safety; the home of ACE and JSaRC.',
  'gov.uk/government/organisations/home-office',
  '{"w":["govmil"],"o":["advice"],"t":[1,9],"d":["xcut"],"a":"restricted","g":"uk"}'::jsonb,'gov','published'),
 ('nss','National Security Secretariat (Cabinet Office)','b_strat','org',
  'The Cabinet Office secretariat that coordinates UK national-security strategy and supports the National Security Council.',
  'gov.uk/government/organisations/cabinet-office',
  '{"w":["govmil"],"o":["advice"],"t":[1,9],"d":["xcut"],"a":"restricted","g":"uk"}'::jsonb,'gov','published'),
 ('nca','National Crime Agency (NCA)','b_gov','org',
  'The UK''s law-enforcement agency against serious and organised crime — illicit finance, drugs, borders, fraud and online threats; a technology and capability customer.',
  'nationalcrimeagency.gov.uk',
  '{"w":["govmil"],"o":["advice"],"t":[3,9],"d":["xcut"],"a":"restricted","g":"uk"}'::jsonb,'gov','published'),
 ('ctpolicing','Counter Terrorism Policing (CTP)','b_gov','org',
  'The UK''s national counter-terrorism policing network (CTPHQ) — coordinates CT policy, capability and operations with the intelligence agencies and government.',
  'counterterrorism.police.uk',
  '{"w":["govmil"],"o":["advice"],"t":[3,9],"d":["xcut"],"a":"restricted","g":"uk"}'::jsonb,'gov','published'),
 ('borderforce','Border Force','b_gov','org',
  'The Home Office law-enforcement command securing the UK border — immigration and customs controls, and a customer for detection, screening and data technology.',
  'gov.uk/government/organisations/border-force',
  '{"w":["govmil"],"o":["advice"],"t":[4,9],"d":["xcut"],"a":"restricted","g":"uk"}'::jsonb,'gov','published'),
 ('pds','Police Digital Service (PDS)','b_gov','org',
  'The national body coordinating digital, data and technology services and standards for UK policing.',
  'pds.police.uk',
  '{"w":["govmil","sme"],"o":["advice"],"t":[4,9],"d":["software"],"a":"restricted","g":"uk"}'::jsonb,'gov','published'),

-- Security procurement & professional bodies --------------------------------
 ('bluelight','BlueLight Commercial','b_acq','org',
  'The national commercial and procurement body for UK policing and blue-light services — frameworks and contracts for IT and equipment across the 43 forces.',
  'bluelightcommercial.police.uk',
  '{"w":["govmil","sme","startup"],"o":["procurement"],"t":[5,9],"d":["xcut"],"a":"portal","g":"uk"}'::jsonb,null,'published'),
 ('collegepolicing','College of Policing','b_acad','org',
  'The professional body for policing in England and Wales — standards, training, research and evidence-based practice.',
  'college.police.uk',
  '{"w":["govmil","academic"],"o":["research","advice"],"t":[1,7],"d":["xacad"],"a":"open","g":"uk"}'::jsonb,'research','published')

on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,
  does=excluded.does,entry=excluded.entry,tags=excluded.tags,entity_type_override=excluded.entity_type_override,status='published';
