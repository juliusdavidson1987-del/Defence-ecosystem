-- ============================================================================
-- Native feedback inbox — replaces the Google Form. The public tool posts here
-- (anon insert only); the maintainer reviews via review-node (service-role).
-- Run in the Supabase SQL editor (Run). Idempotent.
-- ============================================================================
create table if not exists public.feedback (
  id           bigint generated always as identity primary key,
  kind         text,                 -- 'General feedback / idea', 'National procurement gateway', 'New organisation to add', 'Correction', …
  org          text,                 -- organisation / context the feedback is about
  node_id      text,                 -- entry id if the feedback is tied to a node
  message      text not null,        -- the actual feedback
  submitted_by text,                 -- optional name for follow-up
  status       text not null default 'pending',
  created_at   timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Public may INSERT feedback, but not read it back (it can contain names / PII).
grant insert on public.feedback to anon;
drop policy if exists feedback_anon_insert on public.feedback;
create policy feedback_anon_insert on public.feedback
  for insert to anon with check (true);
