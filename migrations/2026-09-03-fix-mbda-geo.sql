-- ============================================================================
-- Cosmetic: set the geo-lens tag (tags.g) for MBDA France and MBDA Italia to
-- their own country (was 'eu'). Nationality already resolves correctly from the
-- fr_/it_ id prefix — this only affects the technology/geo lens bucket.
-- Merges g into the existing tags jsonb (keeps w/o/t/d/a). Idempotent.
-- Run in the Supabase SQL editor (Run), then re-run the sync.
-- ============================================================================
update public.nodes set tags = tags || '{"g":"fr"}'::jsonb where id = 'fr_mbda';
update public.nodes set tags = tags || '{"g":"it"}'::jsonb where id = 'it_mbdait';
