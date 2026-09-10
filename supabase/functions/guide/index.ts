// Edge Function: guide  (PUBLIC — no shared secret; rate-limited)
// ---------------------------------------------------------------------------
// The conversational assistant for The Defence Ecosystem. Multi-turn, grounded in
// the map: each turn the browser sends the conversation, a SHORTLIST of relevant
// organisations (retrieved client-side), and an OVERVIEW of the map. Claude
// answers from the mapped bodies (referencing them as [[id]] the client turns into
// clickable chips), and may use web search when the map is thin (flagged as
// unverified). Read-only — never writes to the dataset.
//
//   POST { messages:[{role,content}], candidates:[{id,label,does,...}], overview:[{id,label}] }
//     -> { reply: "<markdown; map refs as [[id]]>" }
//
// Cost protection: soft per-IP + global daily rate limits via increment_rate().
// Required secret: ANTHROPIC_API_KEY. SUPABASE_URL + SUPABASE_ANON_KEY auto-injected.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const DAILY = Number(Deno.env.get("GUIDE_DAILY_CAP") ?? "1500");
const IP_CAP = Number(Deno.env.get("GUIDE_IP_CAP") ?? "80");
const MAX_MSGS = 14;
const MAX_CAND = 44;

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}
function textOf(msg: { content: Array<{ type: string }> }): string {
  return msg.content.filter((b) => b.type === "text").map((b) => (b as unknown as { text: string }).text).join("").trim();
}
async function overLimit(req: Request): Promise<boolean> {
  try {
    const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anon) return false;
    const sb = createClient(url, anon);
    const day = new Date().toISOString().slice(0, 10);
    const [g, ip] = await Promise.all([
      sb.rpc("increment_rate", { p_key: `guide:global:${day}` }),
      sb.rpc("increment_rate", { p_key: `guide:ip:${clientIp(req)}:${day}` }),
    ]);
    return (g.data ?? 0) > DAILY || (ip.data ?? 0) > IP_CAP;
  } catch { return false; }
}

const BASE_SYSTEM = `You are the friendly, expert guide for "The Defence Ecosystem" — an interactive map of the UK / NATO / allied / partner-nation defence INNOVATION and PROCUREMENT landscape (who the organisations are, what they do, and how to approach them). You help a visitor:
 1. Find the right "door" — the specific organisation(s) to approach for their situation.
 2. Understand the landscape — how bodies relate (e.g. DE&S vs the NAD Group; UK Defence Innovation (UKDI), which absorbed DASA) and the route in.
 3. Use the tool — the two lenses (top bar: Alliance & country / Technology), "Find your door" (describe your situation → ranked doors + an on-demand wider-web search), clicking any organisation to open its panel and entry route, and "Suggest a correction" / "Send feedback" (which can carry a fact sheet) that feed a maintainer review queue.
 4. Draft an approach — help word a first, concise, credible intro / email to a body once chosen.

You are given: the recent conversation; a SHORTLIST of organisations from the map relevant to the latest message (id — label — does [tags]); and an OVERVIEW of the map's top branches and technology categories.

Grounding & honesty (the project's rule is accuracy over speed):
 - Prefer the shortlisted / mapped organisations. When you name a mapped organisation, wrap its id in double square brackets so the user can click straight to it — e.g. [[dstl]], [[ukdi]]. Use ONLY ids from the provided shortlist or overview; never invent an id or guess one.
 - If the map genuinely doesn't cover what they need, you MAY use web search to find a real, currently-operating organisation, and you MUST flag it as "not in the map yet — unverified, worth checking" with its official link. Never invent an organisation, a URL, or a fact.
 - Be concise, neutral and practical — no marketing language, UK spelling. Usually a short framing sentence, then the specific door(s), then the next step. Ask a brief clarifying question only when you genuinely cannot help without it.
 - You are a navigational aid, not an official source — when it matters (dates, eligibility, contacts), remind the user to verify on the body's own site.

Reply in short, well-structured markdown (bold and bullet points are fine). Put each recommended door on its own line with its [[id]] and one clause on why it fits. Do NOT output JSON — just your message.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { messages?: Array<{ role?: string; content?: unknown }>; candidates?: unknown; overview?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body", reply: "" }, 400); }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured", reply: "" }, 500);

  const msgs = Array.isArray(body?.messages) ? body.messages : [];
  const clean: Anthropic.MessageParam[] = msgs
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && (m.content as string).trim())
    .slice(-MAX_MSGS)
    .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 4000) }));
  if (!clean.length || clean[clean.length - 1].role !== "user") return json({ error: "a user message is required", reply: "" }, 400);

  if (await overLimit(req)) return json({ error: "rate_limited", reply: "The guide is busy right now — please try again shortly." }, 429);

  const cands = Array.isArray(body?.candidates) ? body.candidates.slice(0, MAX_CAND) : [];
  const overview = Array.isArray(body?.overview) ? body.overview.slice(0, 60) : [];
  const candStr = cands.map((c) => {
    const x = c as { id?: string; label?: string; does?: string; d?: unknown; g?: unknown };
    const tags = [Array.isArray(x.d) ? (x.d as string[]).join("/") : "", x.g ? String(x.g) : ""].filter(Boolean).join(" ");
    return `${x.id} — ${x.label}${x.does ? " — " + String(x.does).slice(0, 140) : ""}${tags ? " [" + tags + "]" : ""}`;
  }).join("\n");
  const ovStr = overview.map((o) => { const x = o as { id?: string; label?: string }; return `${x.id} — ${x.label}`; }).join("\n");

  const system = `${BASE_SYSTEM}\n\nMAP OVERVIEW (top branches & technology categories — ids you may link):\n${ovStr || "(none provided)"}\n\nRELEVANT ORGANISATIONS for the latest message (id — label — does [tags]):\n${candStr || "(none matched — rely on the overview, ask a clarifying question, or search the web if the map is thin)"}`;

  const client = new Anthropic({ apiKey });
  try {
    const opts = () => ({
      model: "claude-opus-5", max_tokens: 2048, output_config: { effort: "low" as const },
      system, tools: [{ type: "web_search_20260209" as const, name: "web_search", max_uses: 3 }], messages: clean,
    });
    let resp = await client.messages.create(opts());
    for (let i = 0; i < 3 && resp.stop_reason === "pause_turn"; i++) { clean.push({ role: "assistant", content: resp.content }); resp = await client.messages.create(opts()); }
    const reply = textOf(resp) || "Sorry — I couldn't find a good answer just now. Try rephrasing, or use “Find your door”.";
    return json({ reply });
  } catch (e) {
    if (e instanceof Anthropic.APIError) return json({ error: `Anthropic ${e.status}: ${e.message}`, reply: "" }, 502);
    return json({ error: String(e), reply: "" }, 500);
  }
});
