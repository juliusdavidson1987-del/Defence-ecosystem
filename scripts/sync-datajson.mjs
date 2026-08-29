#!/usr/bin/env node
/**
 * The Defence Ecosystem — Supabase → data.json sync
 * -------------------------------------------------
 * Makes Supabase the single source of truth. Pulls the same data the live tool
 * reads (the `published_nodes` view + the `reference` key/value table), maps it
 * into the data.json shape the fallback loader expects, and writes data.json.
 *
 * Paginates in pages of 1000 so it can never be silently clipped by Supabase's
 * "Max rows" setting (the bug that once hid new nodes). Preserves the semantic
 * meta.version from the existing data.json so the auto-sync doesn't lose the stamp.
 *
 * USAGE (locally or in CI):
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node sync-datajson.mjs [outfile]
 * Defaults to the project's public URL + anon key (already public in the client)
 * and writes ./data.json. Exit 0 on success, non-zero on failure.
 */
import fs from 'node:fs';

// Public values (already embedded in the shipped client) — override via env if desired.
const URL = (process.env.SUPABASE_URL || 'https://igvxlmbndpuegibykygq.supabase.co').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_Z2z6XuJERV6eosZsnnFnAA_AiBfHkyf';
const OUT = process.argv[2] || 'data.json';
const PAGE = 1000;
const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY };

// Map a Supabase (snake_case) row into the data.json node shape applyData expects.
function rowToNode(r) {
  const n = { id: r.id, label: r.label, parent: r.parent, kind: r.kind, entry: r.entry || '', does: r.does || '' };
  if (r.order != null) n.order = r.order;
  if (r.depth != null) n.depth = r.depth;         // cosmetic; the tool re-derives depth from nesting
  if (r.tags) n.tags = r.tags;
  if (r.affiliation) n.affiliation = r.affiliation;
  if (r.entry_point) n.entryPoint = r.entry_point;
  if (r.opps_override) n.oppsOverride = r.opps_override;
  if (r.funding) n.funding = r.funding;
  if (r.entity_type_override) n.entityTypeOverride = r.entity_type_override;
  if (r.source) n.source = r.source;
  return n;
}

async function fetchAllNodes() {
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${URL}/rest/v1/published_nodes?select=*&order=id.asc&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`nodes fetch failed: HTTP ${res.status} ${await res.text().catch(() => '')}`);
    const rows = await res.json();
    all.push(...rows);
    if (rows.length < PAGE) break;              // last page
    if (offset > 100000) throw new Error('pagination runaway — aborting');
  }
  return all;
}

async function fetchReference() {
  const res = await fetch(`${URL}/rest/v1/reference?select=key,value`, { headers });
  if (!res.ok) return {};                        // reference is optional
  const rows = await res.json();
  const ref = {};
  rows.forEach(x => { ref[x.key] = x.value; });
  return ref;
}

(async () => {
  try {
    const [rows, reference] = await Promise.all([fetchAllNodes(), fetchReference()]);
    if (!rows.length) throw new Error('published_nodes returned 0 rows — refusing to overwrite data.json');

    const nodes = rows.map(rowToNode);
    const orgs = nodes.filter(n => n.kind === 'org').length;
    const branches = nodes.filter(n => n.kind === 'branch').length;

    // preserve semantic meta from the existing file where present
    let prevMeta = {};
    try { prevMeta = (JSON.parse(fs.readFileSync(OUT, 'utf8')).meta) || {}; } catch (_) {}

    const data = {
      meta: {
        name: prevMeta.name || 'The Defence Ecosystem',
        schema_version: prevMeta.schema_version || 1,
        version: prevMeta.version || null,        // semantic version is set manually on release
        asOf: prevMeta.asOf || null,
        generated: new Date().toISOString().slice(0, 10),
        source: 'supabase-sync',
        counts: { total_nodes: nodes.length, organisations: orgs, branches: branches }
      },
      nodes,
      reference
    };

    fs.writeFileSync(OUT, JSON.stringify(data));
    console.error(`✓ synced ${nodes.length} nodes (${orgs} orgs, ${branches} branches), ${Object.keys(reference).length} reference tables → ${OUT}`);
  } catch (e) {
    console.error('✗ sync failed:', e.message);
    process.exit(1);
  }
})();
