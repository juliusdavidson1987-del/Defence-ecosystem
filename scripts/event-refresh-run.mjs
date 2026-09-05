#!/usr/bin/env node
/**
 * The Defence Ecosystem — event date-refresh orchestrator (Phase 2)
 * ----------------------------------------------------------------
 * Drives the gated `event-refresh` Edge Function across every anchor fair in
 * reference.event_next (looping, one small web-search batch per call), collects
 * any PROPOSED date changes, and opens a GitHub issue listing them for review.
 * Nothing is written to the live map — approval happens in admin-drafter.html.
 *
 * ENV:
 *   DRAFTER_SHARED_SECRET   (required)  the x-drafter-secret gate
 *   EVENTREFRESH_URL        full function URL, else derived from SUPABASE_URL
 *   SUPABASE_URL            https://<ref>.supabase.co  (to derive the URL)
 *   MAX_PER_CALL=2          events per function invocation
 *   MAX_ITERS=20            safety cap on loop iterations
 *   GITHUB_TOKEN, GITHUB_REPOSITORY, ISSUE_LABELS=event-dates
 *   RESEND_API_KEY, DIGEST_EMAIL_TO, DIGEST_EMAIL_FROM  (optional email)
 */

const SECRET = process.env.DRAFTER_SHARED_SECRET || "";
const MAX_PER_CALL = Number(process.env.MAX_PER_CALL) || 2;
const MAX_ITERS = Number(process.env.MAX_ITERS) || 20;

function functionUrl() {
  if (process.env.EVENTREFRESH_URL) return process.env.EVENTREFRESH_URL.replace(/\/+$/, "");
  const base = process.env.SUPABASE_URL || "https://igvxlmbndpuegibykygq.supabase.co";
  const m = base.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  if (!m) throw new Error("cannot derive function URL — set EVENTREFRESH_URL");
  return `https://${m[1]}.functions.supabase.co/event-refresh`;
}
const URL = functionUrl();
const headers = { "Content-Type": "application/json", "x-drafter-secret": SECRET };

async function call(payload) {
  const res = await fetch(URL, { method: "POST", headers, body: JSON.stringify(payload) });
  const text = await res.text();
  let j = {}; try { j = JSON.parse(text); } catch { /* {} */ }
  if (!res.ok) throw new Error(`event-refresh HTTP ${res.status}: ${j.error || text.slice(0, 200)}`);
  return j;
}

function changeLines(p) {
  const L = [`### ${p.label || p.node_id}  \`${p.node_id}\``];
  L.push(`- was: **${p.current_next || "—"}**${p.current_where ? " · " + p.current_where : ""}`);
  L.push(`- now: **${p.proposed_next || "—"}**${p.proposed_where ? " · " + p.proposed_where : ""}  _(conf ${Number(p.confidence ?? 0).toFixed(2)})_`);
  if (p.note) L.push(`- ${p.note}`);
  if (p.source_url) L.push(`- source: ${p.source_url}`);
  L.push("");
  return L;
}
function buildDigest(applied, proposals, checked, error) {
  const date = new Date().toISOString().slice(0, 10);
  const L = [`# 📅 Event dates — ${date}`, ""];
  L.push(`Checked **${checked}** events · **${applied.length}** auto-applied · **${proposals.length}** proposed for review.`);
  if (error) L.push(`\n> ⚠️ Stopped early: ${error}`);
  L.push("");
  if (applied.length) {
    L.push(`## ✅ Auto-applied (${applied.length})`);
    applied.forEach((p) => L.push(...changeLines(p)));
    L.push(`_Written into \`reference.event_next\` (live on the site; data.json re-synced by this run)._`);
    L.push("");
  }
  if (proposals.length) {
    L.push(`## ✋ Proposed for review (${proposals.length})`);
    proposals.forEach((p) => L.push(...changeLines(p)));
    L.push(`_Approve in **admin-drafter.html → Event dates — proposed** (writes \`reference.event_next\`; then run the sync)._`);
  }
  if (!applied.length && !proposals.length) L.push("_All stored event dates still match their official sources — nothing to change._");
  return L.join("\n");
}

async function createIssue(digest, count) {
  const repo = process.env.GITHUB_REPOSITORY, token = process.env.GITHUB_TOKEN;
  if (!repo || !token) return null;
  const labels = (process.env.ISSUE_LABELS || "event-dates").split(",").map((s) => s.trim()).filter(Boolean);
  const title = `📅 Event date proposals — ${new Date().toISOString().slice(0, 10)} · ${count} change(s)`;
  const gh = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", "User-Agent": "event-refresh" };
  const post = (body) => fetch(`https://api.github.com/repos/${repo}/issues`, { method: "POST", headers: gh, body: JSON.stringify(body) });
  let res = await post({ title, body: digest, labels });
  if (!res.ok) res = await post({ title, body: digest });
  if (!res.ok) { console.error(`! issue create failed HTTP ${res.status}`); return null; }
  const j = await res.json(); console.error(`✓ issue #${j.number}`); return j.html_url;
}

async function sendEmail(digest, count) {
  const key = process.env.RESEND_API_KEY, to = process.env.DIGEST_EMAIL_TO, from = process.env.DIGEST_EMAIL_FROM;
  if (!key || !to || !from) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: to.split(",").map((s) => s.trim()), subject: `📅 Event date proposals — ${count} change(s)`, text: digest }),
  });
  if (!res.ok) { console.error(`! email failed HTTP ${res.status}`); return false; }
  console.error("✓ email sent"); return true;
}

(async () => {
  if (!SECRET) { console.error("✗ DRAFTER_SHARED_SECRET is required"); process.exit(1); }
  console.error(`→ event-refresh: ${URL}`);
  const applied = [], proposals = [], excluded = [];
  let checkedCount = 0, iters = 0, error = null;
  for (; iters < MAX_ITERS; iters++) {
    let r;
    try { r = await call({ op: "run", max: MAX_PER_CALL, exclude: excluded }); }
    catch (e) { error = e.message; console.error(`✗ ${e.message}`); break; }
    const ck = r.checked || [];
    applied.push(...(r.applied || []));
    proposals.push(...(r.proposals || []));
    excluded.push(...ck);
    checkedCount += ck.length;
    console.error(`  pass ${iters + 1}: checked ${ck.length}, +${(r.applied || []).length} applied, +${(r.proposals || []).length} proposed, ${r.remaining} remaining`);
    if (!ck.length || !r.remaining) break;
  }
  const digest = buildDigest(applied, proposals, checkedCount, error);
  console.log(digest);
  const n = applied.length + proposals.length;
  if (n) { const url = await createIssue(digest, n); await sendEmail(digest, n); if (url) console.error(url); }
  else console.error("· no changes — no issue/email");
  if (error) process.exit(1);
})();
