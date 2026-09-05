-- ============================================================================
-- Events rework — Phase 1: three-layer model + dates as data.
--
-- The events area was thin and its next-edition DATES were hardcoded in
-- index.html (so they went stale and needed an app redeploy). This:
--   1) restructures b_events into three sub-groups — Anchor fairs,
--      Aggregators & calendars, Independent organisers & activities;
--   2) adds verified aggregator + activity nodes (real, web-checked URLs);
--   3) moves the next-edition dates into reference.event_next, so a date fix
--      becomes a normal data change (sync, no redeploy).
--
-- Representative, not exhaustive — the aggregators are the pathway to the full,
-- always-current listings. Run in the Supabase SQL editor (Run), then re-sync.
-- Idempotent.
-- ============================================================================

-- 1) Broaden the parent branch.
update public.nodes set
  label = 'Defence & Security Events & Fairs',
  does  = 'Where the ecosystem meets — the anchor trade fairs, the aggregators who keep the live listings, and independent organisers running exercises, hackathons and demo days.'
 where id = 'b_events';

-- 2) Three sub-branches (ordered fairs → aggregators → activities).
insert into public.nodes (id,label,parent,kind,does,entry,tags,status,"order") values
 ('ev_fairs','Anchor fairs & exhibitions','b_events','branch','The tentpole international trade shows — recognisable, recurring, and often the fastest way in for a newcomer or SME. Dates move; always confirm on the organiser''s site before booking.','',null,'published',0),
 ('ev_aggreg','Aggregators & event calendars','b_events','branch','Organisers and portals that keep the always-current listings — start here to find what''s on, rather than relying on a fixed list. Association calendars (NDIA, ADS, RUSI, techUK) are also worth watching.','',null,'published',1),
 ('ev_activities','Independent organisers & activities','b_events','branch','Beyond the trade fairs: interoperability exercises, cyber ranges, hackathons and accelerator demo days. See also DIANA, SOFWERX, CCDCOE (CyCon) and Eurodefense.tech elsewhere in the map.','',null,'published',2)
on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,does=excluded.does,status='published',"order"=excluded."order";

-- 3) Reparent the existing anchor fairs under ev_fairs (dates unaffected — EVENT_NEXT is keyed by id).
update public.nodes set parent='ev_fairs'
 where id in ('ev_ausa','ev_cansec','ev_defea','ev_dsa','ev_dsei','ev_eurosatory','ev_farnborough',
              'ev_idef','ev_idex','ev_indopacific','ev_itsec','ev_milipol','ev_mspo','ev_parisair',
              'ev_seaairspace','ev_wds');

-- 4) Aggregators & calendars (web-verified 2026-09-05).
insert into public.nodes (id,label,parent,kind,does,entry,tags,status) values
 ('ev_defenceiq','Defence IQ','ev_aggreg','org','One of the largest defence events and content organisations (est. 2001); runs a big conference portfolio and an events calendar across air, land, maritime, space, cyber and security.','defenceiq.com/events','{"w":["govmil","prime","sme","startup"],"o":["advice"],"t":[1,9],"d":["xcut"],"a":"open","g":"uk"}'::jsonb,'published'),
 ('ev_clarion','Clarion Defence & Security','ev_aggreg','org','The events organiser behind DSEI (London) and the DSEI-branded international shows; its portfolio is a primary source for those shows'' schedules.','clarion-defence.com','{"w":["govmil","prime","sme"],"o":["advice"],"t":[1,9],"d":["xcut"],"a":"open","g":"uk"}'::jsonb,'published'),
 ('ev_coges','COGES Events (GICAT)','ev_aggreg','org','GICAT''s events subsidiary; organises Eurosatory (Paris), ShieldAfrica and Expodefensa — the authoritative source for its shows'' dates.','cogesevents.com','{"w":["govmil","prime","sme"],"o":["advice"],"t":[1,9],"d":["xcut"],"a":"open","g":"fr"}'::jsonb,'published')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,does=excluded.does,entry=excluded.entry,tags=excluded.tags,status='published';

-- 5) Independent organisers & activities (web-verified 2026-09-05).
insert into public.nodes (id,label,parent,kind,does,entry,tags,status) values
 ('ev_cwix','CWIX — NATO interoperability exercise','ev_activities','org','NATO''s annual Coalition Warrior Interoperability eXercise (since 1999; hosted at the Joint Force Training Centre, Bydgoszcz) — where nations and industry test and de-risk C2 systems and IT services for interoperability.','act.nato.int','{"w":["govmil","prime"],"o":["test"],"t":[4,9],"d":["c4isr"],"a":"restricted","g":"nato"}'::jsonb,'published'),
 ('ev_lockedshields','Locked Shields (CCDCOE, Tallinn)','ev_activities','org','The world''s largest live-fire cyber-defence exercise, run annually by the NATO Cooperative Cyber Defence Centre of Excellence.','ccdcoe.org','{"w":["govmil"],"o":["test"],"t":[4,9],"d":["cyber"],"a":"restricted","g":"nato"}'::jsonb,'published')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,does=excluded.does,entry=excluded.entry,tags=excluded.tags,status='published';

-- 6) Move next-edition dates into the reference layer (was hardcoded in index.html EVENT_NEXT).
--    The app reads reference.event_next and overrides its embedded fallback with this.
insert into public.reference (key,value) values
 ('event_next', '{
   "ev_dsei":{"next":"7–10 September 2027","where":"ExCeL London"},
   "ev_eurosatory":{"next":"15–19 June 2026","where":"Paris-Nord Villepinte"},
   "ev_farnborough":{"next":"20–24 July 2026","where":"Farnborough, UK"},
   "ev_parisair":{"next":"June 2027 (odd years)","where":"Le Bourget, Paris"},
   "ev_mspo":{"next":"8–11 September 2026","where":"Targi Kielce, Poland"},
   "ev_idex":{"next":"2027 (odd years)","where":"Abu Dhabi, UAE"},
   "ev_wds":{"next":"February 2026","where":"Riyadh, Saudi Arabia"},
   "ev_idef":{"next":"2027 (odd years)","where":"Istanbul, Türkiye"},
   "ev_defea":{"next":"2027","where":"Athens, Greece"},
   "ev_cansec":{"next":"2026 (annual)","where":"Ottawa, Canada"},
   "ev_ausa":{"next":"12–14 October 2026","where":"Washington DC"},
   "ev_seaairspace":{"next":"2026 (annual)","where":"National Harbor, MD"},
   "ev_itsec":{"next":"December 2026 (annual)","where":"Orlando, FL"},
   "ev_indopacific":{"next":"2027 (biennial)","where":"Sydney, Australia"},
   "ev_dsa":{"next":"2026 (biennial)","where":"Kuala Lumpur, Malaysia"},
   "ev_milipol":{"next":"2027 (biennial)","where":"Paris, France"}
 }'::jsonb)
on conflict (key) do update set value=excluded.value;
