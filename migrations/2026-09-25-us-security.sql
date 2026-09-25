-- ============================================================================
-- Security expansion (Phase 2 — US). The US homeland-security / law-enforcement /
-- foreign-intelligence bodies that share the innovation & procurement pipeline.
-- (In-Q-Tel, CISA, NSA, NGA, DC3 were already in.) Web-verified + dedupe-checked
-- 2026-09-25. Tagged so funcForOrg buckets them (NO audience-'prime' on gov bodies).
-- Parented in the b_us subtree. Idempotent. Run in Supabase, then sync.
-- ============================================================================
insert into public.nodes (id,label,parent,kind,does,entry,tags,entity_type_override,status) values

 ('us_dhs','Department of Homeland Security (DHS)','us_agencies','org',
  'The US department for homeland security — counter-terrorism, border and infrastructure protection, immigration and emergency management; parent of TSA, CBP, Secret Service, CISA and FEMA.',
  'dhs.gov',
  '{"w":["govmil"],"o":["advice"],"t":[1,9],"d":["xcut"],"a":"restricted","g":"us"}'::jsonb,'gov','published'),
 ('us_dhs_st','DHS Science & Technology Directorate (S&T)','us_labs','org',
  'The research, development and innovation arm of DHS — develops and transitions homeland-security technology across border, CBRN, counter-UAS, first-responder and critical-infrastructure resilience.',
  'dhs.gov/science-and-technology',
  '{"w":["govmil","academic","sme","startup"],"o":["research","grant"],"t":[2,8],"d":["cbrn","counteruas","c4isr"],"a":"open","g":"us"}'::jsonb,'research','published'),
 ('us_odni','Office of the Director of National Intelligence (ODNI)','us_agencies','org',
  'Coordinates the US Intelligence Community; the parent of IARPA and the National Counterterrorism Center.',
  'dni.gov',
  '{"w":["govmil"],"o":["advice"],"t":[1,9],"d":["c4isr"],"a":"restricted","g":"us"}'::jsonb,null,'published'),
 ('us_fbi','Federal Bureau of Investigation (FBI)','us_agencies','org',
  'The US domestic intelligence and law-enforcement agency — counter-terrorism, counter-intelligence and cyber investigations.',
  'fbi.gov',
  '{"w":["govmil"],"o":["advice"],"t":[3,9],"d":["cyber","c4isr"],"a":"restricted","g":"us"}'::jsonb,null,'published'),
 ('us_cia','Central Intelligence Agency (CIA)','us_agencies','org',
  'The US foreign intelligence service — overseas human-intelligence collection and analysis (its strategic technology investor is In-Q-Tel).',
  'cia.gov',
  '{"w":["govmil"],"o":["advice"],"t":[1,9],"d":["c4isr"],"a":"restricted","g":"us"}'::jsonb,null,'published'),
 ('us_usss','US Secret Service (USSS)','us_agencies','org',
  'The US protective and financial-crimes agency — protects national leaders and safeguards the payment and financial infrastructure; a customer for counter-UAS and forensic technology.',
  'secretservice.gov',
  '{"w":["govmil"],"o":["advice"],"t":[4,9],"d":["xcut"],"a":"restricted","g":"us"}'::jsonb,'gov','published'),
 ('us_tsa','Transportation Security Administration (TSA)','us_agencies','org',
  'The US aviation and surface-transport security agency — screening and detection at scale, and a major customer for screening, sensing and biometric technology.',
  'tsa.gov',
  '{"w":["govmil","sme","startup"],"o":["advice"],"t":[5,9],"d":["xcut"],"a":"restricted","g":"us"}'::jsonb,'gov','published'),
 ('us_cbp','US Customs & Border Protection (CBP)','us_agencies','org',
  'The US border-security agency — customs and border controls, and a customer for sensors, surveillance, autonomy and data technology at the border.',
  'cbp.gov',
  '{"w":["govmil","sme","startup"],"o":["advice"],"t":[5,9],"d":["xcut"],"a":"restricted","g":"us"}'::jsonb,'gov','published'),
 ('us_fema','Federal Emergency Management Agency (FEMA)','us_agencies','org',
  'The US emergency-management and resilience agency — disaster preparedness, response and recovery, and critical-infrastructure resilience.',
  'fema.gov',
  '{"w":["govmil"],"o":["advice"],"t":[4,9],"d":["xcut"],"a":"restricted","g":"us"}'::jsonb,'gov','published')

on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,
  does=excluded.does,entry=excluded.entry,tags=excluded.tags,entity_type_override=excluded.entity_type_override,status='published';
