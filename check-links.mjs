#!/usr/bin/env node
/**
 * The Defence Ecosystem — automated link checker
 * ------------------------------------------------
 * Fetches every clickable URL in the tool and reports which ones are dead,
 * redirected, or slow. This is the "live" check the browser can't do itself
 * (browsers block cross-origin requests), so run it periodically — say monthly,
 * or before any deployment — to catch links that have gone stale.
 *
 * USAGE:
 *   node check-links.mjs The_Defence_Ecosystem_v2.html
 *   node check-links.mjs The_Defence_Ecosystem_v2.html --all      # also check "plain" (unverified) domains
 *   node check-links.mjs The_Defence_Ecosystem_v2.html --json     # machine-readable output
 *   node check-links.mjs The_Defence_Ecosystem_v2.html --slow=8000 # custom timeout (ms)
 *
 * No dependencies — uses Node's built-in fetch (Node 18+).
 * Exit code is 0 if no dead links, 1 if any dead links are found (handy for CI).
 */

import fs from 'node:fs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const CHECK_ALL = args.includes('--all');
const AS_JSON = args.includes('--json');
const TIMEOUT = parseInt((args.find(a => a.startsWith('--slow=')) || '').split('=')[1]) || 12000;
const CONCURRENCY = 8;

if (!file) {
  console.error('Usage: node check-links.mjs <path-to-html> [--all] [--json] [--slow=ms]');
  process.exit(2);
}
if (!fs.existsSync(file)) {
  console.error('File not found: ' + file);
  process.exit(2);
}

const html = fs.readFileSync(file, 'utf8');

/* ---- 1. Extract the verified-domain allowlist (the links the tool treats as clickable) ---- */
const verified = new Set();
// initial Set([...]) plus every [...].forEach(d=>VERIFIED_DOMAINS.add(d)) batch
const setBlock = html.slice(html.indexOf('VERIFIED_DOMAINS'), html.indexOf('function domainVerified'));
const initMatch = setBlock.match(/new Set\(\[([\s\S]*?)\]\)/);
if (initMatch) (initMatch[1].match(/'[^']+'/g) || []).forEach(d => verified.add(d.replace(/'/g, '').toLowerCase()));
for (const m of setBlock.matchAll(/\[([\s\S]*?)\]\.forEach\(d=>VERIFIED_DOMAINS\.add\(d\)\)/g)) {
  (m[1].match(/'[^']+'/g) || []).forEach(d => verified.add(d.replace(/'/g, '').toLowerCase()));
}

function domainVerified(host) {
  host = host.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/[.,;·]+$/, '').toLowerCase();
  if (verified.has(host)) return true;
  const parts = host.split('.');
  for (let i = 0; i < parts.length - 1; i++) if (verified.has(parts.slice(i).join('.'))) return true;
  return false;
}

/* ---- 2. Harvest every domain-like token that appears in the tool's data ---- */
// Match the same shape the tool's linkifiers use, but be generous so we also see "plain" ones.
const tokenRe = /\b(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s"'·,)]*)?/gi;
const raw = new Set();
for (const m of html.matchAll(tokenRe)) {
  let t = m[0].replace(/[.,;·]+$/, '');
  // skip asset/file references and obvious non-links
  if (/\.(js|css|png|jpg|jpeg|svg|gif|webp|ico|json|woff2?|ttf)$/i.test(t)) continue;
  if (/^\d+\.\d+/.test(t)) continue;            // version numbers
  if (t.length < 4 || t.indexOf('.') < 1) continue;
  raw.add(t);
}

// Split into verified (clickable in the tool) vs plain (shown as dead text on purpose)
const targets = [];
for (const t of raw) {
  const host = t.replace(/\/.*$/, '');
  const isVerified = domainVerified(host);
  if (isVerified || CHECK_ALL) targets.push({ url: 'https://' + t, host, verified: isVerified });
}
targets.sort((a, b) => a.host.localeCompare(b.host));

/* ---- 3. Check each URL ---- */
async function check(t) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  const started = Date.now();
  try {
    // Try HEAD first (cheap); some servers reject it, so fall back to GET.
    let res = await fetch(t.url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: UA });
    if (res.status === 405 || res.status === 501 || res.status === 403) {
      res = await fetch(t.url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: UA });
    }
    clearTimeout(timer);
    return { ...t, status: res.status, ok: res.status >= 200 && res.status < 400, finalUrl: res.url, ms: Date.now() - started };
  } catch (e) {
    clearTimeout(timer);
    const reason = e.name === 'AbortError' ? 'timeout' : (e.cause && e.cause.code) || e.message;
    return { ...t, status: 0, ok: false, error: reason, ms: Date.now() - started };
  }
}
const UA = { 'User-Agent': 'DefenceEcosystem-LinkCheck/1.0 (+maintenance script)' };

async function run() {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < targets.length) {
      const t = targets[i++];
      const r = await check(t);
      results.push(r);
      if (!AS_JSON) {
        const flag = r.ok ? 'OK ' : 'DEAD';
        const extra = r.ok
          ? (r.finalUrl && r.finalUrl.replace(/\/$/, '') !== t.url.replace(/\/$/, '') ? '  -> redirects to ' + r.finalUrl : '')
          : '  (' + (r.error || r.status) + ')';
        const tag = t.verified ? '' : ' [plain]';
        process.stdout.write(`  ${flag}  ${r.status || '-'}  ${t.url}${tag}${extra}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const dead = results.filter(r => !r.ok);
  const redirected = results.filter(r => r.ok && r.finalUrl && r.finalUrl.replace(/\/$/, '') !== r.url.replace(/\/$/, ''));

  if (AS_JSON) {
    console.log(JSON.stringify({ checked: results.length, dead: dead.length, redirected: redirected.length, results }, null, 2));
  } else {
    console.log('\n──────── SUMMARY ────────');
    console.log(`  Checked:     ${results.length} URLs`);
    console.log(`  Dead:        ${dead.length}`);
    console.log(`  Redirected:  ${redirected.length}  (worth reviewing — the tool may show an out-of-date address)`);
    if (dead.length) {
      console.log('\n  DEAD LINKS (fix these):');
      dead.sort((a,b)=>a.host.localeCompare(b.host)).forEach(r => console.log(`    ✗ ${r.url}  — ${r.error || 'HTTP ' + r.status}${r.verified ? '' : '  [plain, not clickable in tool]'}`));
    }
    if (redirected.length) {
      console.log('\n  REDIRECTS (check the destination is still the right body):');
      redirected.forEach(r => console.log(`    → ${r.url}  ->  ${r.finalUrl}`));
    }
    console.log('');
  }
  // Only fail the run for dead VERIFIED links — those are the ones that look clickable but break.
  process.exit(dead.some(r => r.verified) ? 1 : 0);
}

if (!AS_JSON) {
  console.log(`\nChecking ${targets.length} URLs from ${file}`);
  console.log(`(timeout ${TIMEOUT}ms, concurrency ${CONCURRENCY}${CHECK_ALL ? ', including plain/unverified' : ', verified links only — pass --all to include plain'})\n`);
}
run();
