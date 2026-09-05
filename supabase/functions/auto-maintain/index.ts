// Edge Function: auto-maintain  (GATED — requires x-drafter-secret)
// ---------------------------------------------------------------------------
// Stage 4 — the daily back-room agent. Works the five review queues the public
// tool fills, VERIFIES each item with claude-opus-5 + web search, then:
//
//   • auto-applies the clear-cut, safe decisions, and
//   • HOLDS anything uncertain for the maintainer, recording a one-line
//     recommendation (auto_action / auto_reason) shown in admin-drafter.html.
//
// Policy (all env-tunable — conservative by default because the map is public
// and "accuracy over speed" is the project rule):
//   claims      exact email↔site domain match      -> auto-approve, else hold
//   feedback    non-actionable (praise/vague/spam)  -> auto-resolve, else hold
//   corrections web-verified, high-conf, non-structural -> auto-apply, else hold
//   web finds   verified real + not a dupe          -> draft & STAGE (or publish
//                                                      if AUTOPUB_NEW_ORGS on),
//                                                      junk/dupe -> dismiss
//   pending     web-verified new orgs               -> publish only if
//   nodes                                             AUTOPUB_NEW_ORGS on & high
//                                                     conf; dupes -> reject; else hold
//
// It only touches pending rows where auto_assessed_at IS NULL, so a held item
// drops out of the nightly pass until you act on it. Bounded per call (web
// search is slow) — the orchestrator loops until the queues are drained.
//
// Body:  POST { op:"run", max?:number }  |  POST { op:"config" }
// Required secrets: ANTHROPIC_API_KEY, DRAFTER_SHARED_SECRET
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, secretOk } from "../_shared/cors.ts";

// ── config ─────────────────────────────────────────────────────────────────
const num = (k: string, d: number) => { const v = Number(Deno.env.get(k)); return Number.isFinite(v) && v > 0 ? v : d; };
const bool = (k: string, d: boolean) => { const v = (Deno.env.get(k) ?? "").toLowerCase(); return v ? v === "true" || v === "1" || v === "yes" : d; };
const CFG = {
  maxHeavy: num("AUTOMAINT_MAX_PER_RUN", 2),        // web-search items per invocation (kept low for the wall-clock budget; the orchestrator loops)
  pubNewOrgs: bool("AUTOPUB_NEW_ORGS", false),      // OFF by default: new orgs are staged, not published
  pubMinConf: num("AUTOPUB_MIN_CONFIDENCE", 0.85),
  applyCorr: bool("AUTOAPPLY_CORRECTIONS", true),
  corrMinConf: num("AUTOAPPLY_MIN_CONFIDENCE", 0.8),
  resolveFeedback: bool("AUTORESOLVE_FEEDBACK", true),
  approveClaims: bool("AUTOAPPROVE_CLAIMS", true),
};

// tag vocabulary (kept in sync with CLAUDE.md / the app)
const TAG_VOCAB = `tags shape { w:[govmil|academic|prime|sme|startup|investor], o:[advice|contract|procurement|research|product|investment|grant|test], t:[low,high] TRL ints 1-9, d:[ai|space|cyber|c4isr|comms|maritime|land|air|counteruas|weapons|directed|hypersonic|nuclear|simulation|training|logistics|energy|materials|human|quantum|xcut], a:open|restricted|portal|prime, g:uk|us|eu|nato|ca|au|nz|kr|jp|il|in|sg|ae|sa|fr|de|it|nl|... (2-letter home country) }`;

const now = () => new Date().toISOString();

// ── small helpers ────────────────────────────────────────────────────────────
function textOf(msg: { content: Array<{ type: string }> }): string {
  return msg.content.filter((b) => b.type === "text").map((b) => (b as unknown as { text: string }).text).join("").trim();
}
function parseJson(text: string): Record<string, unknown> {
  try { return JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()); }
  catch { const m = text.match(/\{[\s\S]*\}/); return m ? (() => { try { return JSON.parse(m[0]); } catch { return {}; } })() : {}; }
}
function firstUrl(s: string): string {
  const m = String(s || "").match(/https?:\/\/[^\s)"'<>]+/i);
  if (m) return m[0];
  const t = String(s || "").trim();
  return /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(t) ? "https://" + t : "";
}
function hostOf(s: string): string {
  try { return new URL(firstUrl(s)).host.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}
function slug(s: string): string {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "").slice(0, 22);
}
function tagsOk(t: unknown): boolean {
  return !!(t && typeof t === "object" && !Array.isArray(t) && Array.isArray((t as { d?: unknown }).d));
}
const FREEMAIL = new Set(["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "yahoo.co.uk", "icloud.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "live.com", "aol.com", "me.com", "mail.com"]);

async function urlReachable(u: string): Promise<boolean> {
  const url = firstUrl(u);
  if (!url) return false;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url, { method: "GET", redirect: "follow", signal: ctl.signal, headers: { "user-agent": "DefenceEcosystemBot/1.0" } });
    clearTimeout(t);
    return r.ok || (r.status >= 300 && r.status < 400);
  } catch { return false; }
}

// Claude call with optional web search + bounded pause_turn continuation.
async function callClaude(client: Anthropic, system: string, user: string, web: boolean): Promise<Record<string, unknown>> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  const opts = () => ({
    model: "claude-opus-5",
    max_tokens: 4096,
    output_config: { effort: web ? "medium" as const : "low" as const },
    system,
    ...(web ? { tools: [{ type: "web_search_20260209" as const, name: "web_search", max_uses: 4 }] } : {}),
    messages,
  });
  let resp = await client.messages.create(opts());
  for (let i = 0; i < 3 && resp.stop_reason === "pause_turn"; i++) {
    messages.push({ role: "assistant", content: resp.content });
    resp = await client.messages.create(opts());
  }
  return parseJson(textOf(resp));
}

type Rec = { queue: string; id: string; label: string; action: string; reason: string; url?: string };
type Report = { processed: number; actions: Rec[]; held: Rec[] };

// Simple dedupe against the live map: domain match, or strong name containment.
function findDupe(name: string, url: string, corpus: Array<{ id: string; label: string; entry: string }>): { id: string; label: string } | null {
  const host = hostOf(url);
  const nmeLc = name.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  for (const n of corpus) {
    const ent = (n.entry || "").toLowerCase();
    if (host && ent.includes(host)) return { id: n.id, label: n.label };
    const lab = (n.label || "").toLowerCase().replace(/^[^—:]*[—:]\s*/, "").replace(/[^a-z0-9 ]/g, "").trim();
    if (nmeLc.length >= 5 && lab && (lab.includes(nmeLc) || nmeLc.includes(lab))) return { id: n.id, label: n.label };
  }
  return null;
}

// ── assessment prompts ───────────────────────────────────────────────────────
async function assessCorrection(client: Anthropic, node: Record<string, unknown>, correction: { field?: string; suggestion?: string }, parents: Array<{ id: string; label: string }>) {
  const system = `You assess and, if warranted, repair one organisation's entry in a curated UK / NATO / allied defence innovation & procurement map, based on a submitted correction.

Use web search to VERIFY the correction before acting — renames, mergers, defunct bodies, wrong parent/country, reference URLs. Never invent organisations, facts or URLs.

Decide a recommendation:
- "apply"  the correction is factually verified and you can produce the corrected entry.
- "reject" the correction is wrong, spam, or unverifiable — the current entry is fine.
- "hold"   plausible but you are not confident, OR it needs a judgement call (a structural re-parent, a contentious merge, ambiguity).
Set "structural": true if it changes the parent/category or the org's place in the tree.

"parent" (in the repair) MUST be an id from the provided PARENT list, or the node's current parent. "tags" keep the ${TAG_VOCAB} shape.

Return ONLY minified JSON:
{"recommendation":"apply|reject|hold","confidence":0.0-1.0,"structural":true|false,"repair":{"label":"...","parent":"<id>","does":"one neutral factual sentence","entry":"official URL/contact line","tags":{...}},"note":"one sentence: what you verified and what you changed or why you held"}`;
  const user = `CURRENT node:\n${JSON.stringify(node)}\n\nCORRECTION (field flagged: ${correction.field || "—"}):\n${correction.suggestion}\n\nValid PARENT ids (id — label):\n${parents.map((p) => `${p.id} — ${p.label}`).join("\n")}`;
  const r = await callClaude(client, system, user, true);
  return {
    recommendation: String(r.recommendation || "hold"),
    confidence: Number(r.confidence ?? 0),
    structural: r.structural === true,
    repair: (r.repair && typeof r.repair === "object") ? r.repair as Record<string, unknown> : null,
    note: String(r.note || ""),
  };
}

async function draftFromFind(client: Anthropic, find: { name?: string; url?: string; why?: string; query?: string }, parents: Array<{ id: string; label: string }>) {
  const system = `You verify and draft a candidate organisation for a curated UK / NATO / allied defence innovation & procurement map.

Use web search to confirm the organisation is REAL and currently operating, find its OFFICIAL website, and judge defence/dual-use relevance. Never invent an organisation, facts or URLs. If you cannot confirm it exists, set "exists": false.

Choose "parent" ONLY from the provided PARENT list (pick the best home by country/theme). Tags use the ${TAG_VOCAB} shape — set "g" to the org's home country.

Return ONLY minified JSON:
{"exists":true|false,"confidence":0.0-1.0,"defence_relevant":true|false,"publishable":true|false,"node":{"label":"Country — Name (or just Name if UK/obvious)","parent":"<id>","does":"one neutral factual sentence","entry":"https://official-site","tags":{...}},"note":"one sentence on what you verified"}`;
  const user = `Candidate (from a web gap-fill search):\nname: ${find.name}\nurl: ${find.url}\nwhy surfaced: ${find.why || "—"}\nsearch context: ${find.query || "—"}\n\nVerify it, then draft its entry.\n\nValid PARENT ids (id — label):\n${parents.map((p) => `${p.id} — ${p.label}`).join("\n")}`;
  const r = await callClaude(client, system, user, true);
  return {
    exists: r.exists === true,
    confidence: Number(r.confidence ?? 0),
    defence_relevant: r.defence_relevant !== false,
    publishable: r.publishable === true,
    node: (r.node && typeof r.node === "object") ? r.node as Record<string, unknown> : null,
    note: String(r.note || ""),
  };
}

async function verifyPending(client: Anthropic, node: Record<string, unknown>) {
  const system = `You verify an organisation already drafted for a curated defence innovation & procurement map, before it is published live.

Use web search to confirm it is REAL, currently operating, genuinely defence/dual-use relevant, and that the "entry" URL is its official site. Never invent facts.

Return ONLY minified JSON: {"exists":true|false,"confidence":0.0-1.0,"defence_relevant":true|false,"note":"one sentence"}`;
  const user = `Drafted node:\n${JSON.stringify({ label: node.label, does: node.does, entry: node.entry, tags: node.tags })}`;
  const r = await callClaude(client, system, user, true);
  return { exists: r.exists === true, confidence: Number(r.confidence ?? 0), defence_relevant: r.defence_relevant !== false, note: String(r.note || "") };
}

async function assessFeedback(client: Anthropic, item: { kind?: string; org?: string; message?: string }) {
  const system = `You triage one piece of user feedback about a curated defence-ecosystem map. Decide if it is ACTIONABLE (points to a specific fix, addition, bug, or data change the maintainer should act on) or NON-ACTIONABLE (praise, vague, a test, spam, or a duplicate of something obvious).

Return ONLY minified JSON: {"category":"bug|suggestion|addition|correction|praise|vague|spam","actionable":true|false,"summary":"≤18-word summary","suggested_action":"one short next step, or ''"}`;
  const user = `kind: ${item.kind || "—"}\nabout: ${item.org || "—"}\nmessage: ${item.message || ""}`;
  const r = await callClaude(client, system, user, false);
  return {
    category: String(r.category || "vague"),
    actionable: r.actionable === true,
    summary: String(r.summary || ""),
    suggested_action: String(r.suggested_action || ""),
  };
}

// ── queue processors ─────────────────────────────────────────────────────────
async function holdRow(sb: SupabaseClient, table: string, id: string | number, action: string, reason: string) {
  await sb.from(table).update({ auto_assessed_at: now(), auto_action: action, auto_reason: reason.slice(0, 500) }).eq("id", id);
}

async function procClaims(sb: SupabaseClient, report: Report) {
  const { data } = await sb.from("claims").select("id,node_id,claimant,email,role,note").eq("status", "pending").is("auto_assessed_at", null).limit(20);
  for (const c of data ?? []) {
    report.processed++;
    let site = "";
    if (c.node_id) { const { data: nd } = await sb.from("nodes").select("entry").eq("id", c.node_id).maybeSingle(); site = hostOf(nd?.entry || ""); }
    const emailHost = (String(c.email || "").split("@")[1] || "").toLowerCase().trim();
    const freemail = FREEMAIL.has(emailHost);
    const match = !!emailHost && !!site && (emailHost === site || emailHost.endsWith("." + site) || site.endsWith("." + emailHost));
    const label = c.claimant || c.node_id || String(c.id);
    if (CFG.approveClaims && match && !freemail) {
      await sb.from("claims").update({ status: "approved", auto_assessed_at: now(), auto_action: "approve", auto_reason: `email @${emailHost} matches site ${site}` }).eq("id", c.id);
      report.actions.push({ queue: "claim", id: String(c.id), label, action: "approved", reason: `verified: email @${emailHost} matches the org site (${site})` });
    } else {
      const reason = !emailHost ? "no email domain to verify" : freemail ? `personal/freemail address (@${emailHost}) — verify manually` : !site ? "no website on the node to match against" : `email @${emailHost} ≠ site ${site} — verify manually`;
      await holdRow(sb, "claims", c.id, "review", reason);
      report.held.push({ queue: "claim", id: String(c.id), label, action: "review", reason });
    }
  }
}

async function procFeedback(client: Anthropic, sb: SupabaseClient, report: Report) {
  const { data } = await sb.from("feedback").select("id,kind,org,message").eq("status", "pending").is("auto_assessed_at", null).limit(6);
  for (const f of data ?? []) {
    report.processed++;
    const a = await assessFeedback(client, f);
    const label = (f.org || f.kind || "feedback") as string;
    if (CFG.resolveFeedback && !a.actionable) {
      await sb.from("feedback").update({ status: "resolved", auto_assessed_at: now(), auto_action: "resolve", auto_reason: `${a.category}: ${a.summary}` }).eq("id", f.id);
      report.actions.push({ queue: "feedback", id: String(f.id), label, action: "resolved", reason: `non-actionable (${a.category}): ${a.summary}` });
    } else {
      const reason = `${a.category}: ${a.summary}${a.suggested_action ? " → " + a.suggested_action : ""}`;
      await holdRow(sb, "feedback", f.id, "review", reason);
      report.held.push({ queue: "feedback", id: String(f.id), label, action: "review", reason });
    }
  }
}

async function procCorrections(client: Anthropic, sb: SupabaseClient, report: Report, budget: () => number, spend: () => void, parents: Array<{ id: string; label: string }>) {
  const { data } = await sb.from("edits").select("id,node_id,field,suggestion").eq("status", "pending").is("auto_assessed_at", null).limit(budget());
  for (const e of data ?? []) {
    if (budget() <= 0) break;
    spend();
    report.processed++;
    const label = (e.node_id || "correction") as string;
    const { data: node } = await sb.from("nodes").select("id,label,parent,kind,does,entry,tags").eq("id", e.node_id).maybeSingle();
    if (!node) {
      await holdRow(sb, "edits", e.id, "review", `targets '${e.node_id}' which is not a DB node (likely a synthetic nat_* / reference item) — fix the reference layer manually`);
      report.held.push({ queue: "correction", id: String(e.id), label, action: "review", reason: "targets a non-node id (reference layer) — fix manually" });
      continue;
    }
    const a = await assessCorrection(client, node, { field: e.field, suggestion: e.suggestion }, parents);
    if (CFG.applyCorr && a.recommendation === "apply" && a.confidence >= CFG.corrMinConf && !a.structural && a.repair) {
      const rep = a.repair;
      const row = {
        id: node.id, label: rep.label ?? node.label, parent: rep.parent ?? node.parent, kind: node.kind || "org",
        does: rep.does ?? node.does, entry: rep.entry ?? node.entry,
        tags: tagsOk(rep.tags) ? rep.tags : (tagsOk(node.tags) ? node.tags : null),
        status: "published",
      };
      const { error } = await sb.from("nodes").upsert(row, { onConflict: "id" });
      if (error) { await holdRow(sb, "edits", e.id, "review", `verified but write failed: ${error.message}`); report.held.push({ queue: "correction", id: String(e.id), label, action: "review", reason: "verified but DB write failed — apply manually" }); continue; }
      await sb.from("edits").update({ status: "resolved", auto_assessed_at: now(), auto_action: "apply", auto_reason: a.note }).eq("id", e.id);
      report.actions.push({ queue: "correction", id: String(e.id), label, action: "applied", reason: a.note, url: firstUrl(String(row.entry || "")) });
    } else if (a.recommendation === "reject" && a.confidence >= 0.75) {
      await sb.from("edits").update({ status: "dismissed", auto_assessed_at: now(), auto_action: "dismiss", auto_reason: a.note }).eq("id", e.id);
      report.actions.push({ queue: "correction", id: String(e.id), label, action: "dismissed", reason: `unverified/incorrect: ${a.note}` });
    } else {
      const why = a.structural ? "structural re-parent — needs your call" : a.recommendation === "reject" ? "looks incorrect but low confidence" : "could not fully verify";
      await holdRow(sb, "edits", e.id, "review", `${why}. ${a.note}`);
      report.held.push({ queue: "correction", id: String(e.id), label, action: "review", reason: `${why} — ${a.note}` });
    }
  }
}

async function procWebFinds(client: Anthropic, sb: SupabaseClient, report: Report, budget: () => number, spend: () => void, parents: Array<{ id: string; label: string }>, corpus: Array<{ id: string; label: string; entry: string }>, ids: Set<string>) {
  const { data } = await sb.from("web_finds").select("id,name,url,why,query").eq("status", "pending").is("auto_assessed_at", null).limit(budget());
  for (const w of data ?? []) {
    if (budget() <= 0) break;
    spend();
    report.processed++;
    const label = (w.name || w.url || "web find") as string;
    const dupe = findDupe(String(w.name || ""), String(w.url || ""), corpus);
    if (dupe) {
      await sb.from("web_finds").update({ status: "dismissed", auto_assessed_at: now(), auto_action: "dismiss", auto_reason: `already in map: ${dupe.id}` }).eq("id", w.id);
      report.actions.push({ queue: "webfind", id: String(w.id), label, action: "dismissed", reason: `already in the map as ${dupe.id} (${dupe.label})` });
      continue;
    }
    const d = await draftFromFind(client, w, parents);
    if (!d.exists || !d.node) {
      await sb.from("web_finds").update({ status: "dismissed", auto_assessed_at: now(), auto_action: "dismiss", auto_reason: d.note || "could not verify it exists" }).eq("id", w.id);
      report.actions.push({ queue: "webfind", id: String(w.id), label, action: "dismissed", reason: `could not verify a real org: ${d.note}` });
      continue;
    }
    const node = d.node;
    // second dedupe on the verified/official URL
    const dupe2 = findDupe(String(node.label || w.name || ""), String(node.entry || w.url || ""), corpus);
    if (dupe2) {
      await sb.from("web_finds").update({ status: "dismissed", auto_assessed_at: now(), auto_action: "dismiss", auto_reason: `already in map: ${dupe2.id}` }).eq("id", w.id);
      report.actions.push({ queue: "webfind", id: String(w.id), label, action: "dismissed", reason: `already in the map as ${dupe2.id}` });
      continue;
    }
    // mint a unique id
    const g = (node.tags && typeof node.tags === "object") ? String((node.tags as { g?: string }).g || "") : "";
    const prefix = g && g !== "uk" && /^[a-z]{2}$/.test(g) ? g + "_" : "";
    let base = prefix + slug(String(node.label || w.name || "org")); let id = base, k = 2;
    while (ids.has(id)) { id = base + k; k++; }
    ids.add(id);
    const reachable = await urlReachable(String(node.entry || ""));
    const canPublish = CFG.pubNewOrgs && d.publishable && d.defence_relevant && d.confidence >= CFG.pubMinConf && reachable && tagsOk(node.tags);
    const row = {
      id, label: node.label, parent: node.parent, kind: "org",
      does: node.does || "", entry: node.entry || w.url || "",
      tags: tagsOk(node.tags) ? node.tags : null,
      status: canPublish ? "published" : "pending",
      auto_assessed_at: now(),
      auto_action: canPublish ? "publish" : "stage",
      auto_reason: `${canPublish ? "auto-published" : "staged"} from web find — ${d.note}`,
    };
    const { error } = await sb.from("nodes").upsert(row, { onConflict: "id" });
    if (error) { await holdRow(sb, "web_finds", w.id, "review", `verified but node insert failed: ${error.message}`); report.held.push({ queue: "webfind", id: String(w.id), label, action: "review", reason: "verified but node insert failed" }); continue; }
    await sb.from("web_finds").update({ status: "added", auto_assessed_at: now(), auto_action: canPublish ? "publish" : "stage", auto_reason: d.note }).eq("id", w.id);
    corpus.push({ id, label: String(node.label || ""), entry: String(node.entry || "") });
    if (canPublish) report.actions.push({ queue: "webfind", id: String(w.id), label, action: "published new org", reason: `${d.note} (as ${id})`, url: firstUrl(String(node.entry || "")) });
    else report.held.push({ queue: "webfind", id: String(w.id), label, action: "stage", reason: `drafted & staged as pending node ${id} — ${d.note}`, url: firstUrl(String(node.entry || "")) });
  }
}

async function procPendingNodes(client: Anthropic, sb: SupabaseClient, report: Report, budget: () => number, spend: () => void, corpus: Array<{ id: string; label: string; entry: string }>) {
  const { data } = await sb.from("nodes").select("id,label,parent,kind,does,entry,tags").eq("status", "pending").is("auto_assessed_at", null).limit(budget());
  for (const n of data ?? []) {
    if (budget() <= 0) break;
    spend();
    report.processed++;
    const label = (n.label || n.id) as string;
    const dupe = findDupe(String(n.label || ""), String(n.entry || ""), corpus.filter((c) => c.id !== n.id));
    if (dupe) {
      await sb.from("nodes").delete().eq("id", n.id).eq("status", "pending");
      report.actions.push({ queue: "pending-node", id: String(n.id), label, action: "rejected", reason: `duplicate of ${dupe.id} (${dupe.label})` });
      continue;
    }
    const v = await verifyPending(client, n);
    const reachable = await urlReachable(String(n.entry || ""));
    if (!v.exists) {
      await holdRow(sb, "nodes", n.id, "review", `could not verify this is a real org — ${v.note}`);
      report.held.push({ queue: "pending-node", id: String(n.id), label, action: "review", reason: `could not verify — ${v.note}` });
      continue;
    }
    const canPublish = CFG.pubNewOrgs && v.defence_relevant && v.confidence >= CFG.pubMinConf && reachable && tagsOk(n.tags);
    if (canPublish) {
      await sb.from("nodes").update({ status: "published", auto_assessed_at: now(), auto_action: "publish", auto_reason: v.note }).eq("id", n.id);
      report.actions.push({ queue: "pending-node", id: String(n.id), label, action: "published", reason: v.note, url: firstUrl(String(n.entry || "")) });
    } else {
      const why = !CFG.pubNewOrgs ? "auto-publish of new orgs is off" : !v.defence_relevant ? "relevance unclear" : !reachable ? "official URL didn't resolve" : !tagsOk(n.tags) ? "tags incomplete" : `confidence ${v.confidence.toFixed(2)} < ${CFG.pubMinConf}`;
      await holdRow(sb, "nodes", n.id, "publish", `looks real (${v.note}) — awaiting your publish [${why}]`);
      report.held.push({ queue: "pending-node", id: String(n.id), label, action: "publish", reason: `looks real — awaiting your publish [${why}]. ${v.note}`, url: firstUrl(String(n.entry || "")) });
    }
  }
}

async function remainingCounts(sb: SupabaseClient) {
  async function c(table: string, extra?: [string, string]): Promise<number> {
    try {
      let q = sb.from(table).select("*", { count: "exact", head: true }).eq("status", "pending").is("auto_assessed_at", null);
      if (extra) q = q.eq(extra[0], extra[1]);
      const { count } = await q; return count ?? 0;
    } catch { return 0; }
  }
  const [nodes, edits, claims, feedback, webfinds] = await Promise.all([c("nodes"), c("edits"), c("claims"), c("feedback"), c("web_finds")]);
  return { nodes, edits, claims, feedback, webfinds };
}

// ── handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!secretOk(req)) return json({ error: "unauthorized" }, 401);

  let body: { op?: string; max?: number; applied?: number; held?: number; digest?: string; detail?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const op = String(body?.op ?? "run");

  if (op === "config") return json({ config: CFG });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase env not configured" }, 500);
  const sb = createClient(supabaseUrl, serviceKey);

  // Persist a run summary to auto_runs (called by the orchestrator once the queues
  // are drained, so the "Last agent run" card / analytics can read it).
  if (op === "log") {
    const { error } = await sb.from("auto_runs").insert({
      applied: Number(body?.applied ?? 0),
      held: Number(body?.held ?? 0),
      digest: String(body?.digest ?? "").slice(0, 20000),
      detail: body?.detail ?? null,
    });
    if (error) return json({ error: error.message }, 502);
    return json({ ok: true });
  }

  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
  const client = new Anthropic({ apiKey });

  if (op !== "run") return json({ error: "unknown op (expected run | config | log)" }, 400);

  const report: Report = { processed: 0, actions: [], held: [] };
  let heavy = Math.min(CFG.maxHeavy, Math.max(1, Number(body?.max) || CFG.maxHeavy));
  const budget = () => heavy;
  const spend = () => { heavy--; };

  try {
    // Shared context (fetched once per call).
    const [{ data: branchRows }, { data: corpusRows }] = await Promise.all([
      sb.from("nodes").select("id,label").eq("kind", "branch").limit(500),
      sb.from("nodes").select("id,label,entry,status").limit(5000),
    ]);
    const parents = (branchRows ?? []).map((b) => ({ id: b.id as string, label: b.label as string }));
    const ids = new Set<string>((corpusRows ?? []).map((r) => r.id as string));
    const corpus = (corpusRows ?? []).filter((r) => r.status === "published").map((r) => ({ id: r.id as string, label: (r.label as string) || "", entry: (r.entry as string) || "" }));

    // Cheap queues first (deterministic / no web search), then heavy queues within budget.
    await procClaims(sb, report);
    await procFeedback(client, sb, report);
    if (budget() > 0) await procCorrections(client, sb, report, budget, spend, parents);
    if (budget() > 0) await procWebFinds(client, sb, report, budget, spend, parents, corpus, ids);
    if (budget() > 0) await procPendingNodes(client, sb, report, budget, spend, corpus);

    const remaining = await remainingCounts(sb);
    return json({ ran: true, processed: report.processed, actions: report.actions, held: report.held, remaining });
  } catch (e) {
    if (e instanceof Anthropic.APIError) return json({ error: `Anthropic ${e.status}: ${e.message}`, processed: report.processed, actions: report.actions, held: report.held }, 502);
    return json({ error: String(e), processed: report.processed, actions: report.actions, held: report.held }, 500);
  }
});
