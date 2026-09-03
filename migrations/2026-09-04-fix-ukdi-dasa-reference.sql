-- ============================================================================
-- Reference tidy: the UK procurement guidance still listed "UKDI/DASA" as two
-- parallel routes. DASA was absorbed into UK Defence Innovation (UKDI) on
-- 1 July 2025 (UKDI sits within the NAD Group), so it's now one route: UKDI.
-- Updates reference.nations_procurement.uk. Run in Supabase, then re-sync.
-- ============================================================================
update public.reference
   set value = jsonb_set(
         value, '{uk}',
         to_jsonb('UK — tenders on Find a Tender (www.find-tender.service.gov.uk) and Contracts Finder; MOD suppliers via the Defence Sourcing Portal (Jaggaer). Innovation via UK Defence Innovation (UKDI) competitions (gov.uk).'::text)
       )
 where key = 'nations_procurement';
