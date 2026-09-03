#!/usr/bin/env node
/**
 * The Defence Ecosystem — DATA validator (data.json / Supabase model)
 * ------------------------------------------------------------------
 * Turns the integrity checks we used to run by hand into an automatic gate.
 * Validates the flat node dataset (data.json) that the tool now loads from
 * Supabase (published_nodes) with data.json as the fallback.
 *
 * Checks:
 *   1.  Valid JSON with { nodes, reference, meta }
 *   2.  Node count floor (guards against a truncated/empty fetch or mass delete)
 *   3.  Unique node ids (catches duplicate inserts)
 *   4.  Every parent exists (no orphaned nodes) — catches broken re-parents
 *   5.  Exactly one root; root has no parent
 *   6.  Valid kind ('org' | 'branch')
 *   7.  Org nodes: warn if missing an entry (a door with no link)
 *   8.  tags shape { w,o,t,d,a,g } where present; domains on the known list (warn)
 *   9.  affiliation shape { net, role, note } where present
 *   10. Affiliation count floor (catches an accidental affiliation wipe)
 *   11. Org nodes carry a geo tag (tags.g) — tagless orgs default to UK nationality (warn)
 *
 * USAGE:
 *   node validate-data.mjs data.json
 *   node validate-data.mjs data.json --json --min-nodes=1200 --min-affiliations=150
 * Exit 0 = all green, 1 = one or more failures. No dependencies (Node 18+).
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const AS_JSON = args.includes('--json');
const num = (k, def) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? parseInt(a.split('=')[1]) : def; };
const MIN_NODES = num('min-nodes', 1200);
const MIN_AFF = num('min-affiliations', 150);

if (!file || !fs.existsSync(file)) { console.error('Usage: node validate-data.mjs <data.json> [--json] [--min-nodes=N] [--min-affiliations=N]'); process.exit(2); }

const KNOWN_DOMAINS = new Set(['ai','space','cyber','c4isr','comms','maritime','land','air','counteruas','weapons','directed','hypersonic','nuclear','simulation','wargaming','training','logistics','energy','materials','human','quantum','xcut','xfund','xtest','xacad','xproc','xother']);
const KNOWN_KINDS = new Set(['org','branch']);

const results = [];
const pass = (name, detail = '') => results.push({ name, ok: true, detail });
const fail = (name, detail = '') => results.push({ name, ok: false, detail });
const warn = (name, detail = '') => results.push({ name, ok: true, warn: true, detail });

let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); pass('Valid JSON'); }
catch (e) { fail('Valid JSON', String(e.message)); report(); process.exit(1); }

const nodes = Array.isArray(data.nodes) ? data.nodes : null;
if (!nodes) { fail('Has nodes array'); report(); process.exit(1); }
pass('Has nodes array', nodes.length + ' nodes');
if (!data.reference || typeof data.reference !== 'object') warn('Has reference object', 'missing — tool still works but reference tables (gateways/connectors) absent');
else pass('Has reference object', Object.keys(data.reference).join(', '));

/* 2. count floor */
if (nodes.length >= MIN_NODES) pass('Node-count floor', `${nodes.length} ≥ ${MIN_NODES}`);
else fail('Node-count floor', `${nodes.length} < ${MIN_NODES} — possible truncated fetch or mass deletion`);

/* 3. unique ids */
const seen = new Map(); const dups = [];
nodes.forEach(n => { if (seen.has(n.id)) dups.push(n.id); seen.set(n.id, n); });
dups.length ? fail('Unique ids', `${dups.length} duplicate(s): ${[...new Set(dups)].slice(0,8).join(', ')}`) : pass('Unique ids');

/* 4. parents exist (orphans) */
const ids = new Set(nodes.map(n => n.id));
const orphans = nodes.filter(n => n.parent && !ids.has(n.parent));
orphans.length ? fail('No orphaned parents', `${orphans.length}: ${orphans.slice(0,8).map(o=>o.id+'→'+o.parent).join(', ')}`) : pass('No orphaned parents');

/* 5. exactly one root */
const roots = nodes.filter(n => !n.parent);
roots.length === 1 ? pass('Single root', roots[0].id) : (roots.length === 0 ? fail('Single root','no root node (no node without a parent)') : warn('Single root', `${roots.length} roots: ${roots.map(r=>r.id).join(', ')}`));

/* 6. valid kind */
const badKind = nodes.filter(n => n.kind && !KNOWN_KINDS.has(n.kind));
badKind.length ? fail('Valid kind', `${badKind.length} with unexpected kind: ${[...new Set(badKind.map(n=>n.kind))].join(', ')}`) : pass('Valid kind');

/* 7. org nodes have an entry (warn) */
const noEntry = nodes.filter(n => n.kind === 'org' && !(n.entry && String(n.entry).trim()));
noEntry.length ? warn('Org nodes have a link', `${noEntry.length} org node(s) with no entry (e.g. ${noEntry.slice(0,5).map(n=>n.id).join(', ')})`) : pass('Org nodes have a link');

/* 8. tags shape + domains */
let tagIssues = [], domIssues = new Set();
nodes.forEach(n => { const t = n.tags; if (!t) return;
  if (typeof t !== 'object' || !Array.isArray(t.d)) { tagIssues.push(n.id); return; }
  (t.d || []).forEach(dm => { if (!KNOWN_DOMAINS.has(dm)) domIssues.add(dm); });
});
tagIssues.length ? fail('Tags shape', `${tagIssues.length} malformed: ${tagIssues.slice(0,8).join(', ')}`) : pass('Tags shape');
domIssues.size ? warn('Known domains', `unknown domain tag(s) (will fall to cross-cutting): ${[...domIssues].join(', ')}`) : pass('Known domains');

/* 8b. org nodes should carry a geo tag (tags.g). A tagless org — or one missing g —
   falls through nationCodeFor() to the tags default {g:'uk'}, so it is silently
   treated as UK and shown UK procurement/opportunities. This is the class of bug
   that made per-nation gateways default to the UK (fixed in the app v4.3.1). */
const noGeo = nodes.filter(n => n.kind === 'org' && (!n.tags || !n.tags.g));
noGeo.length ? warn('Org geo tag', `${noGeo.length} org node(s) missing tags.g — will default to UK nationality/opportunities (e.g. ${noGeo.slice(0,6).map(n=>n.id).join(', ')})`) : pass('Org geo tag');

/* 9. affiliation shape */
const affNodes = nodes.filter(n => n.affiliation);
const badAff = affNodes.filter(n => typeof n.affiliation !== 'object' || typeof n.affiliation.net !== 'string' || typeof n.affiliation.note !== 'string');
badAff.length ? fail('Affiliation shape', `${badAff.length} malformed: ${badAff.slice(0,8).map(n=>n.id).join(', ')}`) : pass('Affiliation shape', affNodes.length + ' affiliated');

/* 10. affiliation floor */
affNodes.length >= MIN_AFF ? pass('Affiliation-count floor', `${affNodes.length} ≥ ${MIN_AFF}`) : warn('Affiliation-count floor', `${affNodes.length} < ${MIN_AFF} — did an affiliation set get dropped?`);

report();
const failed = results.filter(r => !r.ok);
process.exit(failed.length ? 1 : 0);

function report() {
  if (AS_JSON) { console.log(JSON.stringify({ file, version: data && data.meta && data.meta.version, results }, null, 2)); return; }
  console.log(`\nDefence Ecosystem — data validation: ${file}` + (data && data.meta && data.meta.version ? `  (v${data.meta.version})` : ''));
  console.log('─'.repeat(64));
  for (const r of results) console.log(`  ${r.ok ? (r.warn ? '⚠' : '✓') : '✗'}  ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  const f = results.filter(r => !r.ok).length, w = results.filter(r => r.warn).length;
  console.log('─'.repeat(64));
  console.log(f ? `  ✗ ${f} FAILED${w ? `, ${w} warning(s)` : ''}` : `  ✓ ALL CHECKS PASSED${w ? `, ${w} warning(s)` : ''}\n`);
}
