// Edge Function: insert-node
// ---------------------------------------------------------------------------
// POST { id, label, parent, kind, does, entry, tags }  ->  { ok: true }
//
// Upserts one node into public.nodes using the SERVICE-ROLE key (writes),
// mirroring drafter-engine.mjs nodeToSQL(): on conflict (id) do update ...,
// status = 'published'. Gated by the shared secret.
//
// SECURITY: the service-role key can write the whole database. It lives only
// here as a function secret and is never sent to the browser. Keep the shared
// secret gate in place before exposing this function's URL.
//
// Required secrets: DRAFTER_SHARED_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected into the function
// runtime automatically by Supabase.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, secretOk } from "../_shared/cors.ts";

type NodeIn = {
  id?: string; label?: string; parent?: string; kind?: string;
  does?: string; entry?: string; tags?: unknown;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!secretOk(req)) return json({ error: "unauthorized" }, 401);

  let node: NodeIn;
  try { node = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (!node?.id || !node?.label || !node?.parent) {
    return json({ error: "id, label and parent are required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase env not configured" }, 500);

  const supabase = createClient(supabaseUrl, serviceKey);
  const row = {
    id: node.id,
    label: node.label,
    parent: node.parent,
    kind: node.kind || "org",
    does: node.does || "",
    entry: node.entry || "",
    tags: node.tags ?? null,
    status: "published",
  };

  const { error } = await supabase.from("nodes").upsert(row, { onConflict: "id" });
  if (error) return json({ error: error.message }, 502);
  return json({ ok: true });
});
