-- ============================================================================
-- Map-wide categorisation fix — gov/lab/agency/command/procurement bodies were
-- mis-filed in the Industry bucket because they carried audience-'prime' in w
-- (funcForOrg reads w:['prime'] as being an industry prime). This corrects them:
--   * research labs/institutes -> entity_type='research' (Alliance lens: RTO)
--   * gov agencies/commands/ministries/procurement -> drop audience-'prime' so
--     they route to intel/procurement/policy/frontline by their own tags.
-- Trade associations (entity_type=gateway) and real manufacturers are left as-is.
-- Auto-generated from a live audit; verified by simulation. Idempotent. Run in Supabase, then sync.
-- ============================================================================

-- 0) Normalize scalar-string tag values to arrays (schema says w/o/d are arrays)
update public.nodes set tags = jsonb_set(tags,'{w}', to_jsonb(array[tags->>'w'])) where jsonb_typeof(tags->'w')='string';
update public.nodes set tags = jsonb_set(tags,'{o}', to_jsonb(array[tags->>'o'])) where jsonb_typeof(tags->'o')='string';
update public.nodes set tags = jsonb_set(tags,'{d}', to_jsonb(array[tags->>'d'])) where jsonb_typeof(tags->'d')='string';

-- Research labs & institutes -> RTO
update public.nodes set entity_type_override='research' where id in ('dstl','npl','afrl','arl','us_sei','us_draper','us_gtri');

-- Government / agency / command / procurement bodies -> drop audience-'prime'
update public.nodes set tags = jsonb_set(tags,'{w}', (tags->'w') - 'prime') where id in ('des','horibamira','ukef','natoact','ncia','nspa','nato_space','eda','fr_dga','fr_comcyber','fr_anssi','fr_cde','de_baainbw','de_cir','de_izbw','de_wrkdo','it_segredifesa','it_cor','nl_dcc','ee_ecsc','pl_armament','pl_dkwoc','lt_dmf','es_mcce','es_dgam','es_mespa','pt_idd','pt_dgrdn','ro_mapn','sk_mosr','hu_hm','dia_iddportugal','bg_mod','hr_morh','al_mod','mk_mod','me_mod','si_mors','us_army','us_navy','ua_dpa','us_af','us_jointstaff','us_dla','us_cybercom','us_cisa','us_dcma','us_disa','us_ousd_as','us_spaceforce','cdao','dib','ssc','ca_cccs','ca_pspc','ca_dia','au_spacecmd','au_casg','kr_dapa','jp_sog');
update public.nodes set tags = jsonb_set(tags,'{w}', (tags->'w') - 'prime') where id in ('jp_atla','il_mafat','il_sibat','au_asd_acsc','be_dgmr','de_bwi','gr_gdaeed','se_swedenboforstestcenter','nsin');
