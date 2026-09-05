-- ============================================================================
-- Taxonomy v2 — retag safety net.
--
-- The one-off retag agent (retag Edge Function) rewrites each org's domain tags
-- (tags.d) into the v2 subcategories. Before it changes a node it snapshots the
-- old tags here, so the whole pass is fully revertible even in Supabase (not just
-- via the data.json git diff):
--
--   update public.nodes n set tags = b.old_tags
--     from public.retag_backup b where n.id = b.id;   -- full revert
--
-- Service-role only. Run in the Supabase SQL editor (Run). Idempotent.
-- ============================================================================
create table if not exists public.retag_backup (
  id         text primary key,          -- node id (one snapshot per node; latest wins)
  old_tags   jsonb,
  new_tags   jsonb,
  changed_at timestamptz not null default now()
);

alter table public.retag_backup enable row level security;
-- No anon access; only the service-role (retag function) writes, and you read via SQL.
