-- ============================================================================
-- Full chart reconcile, batch 2: INNOVATION HUBS / WERX / TECH BRIDGES.
-- Web-verified 2026-10-11. Parent = us_service. Deduped, idempotent.
-- Skipped as already represented by the existing `navalx` node ("NavalX & Tech
-- Bridges"): Central Florida Tech Grove, 401/"Polaris" Tech Bridge.
-- Deferred (real but no confirmed standalone official URL / status unclear):
-- CyberWorx, FLEETWERX, AFRL Southwest, MGMWERX, Corsair Ranch (ARCWERX's software div).
-- ============================================================================
insert into public.nodes (id,label,parent,kind,does,entry,tags,status,origin,evidence_status,last_verified_at,verified_by,source) values
 ('us_eaglewerx','EagleWerx (101st Airborne ATIC)','us_service','org',
  'US Army division-level innovation hub — the 101st Airborne Division''s Applied Tactical Innovation Center at Fort Campbell, enabling soldier-led, bottom-up innovation (AI, robotics, 3D printing).',
  'home.army.mil/campbell/eaglewerx','{"w":["govmil","sme","startup"],"o":["advice"],"t":[3,8],"d":["xcut"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','home.army.mil/campbell/eaglewerx'),
 ('us_erdcwerx','ERDCWERX','us_service','org',
  'US innovation hub run by DEFENSEWERX under a partnership intermediary agreement with the Army Engineer Research and Development Center (ERDC), a simplified front door for small firms (Vicksburg, MS).',
  'erdcwerx.org','{"w":["startup","sme"],"o":["advice","contract"],"t":[3,8],"d":["xcut"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','erdcwerx.org'),
 ('us_arcwerx','ARCWERX','us_service','org',
  'US Air Reserve Component''s innovation hub (the reserve-component counterpart to AFWERX; under the ANG-AFRC Test Center, Tucson), with a software division known as Corsair Ranch.',
  'arcwerx.dso.mil','{"w":["govmil","sme","startup"],"o":["advice"],"t":[3,8],"d":["xcut"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','arcwerx.dso.mil'),
 ('us_newspacenexus','NewSpace Nexus','us_service','org',
  'US space-industry innovation hub (Albuquerque; formerly NewSpace New Mexico) backed by AFRL and the Space Force Rapid Capabilities Office, helping space companies access facilities, equipment and programmes.',
  'newspacenm.org','{"w":["startup","sme"],"o":["advice","grant"],"t":[3,8],"d":["space"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','newspacenm.org'),
 ('us_sdataplab','SDA TAP Lab','us_service','org',
  'US Space Systems Command Tools, Applications and Processing (TAP) Lab in Colorado Springs — a space-domain-awareness accelerator (Project Apollo) opening data and sandboxes to companies, UARCs/FFRDCs and Guardians.',
  'ssc.spaceforce.mil','{"w":["govmil","sme","startup","academic"],"o":["advice","test"],"t":[4,8],"d":["space","c4isr","software"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','ssc.spaceforce.mil'),
 ('us_fathomwerx','FATHOMWERX','us_service','org',
  'US innovation lab at Port Hueneme (the NavalX Ventura Tech Bridge) fusing academia, industry and DoD partners — 60,000 sq ft of prototyping, testing and maritime/undersea experimentation (ANTX Coastal Trident).',
  'fathomwerx.com','{"w":["startup","sme","academic"],"o":["advice","test"],"t":[3,8],"d":["maritime"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','fathomwerx.com')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,does=excluded.does,entry=excluded.entry,
  tags=excluded.tags,status='published',origin=excluded.origin,evidence_status=excluded.evidence_status,
  last_verified_at=excluded.last_verified_at,verified_by=excluded.verified_by,source=excluded.source;
