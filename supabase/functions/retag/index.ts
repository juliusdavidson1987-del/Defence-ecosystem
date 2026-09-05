// Edge Function: retag  (GATED — requires x-drafter-secret)
// ---------------------------------------------------------------------------
// Taxonomy v2 — the one-off retag pass. Walks the org nodes in batches and, using
// claude-opus-5 (no web search — pure classification from name + description),
// refines each node's domain tags (tags.d) into the v2 subcategories:
//   • preserves sensible existing tags, adds finer/missing ones;
//   • splits the legacy 'human' tag into 'medical' and/or 'humanperf';
//   • only ever changes tags.d (w/o/t/a/g untouched).
//
// Before writing a node it snapshots the old tags into retag_backup (full revert).
// dryRun returns the proposed changes without writing.
//
// Body:  POST { op:"run", limit?:number, offset?:number, dryRun?:boolean }
//   -> { processed, changed:[{id,label,old,new}], nextOffset, done }
// Required secrets: ANTHROPIC_API_KEY, DRAFTER_SHARED_SECRET
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, secretOk } from "../_shared/cors.ts";

// Valid v2 domain subcategories the retag may assign (function buckets x* are computed elsewhere).
const DOMS = new Set(["ai","autonomy","software","wargaming","cyber","ew","comms","pnt","quantum","c4isr","space","eoisr","air","land","maritime","weapons","directed","hypersonic","counteruas","nuclear","cbrn","logistics","energy","materials","microelec","medical","humanperf","training","simulation","xcut"]);
const VOCAB = `ai=AI & machine learning; autonomy=autonomy & robotics; software=software, data & digital infrastructure; wargaming=decision support & wargaming; cyber=cyber & information security; ew=electronic warfare & spectrum; comms=communications & networks; pnt=position, navigation & timing; quantum=quantum; c4isr=C4ISR, sensors & radar; space=space systems; eoisr=Earth observation & space ISR; air=air & uncrewed; land=land systems; maritime=maritime & undersea; weapons=weapons, munitions & missiles; directed=directed energy; hypersonic=hypersonics; counteruas=counter-UAS & air/missile defence; nuclear=nuclear; cbrn=CBRN & counter-WMD; logistics=logistics & sustainment; energy=energy, power & propulsion; materials=advanced materials & manufacturing; microelec=microelectronics & semiconductors; medical=combat casualty care & medical; humanperf=human performance & augmentation; training=training & education; simulation=modelling & simulation; xcut=genuinely cross-cutting / no single domain`;

const DEF_LIMIT = Number(Deno.env.get("RETAG_BATCH") ?? "25");

function textOf(msg: { content: Array<{ type: string }> }): string {
  return msg.content.filter((b) => b.type === "text").map((b) => (b as unknown as { text: string }).text).join("").trim();
}
function parseJson(text: string): Record<string, unknown> {
  try { return JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()); }
  catch { const m = text.match(/\{[\s\S]*\}/); return m ? (() => { try { return JSON.parse(m[0]); } catch { return {}; } })() : {}; }
}
function cleanD(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const x of arr) { const k = String(x).trim().toLowerCase(); if (DOMS.has(k) && !out.includes(k)) out.push(k); }
  return out.slice(0, 4);
}
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!secretOk(req)) return json({ error: "unauthorized" }, 401);

  let body: { op?: string; limit?: number; offset?: number; dryRun?: boolean };
  try { body = await req.json(); } catch { body = {}; }
  if (String(body?.op ?? "run") !== "run") return json({ error: "unknown op (expected run)" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase env not configured" }, 500);
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
  const sb = createClient(supabaseUrl, serviceKey);
  const client = new Anthropic({ apiKey });

  const limit = Math.min(60, Math.max(1, Number(body?.limit) || DEF_LIMIT));
  const offset = Math.max(0, Number(body?.offset) || 0);
  const dryRun = body?.dryRun === true;

  try {
    // Org nodes with a tags object, stable id order for offset paging.
    const { data: rows, error } = await sb.from("nodes")
      .select("id,label,does,tags").eq("kind", "org").eq("status", "published").not("tags", "is", null)
      .order("id", { ascending: true }).range(offset, offset + limit - 1);
    if (error) return json({ error: error.message }, 502);
    const batch = rows ?? [];
    if (!batch.length) return json({ processed: 0, changed: [], nextOffset: offset, done: true });

    const payload = batch.map((n) => ({ id: n.id, label: n.label, does: String(n.does || "").slice(0, 200), d: (n.tags && (n.tags as { d?: unknown }).d) || [] }));
    const system = `You refine the technology-domain tags of defence/dual-use organisations in a curated map. For EACH organisation, using its name, one-line description and current tags, return the best 1-4 domain tags from the fixed vocabulary.

Rules:
- PRESERVE existing tags that still fit; ADD finer or missing ones.
- SPLIT any legacy "human" tag into "medical" (casualty care, med-devices, biotech, health) and/or "humanperf" (performance, augmentation, cognitive, human factors); never output "human".
- Use ONLY keys from the vocabulary. If genuinely cross-cutting with no single domain, use ["xcut"].
- Infer only from the name/description — never invent facts. Return exactly one entry per input id.

Vocabulary (key = meaning):
${VOCAB}

Return ONLY minified JSON: {"tags":[{"id":"<id>","d":["key","key"]}]}`;
    const msg = await client.messages.create({
      model: "claude-opus-5", max_tokens: 4096, output_config: { effort: "low" },
      system, messages: [{ role: "user", content: `Organisations (JSON):\n${JSON.stringify(payload)}` }],
    });
    const parsed = parseJson(textOf(msg)) as { tags?: Array<{ id?: string; d?: unknown }> };
    const byId = new Map((parsed.tags ?? []).map((x) => [String(x.id), cleanD(x.d)]));

    const changed: Array<{ id: string; label: string; old: string[]; new: string[] }> = [];
    for (const n of batch) {
      const oldD = cleanD((n.tags as { d?: unknown }).d);
      let newD = byId.get(n.id) ?? oldD;
      if (!newD.length) newD = oldD.length ? oldD : ["xcut"];
      if (sameSet(oldD, newD)) continue;
      changed.push({ id: n.id, label: n.label as string, old: oldD, new: newD });
      if (!dryRun) {
        const newTags = { ...(n.tags as Record<string, unknown>), d: newD };
        await sb.from("retag_backup").upsert({ id: n.id, old_tags: n.tags, new_tags: newTags, changed_at: new Date().toISOString() }, { onConflict: "id" });
        const { error: ue } = await sb.from("nodes").update({ tags: newTags }).eq("id", n.id);
        if (ue) { changed[changed.length - 1] = { ...changed[changed.length - 1], new: oldD }; }
      }
    }
    return json({ processed: batch.length, changed, nextOffset: offset + batch.length, done: batch.length < limit });
  } catch (e) {
    if (e instanceof Anthropic.APIError) return json({ error: `Anthropic ${e.status}: ${e.message}` }, 502);
    return json({ error: String(e) }, 500);
  }
});
