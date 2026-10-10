-- ============================================================================
-- Full chart reconcile (both Murray org-charts, Sept 2026 "DoW" edition), batch 1:
-- SOFTWARE FACTORIES. Web-verified 2026-10-11. All parent = us_service.
-- DAF factories without a standalone domain use their official enterprise home,
-- software.af.mil (the "AF DEVSECOPS" directory that catalogs each with its mission).
-- Deferred: Mach5 (ATO lapsed Apr-2026, status unclear), Corsair Ranch (noted under
-- ARCWERX), EmeraldCode / Rogue Blue / MXS / DAF CLOUDworks (no verified mission text yet).
-- Deduped, idempotent.
-- ============================================================================
insert into public.nodes (id,label,parent,kind,does,entry,tags,status,origin,evidence_status,last_verified_at,verified_by,source) values
 ('us_mcswf','Marine Corps Software Factory (MCSWF)','us_service','org',
  'US Marine Corps unit (Austin, TX) under the Deputy Commandant for Information that trains Marines to build and deliver operational software using agile and DevSecOps methods.',
  'information.marines.mil/Units/Marine-Corps-Software-Factory/','{"w":["govmil","sme"],"o":["advice","contract"],"t":[6,9],"d":["software"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','information.marines.mil/Units/Marine-Corps-Software-Factory/'),
 ('us_tesseract','Tesseract','us_service','org',
  'US Air Force software factory (with the 309th Software Engineering Group, Hill AFB) building and accelerating software tools designed by and for Airmen.',
  'tesseract.af.mil','{"w":["govmil","sme"],"o":["advice","contract"],"t":[6,9],"d":["software"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','tesseract.af.mil'),
 ('us_theforge','The Forge (PEO IWS)','us_service','org',
  'US Navy software factory run by NAVSEA / PEO Integrated Warfare Systems (at NSWC Dahlgren) — the Navy''s first weapons-systems software factory, developing and certifying surface-combat (Aegis) software.',
  'navsea.navy.mil','{"w":["govmil","sme"],"o":["advice","contract"],"t":[6,9],"d":["software","weapons"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','navsea.navy.mil'),
 ('us_overmatch_osa','Overmatch Software Armory (OSA)','us_service','org',
  'US Navy DevSecOps software factory (NIWC Pacific) supporting Project Overmatch, delivering modern naval command-and-control software to ashore and afloat units.',
  'niwcpacific.navy.mil','{"w":["govmil","sme"],"o":["advice","contract"],"t":[6,9],"d":["software","c4isr"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','niwcpacific.navy.mil'),
 ('us_kobayashimaru','Kobayashi Maru','us_service','org',
  'US Space Force software factory (Los Angeles) modernising space command-and-control software and the way space forces share data with allies.',
  'software.af.mil','{"w":["govmil","sme"],"o":["advice","contract"],"t":[6,9],"d":["software","space","c4isr"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','software.af.mil'),
 ('us_blacklabel','Black Label','us_service','org',
  'US Department of the Air Force software factory delivering DevSecOps capabilities for offensive cyber and information-warfare missions.',
  'software.af.mil','{"w":["govmil","sme"],"o":["advice","contract"],"t":[6,9],"d":["software","cyber"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','software.af.mil'),
 ('us_unifiedplatform','Unified Platform','us_service','org',
  'US Department of the Air Force cyber software factory that builds and maintains the DevSecOps software-development toolkit used across the DoD and the services.',
  'software.af.mil','{"w":["govmil","sme"],"o":["advice","contract"],"t":[6,9],"d":["software","cyber"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','software.af.mil'),
 ('us_wavelength','Wavelength','us_service','org',
  'US Air Force electronic-warfare digital-services software factory (563rd Electronic Warfare Squadron, 350th Spectrum Warfare Wing) building EW mission software.',
  'software.af.mil','{"w":["govmil","sme"],"o":["advice","contract"],"t":[6,9],"d":["software","ew"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','software.af.mil'),
 ('us_cloudone','Cloud One','us_service','org',
  'US Department of the Air Force enterprise cloud-hosting environment paired with a tailorable DevSecOps pipeline, declared a DoD enterprise service.',
  'software.af.mil','{"w":["govmil","sme"],"o":["advice"],"t":[6,9],"d":["software","cyber"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','software.af.mil')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,does=excluded.does,entry=excluded.entry,
  tags=excluded.tags,status='published',origin=excluded.origin,evidence_status=excluded.evidence_status,
  last_verified_at=excluded.last_verified_at,verified_by=excluded.verified_by,source=excluded.source;
