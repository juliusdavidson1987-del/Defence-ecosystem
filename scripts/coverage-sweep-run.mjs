#!/usr/bin/env node
/**
 * The Defence Ecosystem — coverage-sweep orchestrator
 * --------------------------------------------------
 * Drives the gated `coverage-sweep` Edge Function across the nation × category
 * grid (resumable via a stored cursor), collecting the NEW organisations it
 * surfaces into the web_finds review queue. Bounded per run (CELLS_PER_RUN) so a
 * daily workflow chips through the whole grid over several days within cost/rate
 * comfort; opens a GitHub issue listing what surfaced.
 *
 * ENV:
 *   DRAFTER_SHARED_SECRET   (required)
 *   SWEEP_URL               full function URL, else derived from SUPABASE_URL
 *   SUPABASE_URL            https://<ref>.supabase.co
 *   MAX_PER_CALL=2          cells per function invocation
 *   CELLS_PER_RUN=40        cells to process this run (then stop; next run resumes)
 *   MAX_ITERS=60            safety cap on loop iterations
 *   GITHUB_TOKEN, GITHUB_REPOSITORY, ISSUE_LABELS=coverage-sweep
 */
const SECRET = process.env.DRAFTER_SHARED_SECRET || "";
const MAX_PER_CALL = Number(process.env.MAX_PER_CALL) || 2;
const CELLS_PER_RUN = Number(process.env.CELLS_PER_RUN) || 40;
const MAX_ITERS = Number(process.env.MAX_ITERS) || 60;

function functionUrl() {
  if (process.env.SWEEP_URL) return process.env.SWEEP_URL.replace(/\/+$/, "");
  const base = process.env.SUPABASE_URL || "https://igvxlmbndpuegibykygq.supabase.co";
  const m = base.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  if (!m) throw new Error("cannot derive function URL — set SWEEP_URL");
  return `https://${m[1]}.functions.supabase.co/coverage-sweep`;
}
const URL = functionUrl();
const headers = { "Content-Type": "application/json", "x-drafter-secret": SECRET };

async function call(payload) {
  const res = await fetch(URL, { method: "POST", headers, body: JSON.stringify(payload) });
  const text = await res.text(); let j = {}; try { j = JSON.parse(text); } catch { /* {} */ }
  if (!res.ok) throw new Error(`coverage-sweep HTTP ${res.status}: ${j.error || text.slice(0, 200)}`);
  return j;
}

function digest(added, cellsDone, remaining, total, error) {
  const date = new Date().toISOString().slice(0, 10);
  const L = [`# 🛰️ Coverage sweep — ${date}`, "", `Processed **${cellsDone}** grid cells this run · **${added.length}** new candidate(s) surfaced to the review queue · **${remaining}/${total}** cells remaining.`];
  if (error) L.push(`\n> ⚠️ Stopped early: ${error}`);
  L.push("");
  if (added.length) {
    const byNat = {};
    added.forEach((a) => { (byNat[a.nation] = byNat[a.nation] || []).push(a); });
    Object.keys(byNat).sort().forEach((n) => {
      L.push(`### ${n.toUpperCase()}`);
      byNat[n].forEach((a) => L.push(`- **${a.name}** — ${a.url}  _(${a.category})_`));
      L.push("");
    });
    L.push(`_Review in **admin-drafter.html → Web finds — pending**; the daily auto-maintainer also verifies + stages/publishes these._`);
  } else L.push("_No new organisations this run (these cells are already well-covered)._");
  return L.join("\n");
}

async function createIssue(body, count) {
  const repo = process.env.GITHUB_REPOSITORY, token = process.env.GITHUB_TOKEN;
  if (!repo || !token) return null;
  const labels = (process.env.ISSUE_LABELS || "coverage-sweep").split(",").map((s) => s.trim()).filter(Boolean);
  const title = `🛰️ Coverage sweep — ${new Date().toISOString().slice(0, 10)} · ${count} new candidate(s)`;
  const gh = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", "User-Agent": "coverage-sweep" };
  const post = (b) => fetch(`https://api.github.com/repos/${repo}/issues`, { method: "POST", headers: gh, body: JSON.stringify(b) });
  let res = await post({ title, body, labels }); if (!res.ok) res = await post({ title, body });
  if (!res.ok) { console.error(`! issue failed HTTP ${res.status}`); return null; }
  const j = await res.json(); console.error(`✓ issue #${j.number}`); return j.html_url;
}

(async () => {
  if (!SECRET) { console.error("✗ DRAFTER_SHARED_SECRET is required"); process.exit(1); }
  const grid = await call({ op: "grid" }).catch(() => ({}));
  console.error(`→ coverage-sweep: ${URL}  (grid ${grid.total || "?"} cells)`);
  const added = []; let cellsDone = 0, remaining = grid.total || 0, total = grid.total || 0, iters = 0, error = null;
  for (; iters < MAX_ITERS && cellsDone < CELLS_PER_RUN; iters++) {
    let r; try { r = await call({ op: "run", max: MAX_PER_CALL }); } catch (e) { error = e.message; console.error(`✗ ${e.message}`); break; }
    added.push(...(r.added || [])); cellsDone += r.processed || 0; remaining = r.remaining ?? remaining; total = r.total || total;
    console.error(`  +${r.processed} cells (cursor ${r.nextCursor}/${total}), +${(r.added || []).length} finds; ${remaining} left`);
    if (r.done || !r.processed) break;
  }
  const body = digest(added, cellsDone, remaining, total, error);
  console.log(body);
  if (added.length || error) { const url = await createIssue(body, added.length); if (url) console.error(url); }
  if (error) process.exit(1);
})();
