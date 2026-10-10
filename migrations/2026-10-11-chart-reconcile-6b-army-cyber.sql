-- ============================================================================
-- Full chart reconcile, batch 6b: remaining granular sub-units — Army research
-- & innovation bodies, a cyber analysis centre, a DAF cyber software factory, and
-- the Marine Innovation Unit. Web-verified 2026-10-11. Idempotent.
-- Deferred: Maneuver Battle Lab (no clean URL after the Fort Moore->Benning rename),
-- TRADOC (a command, not an access point), CFIC / Technology Advancement Center
-- (no clean standalone URL), Army SBIR/STTR & Army ManTech (represented by the
-- existing DoD SBIR node).
-- ============================================================================
insert into public.nodes (id,label,parent,kind,does,entry,tags,status,origin,evidence_status,last_verified_at,verified_by,source) values
 ('us_erdc','Engineer Research and Development Center (ERDC)','us_labs','org',
  'US Army Corps of Engineers R&D organisation (seven laboratories) covering military engineering, geospatial, infrastructure, environmental and high-performance computing.',
  'erdc.usace.army.mil','{"w":["govmil","sme","academic"],"o":["research","contract"],"t":[3,8],"d":["xcut"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','erdc.usace.army.mil'),
 ('us_ari','Army Research Institute for the Behavioral & Social Sciences (ARI)','us_labs','org',
  'US Army R&D organisation conducting the service''s personnel, training and leader-development behavioural and social science research.',
  'ari.army.mil','{"w":["govmil","academic"],"o":["research"],"t":[2,7],"d":["humanperf","training"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','ari.army.mil'),
 ('us_etc','Energetics Technology Center (ETC)','us_labs','org',
  'US nonprofit research and engineering organisation (La Plata, MD) supporting national security through energetics science and technology and problem-solving.',
  'etcmd.com','{"w":["govmil","sme","academic"],"o":["research","advice"],"t":[3,8],"d":["weapons"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','etcmd.com'),
 ('us_firepoint','FirePoint Innovations Center','us_service','org',
  'US innovation centre run by Wichita State University under a partnership with Army DEVCOM Aviation & Missile Center, connecting startups and academia to Army aviation modernisation.',
  'gofirepoint.org','{"w":["startup","sme","academic"],"o":["advice","research"],"t":[3,8],"d":["air"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','gofirepoint.org'),
 ('us_njii','New Jersey Innovation Institute (NJII)','us_acq','org',
  'US NJIT corporation and innovation intermediary partnering with defence (e.g. DEVCOM Armaments, Picatinny) and industry to accelerate technology development and commercialisation.',
  'njii.com','{"w":["startup","sme","academic"],"o":["advice","research"],"t":[3,8],"d":["xcut"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','njii.com'),
 ('us_smdc_tc','USASMDC Technical Center','us_labs','org',
  'US Army Space and Missile Defense Command''s science-and-technology centre (Redstone Arsenal) researching directed energy, high-energy lasers, space, hypersonics and integrated air & missile defence.',
  'smdc.army.mil','{"w":["govmil","sme","academic"],"o":["research"],"t":[3,8],"d":["directed","space","hypersonic"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','smdc.army.mil'),
 ('us_jwac','Joint Warfare Analysis Center (JWAC)','us_cyber','org',
  'US Strategic Command subordinate command (Dahlgren, VA) providing strategic technical analysis and solutions for precision effects and national security.',
  'jwac.mil','{"w":["govmil"],"o":["research","advice"],"t":[4,9],"d":["c4isr"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','jwac.mil'),
 ('us_shadowsedge','Shadows Edge','us_service','org',
  'US Department of the Air Force software factory (listed in the AF DevSecOps directory) delivering cyber and mission software.',
  'software.af.mil','{"w":["govmil","sme"],"o":["advice","contract"],"t":[6,9],"d":["software","cyber"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','software.af.mil'),
 ('us_miu','Marine Innovation Unit (MIU)','us_service','org',
  'US Marine Corps Reserve unit (Newburgh, NY) acting as a strategic connector between commercial industry and the Marine Corps to accelerate advanced capabilities, with liaisons to DIU and DARPA.',
  'marforres.marines.mil/MIU','{"w":["govmil","startup","sme"],"o":["advice"],"t":[3,9],"d":["xcut"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','marforres.marines.mil/MIU')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,does=excluded.does,entry=excluded.entry,
  tags=excluded.tags,status='published',origin=excluded.origin,evidence_status=excluded.evidence_status,
  last_verified_at=excluded.last_verified_at,verified_by=excluded.verified_by,source=excluded.source;
