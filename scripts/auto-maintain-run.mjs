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
import { pathToFileURL } from "node:url";

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

// ── HTML email (built from the structured data, not the raw markdown) ─────────
const QUEUE_LABEL = { claim: "Claim", feedback: "Feedback", correction: "Correction", webfind: "Web find", "pending-node": "Pending node" };
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const actionColor = (a) => /reject|dismiss/i.test(a) ? "#6b7280" : /publish|applied|approv|resolv/i.test(a) ? "#16a34a" : "#b45309";

function emailRow(r) {
  const q = QUEUE_LABEL[r.queue] || r.queue;
  const url = r.url ? `<div style="margin-top:3px"><a href="${esc(r.url)}" style="color:#2563eb;font-size:12px;text-decoration:none">${esc(r.url)}</a></div>` : "";
  return `<tr><td style="padding:10px 14px;border-bottom:1px solid #edf0f2">
      <div><span style="display:inline-block;font-size:11px;font-weight:600;color:#475569;background:#eef2f6;border-radius:4px;padding:2px 7px;margin-right:8px">${esc(q)}</span><span style="font-weight:600;color:#0f172a">${esc(r.label)}</span><span style="color:${actionColor(r.action)};font-weight:600">&nbsp;·&nbsp;${esc(r.action)}</span></div>
      <div style="color:#475569;font-size:13px;margin-top:3px;line-height:1.45">${esc(r.reason)}</div>${url}
    </td></tr>`;
}
function emailSection(title, items, accent, empty) {
  const rows = items.length ? items.map(emailRow).join("") : `<tr><td style="padding:12px 14px;color:#94a3b8;font-size:13px">${esc(empty)}</td></tr>`;
  return `<div style="margin-top:18px"><div style="font-size:13px;font-weight:700;color:#0f172a;padding:0 2px 6px;border-bottom:2px solid ${accent}">${title} <span style="color:#94a3b8;font-weight:600">(${items.length})</span></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff;border:1px solid #edf0f2;border-top:none">${rows}</table></div>`;
}
export function buildHtmlEmail({ actions, held, remaining, cfg, error }) {
  const date = new Date().toISOString().slice(0, 10);
  const rem = remaining || {};
  const remTotal = Object.values(rem).reduce((a, b) => a + (b || 0), 0);
  const pill = (label, n, bg, fg) => `<span style="display:inline-block;background:${bg};color:${fg};border-radius:999px;padding:4px 12px;font-size:13px;font-weight:600;margin:0 6px 6px 0">${n} ${label}</span>`;
  const errBanner = error ? `<div style="margin:12px 0;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#b91c1c;font-size:13px">⚠️ Run stopped early: ${esc(error)}</div>` : "";
  const pending = remTotal
    ? `<div style="margin-top:18px;color:#475569;font-size:13px">📥 <strong>Still pending</strong> (the next run picks these up): nodes ${rem.nodes || 0} · corrections ${rem.edits || 0} · claims ${rem.claims || 0} · feedback ${rem.feedback || 0} · web finds ${rem.webfinds || 0}</div>`
    : `<div style="margin-top:18px;color:#16a34a;font-size:13px">📥 All queues drained.</div>`;
  const policy = cfg ? `<div style="margin-top:20px;padding:12px 14px;background:#f8fafc;border:1px solid #edf0f2;border-radius:8px;color:#64748b;font-size:12px;line-height:1.6"><strong style="color:#475569">Policy</strong> — new-org auto-publish: <strong>${cfg.pubNewOrgs ? "ON" : "OFF (staged for you)"}</strong> · corrections auto-apply: <strong>${cfg.applyCorr ? "ON" : "OFF"}</strong> · claims auto-approve: <strong>${cfg.approveClaims ? "ON" : "OFF"}</strong> · feedback auto-resolve: <strong>${cfg.resolveFeedback ? "ON" : "OFF"}</strong>.<br>Tune via the function's Supabase secrets.</div>` : "";
  return `<div style="background:#f1f5f9;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:#0f172a;color:#fff;padding:18px 20px"><div style="font-size:17px;font-weight:700">🤖 Auto-maintainer digest</div><div style="font-size:13px;color:#94a3b8;margin-top:2px">${date}</div></div>
      <div style="padding:18px 20px">
        <div>${pill("auto-actioned", actions.length, "#dcfce7", "#166534")}${pill("held for you", held.length, "#fef3c7", "#92400e")}${pill("still pending", remTotal, "#e2e8f0", "#334155")}</div>
        ${errBanner}
        ${emailSection("✅ Auto-actioned", actions, "#16a34a", "Nothing to apply.")}
        ${emailSection("✋ Held for your review", held, "#d97706", "Nothing held.")}
        ${pending}${policy}
        <div style="margin-top:18px;color:#94a3b8;font-size:12px">Reviewed in admin-drafter.html</div>
      </div>
    </div>
  </div>`;
}

async function sendEmail(textDigest, data) {
  const key = process.env.RESEND_API_KEY, to = process.env.DIGEST_EMAIL_TO, from = process.env.DIGEST_EMAIL_FROM;
  if (!key || !to || !from) return false;
  const subject = `🤖 Defence Ecosystem — ${new Date().toISOString().slice(0, 10)}: ${data.actions.length} applied, ${data.held.length} held`;
  const html = buildHtmlEmail(data);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: to.split(",").map((s) => s.trim()), subject, text: textDigest, html }),
  });
  if (!res.ok) { console.error(`! email send failed HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`); return false; }
  console.error("✓ email sent");
  return true;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] || "").href;
if (isMain) (async () => {
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
    await sendEmail(digest, { actions, held, remaining, cfg, error });
    if (issueUrl) console.error(issueUrl);
  } else {
    console.error("· quiet day — no issue/email (set ALWAYS_REPORT=true to report anyway)");
  }
  if (error) process.exit(1);
})();
