-- ============================================================================
-- France deepening — fill the empty/thin France buckets (nuclear, test &
-- evaluation, academia, S&T, government) so France tracks the same function
-- framework as the UK in the Alliance lens. France had strong primes, defence-
-- tech and intel/cyber coverage but no nuclear, no T&E, thin academia.
--
-- 13 organisations, each web-verified with its official URL on 2026-09-23 and
-- dedupe-checked (Bpifrance already existed as fin_bpifrance and was skipped).
-- Parented under eu_fr (the France container); the Alliance lens buckets each by
-- funcForOrg() via the tags/entity_type below. Idempotent. Run in Supabase, then sync.
-- ============================================================================
insert into public.nodes (id,label,parent,kind,does,entry,tags,entity_type_override,affiliation,status) values

-- ---- Government & policy --------------------------------------------------
 ('fr_sgdsn','SGDSN — Secrétariat général de la défense et de la sécurité nationale','eu_fr','org',
  'France''s General Secretariat for National Defence and Security — the interministerial body under the Prime Minister that coordinates national defence and security policy, resilience and the protection of the nation''s critical interests.',
  'sgdsn.gouv.fr',
  '{"w":["govmil"],"o":["advice"],"t":[4,9],"d":["xcut"],"a":"restricted","g":"fr"}'::jsonb,'policy',null,'published'),

-- ---- Nuclear & strategic --------------------------------------------------
 ('fr_cea_dam','CEA/DAM — Direction des applications militaires','eu_fr','org',
  'The CEA''s Military Applications Division — designs, builds and maintains the warheads of France''s nuclear deterrent and its naval nuclear propulsion (sites at Île-de-France, Valduc, Cesta, Le Ripault and Gramat).',
  'cea.fr',
  '{"w":["govmil"],"o":["research"],"t":[3,9],"d":["nuclear"],"a":"restricted","g":"fr"}'::jsonb,null,null,'published'),

-- ---- Science, technology & innovation (research organisations) ------------
 ('fr_cea','CEA — Commissariat à l''énergie atomique et aux énergies alternatives','eu_fr','org',
  'France''s Alternative Energies and Atomic Energy Commission — a major public research organisation spanning defence, nuclear, low-carbon energy, and digital and health technologies.',
  'cea.fr',
  '{"w":["govmil","academic","prime"],"o":["research"],"t":[1,8],"d":["nuclear","microelec","energy"],"a":"restricted","g":"fr"}'::jsonb,'research',null,'published'),
 ('fr_cea_list','CEA-List','eu_fr','org',
  'The CEA institute for digital systems, embedded AI and interactive systems (Paris-Saclay), developing defence- and security-relevant software, sensing and autonomy technologies.',
  'list.cea.fr',
  '{"w":["govmil","academic","prime","sme"],"o":["research"],"t":[2,7],"d":["ai","software","autonomy"],"a":"restricted","g":"fr"}'::jsonb,'research',null,'published'),
 ('fr_cea_leti','CEA-Leti','eu_fr','org',
  'The CEA institute for micro- and nanoelectronics (Grenoble), one of Europe''s major applied-electronics research centres, with defence-relevant sensing and semiconductor technologies.',
  'leti.cea.fr',
  '{"w":["govmil","academic","prime","sme"],"o":["research"],"t":[2,7],"d":["microelec"],"a":"restricted","g":"fr"}'::jsonb,'research',null,'published'),
 ('fr_isl','ISL — French-German Research Institute of Saint-Louis','eu_fr','org',
  'A binational defence-research institute (ballistics, protection, materials, energetics and sensors) jointly run by France''s AID/DGA and Germany''s BAAINBw, based at Saint-Louis.',
  'isl.eu',
  '{"w":["govmil","academic"],"o":["research"],"t":[1,7],"d":["weapons","materials"],"a":"restricted","g":"fr"}'::jsonb,'research',
  '{"net":"Franco-German","role":"joint institute","note":"run by France (AID/DGA) & Germany (BAAINBw)"}'::jsonb,'published'),

-- ---- Test, evaluation & ranges -------------------------------------------
 ('fr_dga_ev','DGA Essais en vol','eu_fr','org',
  'The DGA''s flight-test centre (Istres, Cazaux, Brétigny) — qualifies and evaluates military and civil aircraft and airborne systems for the French state and supports airworthiness and exports.',
  'armement.defense.gouv.fr/test-de-materiel/implantations-de-la-dga/dga-essais-en-vol',
  '{"w":["govmil"],"o":["test"],"t":[5,9],"d":["air","xtest"],"a":"restricted","g":"fr"}'::jsonb,null,null,'published'),
 ('fr_dga_mi','DGA Maîtrise de l''information','eu_fr','org',
  'The DGA''s expertise and test centre for digital defence systems — navigation, optronics, electronic warfare and secure networks — based at Bruz.',
  'defense.gouv.fr/dga',
  '{"w":["govmil"],"o":["test"],"t":[4,9],"d":["ew","c4isr","xtest"],"a":"restricted","g":"fr"}'::jsonb,null,null,'published'),
 ('fr_dga_centres','DGA — centres d''expertise et d''essais','eu_fr','org',
  'The DGA''s network of technical expertise and test centres (flight, missiles, aeronautics, land, naval and information systems) that evaluate and qualify French defence equipment.',
  'defense.gouv.fr/dga/implantations-dga/centres-dexpertise-dessais-dga-poles-dinnovation-technique',
  '{"w":["govmil"],"o":["test"],"t":[4,9],"d":["xtest"],"a":"restricted","g":"fr"}'::jsonb,null,null,'published'),

-- ---- Academia & research -------------------------------------------------
 ('fr_polytechnique','École Polytechnique','eu_fr','org',
  'France''s leading engineering grande école (part of Institut Polytechnique de Paris) — trains armament-corps engineers and conducts defence-relevant research across the sciences.',
  'polytechnique.edu',
  '{"w":["academic","govmil"],"o":["research"],"t":[1,6],"d":["xacad"],"a":"open","g":"fr"}'::jsonb,'research',null,'published'),
 ('fr_isae','ISAE-SUPAERO','eu_fr','org',
  'The aerospace engineering grande école overseen by the Ministry of the Armed Forces (DGA) — trains armament-corps engineers and researches aerospace, space and defence systems.',
  'isae-supaero.fr',
  '{"w":["academic","govmil"],"o":["research"],"t":[1,6],"d":["xacad","air","space"],"a":"open","g":"fr"}'::jsonb,'research',null,'published'),
 ('fr_ensta','ENSTA Paris','eu_fr','org',
  'An engineering grande école (Institut Polytechnique de Paris) with a Defence & Security programme spanning naval, systems, AI and cyber engineering.',
  'ensta.fr',
  '{"w":["academic","govmil"],"o":["research"],"t":[1,6],"d":["xacad"],"a":"open","g":"fr"}'::jsonb,'research',null,'published'),
 ('fr_ip_paris','Institut Polytechnique de Paris','eu_fr','org',
  'A federation of leading engineering grandes écoles (École Polytechnique, ENSTA, ENSAE, Télécom Paris and others) with an interdisciplinary Defence & Security research centre.',
  'ip-paris.fr',
  '{"w":["academic","govmil"],"o":["research"],"t":[1,6],"d":["xacad"],"a":"open","g":"fr"}'::jsonb,'research',null,'published')

on conflict (id) do update set
  label=excluded.label, parent=excluded.parent, kind=excluded.kind, does=excluded.does,
  entry=excluded.entry, tags=excluded.tags, entity_type_override=excluded.entity_type_override,
  affiliation=excluded.affiliation, status='published';
