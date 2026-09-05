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
    let res = await sb.from("nodes").select("id,label,parent,kind,does,entry,tags,auto_action,auto_reason").eq("status", "pending").order("id");
    if (res.error) res = await sb.from("nodes").select("id,label,parent,kind,does,entry,tags").eq("status", "pending").order("id");
    if (res.error) return json({ error: res.error.message, pending: [] }, 502);
    return json({ pending: res.data ?? [] });
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
    let res = await sb.from("edits").select("id,node_id,field,suggestion,submitted_by,status,auto_action,auto_reason").eq("status", "pending").order("id", { ascending: false }).limit(50);
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
    let res = await sb.from("claims").select("id,node_id,claimant,email,role,note,status,auto_action,auto_reason").eq("status", "pending").order("id", { ascending: false }).limit(50);
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
    let res = await sb.from("feedback").select("id,kind,org,node_id,message,submitted_by,status,created_at,auto_action,auto_reason,source_url,attachment_path,attachment_name,attachment_type").eq("status", "pending").order("id", { ascending: false }).limit(50);
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

  if (op === "feedback-attachment") {
    // Short-lived signed URL to view a feedback submission's uploaded fact sheet
    // (the bucket is private; only the service-role can mint this).
    if (!body.id) return json({ error: "id required" }, 400);
    const { data: fb } = await sb.from("feedback").select("attachment_path,attachment_name,attachment_type").eq("id", body.id).maybeSingle();
    if (!fb?.attachment_path) return json({ error: "no attachment" }, 404);
    const { data: sig, error } = await sb.storage.from("feedback-uploads").createSignedUrl(fb.attachment_path as string, 600);
    if (error || !sig) return json({ error: error?.message || "could not sign" }, 502);
    return json({ url: sig.signedUrl, name: fb.attachment_name, type: fb.attachment_type });
  }

  if (op === "webfinds-list") {
    // Captured "Beyond the map" web-search suggestions awaiting the maintainer.
    let res = await sb.from("web_finds").select("id,name,url,why,query,source,status,auto_action,auto_reason").eq("status", "pending").order("id", { ascending: false }).limit(80);
    if (res.error) res = await sb.from("web_finds").select("id,name,url,why,query,status").eq("status", "pending").limit(80);
    if (res.error) return json({ error: res.error.message, webfinds: [] }, 502);
    return json({ webfinds: res.data ?? [] });
  }

  if (op === "webfind-set") {
    if (!body.id) return json({ error: "id required" }, 400);
    const status = body.status === "dismissed" ? "dismissed" : "added";
    const { error } = await sb.from("web_finds").update({ status }).eq("id", body.id);
    if (error) return json({ error: error.message }, 502);
    return json({ ok: true });
  }

  if (op === "eventprops-list") {
    // Pending event-date change proposals from the weekly event-refresh agent.
    let res = await sb.from("event_date_proposals").select("id,node_id,current_next,current_where,proposed_next,proposed_where,source_url,confidence,note,status,created_at").eq("status", "pending").order("id", { ascending: false }).limit(50);
    if (res.error) return json({ error: res.error.message, proposals: [] });
    return json({ proposals: res.data ?? [] });
  }

  if (op === "eventprop-set") {
    // Approve (write the proposed date into reference.event_next) or dismiss.
    if (!body.id) return json({ error: "id required" }, 400);
    if (body.status === "dismissed") {
      const { error } = await sb.from("event_date_proposals").update({ status: "dismissed" }).eq("id", body.id);
      if (error) return json({ error: error.message }, 502);
      return json({ ok: true });
    }
    const { data: p, error: pe } = await sb.from("event_date_proposals").select("*").eq("id", body.id).maybeSingle();
    if (pe || !p) return json({ error: pe?.message || "proposal not found" }, 502);
    const { data: refRow } = await sb.from("reference").select("value").eq("key", "event_next").maybeSingle();
    const ev = (refRow?.value ?? {}) as Record<string, unknown>;
    ev[p.node_id] = { next: p.proposed_next || "", where: p.proposed_where || "" };
    const up = await sb.from("reference").upsert({ key: "event_next", value: ev }, { onConflict: "key" });
    if (up.error) return json({ error: up.error.message }, 502);
    const { error } = await sb.from("event_date_proposals").update({ status: "approved" }).eq("id", body.id);
    if (error) return json({ error: error.message }, 502);
    return json({ ok: true });
  }

  if (op === "auto-runs") {
    // The daily auto-maintainer's run log (latest first) for the "Last agent run" card.
    let res = await sb.from("auto_runs").select("id,ran_at,applied,held,digest").order("ran_at", { ascending: false }).limit(14);
    if (res.error) return json({ runs: [] });        // table not present yet
    return json({ runs: res.data ?? [] });
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
    const [nPub, nPend, edT, edP, clT, clP, evT, fbT, fbP, wfT, wfP] = await Promise.all([
      cnt("nodes", ["status", "published"]),
      cnt("nodes", ["status", "pending"]),
      cnt("edits"), cnt("edits", ["status", "pending"]),
      cnt("claims"), cnt("claims", ["status", "pending"]),
      cnt("events"),
      cnt("feedback"), cnt("feedback", ["status", "pending"]),
      cnt("web_finds"), cnt("web_finds", ["status", "pending"]),
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
        webfinds: { total: wfT, pending: wfP },
        events: { total: evT },
        searches: { rankTotal, webTotal, rankToday, webToday },
      },
      recentCorrections,
      recentClaims,
    });
  }

  return json({ error: "unknown op (expected list | publish | reject | stats | auto-runs | edits-list | edit-set | claims-list | claim-set | feedback-list | feedback-set | feedback-attachment | webfinds-list | webfind-set | eventprops-list | eventprop-set)" }, 400);
});
