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

  let body: { op?: string; id?: string; status?: string };
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

  if (op === "edits-list") {
    // Pending corrections from the "Suggest a correction" form (edits table).
    let res = await sb.from("edits").select("id,node_id,field,suggestion,submitted_by,status").eq("status", "pending").order("id", { ascending: false }).limit(50);
    if (res.error) res = await sb.from("edits").select("id,node_id,field,suggestion,submitted_by,status").eq("status", "pending").limit(50);
    if (res.error) return json({ error: res.error.message, edits: [] }, 502);
    return json({ edits: res.data ?? [] });
  }

  if (op === "edit-set") {
    // Mark a correction resolved (applied) or dismissed (dropped). Keeps the row
    // for analytics history; it just leaves the "pending" bucket.
    if (!body.id) return json({ error: "id required" }, 400);
    const status = body.status === "dismissed" ? "dismissed" : "resolved";
    const { error } = await sb.from("edits").update({ status }).eq("id", body.id);
    if (error) return json({ error: error.message }, 502);
    return json({ ok: true });
  }

  if (op === "claims-list") {
    // Pending organisation claims (claims table).
    let res = await sb.from("claims").select("id,node_id,claimant,email,role,note,status").eq("status", "pending").order("id", { ascending: false }).limit(50);
    if (res.error) res = await sb.from("claims").select("id,node_id,claimant,email,role,note,status").eq("status", "pending").limit(50);
    if (res.error) return json({ error: res.error.message, claims: [] }, 502);
    return json({ claims: res.data ?? [] });
  }

  if (op === "claim-set") {
    // Approve (verified contact) or dismiss a claim. Row kept for history.
    if (!body.id) return json({ error: "id required" }, 400);
    const status = body.status === "dismissed" ? "dismissed" : "approved";
    const { error } = await sb.from("claims").update({ status }).eq("id", body.id);
    if (error) return json({ error: error.message }, 502);
    return json({ ok: true });
  }

  if (op === "feedback-list") {
    // Native feedback inbox (replaces the Google Form).
    let res = await sb.from("feedback").select("id,kind,org,node_id,message,submitted_by,status,created_at").eq("status", "pending").order("id", { ascending: false }).limit(50);
    if (res.error) res = await sb.from("feedback").select("id,kind,org,node_id,message,submitted_by,status").eq("status", "pending").limit(50);
    if (res.error) return json({ error: res.error.message, feedback: [] }, 502);
    return json({ feedback: res.data ?? [] });
  }

  if (op === "feedback-set") {
    if (!body.id) return json({ error: "id required" }, 400);
    const status = body.status === "dismissed" ? "dismissed" : "resolved";
    const { error } = await sb.from("feedback").update({ status }).eq("id", body.id);
    if (error) return json({ error: error.message }, 502);
    return json({ ok: true });
  }

  if (op === "stats") {
    // Count helper — returns null (not 0) if the table is missing/unreadable,
    // so the dashboard can show "—" for anything not yet set up.
    async function cnt(table: string, eq?: [string, string]): Promise<number | null> {
      try {
        let q = sb.from(table).select("*", { count: "exact", head: true });
        if (eq) q = q.eq(eq[0], eq[1]);
        const { count, error } = await q;
        return error ? null : (count ?? 0);
      } catch { return null; }
    }
    async function recent(table: string, cols: string): Promise<unknown[]> {
      try {
        let res = await sb.from(table).select(cols).order("created_at", { ascending: false }).limit(12);
        if (res.error) res = await sb.from(table).select(cols).limit(12);
        return res.data ?? [];
      } catch { return []; }
    }

    const today = new Date().toISOString().slice(0, 10);
    const [nPub, nPend, edT, edP, clT, clP, evT, fbT, fbP] = await Promise.all([
      cnt("nodes", ["status", "published"]),
      cnt("nodes", ["status", "pending"]),
      cnt("edits"), cnt("edits", ["status", "pending"]),
      cnt("claims"), cnt("claims", ["status", "pending"]),
      cnt("events"),
      cnt("feedback"), cnt("feedback", ["status", "pending"]),
    ]);

    let rankTotal = 0, webTotal = 0, rankToday = 0, webToday = 0;
    try {
      const { data: rl } = await sb.from("rate_limits").select("key,count").or("key.like.rank:global:%,key.like.web:global:%");
      (rl ?? []).forEach((r: { key: string; count: number }) => {
        if (r.key.startsWith("rank:global:")) { rankTotal += r.count; if (r.key.endsWith(today)) rankToday = r.count; }
        else if (r.key.startsWith("web:global:")) { webTotal += r.count; if (r.key.endsWith(today)) webToday = r.count; }
      });
    } catch { /* ignore */ }

    const [recentCorrections, recentClaims] = await Promise.all([
      recent("edits", "node_id,field,suggestion,submitted_by,status"),
      recent("claims", "node_id,claimant,email,role,status"),
    ]);

    return json({
      stats: {
        nodes: { published: nPub, pending: nPend },
        corrections: { total: edT, pending: edP },
        claims: { total: clT, pending: clP },
        feedback: { total: fbT, pending: fbP },
        events: { total: evT },
        searches: { rankTotal, webTotal, rankToday, webToday },
      },
      recentCorrections,
      recentClaims,
    });
  }

  return json({ error: "unknown op (expected list | publish | reject | stats | edits-list | edit-set | claims-list | claim-set | feedback-list | feedback-set)" }, 400);
});
