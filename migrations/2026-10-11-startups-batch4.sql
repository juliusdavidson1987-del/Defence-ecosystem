-- ============================================================================
-- Defence-tech startups — batch 4 (non-US clusters). 4 India (pt_in), 1 Germany
-- (eu_de), 1 Canada (ca_grp), each web-verified against its official site on
-- 2026-10-11. Deduped. Idempotent. Run in Supabase, then sync.
-- Deferred: Digantara (domain unresolved), Sidereus (ceasing EU operations),
-- Spaceflux (site under construction) — to re-source before adding.
-- ============================================================================
-- (Pixxel already in the map as in_pixxel "India — Pixxel" — skipped.)
insert into public.nodes (id,label,parent,kind,does,entry,tags,status,origin,evidence_status,last_verified_at,verified_by,source) values
 ('in_galaxeye','GalaxEye','pt_in','org',
  'Indian Earth-observation company; its Mission Drishti satellite fuses radar (SAR) and multispectral sensors for all-weather, day-and-night imagery.',
  'galaxeye.space','{"w":["startup"],"o":["contract"],"t":[5,8],"d":["space","eoisr"],"a":"open","g":"in"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','galaxeye.space'),
 ('in_agnikul','Agnikul Cosmos','pt_in','org',
  'Indian launch startup offering customised small orbital launches with its 3D-printed Agnibaan rocket, based at IIT Madras, Chennai.',
  'agnikul.in','{"w":["startup"],"o":["contract"],"t":[5,8],"d":["space"],"a":"open","g":"in"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','agnikul.in'),
 ('in_skyroot','Skyroot Aerospace','pt_in','org',
  'Indian launch company building on-demand small-satellite launch vehicles (the Vikram series).',
  'skyroot.in','{"w":["startup"],"o":["contract"],"t":[5,8],"d":["space"],"a":"open","g":"in"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','skyroot.in'),
 ('de_constellr','constellr','eu_de','org',
  'German company building and operating high-resolution thermal-intelligence satellites for national security, maritime awareness and industrial monitoring.',
  'constellr.com','{"w":["startup"],"o":["contract"],"t":[6,9],"d":["space","eoisr"],"a":"open","g":"de"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','constellr.com'),
 ('ca_reactiondynamics','Reaction Dynamics','ca_grp','org',
  'Canadian launch company developing light- and medium-lift rockets using storable hybrid propellants, plus satellite propulsion systems.',
  'reactiondynamics.space','{"w":["startup"],"o":["contract"],"t":[4,7],"d":["space","energy"],"a":"open","g":"ca"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','reactiondynamics.space')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,does=excluded.does,entry=excluded.entry,
  tags=excluded.tags,status='published',origin=excluded.origin,evidence_status=excluded.evidence_status,
  last_verified_at=excluded.last_verified_at,verified_by=excluded.verified_by,source=excluded.source;
