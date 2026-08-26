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
const TIMEOUT = parseInt((args.find(a => a.startsWith('--slow=')) || '').split('=')[1]) || 20000;
const CONCURRENCY = parseInt((args.find(a => a.startsWith('--conc=')) || '').split('=')[1]) || 5;

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

/* ---- 3. Check each URL ----
   Two changes that dramatically cut false alarms:
   (a) send a realistic browser User-Agent + Accept headers. Many defence/gov
       sites return 403 to anything that looks like a bot; a browser UA gets
       through, so a 403 in the result now much more likely means a REAL block.
   (b) retry once (with GET) on a timeout or transient network error, since a
       single slow response when hammering 600+ hosts is usually noise, not a
       dead link. */
async function attempt(url, method) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { method, redirect: 'follow', signal: ctrl.signal, headers: UA });
    clearTimeout(timer);
    return { res };
  } catch (e) {
    clearTimeout(timer);
    return { err: e };
  }
}
// errors worth a second try — transient network / slow-server conditions, not real 404s
const TRANSIENT = new Set(['timeout','UND_ERR_CONNECT_TIMEOUT','ETIMEDOUT','ECONNRESET','EAI_AGAIN','UND_ERR_SOCKET']);
function errReason(e){ return e.name === 'AbortError' ? 'timeout' : (e.cause && e.cause.code) || e.message; }
async function check(t) {
  const started = Date.now();
  // Try HEAD first (cheap); fall back to GET on rejection.
  let { res, err } = await attempt(t.url, 'HEAD');
  if (res && (res.status === 405 || res.status === 501 || res.status === 403)) {
    ({ res, err } = await attempt(t.url, 'GET'));
  }
  // retry once on transient failure, with a GET (more widely accepted than HEAD)
  if (err && TRANSIENT.has(errReason(err))) {
    await new Promise(r => setTimeout(r, 400));
    ({ res, err } = await attempt(t.url, 'GET'));
  }
  if (res) return { ...t, status: res.status, ok: res.status >= 200 && res.status < 400, finalUrl: res.url, ms: Date.now() - started };
  return { ...t, status: 0, ok: false, error: errReason(err), ms: Date.now() - started };
}
// A current, realistic desktop-Chrome header set — makes gov/defence sites treat us like a browser.
const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Upgrade-Insecure-Requests': '1'
};

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

  // Classify dead links so the report triages itself.
  // "Likely real" = the server answered and said the page/domain is gone (404/410),
  //   or DNS genuinely can't find it (ENOTFOUND) on a non-.mil host.
  // "Likely a block or transient" = 403 (bot-block), 429 (rate-limit), 5xx (server
  //   hiccup), cert quirks, timeouts, resets — these usually work in a real browser.
  const LIKELY_REAL = r => {
    const s = r.status;
    if (s === 404 || s === 410) return true;
    const e = String(r.error || '');
    // ENOTFOUND on a .mil host is usually a resolver/geo quirk, not a dead site — treat as uncertain
    if (e === 'ENOTFOUND' && !/\.mil(\/|$)|\.mil"/.test(r.url) && !/\bmil\./.test(r.host||'')) return true;
    return false;
  };
  const realDead = dead.filter(LIKELY_REAL);
  const softDead = dead.filter(r => !LIKELY_REAL(r));

  if (AS_JSON) {
    console.log(JSON.stringify({ checked: results.length, dead: dead.length, realDead: realDead.length, softDead: softDead.length, redirected: redirected.length, results }, null, 2));
  } else {
    console.log('\n──────── SUMMARY ────────');
    console.log(`  Checked:        ${results.length} URLs`);
    console.log(`  Likely broken:  ${realDead.length}   ← focus here`);
    console.log(`  Blocked/slow:   ${softDead.length}   (403 / timeout / cert / 5xx — usually fine in a browser)`);
    console.log(`  Redirected:     ${redirected.length}   (check the destination is still the right body)`);
    if (realDead.length) {
      console.log('\n  LIKELY BROKEN — verify in a browser, then fix or report:');
      realDead.sort((a,b)=>a.host.localeCompare(b.host)).forEach(r => console.log(`    ✗ ${r.url}  — ${r.error || 'HTTP ' + r.status}${r.verified ? '' : '  [plain]'}`));
    }
    if (softDead.length) {
      console.log('\n  BLOCKED / SLOW / CERT — probably fine; spot-check only if you like:');
      softDead.sort((a,b)=>a.host.localeCompare(b.host)).forEach(r => console.log(`    ? ${r.url}  — ${r.error || 'HTTP ' + r.status}`));
    }
    if (redirected.length) {
      console.log('\n  REDIRECTS (check the destination is still the right body):');
      redirected.forEach(r => console.log(`    → ${r.url}  ->  ${r.finalUrl}`));
    }
    console.log('');
  }
  // Only fail the run for a VERIFIED link that is LIKELY genuinely broken (404/410/real DNS miss).
  // Bot-blocks and timeouts no longer fail CI — they were the source of false failures.
  process.exit(realDead.some(r => r.verified) ? 1 : 0);
}

if (!AS_JSON) {
  console.log(`\nChecking ${targets.length} URLs from ${file}`);
  console.log(`(browser UA + retry-once; timeout ${TIMEOUT}ms, concurrency ${CONCURRENCY}${CHECK_ALL ? ', including plain/unverified' : ', verified links only — pass --all to include plain'})`);
  console.log(`(results split into "likely broken" vs "blocked/slow" — focus on the first list)\n`);
}
run();
