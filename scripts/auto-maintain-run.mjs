#!/usr/bin/env node
/**
 * The Defence Ecosystem — auto-maintainer orchestrator (Stage 4)
 * -------------------------------------------------------------
 * Drives the gated `auto-maintain` Edge Function until the five review queues
 * are drained, aggregates a Markdown digest, then:
 *   • opens a dated GitHub issue   (if GITHUB_TOKEN + GITHUB_REPOSITORY),
 *   • sends an email digest         (if RESEND_API_KEY + DIGEST_EMAIL_TO/FROM),
 *   • records the run to auto_runs   (via the function's `log` op).
 * With none of those set it just prints the digest — so it's runnable locally.
 *
 * The Anthropic key and Supabase service-role key never touch this script or the
 * GitHub runner: all AI assessment and all DB writes happen inside the Edge
 * Function. This orchestrator only needs the shared secret to call it.
 *
 * ENV:
 *   DRAFTER_SHARED_SECRET   (required)  the x-drafter-secret gate
 *   AUTOMAINT_URL           full function URL, else derived from SUPABASE_URL
 *   SUPABASE_URL            https://<ref>.supabase.co  (to derive the function URL)
 *   MAX_PER_CALL=3          heavy (web-search) items per function invocation
 *   MAX_ITERS=30            safety cap on loop iterations
 *   ALWAYS_REPORT=false     issue/email even on a quiet day (default: only when something happened)
 *   GITHUB_TOKEN, GITHUB_REPOSITORY, ISSUE_LABELS=auto-maintainer
 *   RESEND_API_KEY, DIGEST_EMAIL_TO, DIGEST_EMAIL_FROM
 */

const SECRET = process.env.DRAFTER_SHARED_SECRET || "";
const MAX_PER_CALL = Number(process.env.MAX_PER_CALL) || 3;
const MAX_ITERS = Number(process.env.MAX_ITERS) || 30;
const ALWAYS = /^(1|true|yes)$/i.test(process.env.ALWAYS_REPORT || "");

function functionUrl() {
  if (process.env.AUTOMAINT_URL) return process.env.AUTOMAINT_URL.replace(/\/+$/, "");
  const base = process.env.SUPABASE_URL || "https://igvxlmbndpuegibykygq.supabase.co";
  const m = base.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  if (!m) throw new Error("cannot derive function URL — set AUTOMAINT_URL");
  return `https://${m[1]}.functions.supabase.co/auto-maintain`;
}
const URL = functionUrl();
const headers = { "Content-Type": "application/json", "x-drafter-secret": SECRET };

async function call(payload) {
  const res = await fetch(URL, { method: "POST", headers, body: JSON.stringify(payload) });
  const text = await res.text();
  let j = {};
  try { j = JSON.parse(text); } catch { /* leave {} */ }
  if (!res.ok) throw new Error(`auto-maintain HTTP ${res.status}: ${j.error || text.slice(0, 300)}`);
  return j;
}

function line(r) {
  const q = { claim: "claim", feedback: "feedback", correction: "correction", webfind: "web find", "pending-node": "pending node" }[r.queue] || r.queue;
  const u = r.url ? ` — ${r.url}` : "";
  return `- **${q}** · ${r.label} → _${r.action}_: ${r.reason}${u}`;
}

function buildDigest({ actions, held, remaining, cfg, iters, error }) {
  const date = new Date().toISOString().slice(0, 10);
  const rem = remaining || {};
  const remTotal = Object.values(rem).reduce((a, b) => a + (b || 0), 0);
  const L = [];
  L.push(`# 🤖 Auto-maintainer — ${date}`);
  L.push("");
  L.push(`**${actions.length} auto-actioned · ${held.length} held for you · ${remTotal} still pending.**`);
  if (error) L.push(`\n> ⚠️ Run stopped early: ${error}`);
  L.push("");
  L.push(`## ✅ Auto-actioned (${actions.length})`);
  L.push(actions.length ? actions.map(line).join("\n") : "_Nothing to apply._");
  L.push("");
  L.push(`## ✋ Held for your review (${held.length})`);
  L.push(held.length ? held.map(line).join("\n") : "_Nothing held._");
  L.push("");
  L.push(`## 📥 Still pending`);
  L.push(remTotal
    ? `nodes ${rem.nodes || 0} · corrections ${rem.edits || 0} · claims ${rem.claims || 0} · feedback ${rem.feedback || 0} · web finds ${rem.webfinds || 0}  \n_(not reached this run — the next run will pick them up)_`
    : "_All queues drained._");
  L.push("");
  if (cfg) {
    L.push("---");
    L.push(`_Policy — new-org auto-publish: **${cfg.pubNewOrgs ? "ON" : "OFF (new orgs are staged for you)"}** · corrections auto-apply: **${cfg.applyCorr ? "ON" : "OFF"}** · claims auto-approve: **${cfg.approveClaims ? "ON" : "OFF"}** · feedback auto-resolve: **${cfg.resolveFeedback ? "ON" : "OFF"}**. Tune via the function's Supabase secrets._`);
  }
  L.push(`\n<sub>Reviewed in admin-drafter.html · ${iters} pass(es).</sub>`);
  return L.join("\n");
}

async function createIssue(digest, actions, held) {
  const repo = process.env.GITHUB_REPOSITORY, token = process.env.GITHUB_TOKEN;
  if (!repo || !token) return null;
  const labels = (process.env.ISSUE_LABELS || "auto-maintainer").split(",").map((s) => s.trim()).filter(Boolean);
  const title = `🤖 Auto-maintainer — ${new Date().toISOString().slice(0, 10)} · ${actions.length} applied, ${held.length} held`;
  const ghHeaders = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", "User-Agent": "auto-maintainer" };
  const post = (body) => fetch(`https://api.github.com/repos/${repo}/issues`, { method: "POST", headers: ghHeaders, body: JSON.stringify(body) });
  let res = await post({ title, body: digest, labels });
  if (!res.ok) {
    // Most likely the label doesn't exist yet — retry once without it so we never lose the digest.
    console.error(`! issue create with labels failed HTTP ${res.status}; retrying without labels`);
    res = await post({ title, body: digest });
  }
  if (!res.ok) { console.error(`! issue create failed HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`); return null; }
  const j = await res.json();
  console.error(`✓ issue #${j.number} created`);
  return j.html_url;
}

async function sendEmail(digest, actions, held) {
  const key = process.env.RESEND_API_KEY, to = process.env.DIGEST_EMAIL_TO, from = process.env.DIGEST_EMAIL_FROM;
  if (!key || !to || !from) return false;
  const subject = `🤖 Defence Ecosystem — ${new Date().toISOString().slice(0, 10)}: ${actions.length} applied, ${held.length} held`;
  // minimal HTML: preserve line breaks; keep it plain and robust
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;white-space:pre-wrap">${digest.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: to.split(",").map((s) => s.trim()), subject, text: digest, html }),
  });
  if (!res.ok) { console.error(`! email send failed HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`); return false; }
  console.error("✓ email sent");
  return true;
}

(async () => {
  if (!SECRET) { console.error("✗ DRAFTER_SHARED_SECRET is required"); process.exit(1); }
  console.error(`→ auto-maintain: ${URL}`);

  let cfg = null;
  try { cfg = (await call({ op: "config" })).config; } catch (e) { console.error(`! config read failed: ${e.message}`); }

  const actions = [], held = [];
  let remaining = null, iters = 0, error = null;
  for (; iters < MAX_ITERS; iters++) {
    let r;
    try { r = await call({ op: "run", max: MAX_PER_CALL }); }
    catch (e) { error = e.message; console.error(`✗ ${e.message}`); break; }
    actions.push(...(r.actions || []));
    held.push(...(r.held || []));
    remaining = r.remaining || remaining;
    console.error(`  pass ${iters + 1}: processed ${r.processed}, +${(r.actions || []).length} actioned, +${(r.held || []).length} held`);
    if (!r.processed) break;                       // nothing left to do
  }

  const digest = buildDigest({ actions, held, remaining, cfg, iters: iters + 1, error });
  console.log(digest);

  // Record the run (best-effort).
  try { await call({ op: "log", applied: actions.length, held: held.length, digest, detail: { actions, held, remaining } }); }
  catch (e) { console.error(`! run log failed: ${e.message}`); }

  const something = actions.length || held.length || error;
  if (something || ALWAYS) {
    const issueUrl = await createIssue(digest, actions, held);
    await sendEmail(digest, actions, held);
    if (issueUrl) console.error(issueUrl);
  } else {
    console.error("· quiet day — no issue/email (set ALWAYS_REPORT=true to report anyway)");
  }
  if (error) process.exit(1);
})();
