// Edge Function: coverage-sweep  (GATED — requires x-drafter-secret)
// ---------------------------------------------------------------------------
// Runs the finder's web-search (the "updated taxonomy" search that surfaces
// organisations not yet in the map) SYSTEMATICALLY across every nation × every
// technology category. New candidates (deduped against the live map) are written
// to the web_finds review queue — exactly where the public finder writes and where
// the daily auto-maintainer already picks them up to verify + stage/publish.
//
// Read-only w.r.t. the live map (writes only to web_finds, status='pending').
// Resumable: a cursor over the flattened nation×category grid is kept in
// reference.sweep_cursor, so each run continues where the last left off.
//
// Body:  POST { op:"run", max?:number, cursor?:number }  |  { op:"grid" } | { op:"reset" }
// Required secrets: ANTHROPIC_API_KEY, DRAFTER_SHARED_SECRET
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY injected automatically.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, secretOk } from "../_shared/cors.ts";

const MAX_PER_CALL = Number(Deno.env.get("SWEEP_MAX_PER_RUN") ?? "2");   // cells per invocation (web search is slow)

// The grid axes. Nations (incl. the two joint groupings) × the v2 taxonomy categories.
const NATIONS: Array<[string, string]> = [
  ["uk", "the UK"], ["us", "the US"], ["eu", "the EU (pan-European / EU institutions)"], ["nato", "NATO (multinational bodies)"],
  ["fr", "France"], ["de", "Germany"], ["it", "Italy"], ["nl", "the Netherlands"], ["be", "Belgium"],
  ["se", "Sweden"], ["no", "Norway"], ["fi", "Finland"], ["dk", "Denmark"], ["ee", "Estonia"], ["lv", "Latvia"], ["lt", "Lithuania"],
  ["pl", "Poland"], ["cz", "Czechia"], ["sk", "Slovakia"], ["hu", "Hungary"], ["es", "Spain"], ["pt", "Portugal"], ["gr", "Greece"],
  ["ro", "Romania"], ["bg", "Bulgaria"], ["hr", "Croatia"], ["si", "Slovenia"], ["al", "Albania"], ["mk", "North Macedonia"],
  ["me", "Montenegro"], ["lu", "Luxembourg"], ["is", "Iceland"], ["tr", "Türkiye"], ["ua", "Ukraine"],
  ["ca", "Canada"], ["au", "Australia"], ["nz", "New Zealand"], ["kr", "South Korea"], ["jp", "Japan"], ["il", "Israel"],
  ["in", "India"], ["sg", "Singapore"], ["ae", "the UAE"], ["sa", "Saudi Arabia"],
];
const CATEGORIES: string[] = [
  "AI, autonomy & software (incl. robotics, decision support / wargaming)",
  "cyber, electronic warfare & communications (incl. PNT and quantum)",
  "sensing, ISR & space (C4ISR, sensors, radar, satellites, Earth observation)",
  "platforms & domains (air & uncrewed, land systems, maritime & undersea)",
  "weapons & effects (munitions/missiles, directed energy, hypersonics, counter-UAS)",
  "strategic & deterrence (nuclear, CBRN & counter-WMD)",
  "sustainment & industrial base (logistics, energy/propulsion, advanced materials & manufacturing, microelectronics)",
  "human & medical (combat casualty care, human performance, training & simulation)",
];
const TOTAL = NATIONS.length * CATEGORIES.length;

function textOf(msg: { content: Array<{ type: string }> }): string {
  return msg.content.filter((b) => b.type === "text").map((b) => (b as unknown as { text: string }).text).join("").trim();
}
function parseJson(text: string): Record<string, unknown> {
  try { return JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()); }
  catch { const m = text.match(/\{[\s\S]*\}/); return m ? (() => { try { return JSON.parse(m[0]); } catch { return {}; } })() : {}; }
}
function hostOf(s: string): string {
  const m = String(s || "").match(/https?:\/\/[^\s)"'<>]+/i);
  const u = m ? m[0] : (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(String(s || "").trim()) ? "https://" + String(s).trim() : "");
  try { return new URL(u).host.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

// One web-search cell — mirrors the public finder's web mode (the "updated parameters" search).
async function searchCell(client: Anthropic, nation: string, category: string, exclude: string[]) {
  const system = `You find REAL organisations on the public web for a curated UK / NATO / allied defence innovation & procurement map — for a specific country and technology area.

Use web search to find genuinely real, currently-operating, defence or dual-use relevant organisations in ${nation} working in: ${category}.

RULES:
- Return REAL organisations with an official website URL (the org's own site). NEVER invent one — but you do NOT need certainty of every detail (a maintainer verifies before anything is added), so include plausible real candidates rather than omitting them.
- Return only organisations genuinely based in or operating in ${nation} — do NOT substitute organisations from other countries to pad the list; return fewer, or none, rather than off-country results.
- Prefer institutes, agencies, companies, universities, labs, programmes and funds. Include newer / emerging ones.
- Do NOT return anything already in the map. Already mapped (exclude): ${exclude.slice(0, 60).join("; ") || "(none)"}
- Up to 6, most relevant first. Return an empty list only if you genuinely cannot find any.

Return ONLY minified JSON: {"external":[{"name":"...","url":"https://...","why":"one clause on what they do"}]}`;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Search ${nation} for real organisations in "${category}". Return the JSON.` }];
  const opts = () => ({ model: "claude-opus-5", max_tokens: 4096, output_config: { effort: "medium" as const }, system, tools: [{ type: "web_search_20260209" as const, name: "web_search", max_uses: 5 }], messages });
  let resp = await client.messages.create(opts());
  for (let i = 0; i < 3 && resp.stop_reason === "pause_turn"; i++) { messages.push({ role: "assistant", content: resp.content }); resp = await client.messages.create(opts()); }
  const parsed = parseJson(textOf(resp)) as { external?: Array<{ name?: string; url?: string; why?: string }> };
  return (parsed.external ?? []).filter((x) => x && x.name && x.url && /^https?:\/\//i.test(String(x.url))).slice(0, 6);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!secretOk(req)) return json({ error: "unauthorized" }, 401);

  let body: { op?: string; max?: number; cursor?: number };
  try { body = await req.json(); } catch { body = {}; }
  const op = String(body?.op ?? "run");

  if (op === "grid") return json({ total: TOTAL, nations: NATIONS.length, categories: CATEGORIES.length });

  const supabaseUrl = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase env not configured" }, 500);
  const sb = createClient(supabaseUrl, serviceKey);

  if (op === "reset") { await sb.from("reference").upsert({ key: "sweep_cursor", value: 0 as unknown as object }, { onConflict: "key" }); return json({ ok: true, cursor: 0 }); }
  if (op !== "run") return json({ error: "unknown op (expected run | grid | reset)" }, 400);
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
  const client = new Anthropic({ apiKey });

  // Cursor: explicit, else the stored one.
  let cursor = Number.isFinite(Number(body?.cursor)) ? Math.max(0, Number(body?.cursor)) : NaN;
  if (Number.isNaN(cursor)) { const { data } = await sb.from("reference").select("value").eq("key", "sweep_cursor").maybeSingle(); cursor = Number(data?.value ?? 0) || 0; }
  if (cursor >= TOTAL) return json({ ran: true, done: true, cursor, total: TOTAL, processed: 0, added: [], remaining: 0 });

  const max = Math.min(MAX_PER_CALL, Math.max(1, Number(body?.max) || MAX_PER_CALL));

  // Dedupe context: mapped domains, and web_finds urls already captured.
  const { data: corpus } = await sb.from("nodes").select("label,entry").eq("status", "published").limit(5000);
  const mapped = new Set<string>(); const labels: string[] = [];
  (corpus ?? []).forEach((r) => { const h = hostOf(String(r.entry || "")); if (h) mapped.add(h); if (r.label) labels.push(String(r.label)); });
  const { data: wf } = await sb.from("web_finds").select("url").limit(10000);
  const seen = new Set<string>((wf ?? []).map((r) => hostOf(String(r.url || ""))).filter(Boolean));

  const added: Array<Record<string, unknown>> = [];
  let processed = 0;
  try {
    for (let i = cursor; i < TOTAL && processed < max; i++, processed++) {
      const [code, nation] = NATIONS[Math.floor(i / CATEGORIES.length)];
      const category = CATEGORIES[i % CATEGORIES.length];
      // exclude labels roughly relevant to this nation (cheap: send a slice)
      const finds = await searchCell(client, nation, category, labels.slice(0, 60));
      for (const f of finds) {
        const h = hostOf(String(f.url));
        if (!h || mapped.has(h) || seen.has(h)) continue;         // already in the map or already surfaced
        seen.add(h);
        const row = { name: String(f.name), url: String(f.url), why: String(f.why || ""), query: `${nation} · ${category}`.slice(0, 400), source: "sweep", status: "pending" };
        const { error } = await sb.from("web_finds").insert(row);
        if (!error) added.push({ name: row.name, url: row.url, nation: code, category: category.split(" (")[0] });
      }
    }
    const nextCursor = cursor + processed;
    await sb.from("reference").upsert({ key: "sweep_cursor", value: nextCursor as unknown as object }, { onConflict: "key" });
    return json({ ran: true, cursor, nextCursor, processed, total: TOTAL, added, remaining: TOTAL - nextCursor, done: nextCursor >= TOTAL });
  } catch (e) {
    if (e instanceof Anthropic.APIError) return json({ error: `Anthropic ${e.status}: ${e.message}`, added }, 502);
    return json({ error: String(e), added }, 500);
  }
});
