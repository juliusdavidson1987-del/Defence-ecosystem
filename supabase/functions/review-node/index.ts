// Edge Function: review-node  (GATED — requires x-drafter-secret)
// ---------------------------------------------------------------------------
// The maintainer's review gate for staged organisations.
//
//   POST { op:"list" }            -> { pending:[{id,label,parent,kind,does,entry,tags}] }
//   POST { op:"publish", id }     -> { ok:true }   (status pending -> published)
//   POST { op:"reject",  id }     -> { ok:true }   (deletes the pending node)
//
// "pending" nodes are invisible on the live map (published_nodes shows only
// published rows) and never reach data.json until published here. reject only
// deletes rows still in 'pending' — it can never remove a live/published node.
//
// Required secret: DRAFTER_SHARED_SECRET
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, secretOk } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!secretOk(req)) return json({ error: "unauthorized" }, 401);

  let body: { op?: string; id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const op = String(body?.op ?? "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase env not configured" }, 500);
  const sb = createClient(supabaseUrl, serviceKey);

  if (op === "list") {
    const { data, error } = await sb
      .from("nodes")
      .select("id,label,parent,kind,does,entry,tags")
      .eq("status", "pending")
      .order("id");
    if (error) return json({ error: error.message, pending: [] }, 502);
    return json({ pending: data ?? [] });
  }

  if (op === "publish") {
    if (!body.id) return json({ error: "id required" }, 400);
    const { error } = await sb.from("nodes").update({ status: "published" }).eq("id", body.id);
    if (error) return json({ error: error.message }, 502);
    return json({ ok: true });
  }

  if (op === "reject") {
    if (!body.id) return json({ error: "id required" }, 400);
    // Safety: only ever delete a node that is still pending.
    const { error } = await sb.from("nodes").delete().eq("id", body.id).eq("status", "pending");
    if (error) return json({ error: error.message }, 502);
    return json({ ok: true });
  }

  return json({ error: "unknown op (expected list | publish | reject)" }, 400);
});
