// Edge Function: repair-node  (GATED — requires x-drafter-secret)
// ---------------------------------------------------------------------------
// AI-assisted repair of an organisation entry from a submitted correction.
// Handles the complex cases (wrong parent/category, renamed body, defunct or
// merged organisation, confused countries) that need more than a one-field edit.
//
//   POST { node:{id,label,parent,does,entry,tags},
//          correction:{field,suggestion},
//          parents:[{id,label}] }        // valid branch ids it may re-home under
//     -> { repair:{label,parent,does,entry,tags,note} }
//
// Uses claude-opus-5 with web search to VERIFY the correction (renames, mergers,
// defunct bodies, reference URLs) before proposing the rewrite. The maintainer
// reviews the proposal in the drafter and applies it (upsert) — nothing is
// written to the map by this function.
//
// Required secret: ANTHROPIC_API_KEY, DRAFTER_SHARED_SECRET

import Anthropic from "npm:@anthropic-ai/sdk";
import { corsHeaders, json, secretOk } from "../_shared/cors.ts";

function textOf(msg: { content: Array<{ type: string }> }): string {
  return msg.content.filter((b) => b.type === "text").map((b) => (b as unknown as { text: string }).text).join("").trim();
}
function parseJson(text: string): Record<string, unknown> {
  try { return JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()); }
  catch { const m = text.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : {}; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!secretOk(req)) return json({ error: "unauthorized" }, 401);

  let body: {
    node?: { id?: string; label?: string; parent?: string; does?: string; entry?: string; tags?: unknown };
    correction?: { field?: string; suggestion?: string };
    parents?: Array<{ id?: string; label?: string }>;
  };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const node = body?.node;
  const correction = body?.correction;
  if (!node?.id || !correction?.suggestion) return json({ error: "node and correction are required" }, 400);
  const parents = Array.isArray(body?.parents) ? body.parents.slice(0, 200) : [];

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

  const system = `You repair one organisation's entry in a curated UK / NATO / allied defence innovation & procurement map, based on a submitted correction. Some corrections are complex — wrong parent/category, a renamed body, a defunct or merged organisation, or confused countries — and need more than a one-field tweak.

You are given the CURRENT node, the CORRECTION, and a list of valid PARENT branch ids you may re-home the node under.

Use web search to VERIFY the correction before rewriting — especially for renames, mergers, defunct bodies, or when a reference URL is given. Never invent organisations, facts, or URLs.

Produce the corrected node. You may change any of:
- "label": the display name (update it if the body was renamed).
- "parent": choose ONLY an id from the provided PARENT list, or keep the current parent if none is clearly better. (e.g. an industry firm does not belong under an "EU institutions" branch.)
- "does": one concise, factual, neutral sentence — house style, no marketing. If the organisation is defunct or merged, say so plainly, e.g. "Defunct (2025); functions subsumed into the National Armaments Director (NAD) Group."
- "entry": the official contact/URL line (keep it useful even for defunct bodies).
- "tags": keep the same shape { w, o, t, d, a, g } if present; adjust only if the correction warrants.

Return ONLY minified JSON: {"label":"...","parent":"<id>","does":"...","entry":"...","tags":{...},"note":"one sentence on what you changed and why"}`;

  const user = `CURRENT node:
${JSON.stringify(node)}

CORRECTION (field the submitter flagged: ${correction.field || "—"}):
${correction.suggestion}

Valid PARENT ids you may use (id — label):
${parents.map((p) => `${p.id} — ${p.label}`).join("\n")}`;

  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  try {
    let resp = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 8192,
      output_config: { effort: "medium" },
      system,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
      messages,
    });
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
    const r = parseJson(textOf(resp)) as Record<string, unknown>;
    if (!r || (!r.does && !r.label && !r.parent)) return json({ error: "no repair produced", raw: textOf(resp).slice(0, 300) }, 502);
    const repair = {
      label: r.label ?? node.label ?? "",
      parent: r.parent ?? node.parent ?? "",
      does: r.does ?? node.does ?? "",
      entry: r.entry ?? node.entry ?? "",
      tags: (r.tags && typeof r.tags === "object" && Array.isArray((r.tags as { d?: unknown }).d)) ? r.tags : (node.tags ?? null),
      note: r.note ?? "",
    };
    return json({ repair });
  } catch (e) {
    if (e instanceof Anthropic.APIError) return json({ error: `Anthropic ${e.status}: ${e.message}` }, 502);
    return json({ error: String(e) }, 500);
  }
});
