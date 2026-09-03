# Stage 2 "Mode B" — Edge Functions

One-click AI draft & insert for `admin-drafter.html`. Mode A (copy-paste a prompt
into Claude, then run the SQL by hand) needs none of this and keeps working.

| Function | In → Out | Holds |
|---|---|---|
| `draft-node` | `{name,url,nation,notes}` → `{does,type,domains,trl,nation}` | `ANTHROPIC_API_KEY` |
| `insert-node` | `{id,label,parent,kind,does,entry,tags}` → `{ok:true}` | Supabase **service-role** key |

Both are gated by a shared secret (`x-drafter-secret`) because they deploy with
`--no-verify-jwt`. The service-role and Anthropic keys live only as function
secrets — never in the browser.

## Deploy

```bash
# 1. Link the project (once)
supabase login
supabase link --project-ref igvxlmbndpuegibykygq

# 2. Set the secrets (server-side only)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set DRAFTER_SHARED_SECRET=$(openssl rand -hex 24)
#   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

# 3. Deploy (no JWT — the shared secret is the gate)
supabase functions deploy draft-node  --no-verify-jwt
supabase functions deploy insert-node --no-verify-jwt
```

## Wire up the drafter

Open `admin-drafter.html` → **Config** and set:

- **Edge Function URL** → `https://igvxlmbndpuegibykygq.functions.supabase.co/draft-node`
- **Edge Function shared secret** → the same value you set for `DRAFTER_SHARED_SECRET`

Both are stored only in your browser's `localStorage` (`de_ef`, `de_secret`) —
they are **never** committed to the repo. The "⚡ Draft via Edge Function" and
one-click insert buttons appear once the URL is set.

## Test end-to-end

1. Draft a known org → review the fields → **Insert**.
2. Run the **Sync data.json from Supabase** Action.
3. Hard-refresh the live site and confirm the node is there.

## Notes

- `draft-node` uses `claude-opus-5`. Change the model in `draft-node/index.ts`
  if you want a cheaper/faster tier (that's your call, not a default).
- The SDK imports are unpinned (`npm:@anthropic-ai/sdk`, `npm:@supabase/supabase-js@2`).
  Pin `@anthropic-ai/sdk` to an exact version once you confirm one deploys cleanly.
- Keep `TYPE_KEYS` / `KNOWN_DOMAINS` in `draft-node/index.ts` in sync with
  `drafter-engine.mjs` if the taxonomy ever changes.
