# Stage 4 — the Auto-maintainer agent

A daily agent that works your five review queues on its own: it **verifies each
item with `claude-opus-5` + web search, auto-applies the clear-cut ones, holds
the uncertain ones for you (with a recommendation), and sends you a digest** —
by GitHub issue and email. It then re-syncs `data.json` so any published change
reaches the live map.

You built all the parts (the queues, the AI draft/repair, the gated apply
functions); this is the agent that runs them.

---

## What it does each run

| Queue | Auto-applies (safe) | Holds for you |
|---|---|---|
| **Claims** | Approves when the claimant's **email domain matches the org's website** (and isn't a freemail). | Everything else — personal address, domain mismatch, no site to check. |
| **Feedback** | Resolves **non-actionable** items (praise, vague, test, spam). | Anything actionable, with a one-line summary + suggested next step. |
| **Corrections** | Applies a **web-verified, high-confidence, non-structural** fix to an existing entry (rename, URL, defunct/merged). | Structural re-parents, low-confidence, disputed, or `nat_*`/reference-layer targets. |
| **Web finds** | **Dismisses** dead/irrelevant/duplicate finds. Verifies + **drafts** promising ones into **staged** pending nodes. | Every drafted new org (staged, off the live map) — unless you turn on auto-publish. |
| **Pending nodes** | **Rejects** duplicates of existing entries. | New orgs awaiting publish (unless auto-publish is on). |

**Nothing new goes live unattended by default.** New organisations are *staged*
(invisible on the map) for your one-click **Publish**. You opt into auto-publishing
high-confidence new orgs with a single flag once you trust it (below).

Everything it holds carries a recorded **recommendation** (`auto_action` /
`auto_reason`) shown next to the Publish/Reject buttons in `admin-drafter.html`,
so approving is a glance, not a re-investigation.

---

## One-time setup

### 1. Run the migration (Supabase → SQL editor → **Run**)
`migrations/2026-09-05-auto-maintainer.sql` — adds the `auto_assessed_at /
auto_action / auto_reason` bookkeeping columns to the five queue tables and
creates the `auto_runs` log. Idempotent.

### 2. Deploy the functions
```bash
supabase functions deploy auto-maintain --no-verify-jwt
supabase functions deploy review-node   --no-verify-jwt
```
`auto-maintain` is **gated** by the same `x-drafter-secret` as your other admin
functions. `review-node` is redeployed so its review lists return the agent's
recommendation.

The function reuses the secrets you already set: **`ANTHROPIC_API_KEY`** and
**`DRAFTER_SHARED_SECRET`** (service-role + Supabase URL are injected
automatically). No new function secrets are required.

### 3. Add the GitHub repo secrets
`Settings → Secrets and variables → Actions → New repository secret`

| Secret | Required? | Value |
|---|---|---|
| `DRAFTER_SHARED_SECRET` | **Yes** | the same shared secret the functions use |
| `RESEND_API_KEY` | for email | a [Resend](https://resend.com) API key |
| `DIGEST_EMAIL_TO` | for email | where to send the digest (your email) |
| `DIGEST_EMAIL_FROM` | for email | a verified Resend sender, e.g. `agent@yourdomain` (or `onboarding@resend.dev` to test) |
| `SUPABASE_URL` | optional | only if you ever move projects (defaults to the public URL) |
| `SUPABASE_ANON_KEY` | optional | for the data.json re-sync step |
| `AUTOMAINT_URL` | optional | full function URL override |

**Email (Resend) in 3 steps:** create a free account → verify your domain (or use
`onboarding@resend.dev` as the *from* while testing) → copy an API key into
`RESEND_API_KEY`. No email secrets set = the agent still runs and opens the GitHub
issue; it just skips the email.

### 4. Test, then turn on the schedule
The workflow ships **manual-only** so it can't fail nightly before you've finished
setup. Run it once (below). When you're happy, **uncomment the `schedule:` block**
at the top of `.github/workflows/auto-maintain.yml` (daily 06:00 UTC / ~07:00 UK)
and push. On a quiet day it stays silent — no issue, no email — unless you pass
`always_report: true`.

---

## Try it now (before waiting for the cron)

**From GitHub:** Actions tab → *Auto-maintainer (daily)* → **Run workflow**
(optionally set `always_report: true` so you get an issue even if the queues are
empty).

**Locally (PowerShell)** — prints the digest, opens no issue/email unless you set
those env vars:
```powershell
$env:DRAFTER_SHARED_SECRET = "<your shared secret>"
node scripts/auto-maintain-run.mjs
```

**Check the policy the function will use:**
```bash
curl -s -X POST https://<proj>.functions.supabase.co/auto-maintain \
  -H "content-type: application/json" -H "x-drafter-secret: <secret>" \
  -d '{"op":"config"}'
```

---

## Tuning the policy (Supabase → function **secrets**)

All optional — the defaults are deliberately conservative. Set on the
`auto-maintain` function (`supabase secrets set KEY=value`), then redeploy.

| Secret | Default | Effect |
|---|---|---|
| `AUTOPUB_NEW_ORGS` | `false` | **`true` lets the agent auto-publish high-confidence new orgs** (verified real, official URL resolves, defence-relevant, clean tags). Leave off until you trust the staged results. |
| `AUTOPUB_MIN_CONFIDENCE` | `0.85` | confidence bar for auto-publishing a new org |
| `AUTOAPPLY_CORRECTIONS` | `true` | auto-apply web-verified corrections to existing entries |
| `AUTOAPPLY_MIN_CONFIDENCE` | `0.8` | confidence bar for auto-applying a correction |
| `AUTORESOLVE_FEEDBACK` | `true` | auto-resolve non-actionable feedback |
| `AUTOAPPROVE_CLAIMS` | `true` | auto-approve domain-matched claims |
| `AUTOMAINT_MAX_PER_RUN` | `2` | web-search items per function call (kept low for the wall-clock budget; the workflow loops until drained) |

**Recommended rollout:** run it for a week with `AUTOPUB_NEW_ORGS=false`, read the
daily digests, confirm the staged drafts and recommendations are sound, then flip
`AUTOPUB_NEW_ORGS=true` if you want new orgs to go live automatically.

---

## Where the results show up

- **GitHub issue** — a dated digest: what was applied, what's held, what's still pending.
- **Email** — the same digest (if Resend is configured).
- **`admin-drafter.html`** — held items show the agent's 🤖 recommendation next to your buttons; a *Last agent run* card shows the latest digest (`review-node` `op:"auto-runs"`).
- **`auto_runs` table** — the full run log.

## Safety & reversibility

- The public path still writes nothing; the agent runs **server-side** behind the
  shared secret. The Anthropic and service-role keys never touch GitHub.
- New orgs are **staged, not published**, by default — reversible with one click.
- Auto-applied corrections modify existing entries and are captured in git via the
  `data.json` sync commit, so any change is diffable and revertible.
- `reject` only ever deletes a **pending** (never-live) node; `dismiss` keeps the
  row (status flips), so claims/feedback/web-finds are recoverable.

---

## Also: the event date-refresh agent (events Phase 2)

A **weekly** sibling agent that keeps trade-fair dates current. It web-checks each
anchor fair's next edition and, when the official source differs from what's stored,
files a **proposed change** you approve in the console — it never edits dates itself.

**Setup (reuses everything above — same shared secret, same optional email):**
1. Run `migrations/2026-09-05-events-rework.sql` (Phase 1) **and**
   `migrations/2026-09-05-event-proposals.sql` (the proposals table) in Supabase.
2. Deploy the function: `supabase functions deploy event-refresh --no-verify-jwt`
   (and re-deploy `review-node` for the `eventprops-*` ops).
3. It uses the **same GitHub secrets** already set (`DRAFTER_SHARED_SECRET`, and the
   `RESEND_*` trio for email) — nothing new to add.
4. Test: Actions → **Event date refresh (weekly)** → **Run workflow**. Then enable the
   weekly schedule by uncommenting the `schedule:` block in
   `.github/workflows/event-refresh.yml`.

**Review:** `admin-drafter.html → Event dates — proposed` — **Approve** writes the new
date into `reference.event_next` (run the sync after); **Dismiss** drops it.

**Let it apply dates on its own (optional):** set `EVENTREFRESH_AUTOAPPLY=true` and the
agent writes **high-confidence** date changes straight into `reference.event_next` (still
logged to `event_date_proposals` as `auto_applied` for the audit trail, and reported in the
weekly issue/email); anything below the bar is still filed for review. Reversible any time
with `EVENTREFRESH_AUTOAPPLY=false`. Tunables (function secrets):
`EVENTREFRESH_AUTOAPPLY` (default off), `EVENTREFRESH_APPLY_CONFIDENCE` (default 0.8),
`EVENTREFRESH_MAX_PER_RUN` (default 2), `EVENTREFRESH_MIN_CONFIDENCE` (default 0.6).
