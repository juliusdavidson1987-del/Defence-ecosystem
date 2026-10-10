#!/usr/bin/env node
/**
 * Path-finder parity test (v4.13.0, stage D).
 * ------------------------------------------------------------------------
 * Confirms the Postgres find_paths() RPC and the app's JS path-finder agree:
 * for a set of org pairs, the SET of simple paths each returns must be identical.
 * Ports the JS algorithm here and calls the deployed RPC over the public anon key.
 *
 *   node scripts/path-parity-test.mjs [data.json]
 *
 * Requires the find_paths RPC to be deployed (migrations/2026-10-10-find-paths-rpc.sql);
 * if it isn't, the test reports that and exits 0 (nothing to compare yet). Exits 1 on a
 * genuine mismatch.
 */
import fs from 'node:fs';

const URL = (process.env.SUPABASE_URL || 'https://igvxlmbndpuegibykygq.supabase.co').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_Z2z6XuJERV6eosZsnnFnAA_AiBfHkyf';
const data = JSON.parse(fs.readFileSync(process.argv[2] || 'data.json', 'utf8'));
const rels = data.relationships || [];
if (!rels.length) { console.log('No relationships in data.json — nothing to test.'); process.exit(0); }

// ---- JS port of the app's path-finder (undirected, cycle-prevented) --------
function buildEdges(rs){ const E={}; rs.forEach(e=>{ if(!e||!e.source||!e.target||e.source===e.target) return;
  (E[e.source]||(E[e.source]=[])).push({to:e.target,via:e}); (E[e.target]||(E[e.target]=[])).push({to:e.source,via:e}); }); return E; }
const E = buildEdges(rels);
function jsPaths(from,to,maxHops=4){ const res=[]; let ex=0;
  (function dfs(node,seen,path){ if(res.length>=1000||ex>100000||(path.length-1)>=maxHops) return;
    for(const a of (E[node]||[])){ ex++; if(seen.has(a.to)) continue; const np=path.concat([a.to]);
      if(a.to===to){ res.push(np); continue; } seen.add(a.to); dfs(a.to,seen,np); seen.delete(a.to); } })(from,new Set([from]),[from]);
  return res;
}

async function rpcPaths(from,to){
  const res = await fetch(URL+'/rest/v1/rpc/find_paths', { method:'POST',
    headers:{ apikey:KEY, Authorization:'Bearer '+KEY, 'Content-Type':'application/json' },
    body: JSON.stringify({ from_id:from, to_id:to }) });
  if (res.status === 404) { const t = await res.text(); if (/could not find|does not exist|function/i.test(t)) return null; }
  if (!res.ok) throw new Error(`RPC ${res.status}: ${(await res.text()).slice(0,160)}`);
  return (await res.json()).map(r => r.path);
}

const asSet = arrs => new Set(arrs.map(a => a.join('>')));
const eqSet = (x,y) => x.size===y.size && [...x].every(v => y.has(v));

// ---- pick a handful of test pairs deterministically from the data -----------
const nssif = rels.filter(e => e.target==='nssif' || e.source==='nssif').map(e => e.target==='nssif'?e.source:e.target);
const airbus = rels.filter(e => e.target==='airbus_grp').map(e => e.source);
const pairs = [];
if (airbus[0]) pairs.push([airbus[0],'airbus_grp']);                 // 1-hop
if (nssif.length>=2) pairs.push([nssif[0], nssif[1]]);               // 2-hop via hub
if (airbus[0] && nssif[0]) pairs.push([airbus[0], nssif[0]]);        // expected: none
if (nssif[0] && airbus[1]) pairs.push([nssif[0], airbus[1]]);        // expected: none

(async () => {
  let rpcUp = true, fails = 0, ran = 0;
  for (const [a,b] of pairs) {
    const js = asSet(jsPaths(a,b));
    let rpc;
    try { const r = await rpcPaths(a,b); if (r===null){ rpcUp=false; break; } rpc = asSet(r); }
    catch(e){ console.log(`✗ ${a}→${b}: RPC error — ${e.message}`); fails++; continue; }
    ran++;
    if (eqSet(js,rpc)) console.log(`✓ ${a}→${b}: ${js.size} path(s) — match`);
    else { fails++; console.log(`✗ ${a}→${b}: MISMATCH\n   js : ${[...js].join(' | ')||'(none)'}\n   rpc: ${[...rpc].join(' | ')||'(none)'}`); }
  }
  if (!rpcUp) { console.log('find_paths RPC is not deployed yet — run migrations/2026-10-10-find-paths-rpc.sql, then re-run. (Nothing to compare.)'); process.exitCode = 0; return; }
  console.log(`\n${ran-fails}/${ran} pairs match` + (fails?` — ${fails} MISMATCH`:' — JS and RPC agree'));
  process.exitCode = fails ? 1 : 0;   // set code, let handles drain (avoids a libuv teardown assert on Windows)
})();
