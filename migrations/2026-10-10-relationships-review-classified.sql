-- ============================================================================
-- v4.13.0 — Relationship edges: REVIEW CLASSIFICATION  (stage B, round 2)
-- ----------------------------------------------------------------------------
-- Turns the resolvable part of relationships-review.csv into real edges, using
-- existing target nodes where they exist and adding two web-verified parent nodes
-- (Hanwha Group, Kongsberg Gruppen) where the family had no parent in the map.
-- Deterministic / hand-verified; nothing guessed. Run AFTER the schema migration;
-- idempotent. Left for manual review (deliberately NOT forced): Hyundai (spans two
-- different groups), the US UARCs (no umbrella node), Damen (single arm), and the
-- pure descriptors ("UK", "national champion", joint-venture labels).
--
-- Run in the Supabase SQL editor (Run), then the Sync action.
-- ============================================================================

-- 1. Two new web-verified parent nodes (their divisions sit under country
--    containers with no group node, so the family can't be linked without them).
insert into public.nodes (id,label,parent,kind,does,entry,tags,entity_type_override,status,origin,evidence_status,last_verified_at,verified_by,source) values
 ('kr_hanwhagroup','Hanwha Group','pt_kr','org',
  'South Korea''s Hanwha conglomerate; its defence businesses span air, land, naval, space and munitions through Hanwha Aerospace, Hanwha Systems and Hanwha Ocean.',
  'hanwha.com',
  '{"w":["prime"],"o":["product"],"t":[6,9],"d":["air","land","maritime","space","weapons"],"a":"prime","g":"kr"}'::jsonb,
  'industry','published','curated','verified','2026-10-10','maintainer','hanwha.com'),
 ('no_kongsberggruppen','Kongsberg Gruppen (KONGSBERG)','eu_nordic','org',
  'Norway''s KONGSBERG technology group; defence and aerospace (missiles, C2, space) through Kongsberg Defence & Aerospace, plus maritime systems and satellite services (KSAT).',
  'kongsberg.com',
  '{"w":["prime"],"o":["product"],"t":[6,9],"d":["weapons","maritime","space","c4isr"],"a":"prime","g":"no"}'::jsonb,
  'industry','published','curated','verified','2026-10-10','maintainer','kongsberg.com')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,does=excluded.does,entry=excluded.entry,
  tags=excluded.tags,entity_type_override=excluded.entity_type_override,status='published',
  origin=excluded.origin,evidence_status=excluded.evidence_status,last_verified_at=excluded.last_verified_at,
  verified_by=excluded.verified_by,source=excluded.source;

-- 2. Edges. member_of (networks/programmes) and subsidiary_of / part_of (corporate).
insert into public.relationships
  (source_node_id,target_node_id,relationship_type,directed,evidence_status,origin,last_verified_at,verified_by,attributes) values
 -- 20 NATO Centres of Excellence -> the CoE programme node
 ('coe_cbrn','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_ccdcoe','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_ccoe','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_cied','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_climate','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_csw','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_cwo','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_dat','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_ensec','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_eod','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_iamd','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_japcc','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_marsec','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_mileng','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_milmed','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_ms','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_mw','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_nmw','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_space','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 ('coe_stratcom','nato_coe','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"NATO-accredited CoE"}'::jsonb),
 -- 6 US FFRDCs -> the FFRDC grouping
 ('aerospace','us_ffrdc','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"US FFRDC"}'::jsonb),
 ('ida','us_ffrdc','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"US FFRDC"}'::jsonb),
 ('lincoln','us_ffrdc','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"US FFRDC"}'::jsonb),
 ('mitre','us_ffrdc','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"US FFRDC"}'::jsonb),
 ('sandia','us_ffrdc','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"US FFRDC"}'::jsonb),
 ('us_sei','us_ffrdc','member_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"US FFRDC"}'::jsonb),
 -- SAMI (parent already in the map)
 ('sa_advancedelectronicscom','sa_saudiarabianmilitaryin','subsidiary_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"SAMI group"}'::jsonb),
 -- Nammo national operations
 ('fi_nammo','no_nammo','part_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"Nammo AS national operations"}'::jsonb),
 -- Hanwha Group divisions
 ('kr_hanwha','kr_hanwhagroup','subsidiary_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"Hanwha Group"}'::jsonb),
 ('kr_hanwhaocean','kr_hanwhagroup','subsidiary_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"Hanwha Group"}'::jsonb),
 ('kr_hanwhasystems','kr_hanwhagroup','subsidiary_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"Hanwha Group"}'::jsonb),
 -- Kongsberg Gruppen divisions
 ('no_kongsberg','no_kongsberggruppen','subsidiary_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"Kongsberg Gruppen"}'::jsonb),
 ('no_kongsbergmaritime','no_kongsberggruppen','subsidiary_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"Kongsberg Gruppen"}'::jsonb),
 ('no_kongsbergsatelliteserv','no_kongsberggruppen','subsidiary_of',true,'verified','curated','2026-10-10','maintainer','{"basis":"Kongsberg Gruppen"}'::jsonb)
on conflict (source_node_id,target_node_id,relationship_type,coalesce(valid_from,'0001-01-01')) do nothing;

-- Done. ~34 edges + 2 nodes. Verify: select count(*) from public.relationships;
