-- ============================================================================
-- US innovation-ecosystem gap-fill, batch 3 — closing the residual tail found by
-- auditing the live map against the full DoW/DoD innovation-ecosystem taxonomy
-- (Michael Murray charts used only as a checklist; verified independently 2026-10-11).
-- 7 genuinely-missing, web-verified bodies:
--   CESMII, AFFOA (Manufacturing USA institutes, us_ffrdc);
--   ARLIS, STPI (UARC / FFRDC, us_ffrdc);
--   NIWC Atlantic, NIWC Pacific (NAVWAR information-warfare centres, us_navwar);
--   Army Software Factory (us_service).
-- Deduped, idempotent. Still deferred (no clean standalone URL / status unclear):
--   Kobayashi Maru, Cloud One, Section 31, LevelUP, Rogue Squadron, Overwatch,
--   CyberWorx, ARCWERX, MGMWERX, CyManII.
-- ============================================================================
insert into public.nodes (id,label,parent,kind,does,entry,tags,status,origin,evidence_status,last_verified_at,verified_by,source) values
 ('us_cesmii','CESMII — the Smart Manufacturing Institute','us_ffrdc','org',
  'US Manufacturing USA institute (administered at UCLA) advancing smart-manufacturing technologies, a digital interoperability platform and workforce development.',
  'cesmii.org','{"w":["academic","govmil","sme"],"o":["research","grant","advice"],"t":[3,8],"d":["software","materials"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','cesmii.org'),
 ('us_affoa','AFFOA (Advanced Functional Fabrics of America)','us_ffrdc','org',
  'US DoD-sponsored Manufacturing USA institute (Bedford, MA) turning conventional fibres and fabrics into integrated, networked devices and systems.',
  'affoa.org','{"w":["academic","govmil","sme"],"o":["research","grant","advice"],"t":[3,8],"d":["materials","microelec"],"a":"open","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','affoa.org'),
 ('us_arlis','ARLIS (Applied Research Laboratory for Intelligence and Security)','us_ffrdc','org',
  'US DoD University Affiliated Research Center at the University of Maryland (sponsored by OUSD(I&S)) researching cognitive security, human-machine systems, supply-chain and insider-risk problems.',
  'arlis.umd.edu','{"w":["academic","govmil"],"o":["research","advice"],"t":[2,7],"d":["ai","cyber","humanperf"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','arlis.umd.edu'),
 ('us_stpi','STPI (Science and Technology Policy Institute)','us_ffrdc','org',
  'US FFRDC operated by IDA providing science-and-technology policy analysis to the White House Office of Science and Technology Policy and other executive agencies.',
  'ida.org/stpi','{"w":["govmil","academic"],"o":["research","advice"],"t":[3,9],"d":["xcut"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','ida.org/stpi'),
 ('us_niwc_atlantic','Naval Information Warfare Center (NIWC) Atlantic','us_navwar','org',
  'US Navy warfare centre (Charleston, SC) engineering, delivering and sustaining C4ISR, cyber and information-warfare systems for the fleet and joint forces.',
  'niwcatlantic.navy.mil','{"w":["govmil","sme"],"o":["research","contract","advice"],"t":[4,9],"d":["c4isr","cyber","comms"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','niwcatlantic.navy.mil'),
 ('us_niwc_pacific','Naval Information Warfare Center (NIWC) Pacific','us_navwar','org',
  'US Navy warfare centre (Point Loma, San Diego) developing and fielding C4ISR, cyber and information-warfare capabilities, from seabed to space.',
  'niwcpacific.navy.mil','{"w":["govmil","sme"],"o":["research","contract","advice"],"t":[4,9],"d":["c4isr","cyber","comms"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','niwcpacific.navy.mil'),
 ('us_armyswf','Army Software Factory','us_service','org',
  'US Army unit (Austin, TX) that trains soldiers and civilians as software developers and builds operational applications using Agile and DevSecOps practices.',
  'soldiersolutions.swf.army.mil','{"w":["govmil","sme"],"o":["advice","contract"],"t":[6,9],"d":["software"],"a":"restricted","g":"us"}'::jsonb,
  'published','curated','verified','2026-10-11','maintainer','soldiersolutions.swf.army.mil')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,does=excluded.does,entry=excluded.entry,
  tags=excluded.tags,status='published',origin=excluded.origin,evidence_status=excluded.evidence_status,
  last_verified_at=excluded.last_verified_at,verified_by=excluded.verified_by,source=excluded.source;
