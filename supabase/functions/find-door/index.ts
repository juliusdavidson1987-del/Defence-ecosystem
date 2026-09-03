// Edge Function: find-door  (PUBLIC — no shared secret)
// ---------------------------------------------------------------------------
// Two modes, both read-only (never writes to the dataset):
//
//  A) RANK (default) — POST { description, candidates:[{id,label,does,w,o,d,t,g}] }
//       -> { matches:[{id, tier:"exact"|"close"|"potential", why}] }
//     The browser pre-filters the map to a shortlist; Claude ranks ONLY those.
//
//  B) WEB  — POST { web:true, description, exclude:[names already in the map] }
//       -> { external:[{name, url, why}] }
//     When the map is thin, Claude uses web search to find REAL external orgs
//     (verified URLs), excluding anything already mapped. Shown to the user as
//     "not yet in the map — suggested". Ingestion is a separate, gated step.
//
// Cost protection: soft per-IP + global daily rate limits via increment_rate()
// (anon RPC, SECURITY DEFINER). Web mode has its own, tighter caps.
//
// Required secret: ANTHROPIC_API_KEY
// SUPABASE_URL + SUPABASE_ANON_KEY are injected automatically.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const RANK_DAILY = Number(Deno.env.get("FINDDOOR_DAILY_CAP") ?? "800");
const RANK_IP = Number(Deno.env.get("FINDDOOR_IP_CAP") ?? "40");
const WEB_DAILY = Number(Deno.env.get("FINDDOORWEB_DAILY_CAP") ?? "300");
const WEB_IP = Number(Deno.env.get("FINDDOORWEB_IP_CAP") ?? "15");
const MAX_CANDIDATES = 60;
const MAX_EXCLUDE = 80;
const MAX_DESC = 1000;

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

function textOf(msg: { content: Array<{ type: string }> }): string {
  return msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as unknown as { text: string }).text)
    .join("")
    .trim();
}

function parseJson(text: string): Record<string, unknown> {
  try { return JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()); }
  catch { const m = text.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : {}; }
}

// Soft rate limit. Returns true if the request should be blocked. Fails open.
async function overLimit(req: Request, kind: "rank" | "web", dailyCap: number, ipCap: number): Promise<boolean> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anon) return false;
    const sb = createClient(url, anon);
    const day = new Date().toISOString().slice(0, 10);
    const [g, ip] = await Promise.all([
      sb.rpc("increment_rate", { p_key: `${kind}:global:${day}` }),
      sb.rpc("increment_rate", { p_key: `${kind}:ip:${clientIp(req)}:${day}` }),
    ]);
    return (g.data ?? 0) > dailyCap || (ip.data ?? 0) > ipCap;
  } catch { return false; }
}

async function handleRank(client: Anthropic, description: string, candidates: unknown[]): Promise<Response> {
  const system = `You help someone navigate the UK / NATO / allied defence innovation & procurement landscape find the right "door" (organisation) for their situation.

You are given the user's free-text description and a SHORTLIST of candidate organisations from a curated map (id, label, one-line "does", and tags: w=who it's for, o=what it offers, d=tech domains, t=[TRL low,high], g=geo).

Rules:
- Choose ONLY from the provided candidate ids. NEVER invent organisations, URLs, or facts.
- Rank the genuinely relevant ones; if only a few truly fit, return only those — do not pad.
- Tier each: "exact" (clearly the right door), "close" (strong fit), "potential" (partial/adjacent — a possible partner, prime to sub-contract to, or convenor who can introduce them).
- "why": one sentence, addressed to the user ("you"), grounded in what they wrote.

Return ONLY minified JSON: {"matches":[{"id":"<candidate id>","tier":"exact|close|potential","why":"..."}]}`;

  const msg = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: `User's situation:\n${description}\n\nCandidates (JSON):\n${JSON.stringify(candidates)}` }],
  });
  const parsed = parseJson(textOf(msg)) as { matches?: Array<{ id: string; tier?: string; why?: string }> };
  const valid = new Set(candidates.map((c) => (c as { id?: string })?.id));
  const matches = (parsed.matches ?? []).filter((x) => x && valid.has(x.id)).slice(0, 12);
  return json({ matches });
}

async function handleWeb(client: Anthropic, description: string, exclude: string[]): Promise<Response> {
  const system = `You find REAL organisations on the public web that could be a "door" for someone in the UK / NATO / allied defence innovation & procurement landscape, for cases the curated map does not already cover.

Use web search to find genuinely real, currently-operating, relevant organisations.

RULES:
- Return REAL organisations found via search, each with an official website URL (the org's own site — give the best official URL you can find; avoid directories/news/LinkedIn where possible). NEVER invent an organisation that does not exist — but you do NOT need to be certain of every detail: these are suggestions a maintainer verifies before anything is added, so err toward including a plausible real organisation rather than omitting it.
- Defence or dual-use relevant.
- Do NOT return anything already in the map. Already mapped (exclude these): ${exclude.join("; ") || "(none provided)"}
- Return up to 6, most relevant first, ranked by fit. Strongly prefer surfacing useful candidates over an empty list — only return an empty list if you genuinely cannot find ANY relevant real organisation after searching.

Return ONLY minified JSON as your final message: {"external":[{"name":"...","url":"https://...","why":"one sentence addressed to the user"}]}`;

  const messages: Anthropic.MessageParam[] = [{
    role: "user",
    content: `The user's situation:\n${description}\n\nSearch the web for real organisations that fit, excluding anything already in the map. Return the JSON described.`,
  }];

  let resp = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 8192,
    output_config: { effort: "medium" },
    system,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    messages,
  });
  // Continue if the server-tool turn paused (bounded).
  for (let i = 0; i < 3 && resp.stop_reason === "pause_turn"; i++) {
    messages.push({ role: "assistant", content: resp.content });
    resp = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 8192,
      output_config: { effort: "medium" },
      system,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
      messages,
    });
  }

  const parsed = parseJson(textOf(resp)) as { external?: Array<{ name?: string; url?: string; why?: string }> };
  const external = (parsed.external ?? [])
    .filter((x) => x && x.name && x.url && /^https?:\/\//i.test(String(x.url)))
    .slice(0, 6)
    .map((x) => ({ name: String(x.name), url: String(x.url), why: String(x.why ?? "") }));
  return json({ external });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { description?: string; candidates?: unknown; web?: boolean; exclude?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const description = String(body?.description ?? "").slice(0, MAX_DESC).trim();
  if (!description) return json({ error: "description is required", matches: [], external: [] }, 400);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured", matches: [], external: [] }, 500);
  const client = new Anthropic({ apiKey });

  try {
    if (body?.web === true) {
      if (await overLimit(req, "web", WEB_DAILY, WEB_IP)) return json({ error: "rate_limited", external: [] }, 429);
      const exclude = Array.isArray(body?.exclude)
        ? body.exclude.map((s) => String(s)).slice(0, MAX_EXCLUDE)
        : [];
      return await handleWeb(client, description, exclude);
    } else {
      if (await overLimit(req, "rank", RANK_DAILY, RANK_IP)) return json({ error: "rate_limited", matches: [] }, 429);
      const candidates = Array.isArray(body?.candidates) ? body.candidates.slice(0, MAX_CANDIDATES) : [];
      if (!candidates.length) return json({ matches: [] });
      return await handleRank(client, description, candidates);
    }
  } catch (e) {
    if (e instanceof Anthropic.APIError) return json({ error: `Anthropic ${e.status}: ${e.message}`, matches: [], external: [] }, 502);
    return json({ error: String(e), matches: [], external: [] }, 500);
  }
});
