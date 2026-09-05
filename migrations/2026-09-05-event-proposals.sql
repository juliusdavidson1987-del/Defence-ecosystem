-- ============================================================================
-- Events rework — Phase 2: the date-refresh agent's review queue.
--
-- A weekly agent (event-refresh Edge Function) web-checks each anchor fair's
-- next edition and, when the official source differs from what's stored in
-- reference.event_next, files a PROPOSED change here for the maintainer. Dates
-- are high-stakes (people book travel), so nothing auto-publishes — you approve
-- in admin-drafter.html, which writes the new date into reference.event_next.
--
-- Service-role only (the agent writes; the admin functions read/update). No anon
-- access. Run in the Supabase SQL editor (Run). Idempotent.
-- ============================================================================
create table if not exists public.event_date_proposals (
  id             bigint generated always as identity primary key,
  node_id        text not null,           -- the event node (e.g. ev_dsei)
  current_next   text,                     -- what reference.event_next holds now
  current_where  text,
  proposed_next  text,                     -- what the official source now says
  proposed_where text,
  source_url     text,                     -- where the agent found it
  confidence     real,                     -- 0..1
  note           text,
  status         text not null default 'pending',   -- pending | approved | dismissed
  created_at     timestamptz not null default now()
);

alter table public.event_date_proposals enable row level security;
-- No policies / no anon grants: only the service-role (agent + review functions) touches it.
