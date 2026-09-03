-- ============================================================================
-- Web-finds capture — the "Beyond the map" web-search suggestions, saved so the
-- maintainer can evaluate and add them (they were previously ephemeral).
-- The public finder inserts genuinely-new finds (post map-dedupe); the maintainer
-- reviews via review-node. Writes to a REVIEW table, never the map.
-- Run in the Supabase SQL editor (Run). Idempotent.
-- ============================================================================
create table if not exists public.web_finds (
  id         bigint generated always as identity primary key,
  name       text,
  url        text unique,            -- unique so the same org isn't logged twice
  why        text,
  query      text,                   -- the description that surfaced it
  source     text default 'public',
  status     text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.web_finds enable row level security;

-- Public may INSERT finds (no reads); the maintainer reads/updates via service-role.
grant insert on public.web_finds to anon;
drop policy if exists web_finds_anon_insert on public.web_finds;
create policy web_finds_anon_insert on public.web_finds
  for insert to anon with check (true);
