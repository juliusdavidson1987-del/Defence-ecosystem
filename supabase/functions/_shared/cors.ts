// Shared CORS + shared-secret gate for the drafter Edge Functions.
//
// admin-drafter.html runs in the browser (GitHub Pages), so every response
// needs CORS headers and every function must answer the OPTIONS preflight.
// Both functions are gated by a shared secret (x-drafter-secret) because they
// are deployed with --no-verify-jwt (called without a Supabase user JWT), and
// insert-node holds the service-role key.

export const corsHeaders = {
  // Tighten "*" to your Pages origin (e.g. https://juliusdavidson1987-del.github.io)
  // if you prefer; "*" is fine while the shared secret is the real gate.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-drafter-secret",
};

// JSON response helper that always carries the CORS headers.
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// True only when the request carries the correct shared secret.
// Fails closed: if DRAFTER_SHARED_SECRET isn't configured, nothing is allowed.
//   supabase secrets set DRAFTER_SHARED_SECRET=<long-random-string>
export function secretOk(req: Request): boolean {
  const expected = Deno.env.get("DRAFTER_SHARED_SECRET");
  if (!expected) return false;
  return req.headers.get("x-drafter-secret") === expected;
}
