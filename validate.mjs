#!/usr/bin/env node
/**
 * The Defence Ecosystem — structural validator
 * ---------------------------------------------
 * Encodes every integrity check we run by hand into one script, so the same
 * discipline runs automatically on every change (locally or in CI) instead of
 * relying on someone remembering to do it.
 *
 * It checks, without needing a browser:
 *   1.  JavaScript syntax of the app's script block
 *   2.  CSS brace balance (a broken <style> is a common edit error)
 *   3.  Node id uniqueness (no two L()/B() share an id)
 *   4.  Every TAGS routing key points at a real node (no orphan tags)
 *   5.  Every node's link is on the verified allowlist (nothing renders dead)
 *   6.  GATEWAY targets exist
 *   7.  CONNECTORS targets exist
 *   8.  EVENT_NEXT covers every event node
 *   9.  NAT_OPPS portal domains are all verified
 *   10. Node-count floor (guards against an accidental mass-deletion)
 *
 * USAGE:
 *   node validate.mjs The_Defence_Ecosystem_v2.html
 *   node validate.mjs The_Defence_Ecosystem_v2.html --json
 *   node validate.mjs The_Defence_Ecosystem_v2.html --min-nodes=700
 *
 * Exit code 0 = all green, 1 = one or more failures. No dependencies (Node 18+).
 */

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const AS_JSON = args.includes('--json');
const MIN_NODES = parseInt((args.find(a => a.startsWith('--min-nodes=')) || '').split('=')[1]) || 700;

if (!file || !fs.existsSync(file)) {
  console.error('Usage: node validate.mjs <path-to-html> [--json] [--min-nodes=N]');
  process.exit(2);
}

const html = fs.readFileSync(file, 'utf8');
const results = [];
const pass = (name, detail = '') => results.push({ name, ok: true, detail });
const fail = (name, detail = '') => results.push({ name, ok: false, detail });

/* ---- 1. JS syntax of the app script block ---- */
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const appScript = scripts[scripts.length - 1] || '';
try {
  const tmp = path.join(os.tmpdir(), `tde_check_${Date.now()}.js`);
  fs.writeFileSync(tmp, appScript);
  execFileSync('node', ['--check', tmp]);
  fs.unlinkSync(tmp);
  pass('JS syntax', 'app script parses');
} catch (e) {
  fail('JS syntax', String(e.stderr || e.message).split('\n').slice(0, 3).join(' '));
}

/* ---- 2. CSS brace balance ---- */
const styleBlocks = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
const opens = (styleBlocks.match(/\{/g) || []).length;
const closes = (styleBlocks.match(/\}/g) || []).length;
opens === closes ? pass('CSS braces', `${opens} balanced`)
                 : fail('CSS braces', `mismatch: ${opens} '{' vs ${closes} '}'`);

/* ---- Parse the node ids from the TREE literal ---- */
const treeStart = html.indexOf('const TREE =');
const treeEnd = html.indexOf('/* cross-links');
const treeSrc = treeStart >= 0 && treeEnd > treeStart ? html.slice(treeStart, treeEnd) : html;
const idMatches = [...treeSrc.matchAll(/[LB]\("([a-z0-9_]+)"/g)].map(m => m[1]);

/* ---- 3. Node id uniqueness ---- */
const seen = new Set(), dupes = new Set();
idMatches.forEach(id => { if (seen.has(id)) dupes.add(id); seen.add(id); });
dupes.size === 0 ? pass('Node ids unique', `${seen.size} unique nodes`)
                 : fail('Node ids unique', `duplicates: ${[...dupes].join(', ')}`);

/* ---- 10. Node-count floor ---- */
seen.size >= MIN_NODES ? pass('Node count floor', `${seen.size} >= ${MIN_NODES}`)
                       : fail('Node count floor', `${seen.size} < ${MIN_NODES} — did a block get deleted?`);

/* ---- 4. TAGS keys resolve to nodes ---- */
// TAGS is `const TAGS={ id:{...}, ... }` — grab keys at the object's top level.
const tagsStart = html.indexOf('TAGS=', html.indexOf('let TAGS=')>=0?html.indexOf('let TAGS='):html.indexOf('const TAGS='));
if (tagsStart >= 0) {
  // find the matching close of the object literal
  const from = html.indexOf('{', tagsStart);
  let depth = 0, end = from;
  for (let i = from; i < html.length; i++) { const c = html[i]; if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { end = i; break; } } }
  const tagsSrc = html.slice(from, end + 1);
  const tagKeys = [...tagsSrc.matchAll(/(?:^|[,{]\s*)\n?\s*([a-z0-9_]+)\s*:\s*\{/g)].map(m => m[1]);
  const orphanTags = [...new Set(tagKeys)].filter(k => !seen.has(k));
  orphanTags.length === 0 ? pass('TAGS resolve', `${tagKeys.length} tags all point at nodes`)
                          : fail('TAGS resolve', `orphan tags (no node): ${orphanTags.join(', ')}`);
} else fail('TAGS resolve', 'TAGS object not found');

/* ---- Build the verified-domain set (mirror of the tool's allowlist) ---- */
const verified = new Set();
const setBlock = html.slice(html.indexOf('VERIFIED_DOMAINS'), html.indexOf('function domainVerified'));
const initMatch = setBlock.match(/new Set\(\[([\s\S]*?)\]\)/);
if (initMatch) (initMatch[1].match(/'[^']+'/g) || []).forEach(d => verified.add(d.replace(/'/g, '').toLowerCase()));
for (const m of setBlock.matchAll(/\[([\s\S]*?)\]\.forEach\(d=>VERIFIED_DOMAINS\.add\(d\)\)/g))
  (m[1].match(/'[^']+'/g) || []).forEach(d => verified.add(d.replace(/'/g, '').toLowerCase()));
function domainVerified(u) {
  let host = u.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/[.,;·]+$/, '').toLowerCase();
  if (verified.has(host)) return true;
  const parts = host.split('.');
  for (let i = 0; i < parts.length - 1; i++) if (verified.has(parts.slice(i).join('.'))) return true;
  return false;
}

/* ---- 5. Every node link is verified ---- */
// Node entries look like L("id","Label","entry-with-maybe-a-domain","does")
const nodeEntries = [...treeSrc.matchAll(/L\("([a-z0-9_]+)","(?:[^"\\]|\\.)*","((?:[^"\\]|\\.)*)"/g)];
const deadLinks = [];
for (const m of nodeEntries) {
  const id = m[1], entry = m[2];
  const dm = entry.match(/(www\.)?([a-z0-9-]+\.)+[a-z]{2,}/i);
  if (dm && !/@/.test(dm[0]) && !domainVerified(dm[0])) deadLinks.push(`${id}:${dm[0]}`);
}
deadLinks.length === 0 ? pass('Node links verified', 'no node renders a dead link')
                       : fail('Node links verified', `unverified: ${deadLinks.slice(0, 12).join(', ')}${deadLinks.length > 12 ? ` (+${deadLinks.length - 12})` : ''}`);

/* ---- 5b. Guessed-abbreviation tripwire (the nwf.org.uk / 7pc.co error class) ----
   Flags nodes whose domain is a SHORT string that shares no letters with the org
   name AND isn't the org's own acronym. These are the ones most likely to be a
   guessed/stale domain that resolves to something unrelated. It's a WARNING, not
   a failure — legitimate cryptic domains exist (kotadef.sk) — but every hit should
   be eyeballed against the live site before shipping. */
const nodeRe2 = /[LB]\("([a-z0-9_]+)",\s*"([^"]*)",\s*"([^"]*)"/g;
const suspicious = [];
let m2;
while ((m2 = nodeRe2.exec(treeSrc))) {
  const [, id, label, entry] = m2;
  const dm = entry.match(/([a-z0-9-]+\.)+[a-z]{2,}(\.[a-z]{2,})?/i);
  if (!dm || /@/.test(dm[0])) continue;
  const dom = dm[0].toLowerCase();
  const core = dom.replace(/^www\./, '').replace(/\.[a-z.]+$/, '').replace(/[^a-z0-9]/g, '');
  if (core.length > 8) continue;                       // only short domains are guess-risk
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const words = label.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length >= 4);
  const nameMatch = words.some(w => core.includes(norm(w)) || norm(w).includes(core));
  const paren = (label.match(/\(([A-Z0-9]{2,})\)/) || [])[1];
  const caps = (label.match(/\b[A-Z]{2,}\b/) || [])[0];
  const acr = (paren || caps || '').toLowerCase();
  const acrMatch = acr && (core === acr || core.startsWith(acr) || acr.startsWith(core));
  const official = /\.gov(\.|$)|gov\.uk|\.mod\.|mod\.gov|\.mil(\.|$)|nato\.int|europa\.eu|\.ac\.|\.edu(\.|$)|\.go\.jp|canada\.ca|govt\.nz|defense\.gouv|defensie\.nl|defensa\.gob|difesa\.it|defesa\.gov|\.army|kam\.lt|kormany\.hu|mosr\.sk|mod\.bg|gov\.si|forsvar|kaitse|catapult\.org|ukri\.org/i.test(dom);
  if (!nameMatch && !acrMatch && !official) suspicious.push(`${id}:${dom}`);
}
suspicious.length === 0 ? pass('Abbreviation tripwire', 'no unexplained short domains')
                        : pass('Abbreviation tripwire', `⚠ eyeball these ${suspicious.length}: ${suspicious.slice(0, 15).join(', ')}${suspicious.length > 15 ? ` (+${suspicious.length - 15})` : ''}`);

/* ---- 6/7. GATEWAY + CONNECTORS targets exist ---- */
const gwBlock = (html.match(/const GATEWAY\s*=\s*\{[\s\S]*?\};/) || [''])[0];
const gwTargets = [...gwBlock.matchAll(/:\s*'([a-z0-9_]+)'/g)].map(m => m[1]);
const gwMiss = gwTargets.filter(id => !seen.has(id));
gwMiss.length === 0 ? pass('GATEWAY targets', `${gwTargets.length} all exist`)
                    : fail('GATEWAY targets', `missing: ${gwMiss.join(', ')}`);

const conBlock = (html.match(/const CONNECTORS\s*=\s*\[[\s\S]*?\];/) || [''])[0];
const conTargets = [...conBlock.matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]);
const conMiss = conTargets.filter(id => !seen.has(id));
conMiss.length === 0 ? pass('CONNECTORS targets', `${conTargets.length} all exist`)
                     : fail('CONNECTORS targets', `missing: ${conMiss.join(', ')}`);

/* ---- 8. EVENT_NEXT covers every event node ---- */
const evNodes = [...new Set(idMatches.filter(id => id.startsWith('ev_')))];
const evBlock = (html.match(/const EVENT_NEXT\s*=\s*\{[\s\S]*?\n\};/) || [''])[0];
const evKeys = [...evBlock.matchAll(/(ev_[a-z0-9]+)\s*:/g)].map(m => m[1]);
const evMiss = evNodes.filter(id => !evKeys.includes(id));
evMiss.length === 0 ? pass('EVENT_NEXT coverage', `${evNodes.length} event nodes all dated`)
                    : fail('EVENT_NEXT coverage', `missing next-date: ${evMiss.join(', ')}`);

/* ---- 9. NAT_OPPS portal domains verified ---- */
const natBlock = (html.match(/const NAT_OPPS\s*=\s*\{[\s\S]*?\n\};/) || [''])[0];
const natDomains = [...new Set((natBlock.match(/([a-z0-9-]+\.)+[a-z]{2,}(\.[a-z]{2,})?/gi) || []))]
  .filter(d => !/@/.test(d) && !/\.(js|css|png)$/.test(d));
const natUnver = natDomains.filter(d => !domainVerified(d));
natUnver.length === 0 ? pass('NAT_OPPS portals', `${natDomains.length} portal domains all verified`)
                      : fail('NAT_OPPS portals', `unverified: ${natUnver.join(', ')}`);

/* ---- Report ---- */
const failed = results.filter(r => !r.ok);
if (AS_JSON) {
  console.log(JSON.stringify({ file, checks: results.length, failed: failed.length, results }, null, 2));
} else {
  console.log(`\nValidating ${file}\n`);
  results.forEach(r => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(22)} ${r.detail}`));
  console.log(`\n  ${failed.length === 0 ? 'ALL CHECKS PASSED' : failed.length + ' CHECK(S) FAILED'}\n`);
}
process.exit(failed.length ? 1 : 0);
