-- ============================================================================
-- Feedback attachments — let users attach a fact sheet + source link so the agent
-- can draft the right node from an authoritative source (maintainer-reviewed).
--
-- Adds columns to public.feedback and a PRIVATE storage bucket that the public may
-- upload to but not read (only the service-role — the review functions — reads it,
-- via short-lived signed URLs). Size- and type-limited server-side.
-- Run in the Supabase SQL editor (Run). Idempotent.
-- ============================================================================

alter table public.feedback add column if not exists source_url      text;
alter table public.feedback add column if not exists attachment_path text;
alter table public.feedback add column if not exists attachment_name text;
alter table public.feedback add column if not exists attachment_type text;

-- Private bucket, 10 MB cap, PDFs / images / plain text only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-uploads','feedback-uploads', false, 10485760,
        array['application/pdf','image/png','image/jpeg','image/webp','text/plain'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/png','image/jpeg','image/webp','text/plain'];

-- Public (anon) may UPLOAD into this bucket; no read/list/update/delete.
-- The service-role bypasses RLS, so the review functions read via signed URLs.
drop policy if exists "feedback_uploads_anon_insert" on storage.objects;
create policy "feedback_uploads_anon_insert" on storage.objects
  for insert to anon with check (bucket_id = 'feedback-uploads');
