#!/usr/bin/env node
/**
 * The Defence Ecosystem — link checker (data.json)
 * ------------------------------------------------
 * Reads every node's `entry` from data.json, resolves it to a hostname, and
 * checks the URL is reachable. Automates the "verify the URLs" pass we used to
 * do by hand. Non-URL entries (e.g. "Part of the NAD Group") are skipped.
 *
 * USAGE:  node check-links.mjs data.json [--json] [--all] [--concurrency=12]
 * Exit 0 if no dead links, 1 if any dead link is found (so CI can flag it).
 * No dependencies (Node 18+).
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const AS_JSON = args.includes('--json');
const CONC = parseInt((args.find(a => a.startsWith('--concurrency=')) || '').split('=')[1]) || 12;
if (!file || !fs.existsSync(file)) { console.error('Usage: node check-links.mjs <data.json> [--json] [--concurrency=N]'); process.exit(2); }

const data = JSON.parse(fs.readFileSync(file, 'utf8'));

// Extract a fetchable hostname+path from an entry string like:
//   "nssif.gov.uk"  |  "GOV.UK › DSIT"  |  "british-business-bank.co.uk › NSSIF"  |  "example.com · London"
function toUrl(entry) {
  if (!entry) return null;
  let s = String(entry).split(/[›·|]/)[0].trim();          // take the part before a separator
  s = s.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/[.,;]+$/, '').trim().toLowerCase();
  // must look like a domain (has a dot and a TLD, no spaces)
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return null;
  return 'https://' + s;
}

const targets = [];
const seen = new Set();
for (const n of data.nodes || []) {
  const url = toUrl(n.entry);
  if (!url || seen.has(url)) continue;
  seen.add(url);
  targets.push({ url, id: n.id, label: n.label });
}

async function attempt(url, method) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { method, redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'DefenceEcosystem-linkcheck/1.0' } });
    return res.status;
  } finally { clearTimeout(t); }
}
async function check(t) {
  try {
    let status = await attempt(t.url, 'HEAD').catch(() => null);
    if (status == null || status >= 400) status = await attempt(t.url, 'GET');   // some hosts refuse HEAD
    return { ...t, status, ok: status < 400 };
  } catch (e) {
    return { ...t, status: 0, ok: false, err: e.name === 'AbortError' ? 'timeout' : (e.cause && e.cause.code) || e.message };
  }
}

(async () => {
  const results = [];
  let i = 0;
  async function worker() { while (i < targets.length) { const t = targets[i++]; results.push(await check(t)); } }
  await Promise.all(Array.from({ length: Math.min(CONC, targets.length) }, worker));
  const dead = results.filter(r => !r.ok);
  if (AS_JSON) { console.log(JSON.stringify({ checked: results.length, dead }, null, 2)); }
  else {
    console.log(`\nLink check: ${results.length} unique URLs checked, ${dead.length} dead.`);
    for (const d of dead.sort((a, b) => a.id.localeCompare(b.id))) console.log(`  ✗ ${d.status || d.err}  ${d.url}  [${d.id}] ${d.label}`);
    if (!dead.length) console.log('  ✓ all reachable\n');
  }
  process.exit(dead.length ? 1 : 0);
})();
