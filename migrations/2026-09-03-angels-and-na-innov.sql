-- ============================================================================
-- The Defence Ecosystem — data change · 2026-09-03
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL editor (press RUN — not just Save), then trigger
-- the "Sync data.json from Supabase" GitHub Action to regenerate & commit
-- data.json. Idempotent: safe to run more than once.
--
--   A) Re-home Ploughshare / Serapis / DAIC under National Armaments Innovation.
--   B) Give angel networks their own Funding sub-branch (starts with Ante-Bellum).
-- ============================================================================

-- A) na_innov already parents Dstl and UKDI; Ploughshare & Serapis affiliations
--    already state they sit "within National Armaments Innovation".
update public.nodes
   set parent = 'na_innov'
 where id in ('daic', 'ploughshare', 'serapis');

-- B1) New Funding sub-branch for angel networks & syndicates.
insert into public.nodes (id, label, parent, kind, entry, does, "order", status)
values (
  'f_angels',
  'Angel networks & syndicates',
  'b_fund',
  'branch',
  '',
  'Angel investors and syndicates backing early-stage defence and dual-use start-ups.',
  3,                        -- sibling sort under b_fund (after f_vc); remove this column if your schema lacks "order"
  'published'
)
on conflict (id) do update
   set label   = excluded.label,
       parent  = excluded.parent,
       kind    = excluded.kind,
       does    = excluded.does,
       "order" = excluded."order",
       status  = 'published';

-- B2) Move the angel community out of the VC bucket into the new sub-group.
update public.nodes set parent = 'f_angels' where id in ('antebellum');

-- Optional sanity check — expect 5 rows with the new parents:
-- select id, label, parent from public.nodes
--  where id in ('daic','ploughshare','serapis','f_angels','antebellum')
--  order by id;
