// Edge Function: find-door  (PUBLIC — no shared secret)
// ---------------------------------------------------------------------------
// POST { description, candidates:[{id,label,does,w,o,d,t,g}] }
//   -> { matches:[{id, tier:"exact"|"close"|"potential", why}] }
//
// Semantic "Find your door": the browser pre-filters the map to a shortlist and
// sends it with the user's free-text situation; Claude ranks ONLY those
// candidates and explains each in plain English. It never invents orgs and it
// never writes to the dataset — this is a read-only concierge.
//
// Cost protection: a soft per-IP + global daily rate limit via the public
// increment_rate() RPC (SECURITY DEFINER). No service-role key is used here.
//
// Required secret: ANTHROPIC_API_KEY
// SUPABASE_URL + SUPABASE_ANON_KEY are injected automatically.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const DAILY_GLOBAL_CAP = Number(Deno.env.get("FINDDOOR_DAILY_CAP") ?? "800");
const PER_IP_CAP = Number(Deno.env.get("FINDDOOR_IP_CAP") ?? "40");
const MAX_CANDIDATES = 60;
const MAX_DESC = 1000;

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { description?: string; candidates?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const description = String(body?.description ?? "").slice(0, MAX_DESC).trim();
  const candidates = Array.isArray(body?.candidates) ? body.candidates.slice(0, MAX_CANDIDATES) : [];
  if (!description) return json({ error: "description is required", matches: [] }, 400);
  if (!candidates.length) return json({ matches: [] });

  // Soft rate limit — protects the Anthropic bill. Fails open if unavailable.
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (url && anon) {
      const sb = createClient(url, anon);
      const day = new Date().toISOString().slice(0, 10);
      const [g, ip] = await Promise.all([
        sb.rpc("increment_rate", { p_key: `finddoor:global:${day}` }),
        sb.rpc("increment_rate", { p_key: `finddoor:ip:${clientIp(req)}:${day}` }),
      ]);
      if ((g.data ?? 0) > DAILY_GLOBAL_CAP || (ip.data ?? 0) > PER_IP_CAP) {
        return json({ error: "rate_limited", matches: [] }, 429);
      }
    }
  } catch (_) { /* fail open */ }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured", matches: [] }, 500);

  const system = `You help someone navigate the UK / NATO / allied defence innovation & procurement landscape find the right "door" (organisation) for their situation.

You are given the user's free-text description and a SHORTLIST of candidate organisations from a curated map (each has an id, label, one-line "does", and tags: w=who it's for, o=what it offers, d=tech domains, t=[TRL low,high], g=geo).

Rules:
- Choose ONLY from the provided candidate ids. NEVER invent organisations, URLs, or facts.
- Rank the genuinely relevant ones; if only a few truly fit, return only those — do not pad.
- Tier each: "exact" (clearly the right door), "close" (strong fit), "potential" (partial/adjacent — a possible partner, prime to sub-contract to, or convenor who can introduce them).
- "why": one sentence, addressed to the user ("you"), grounded in what they wrote — say specifically why this door fits their situation.

Return ONLY minified JSON, no prose, no markdown:
{"matches":[{"id":"<candidate id>","tier":"exact|close|potential","why":"..."}]}`;

  const userMsg = `User's situation:\n${description}\n\nCandidates (JSON):\n${JSON.stringify(candidates)}`;

  const client = new Anthropic({ apiKey });
  try {
    const msg = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      output_config: { effort: "low" }, // ranking a supplied shortlist is a simple task; keeps public cost down
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();

    let parsed: { matches?: Array<{ id: string; tier?: string; why?: string }> };
    try {
      parsed = JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim());
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { matches: [] };
    }

    const validIds = new Set(candidates.map((c: { id?: string }) => c?.id));
    const matches = (parsed.matches ?? [])
      .filter((x) => x && validIds.has(x.id))
      .slice(0, 12);
    return json({ matches });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      return json({ error: `Anthropic ${e.status}: ${e.message}`, matches: [] }, 502);
    }
    return json({ error: String(e), matches: [] }, 500);
  }
});
