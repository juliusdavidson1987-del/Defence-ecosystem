-- ============================================================================
-- US innovation-ecosystem gap-fill (from Michael Murray's "Innovation Ecosystem
-- 2026" org-charts, used only as a checklist — verified independently, not copied).
-- 10 genuinely-missing US bodies the charts show but the map lacked, each web-
-- verified on 2026-10-11, tagged to the existing FFRDC/service/consortium
-- convention. Deduped (CDAO, MxD, America Makes etc. already present). Idempotent.
-- ============================================================================
-- (CNA already mapped as us_cna — skipped.)
insert into public.nodes (id,label,parent,kind,does,entry,tags,status,origin,evidence_status,last_verified_at,verified_by,source) values
 ('us_lift','LIFT (Lightweight Innovations For Tomorrow)','us_ffrdc','org',
  'US manufacturing innovation institute advancing lightweight metals, advanced manufacturing processes and workforce through an industry-academia-government partnership.',
  'lift.technology','{"w":["academic","govmil","sme"],"o":["research","grant","advice"],"t":[3,8],"d":["materials"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','lift.technology'),
 ('us_niimbl','NIIMBL','us_ffrdc','org',
  'US manufacturing innovation institute for biopharmaceutical manufacturing — developing new production technologies, supporting adoption and training the workforce.',
  'niimbl.org','{"w":["academic","govmil","sme"],"o":["research","grant","advice"],"t":[3,8],"d":["medical","materials"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','niimbl.org'),
 ('us_biomade','BioMADE','us_ffrdc','org',
  'US bioindustrial manufacturing innovation institute building domestic bio-based materials and manufacturing capacity, workforce and pilot facilities.',
  'biomade.org','{"w":["academic","govmil","sme"],"o":["research","grant","advice"],"t":[3,8],"d":["materials"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','biomade.org'),
 ('us_aimphotonics','AIM Photonics','us_ffrdc','org',
  'US integrated-photonics manufacturing institute (Albany, NY) providing silicon-photonics design, prototyping, fabrication, packaging and testing services.',
  'aimphotonics.com','{"w":["academic","govmil","sme"],"o":["research","test","advice"],"t":[3,8],"d":["microelec"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','aimphotonics.com'),
 ('us_defensewerx','DEFENSEWERX','us_service','org',
  'US non-profit running a nationwide network of defence innovation hubs (including SOFWERX and Doolittle) that connect government with industry and academia (Niceville, FL).',
  'defensewerx.org','{"w":["startup","sme"],"o":["advice","contract"],"t":[3,8],"d":["xcut"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','defensewerx.org'),
 ('us_doolittle','Doolittle Institute','us_service','org',
  'US AFRL innovation institute supporting the Air Force Research Laboratory technology-transfer mission and connecting the lab with industry and academia (Niceville, FL).',
  'doolittleinstitute.org','{"w":["startup","sme"],"o":["advice","grant"],"t":[3,8],"d":["xcut"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','doolittleinstitute.org'),
 ('us_griffiss','Griffiss Institute','us_service','org',
  'US partnership-intermediary working with AFRL Rome and industry to develop technologies, talent and startups for national security (Rome, NY).',
  'griffissinstitute.org','{"w":["startup","sme"],"o":["advice","research"],"t":[3,8],"d":["xcut"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','griffissinstitute.org'),
 ('us_catalystcampus','Catalyst Campus','us_service','org',
  'US collaborative innovation ecosystem (Colorado Springs) connecting startups, industry, workforce and capital with the aerospace and defence sector.',
  'catalystcampus.org','{"w":["startup","sme"],"o":["advice","contract"],"t":[3,8],"d":["xcut"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','catalystcampus.org'),
 ('us_ati','Advanced Technology International (ATI)','us_acq','org',
  'US non-profit that forms and manages collaborative consortia (via Other Transaction agreements) to accelerate defence and national-security R&D and prototyping.',
  'ati.org','{"w":["sme"],"o":["procurement","contract"],"t":[3,8],"d":["xcut"],"a":"portal","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','ati.org')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,does=excluded.does,entry=excluded.entry,
  tags=excluded.tags,status='published',origin=excluded.origin,evidence_status=excluded.evidence_status,
  last_verified_at=excluded.last_verified_at,verified_by=excluded.verified_by,source=excluded.source;
