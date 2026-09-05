// Edge Function: draft-node
// ---------------------------------------------------------------------------
// POST { name, url, nation, notes }  ->  { does, type, domains, trl, nation }
//
// Calls Claude (Anthropic Messages API) with the drafter's house-style prompt
// and returns the JSON draft. admin-drafter.html applies it via applyReply(),
// which expects exactly these keys.
//
// Required secrets (supabase secrets set ...):
//   ANTHROPIC_API_KEY, DRAFTER_SHARED_SECRET
//
// NOTE: TYPE_KEYS / KNOWN_DOMAINS must stay in sync with drafter-engine.mjs.
// Pin the SDK version below once you've confirmed one that deploys cleanly.

import Anthropic from "npm:@anthropic-ai/sdk";
import { corsHeaders, json, secretOk } from "../_shared/cors.ts";

// Mirror of drafter-engine.mjs TYPE_TAGS keys and KNOWN_DOMAINS.
const TYPE_KEYS = [
  "gov", "military", "procurement", "intel", "nuclear", "academic", "research",
  "rto", "test", "prime", "supply", "sme", "startup", "investor", "policy", "innovation",
];
// Taxonomy v2 subcategory keys — see docs/TAXONOMY.md.
const KNOWN_DOMAINS = [
  "ai", "autonomy", "software", "wargaming", "cyber", "ew", "comms", "pnt", "quantum",
  "c4isr", "space", "eoisr", "air", "land", "maritime", "weapons", "directed", "hypersonic",
  "counteruas", "nuclear", "cbrn", "logistics", "energy", "materials", "microelec",
  "medical", "humanperf", "training", "simulation", "xcut",
];

// Pull the first JSON object out of the model's reply, tolerating code fences.
function extractJson(text: string): unknown | null {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!secretOk(req)) return json({ error: "unauthorized" }, 401);

  let body: { name?: string; url?: string; nation?: string; notes?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const { name = "", url = "", nation = "", notes = "" } = body;
  if (!name.trim()) return json({ error: "name is required" }, 400);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

  const prompt = `You are helping catalogue an organisation for a defence-innovation ecosystem map. Return ONLY minified JSON, no prose, no markdown.

Organisation: ${name}
Website: ${url}
Nation: ${nation || "(infer)"}
${notes ? "Notes: " + notes : ""}

Return JSON with these keys:
- "does": one factual sentence (max ~30 words), house style: concise, verified facts only, no marketing. What it actually does and why it matters to defence.
- "type": ONE of ${TYPE_KEYS.join(", ")}
- "domains": array from ${KNOWN_DOMAINS.join(", ")} (1-4 most relevant; use "xcut" if genuinely cross-cutting)
- "trl": [low,high] integers 1-9 (maturity of what they field)
- "nation": the home country name — OR "NATO", "EU", or "multinational" for a joint / alliance / multinational body

Rules: representative not exhaustive; if you are not confident the organisation is real and defence-relevant, set "does" to "UNVERIFIED" and explain nothing. Do not invent facts.`;

  const client = new Anthropic({ apiKey });
  try {
    // Opus 5 runs adaptive thinking by default; we read only the text block(s).
    const msg = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();

    const draft = extractJson(text);
    if (!draft) return json({ error: "model did not return valid JSON", raw: text }, 502);
    return json(draft);
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      return json({ error: `Anthropic ${e.status}: ${e.message}` }, 502);
    }
    return json({ error: String(e) }, 500);
  }
});
