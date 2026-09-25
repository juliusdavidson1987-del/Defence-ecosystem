-- ============================================================================
-- From James Pryor feedback (web-verified 2026-09-25), items 2 & 3:
--  2. National Centre for Information Defence — new UK body announced Sep 2026.
--  3. inink — UK defence/national-security marketing & communications agency.
-- (Item 1, Improbable Defence -> Skyral, was applied separately.)
-- Idempotent. Run in Supabase, then sync.
-- ============================================================================
insert into public.nodes (id,label,parent,kind,does,entry,tags,entity_type_override,status) values
 ('ncid','National Centre for Information Defence (NCID)','b_ics','org',
  'A new UK national body (announced September 2026, led from the Cabinet Office) to detect, attribute and disrupt hostile-state information attacks and AI-enabled disinformation, working with the intelligence agencies, police and online platforms.',
  'gov.uk/government/organisations/cabinet-office',
  '{"w":["govmil"],"o":["advice"],"t":[1,9],"d":["cyber","c4isr"],"a":"restricted","g":"uk"}'::jsonb,null,'published'),
 ('inink','inink','b_comms','org',
  'UK marketing and communications agency specialising in defence and national-security technology — brand strategy, positioning and content that help start-ups and scale-ups reach defence and security buyers across the UK, US and NATO.',
  'inink.io',
  '{"w":["sme"],"o":["advice","product"],"t":[6,9],"d":["xcut"],"a":"open","g":"uk"}'::jsonb,'industry','published')
on conflict (id) do update set label=excluded.label,parent=excluded.parent,kind=excluded.kind,
  does=excluded.does,entry=excluded.entry,tags=excluded.tags,entity_type_override=excluded.entity_type_override,status='published';
