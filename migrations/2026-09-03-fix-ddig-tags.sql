-- ============================================================================
-- Fix: ddig (National Armaments Digital & Data — formerly Defence Digital) had
-- tags = {} (an empty object) after a correction/repair was applied to a
-- previously-tagless node. An empty {} fails the data validator (tags must have
-- a `d` array). Set an accurate tags object.
--
-- Run in the Supabase SQL editor (Run), then re-run the sync. Idempotent.
-- ============================================================================
update public.nodes
   set tags = '{"w":["govmil","sme","prime"],"o":["contract","procurement","advice"],"t":[4,9],"d":["comms","cyber","c4isr","ai"],"a":"open","g":"uk"}'::jsonb
 where id = 'ddig';
