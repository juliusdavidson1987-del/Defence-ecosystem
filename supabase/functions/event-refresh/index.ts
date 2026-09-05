// Edge Function: event-refresh  (GATED — requires x-drafter-secret)
// ---------------------------------------------------------------------------
// Events rework Phase 2 — the weekly date-refresh agent.
//
// For each anchor fair in reference.event_next, uses claude-opus-5 + web search
// to find the OFFICIAL next edition (date + place). When it differs from what's
// stored, it files a PROPOSED change in event_date_proposals for the maintainer.
// Dates are high-stakes, so nothing is written to reference.event_next here —
// approval happens in admin-drafter.html (review-node eventprop-set).
//
// Bounded per call (web search is slow); the orchestrator loops, passing back the
// ids it has already checked so each event is looked at once per weekly run.
//
// Body:  POST { op:"run", max?:number, exclude?:[node_id] }
// Required secrets: ANTHROPIC_API_KEY, DRAFTER_SHARED_SECRET
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, secretOk } from "../_shared/cors.ts";

const MAX_PER_CALL = Number(Deno.env.get("EVENTREFRESH_MAX_PER_RUN") ?? "2");
const MIN_CONF = Number(Deno.env.get("EVENTREFRESH_MIN_CONFIDENCE") ?? "0.6");

function textOf(msg: { content: Array<{ type: string }> }): string {
  return msg.content.filter((b) => b.type === "text").map((b) => (b as unknown as { text: string }).text).join("").trim();
}
function parseJson(text: string): Record<string, unknown> {
  try { return JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()); }
  catch { const m = text.match(/\{[\s\S]*\}/); return m ? (() => { try { return JSON.parse(m[0]); } catch { return {}; } })() : {}; }
}

async function checkEvent(client: Anthropic, label: string, url: string, cur: { next?: string; where?: string }) {
  const system = `You verify the NEXT edition of a recurring defence/security trade event, for a curated map. Use web search to find the OFFICIAL next-edition date and location (prefer the event's own site / organiser). Never invent dates — if you cannot confirm, say so with low confidence.

You are given the event, its official URL, and the date currently stored in the map. Decide whether the stored value still matches the official next edition.

Return ONLY minified JSON:
{"same":true|false,"next":"e.g. 15–19 June 2026 (or a pattern like '2027 (odd years)' if an exact date isn't published yet)","where":"venue, city","source_url":"https://…","confidence":0.0-1.0,"note":"one sentence"}
Set "same": true if the stored value is still correct (then still fill next/where with the confirmed value). Set it false only if the official source clearly shows a different date or venue.`;
  const user = `Event: ${label}\nOfficial URL: ${url || "(none)"}\nCurrently stored → next: "${cur.next || ""}", where: "${cur.where || ""}"\n\nConfirm the official next edition.`;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  const opts = () => ({
    model: "claude-opus-5", max_tokens: 2048, output_config: { effort: "medium" as const },
    system, tools: [{ type: "web_search_20260209" as const, name: "web_search", max_uses: 4 }], messages,
  });
  let resp = await client.messages.create(opts());
  for (let i = 0; i < 3 && resp.stop_reason === "pause_turn"; i++) { messages.push({ role: "assistant", content: resp.content }); resp = await client.messages.create(opts()); }
  const r = parseJson(textOf(resp));
  return {
    same: r.same !== false,
    next: String(r.next || ""),
    where: String(r.where || ""),
    source_url: String(r.source_url || ""),
    confidence: Number(r.confidence ?? 0),
    note: String(r.note || ""),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!secretOk(req)) return json({ error: "unauthorized" }, 401);

  let body: { op?: string; max?: number; exclude?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  if (String(body?.op ?? "run") !== "run") return json({ error: "unknown op (expected run)" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase env not configured" }, 500);
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
  const sb = createClient(supabaseUrl, serviceKey);
  const client = new Anthropic({ apiKey });

  const exclude = new Set(Array.isArray(body?.exclude) ? body.exclude.map((s) => String(s)) : []);
  const max = Math.min(MAX_PER_CALL, Math.max(1, Number(body?.max) || MAX_PER_CALL));

  try {
    // Current stored dates.
    const { data: refRow } = await sb.from("reference").select("value").eq("key", "event_next").maybeSingle();
    const eventNext = (refRow?.value ?? {}) as Record<string, { next?: string; where?: string }>;
    const ids = Object.keys(eventNext);
    if (!ids.length) return json({ ran: true, checked: [], proposals: [], remaining: 0, note: "reference.event_next is empty — run the Phase 1 migration first" });

    // Node labels/URLs for those ids.
    const { data: nodeRows } = await sb.from("nodes").select("id,label,entry").in("id", ids);
    const nodeById = new Map((nodeRows ?? []).map((n) => [n.id as string, n]));

    // Skip ids that already have a pending proposal (awaiting the maintainer).
    const { data: pend } = await sb.from("event_date_proposals").select("node_id").eq("status", "pending");
    const pendingIds = new Set((pend ?? []).map((p) => p.node_id as string));

    const candidates = ids.filter((id) => !exclude.has(id) && !pendingIds.has(id));
    const batch = candidates.slice(0, max);

    const checked: string[] = [];
    const proposals: Array<Record<string, unknown>> = [];
    for (const id of batch) {
      const node = nodeById.get(id);
      const cur = eventNext[id] || {};
      const label = (node?.label as string) || id;
      const url = (node?.entry as string) || "";
      checked.push(id);
      const v = await checkEvent(client, label, url, cur);
      const changed = !v.same && v.next && (v.next.trim() !== (cur.next || "").trim() || (v.where && v.where.trim() !== (cur.where || "").trim()));
      if (changed && v.confidence >= MIN_CONF) {
        const row = {
          node_id: id, current_next: cur.next || "", current_where: cur.where || "",
          proposed_next: v.next, proposed_where: v.where, source_url: v.source_url,
          confidence: v.confidence, note: v.note, status: "pending",
        };
        const { error } = await sb.from("event_date_proposals").insert(row);
        if (!error) proposals.push({ node_id: id, label, ...row });
      }
    }
    const remaining = candidates.length - batch.length;
    return json({ ran: true, checked, proposals, remaining });
  } catch (e) {
    if (e instanceof Anthropic.APIError) return json({ error: `Anthropic ${e.status}: ${e.message}` }, 502);
    return json({ error: String(e) }, 500);
  }
});
