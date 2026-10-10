-- ============================================================================
-- Final pass — deferred items re-sourced and verified 2026-10-11. 6 bodies:
-- Platform One, Space CAMP (us_service); TurbineOne (us_dtech); SOSSEC (us_acq);
-- Digantara (India, pt_in); Spaceflux (UK, c_space). Deduped. Idempotent.
-- Still deferred (no clean standalone official site): Kobayashi Maru, CyberWorx,
-- ARCWERX, Cloud One, Obviant.
-- ============================================================================
insert into public.nodes (id,label,parent,kind,does,entry,tags,status,origin,evidence_status,last_verified_at,verified_by,source) values
 ('us_platformone','Platform One','us_service','org',
  'US Air Force enterprise DevSecOps platform providing hardened containers, pipelines and DevSecOps-as-a-service (Big Bang, Iron Bank) for DoD software teams.',
  'p1.dso.mil','{"w":["govmil","sme"],"o":["advice","contract"],"t":[6,9],"d":["software","cyber"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','p1.dso.mil'),
 ('us_spacecamp','Space CAMP','us_service','org',
  'US Space Force / AFRL software factory (at Catalyst Campus, Colorado Springs) building custom software and providing Agile training and technology services for space missions.',
  'spacecamp.dso.mil','{"w":["govmil","sme"],"o":["advice","contract"],"t":[6,9],"d":["software","space"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','spacecamp.dso.mil'),
 ('us_turbineone','TurbineOne','us_dtech','org',
  'US defence-AI company; its Frontline Perception System brings machine learning to the tactical edge (no cloud) to detect and identify threats on devices from drones to heads-up displays.',
  'turbineone.com','{"w":["startup"],"o":["contract"],"t":[6,9],"d":["ai","autonomy","c4isr"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','turbineone.com'),
 ('us_sossec','SOSSEC','us_acq','org',
  'US consortium-management firm running Other Transaction Agreement (OTA) programmes for the SOSSEC and SCE consortia, connecting member companies with DoD customers (Salem, NH).',
  'sossecinc.com','{"w":["sme"],"o":["procurement","contract"],"t":[3,9],"d":["xcut"],"a":"portal","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','sossecinc.com'),
 ('in_digantara','Digantara','pt_in','org',
  'Indian space-situational-awareness company operating space-based sensors to track orbital debris and satellites in real time.',
  'digantara.co.in','{"w":["startup"],"o":["contract"],"t":[5,8],"d":["space","c4isr"],"a":"open","g":"in"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','digantara.co.in'),
 ('spaceflux','Spaceflux','c_space','org',
  'UK space-domain-awareness company pairing a global network of ground telescopes with AI analytics (including daylight SWIR tracking) under UK government contracts.',
  'spaceflux.com','{"w":["startup"],"o":["contract"],"t":[6,9],"d":["space","c4isr"],"a":"open","g":"uk"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','spaceflux.com')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,does=excluded.does,entry=excluded.entry,
  tags=excluded.tags,status='published',origin=excluded.origin,evidence_status=excluded.evidence_status,
  last_verified_at=excluded.last_verified_at,verified_by=excluded.verified_by,source=excluded.source;
