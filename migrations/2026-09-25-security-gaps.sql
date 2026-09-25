-- ============================================================================
-- Security expansion (Phase 3 — fill the thin nations). A per-nation audit showed
-- most allies already have their core intelligence + cyber agencies (from the
-- country builds); these are the genuinely-missing core national-security bodies
-- for the thinnest nations. Web-verified + dedupe-checked 2026-09-25 (Portugal
-- CNCS, Türkiye MİT, Slovenia SOVA/SI-CERT, Croatia SOA, UAE SIA/cyber, NZ GCSB/
-- NZSIS, Denmark PET/CFCS were already in). Parented under each nation container;
-- tagged intel/cyber. Idempotent. Run in Supabase, then sync.
-- ============================================================================
insert into public.nodes (id,label,parent,kind,does,entry,tags,status) values

-- Portugal (had 0 security bodies; CNCS already in) ------------------------
 ('pt_sis','Portugal — SIS (Serviço de Informações de Segurança)','eu_central','org',
  'Portugal''s domestic security-intelligence service — counter-terrorism, counter-espionage and internal security, part of the SIRP intelligence system.',
  'sis.pt',
  '{"w":["govmil"],"o":["advice"],"t":[1,9],"d":["c4isr"],"a":"restricted","g":"pt"}'::jsonb,'published'),
 ('pt_sied','Portugal — SIED (Serviço de Informações Estratégicas de Defesa)','eu_central','org',
  'Portugal''s strategic and defence intelligence service — foreign intelligence within the SIRP intelligence system.',
  'sied.pt',
  '{"w":["govmil"],"o":["advice"],"t":[1,9],"d":["c4isr"],"a":"restricted","g":"pt"}'::jsonb,'published'),

-- Türkiye (MİT already in; add the national cyber body) --------------------
 ('tr_usom','Türkiye — USOM (National Cyber Incident Response Centre)','eu_turkey','org',
  'Türkiye''s national cyber-incident response centre, within the Information and Communication Technologies Authority (BTK) — coordinates cyber defence for public institutions and critical infrastructure.',
  'usom.gov.tr',
  '{"w":["govmil"],"o":["advice"],"t":[3,9],"d":["cyber"],"a":"restricted","g":"tr"}'::jsonb,'published'),

-- South Korea (thin; add intelligence + cyber) ----------------------------
 ('kr_nis','South Korea — National Intelligence Service (NIS)','pt_kr','org',
  'South Korea''s chief intelligence and national-security agency — foreign and domestic intelligence, counter-terrorism, and national cyber-security policy (National Cyber Security Center).',
  'eng.nis.go.kr',
  '{"w":["govmil"],"o":["advice"],"t":[1,9],"d":["cyber","c4isr"],"a":"restricted","g":"kr"}'::jsonb,'published'),
 ('kr_kisa','South Korea — Korea Internet & Security Agency (KISA)','pt_kr','org',
  'South Korea''s national cyber-security agency (Ministry of Science and ICT) — runs KrCERT/CC and secures the internet and critical information infrastructure.',
  'kisa.or.kr',
  '{"w":["govmil","sme","startup"],"o":["advice"],"t":[3,9],"d":["cyber"],"a":"restricted","g":"kr"}'::jsonb,'published'),

-- Denmark (PET & CFCS already in; add the defence-intelligence service) ----
 ('dk_fe','Denmark — Defence Intelligence Service (FE / DDIS)','eu_nordic','org',
  'Denmark''s foreign and military intelligence service (Forsvarets Efterretningstjeneste) — signals and defence intelligence; hosts the Centre for Cyber Security.',
  'fe-ddis.dk',
  '{"w":["govmil"],"o":["advice"],"t":[1,9],"d":["cyber","c4isr"],"a":"restricted","g":"dk"}'::jsonb,'published'),

-- Slovakia (thin; add intelligence + cyber authority) ---------------------
 ('sk_sis','Slovakia — SIS (Slovak Information Service)','eu_central','org',
  'Slovakia''s civilian intelligence and security service (Slovenská informačná služba) — national security, counter-terrorism and counter-intelligence.',
  'sis.gov.sk',
  '{"w":["govmil"],"o":["advice"],"t":[1,9],"d":["c4isr"],"a":"restricted","g":"sk"}'::jsonb,'published'),
 ('sk_nbu','Slovakia — National Security Authority (NBÚ)','eu_central','org',
  'Slovakia''s national authority for cyber security, protective security and classified information — runs the national cyber-security incident response (SK-CERT).',
  'nbu.gov.sk',
  '{"w":["govmil","sme"],"o":["advice"],"t":[3,9],"d":["cyber"],"a":"restricted","g":"sk"}'::jsonb,'published')

on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,
  does=excluded.does,entry=excluded.entry,tags=excluded.tags,status='published';
