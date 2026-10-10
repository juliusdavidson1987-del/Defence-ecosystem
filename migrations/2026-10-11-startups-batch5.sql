-- ============================================================================
-- Defence-tech startups — batch 5. 7 US firms (us_dtech), each verified 2026-10-11
-- (Sierra Space confirmed via search — its live cert was expired). Deduped.
-- Idempotent. Run in Supabase, then sync.
-- Deferred: TurbineOne (could not confirm from site), Array Labs (arraylabs.com is
-- a web-dev firm, not the space company), Obviant (domain unresolved).
-- ============================================================================
insert into public.nodes (id,label,parent,kind,does,entry,tags,status,origin,evidence_status,last_verified_at,verified_by,source) values
 ('us_sierraspace','Sierra Space','us_dtech','org',
  'US space company building the Dream Chaser reusable spaceplane and orbital and space-station infrastructure.',
  'sierraspace.com','{"w":["startup"],"o":["contract"],"t":[5,8],"d":["space"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','sierraspace.com'),
 ('us_red6','Red 6','us_dtech','org',
  'US company whose Advanced Tactical Augmented Reality System (ATARS) places synthetic adversaries and training into the real-world field of view of pilots in flight.',
  'red6ar.com','{"w":["startup"],"o":["contract"],"t":[6,9],"d":["training","simulation","air"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','red6ar.com'),
 ('us_machinalabs','Machina Labs','us_dtech','org',
  'US manufacturer operating AI-guided, software-defined robotic factories that form complex metal structures for aerospace and defence.',
  'machinalabs.ai','{"w":["startup"],"o":["contract"],"t":[6,9],"d":["materials","autonomy","software"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','machinalabs.ai'),
 ('us_sedaro','Sedaro','us_dtech','org',
  'US provider of web-based simulation and digital-twin tools for modelling and validating complex defence and space systems.',
  'sedaro.com','{"w":["startup"],"o":["contract"],"t":[6,9],"d":["simulation","software","space"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','sedaro.com'),
 ('us_virtualitics','Virtualitics','us_dtech','org',
  'US AI software company; its Iris platform supports defence readiness across maintenance, materiel, personnel and supply chain.',
  'virtualitics.com','{"w":["startup"],"o":["contract"],"t":[7,9],"d":["ai","software","logistics"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','virtualitics.com'),
 ('us_cx2','CX2','us_dtech','org',
  'US electronic-warfare company building AI-enabled hardware and software to detect, disrupt and defend the radiofrequency spectrum in contested environments.',
  'cx2.com','{"w":["startup"],"o":["contract"],"t":[5,9],"d":["ew","cyber","c4isr"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','cx2.com'),
 ('us_istari','Istari','us_dtech','org',
  'US digital-engineering company; its platform connects engineering data and tools so teams can validate complex systems across air, sea, space and energy.',
  'istaridigital.com','{"w":["startup"],"o":["contract"],"t":[6,9],"d":["software","simulation"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','istaridigital.com')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,does=excluded.does,entry=excluded.entry,
  tags=excluded.tags,status='published',origin=excluded.origin,evidence_status=excluded.evidence_status,
  last_verified_at=excluded.last_verified_at,verified_by=excluded.verified_by,source=excluded.source;
