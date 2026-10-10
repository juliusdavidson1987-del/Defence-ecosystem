-- ============================================================================
-- US innovation-ecosystem gap-fill, batch 2 (software factories, WERX, MIIs,
-- intermediaries from the org-charts — verified independently 2026-10-11).
-- 8 bodies, deduped, tagged to the existing convention. Idempotent.
-- Deferred (no clean verified URL): Platform One, Cloud One, Kobayashi Maru,
-- Space CAMP, CyberWorx, ARCWERX, SOSSEC — to re-source before adding.
-- ============================================================================
insert into public.nodes (id,label,parent,kind,does,entry,tags,status,origin,evidence_status,last_verified_at,verified_by,source) values
 ('us_kesselrun','Kessel Run','us_service','org',
  'US Air Force software factory building and delivering operational software (air operations, DevSecOps) for the warfighter, based in Boston, MA.',
  'kesselrun.af.mil','{"w":["govmil","sme"],"o":["advice","contract"],"t":[6,9],"d":["software","c4isr"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','kesselrun.af.mil'),
 ('us_bespin','BESPIN','us_service','org',
  'US Air Force software factory (Business and Enterprise Systems Product Innovation) building mobile and enterprise applications for Airmen, based in Montgomery, AL.',
  'bespin.af.mil','{"w":["govmil","sme"],"o":["advice","contract"],"t":[6,9],"d":["software"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','bespin.af.mil'),
 ('us_strikewerx','STRIKEWERX','us_service','org',
  'US Air Force Global Strike Command innovation hub (part of the DEFENSEWERX network) connecting the command with industry and academia to solve deterrence problems, in Bossier City, LA.',
  'strikewerx.com','{"w":["startup","sme"],"o":["advice","contract"],"t":[3,8],"d":["xcut"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','strikewerx.com'),
 ('us_poweramerica','PowerAmerica','us_ffrdc','org',
  'US Manufacturing USA institute advancing wide-bandgap (silicon-carbide and gallium-nitride) power semiconductors and electronics, led from NC State.',
  'poweramericainstitute.org','{"w":["academic","govmil","sme"],"o":["research","grant","advice"],"t":[3,8],"d":["microelec","energy"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','poweramericainstitute.org'),
 ('us_armi','ARMI / BioFabUSA','us_ffrdc','org',
  'US Advanced Regenerative Manufacturing Institute (BioFabUSA) scaling domestic biofabrication and regenerative-medicine manufacturing, based in Manchester, NH.',
  'armiusa.org','{"w":["academic","govmil","sme"],"o":["research","grant","advice"],"t":[3,8],"d":["medical","materials"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','armiusa.org'),
 ('us_techlink','TechLink','us_acq','org',
  'US Department of Defense partnership intermediary for technology transfer, licensing DoD laboratory technologies to industry, based at Montana State University.',
  'techlinkcenter.org','{"w":["sme"],"o":["advice","contract"],"t":[3,9],"d":["xcut"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','techlinkcenter.org'),
 ('us_tradewind','Tradewind','us_acq','org',
  'US CDAO digital and AI acquisition marketplace offering streamlined AI contract vehicles and opportunities for the Department of Defense.',
  'tradewindai.com','{"w":["sme"],"o":["procurement","contract"],"t":[3,9],"d":["ai","xcut"],"a":"portal","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','tradewindai.com'),
 ('us_trmc','Test Resource Management Center (TRMC)','us_govagencies','org',
  'US DoD field activity overseeing the test-and-evaluation infrastructure (the Major Range and Test Facility Base), the Central T&E Investment Program and JMETC.',
  'trmc.osd.mil','{"w":["govmil"],"o":["test","advice"],"t":[4,9],"d":["xcut"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','trmc.osd.mil')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,does=excluded.does,entry=excluded.entry,
  tags=excluded.tags,status='published',origin=excluded.origin,evidence_status=excluded.evidence_status,
  last_verified_at=excluded.last_verified_at,verified_by=excluded.verified_by,source=excluded.source;
