-- ============================================================================
-- v4.13.0 — Relationship edges: SCHEMA  (trust programme, phase 3 / stage A)
-- ----------------------------------------------------------------------------
-- Typed, dated, evidenced links between organisations, so the map can answer path
-- questions ("how does this SME reach DE&S, via which accelerator, still current?").
-- This stage creates the tables only. Stage B backfills from the existing 188
-- affiliations (a script → SQL + a CSV review list). Stage C adds the path RPC,
-- the JS mirror, and the "Find a route" UI. ADDITIVE ONLY — nothing else changes.
--
-- Run in the Supabase SQL editor (Run). Idempotent. Public READ; writes are
-- service-role only (mirrors how published data is gated — the public path never
-- writes edges directly).
-- ============================================================================

-- 1. relationships ------------------------------------------------------------
create table if not exists public.relationships (
  id               uuid primary key default gen_random_uuid(),
  source_node_id   text not null references public.nodes(id) on delete cascade,
  target_node_id   text not null references public.nodes(id) on delete cascade,
  relationship_type text not null default 'unclassified',
  directed         boolean not null default true,
  valid_from       date,
  valid_to         date,
  last_verified_at date,
  verified_by      text,
  source_url       text,
  evidence_note    text,
  evidence_status  text not null default 'unverified',
  origin           text not null default 'manual',
  attributes       jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint relationships_no_self_loop check (source_node_id <> target_node_id),
  constraint relationships_valid_dates  check (valid_to is null or valid_from is null or valid_to > valid_from),
  constraint relationships_type_chk     check (relationship_type in
    ('funds','accelerates','part_of','subsidiary_of','member_of','partners_with',
     'contracts_with','sponsors','delivers_to','unclassified')),
  constraint relationships_evidence_chk check (evidence_status in ('verified','unverified','ai_drafted')),
  constraint relationships_origin_chk   check (origin in ('manual','community','ai_drafted','auto_maintainer','curated'))
);
-- one edge per (source, target, type, start) — coalesce so NULL starts don't dupe
create unique index if not exists relationships_uniq
  on public.relationships (source_node_id, target_node_id, relationship_type, coalesce(valid_from, '0001-01-01'));
create index if not exists relationships_src on public.relationships (source_node_id);
create index if not exists relationships_tgt on public.relationships (target_node_id);
create index if not exists relationships_type on public.relationships (relationship_type);

-- 2. relationships_history (append-only audit via trigger) --------------------
create table if not exists public.relationships_history (
  id       bigint generated always as identity primary key,
  rel_id   uuid,
  action   text not null,                 -- insert | update | delete
  actor    text,                          -- DB role that made the change
  at       timestamptz not null default now(),
  old_row  jsonb,
  new_row  jsonb
);

create or replace function public.relationships_log() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.relationships_history(rel_id, action, actor, new_row)
      values (new.id, 'insert', current_user, to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    new.updated_at := now();
    insert into public.relationships_history(rel_id, action, actor, old_row, new_row)
      values (new.id, 'update', current_user, to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.relationships_history(rel_id, action, actor, old_row)
      values (old.id, 'delete', current_user, to_jsonb(old));
    return old;
  end if;
  return null;
end $$;

drop trigger if exists relationships_log_trg on public.relationships;
create trigger relationships_log_trg
  before insert or update or delete on public.relationships
  for each row execute function public.relationships_log();

-- 3. RLS: public read, writes service-role only -------------------------------
alter table public.relationships         enable row level security;
alter table public.relationships_history enable row level security;

drop policy if exists relationships_public_read on public.relationships;
create policy relationships_public_read on public.relationships for select using (true);
-- No INSERT/UPDATE/DELETE policy => denied for the anon key. The service-role key
-- (server-side only) bypasses RLS, so edges are written only by gated tooling.
-- relationships_history has NO policy at all => not readable by anon (service-role only).

-- Done. Next: stage B backfills edges from affiliations (script → SQL + CSV review list).
