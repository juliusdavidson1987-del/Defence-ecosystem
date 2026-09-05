#!/usr/bin/env node
/**
 * The Defence Ecosystem — taxonomy v2 retag orchestrator (one-off)
 * ---------------------------------------------------------------
 * Drives the gated `retag` Edge Function through every org node in batches,
 * refining domain tags into the v2 subcategories. DRY_RUN=true (the default)
 * previews the proposed changes without writing; DRY_RUN=false applies them
 * (the function snapshots old tags to retag_backup first). Writes the full change
 * list to retag-changes.json.
 *
 * ENV:
 *   DRAFTER_SHARED_SECRET   (required)
 *   RETAG_URL               full function URL, else derived from SUPABASE_URL
 *   SUPABASE_URL            https://<ref>.supabase.co
 *   DRY_RUN=true            preview only (set 'false' to apply)
 *   BATCH=25                nodes per function call
 *   MAX_ITERS=120           safety cap
 */
import fs from "node:fs";

const SECRET = process.env.DRAFTER_SHARED_SECRET || "";
const DRY = !/^(0|false|no)$/i.test(process.env.DRY_RUN ?? "true");
const BATCH = Number(process.env.BATCH) || 25;
const MAX_ITERS = Number(process.env.MAX_ITERS) || 120;

function functionUrl() {
  if (process.env.RETAG_URL) return process.env.RETAG_URL.replace(/\/+$/, "");
  const base = process.env.SUPABASE_URL || "https://igvxlmbndpuegibykygq.supabase.co";
  const m = base.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  if (!m) throw new Error("cannot derive function URL — set RETAG_URL");
  return `https://${m[1]}.functions.supabase.co/retag`;
}
const URL = functionUrl();
const headers = { "Content-Type": "application/json", "x-drafter-secret": SECRET };

async function call(payload) {
  const res = await fetch(URL, { method: "POST", headers, body: JSON.stringify(payload) });
  const text = await res.text();
  let j = {}; try { j = JSON.parse(text); } catch { /* {} */ }
  if (!res.ok) throw new Error(`retag HTTP ${res.status}: ${j.error || text.slice(0, 200)}`);
  return j;
}

(async () => {
  if (!SECRET) { console.error("✗ DRAFTER_SHARED_SECRET is required"); process.exit(1); }
  console.error(`→ retag: ${URL}  (${DRY ? "DRY RUN — no writes" : "APPLYING CHANGES"})`);
  const changed = [];
  let offset = 0, processed = 0, iters = 0, error = null;
  for (; iters < MAX_ITERS; iters++) {
    let r;
    try { r = await call({ op: "run", limit: BATCH, offset, dryRun: DRY }); }
    catch (e) { error = e.message; console.error(`✗ ${e.message}`); break; }
    processed += r.processed || 0;
    changed.push(...(r.changed || []));
    console.error(`  offset ${offset}: processed ${r.processed}, +${(r.changed || []).length} changed (running total: ${changed.length})`);
    if (r.done) break;
    offset = r.nextOffset;
  }

  fs.writeFileSync("retag-changes.json", JSON.stringify({ dryRun: DRY, processed, changed }, null, 2));
  console.log(`\n${DRY ? "DRY RUN" : "APPLIED"} — ${processed} org nodes processed, ${changed.length} would${DRY ? "" : " have"} change${DRY ? "" : "d"}.`);
  // Sample for the log.
  changed.slice(0, 40).forEach((c) => console.log(`  ${c.id}: [${c.old.join(", ") || "—"}] → [${c.new.join(", ")}]  (${c.label})`));
  if (changed.length > 40) console.log(`  … and ${changed.length - 40} more (see retag-changes.json).`);
  if (DRY) console.log(`\nPreview only. Re-run with DRY_RUN=false to apply (old tags are backed up to retag_backup).`);
  else console.log(`\nApplied. Run the data.json sync, then hard-refresh. Revert if needed: update nodes n set tags=b.old_tags from retag_backup b where n.id=b.id;`);
  if (error) process.exit(1);
})();
