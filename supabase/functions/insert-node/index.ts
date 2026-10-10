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
import { isSynthetic, safeParent } from "../_shared/parent.ts";

type NodeIn = {
  id?: string; label?: string; parent?: string; kind?: string;
  does?: string; entry?: string; tags?: unknown; status?: string;
  // Provenance (v4.12.0) — all optional; the caller may override the defaults.
  origin?: string; evidence_status?: string; last_verified_at?: string;
  verified_by?: string; evidence_note?: string;
};

// A tags object is only valid if it's a plain object with a `d` array. Anything
// else (an empty {} from a repair on a previously-tagless node, a string, etc.)
// is stored as null — a malformed tags object fails the data validator.
function normTags(t: unknown): unknown {
  if (t && typeof t === "object" && !Array.isArray(t) && Array.isArray((t as { d?: unknown }).d)) return t;
  return null;
}

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

  // Guard the parent: never store a synthetic (nat_*/tech_*) or non-existent parent
  // — it orphans the node and fails the data validator (breaking the nightly sync).
  // A branch node may legitimately sit under another branch or 'root'; an org must
  // land under a real container. Remap from tags.g when possible, else reject.
  const { data: branchRows } = await supabase.from("nodes").select("id").eq("kind", "branch");
  const validParents = new Set<string>((branchRows ?? []).map((b) => b.id as string));
  validParents.add("root");
  let parent = String(node.parent);
  if (isSynthetic(parent) || !validParents.has(parent)) {
    const remapped = safeParent(parent, node.tags, validParents);
    if (!remapped) {
      return json({ error: `parent '${node.parent}' is not a real container (synthetic or unknown) and could not be remapped from tags.g — set a valid parent`, code: "bad_parent" }, 400);
    }
    parent = remapped;
  }

  const row = {
    id: node.id,
    label: node.label,
    parent,
    kind: node.kind || "org",
    does: node.does || "",
    entry: node.entry || "",
    tags: normTags(node.tags),
    // "pending" stages a node for review (invisible on the live map, which only
    // shows published_nodes); anything else publishes immediately.
    status: node.status === "pending" ? "pending" : "published",
  };

  // Provenance (v4.12.0). A staged (pending) node is an AI/web draft unless the
  // caller says otherwise; a direct insert is a maintainer action. The caller may
  // override any field (e.g. mark verified with a date on review).
  const prov: Record<string, unknown> = {
    origin: (typeof node.origin === "string" && node.origin) ? node.origin
      : (row.status === "pending" ? "ai_drafted" : "manual"),
  };
  if (typeof node.evidence_status === "string" && node.evidence_status) prov.evidence_status = node.evidence_status;
  else if (row.status === "pending") prov.evidence_status = "ai_drafted";
  if (typeof node.last_verified_at === "string" && node.last_verified_at) prov.last_verified_at = node.last_verified_at;
  if (typeof node.verified_by === "string" && node.verified_by) prov.verified_by = node.verified_by;
  if (typeof node.evidence_note === "string" && node.evidence_note) prov.evidence_note = node.evidence_note;

  // Try with provenance; if those columns aren't present yet (migration not run),
  // fall back to the base row so the insert path keeps working either way.
  let { error } = await supabase.from("nodes").upsert({ ...row, ...prov }, { onConflict: "id" });
  if (error && /(origin|evidence_status|last_verified_at|verified_by|evidence_note)/i.test(error.message)
            && /(column|schema cache|does not exist)/i.test(error.message)) {
    ({ error } = await supabase.from("nodes").upsert(row, { onConflict: "id" }));
  }
  if (error) return json({ error: error.message }, 502);
  return json({ ok: true });
});
