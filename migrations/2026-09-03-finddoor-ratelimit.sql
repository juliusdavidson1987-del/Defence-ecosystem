-- ============================================================================
-- Find your door (AI) — rate-limit store for the public `find-door` function.
-- Run in the Supabase SQL editor (Run). Idempotent.
--
-- This is NOT part of the dataset (nodes). It only meters public calls to the
-- Claude-powered search so the Anthropic bill stays bounded. The public
-- function increments it via the SECURITY DEFINER RPC below using the anon key
-- — it never gets direct table access, and no service-role key is involved.
-- ============================================================================

create table if not exists public.rate_limits (
  key     text primary key,
  count   int  not null default 0,
  updated timestamptz not null default now()
);

-- Lock the table down: only the SECURITY DEFINER function (below) touches it.
alter table public.rate_limits enable row level security;

-- Atomic increment; returns the new count for this key.
create or replace function public.increment_rate(p_key text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare new_count int;
begin
  insert into public.rate_limits (key, count, updated)
    values (p_key, 1, now())
  on conflict (key) do update
    set count = public.rate_limits.count + 1, updated = now()
  returning count into new_count;
  return new_count;
end;
$$;

-- Let the public (anon) role call the meter, but nothing else.
grant execute on function public.increment_rate(text) to anon;

-- Optional housekeeping later: delete rows whose key ends in an old date.
-- delete from public.rate_limits where updated < now() - interval '7 days';
