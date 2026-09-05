-- ============================================================================
-- Stage 4 — Auto-maintainer agent: per-queue "assessed & held" bookkeeping.
--
-- The daily agent (auto-maintain Edge Function) auto-applies the clear-cut items
-- and HOLDS the uncertain ones for the maintainer. To avoid re-burning AI on the
-- same held item every night, and to show its recommendation in the admin console,
-- each review table gets three nullable columns:
--
--   auto_assessed_at  when the agent last looked at this row
--   auto_action       what it recommends you do  (stage | review | publish | reject | approve | resolve | dismiss)
--   auto_reason       one-line rationale (shown next to your Publish/Reject buttons)
--
-- The agent only processes pending rows where auto_assessed_at IS NULL, so once a
-- row is held it drops out of the nightly pass until you act on it (which moves it
-- out of the pending bucket entirely). Idempotent — safe to run more than once.
-- Run in the Supabase SQL editor (Run), then re-deploy the function.
-- ============================================================================

alter table public.nodes      add column if not exists auto_assessed_at timestamptz;
alter table public.nodes      add column if not exists auto_action      text;
alter table public.nodes      add column if not exists auto_reason      text;

alter table public.edits      add column if not exists auto_assessed_at timestamptz;
alter table public.edits      add column if not exists auto_action      text;
alter table public.edits      add column if not exists auto_reason      text;

alter table public.claims     add column if not exists auto_assessed_at timestamptz;
alter table public.claims     add column if not exists auto_action      text;
alter table public.claims     add column if not exists auto_reason      text;

alter table public.feedback   add column if not exists auto_assessed_at timestamptz;
alter table public.feedback   add column if not exists auto_action      text;
alter table public.feedback   add column if not exists auto_reason      text;

alter table public.web_finds  add column if not exists auto_assessed_at timestamptz;
alter table public.web_finds  add column if not exists auto_action      text;
alter table public.web_finds  add column if not exists auto_reason      text;

-- A daily run log, so the "Last agent run" card and the analytics can show what
-- the agent did each night without re-reading every queue. One row per run.
create table if not exists public.auto_runs (
  id          bigint generated always as identity primary key,
  ran_at      timestamptz not null default now(),
  applied     int  not null default 0,     -- items auto-actioned
  held        int  not null default 0,     -- items left for the maintainer
  digest      text,                         -- the markdown summary
  detail      jsonb                         -- structured {actions:[…], held:[…]}
);

alter table public.auto_runs enable row level security;
-- No anon access at all; only the service-role (agent + admin functions) reads/writes.
