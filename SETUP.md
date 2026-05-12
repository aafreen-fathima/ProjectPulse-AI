# ProjectPulse AI — setup guide

This walks you from zero → working local dev environment, then optional deploy. Two tracks:

- **Fast path (~30 min):** frontend + Supabase + Clerk + a CLI run of the AI pipeline. Skip Stripe, Pinecone, Resend, Sentry, PostHog. You'll have a working dashboard with seeded data and can run the report pipeline by hand.
- **Full path (~3 hours):** every service wired, deployed to Vercel + Modal/Fly, custom domain.

Do the fast path first.

---

## 0. Prerequisites

```bash
node --version     # 20.x or higher
python3 --version  # 3.11 or higher
git --version
psql --version     # for running the schema; install via brew install libpq if missing
```

If `psql` isn't on your path after `brew install libpq`:

```bash
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

---

## 1. Initialize the repo

```bash
cd projectpulse-ai
git init
git add .
git commit -m "scaffold: ProjectPulse AI"
git branch -M main
# create empty repo on github.com first, then:
git remote add origin git@github.com:<you>/projectpulse-ai.git
git push -u origin main
```

---

## 2. Install dependencies

```bash
# Frontend
npm install

# Python pipeline — separate venv
cd pipeline
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..
```

You'll get warnings on `npm install` about peer deps from Clerk + Supabase. Safe to ignore.

---

## 3. Supabase

### 3a. Create the project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Name it `projectpulse-dev`. Pick a strong DB password and **save it**.
3. Region: closest to you.
4. Wait ~2 min for provisioning.

### 3b. Get credentials

In **Project Settings → API**:

- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never commit)

In **Project Settings → Database → Connection string → URI**:

- That whole string → `SUPABASE_DB_URL`

### 3c. Run the schema + seed

```bash
psql "$SUPABASE_DB_URL" -f supabase/schema.sql
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

Verify in the Supabase **Table Editor** — you should see 8 tables and rows in `orgs`, `users`, `projects` (Delta / Alpha / Omega), `milestones`, `risks`, `actions`.

### 3d. Create the reports storage bucket

In **Storage → Create bucket**:

- Name: `reports`
- Public: **off** (we'll use signed URLs)

The pipeline writes the weekly `.pptx` here.

### 3e. Configure JWT for Clerk integration

The schema's RLS policies read `org_id` from the JWT. We need Supabase to accept Clerk-signed JWTs. **Project Settings → API → JWT settings**:

- Set the JWT secret to the one Clerk will use (we'll grab this in the next step). For now, leave it default.

We'll come back to this.

---

## 4. Clerk

### 4a. Create the application

1. Go to [clerk.com](https://clerk.com) → Add application.
2. Name: `ProjectPulse`. Sign-in methods: email + Google.
3. Click into the app → **API Keys**:
   - `Publishable key` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `Secret key` → `CLERK_SECRET_KEY`

### 4b. Enable Organizations

**Configure → Organizations** → toggle **Enable organizations**. Set `Organizations are required` so every user belongs to one.

### 4c. JWT template for Supabase

**Configure → JWT Templates → New template → Supabase**.

This gives you a template that includes `org_id` in the claims. Save the **Signing key** — paste it into Supabase **Project Settings → API → JWT settings → JWT Secret**, then click Save. Now Supabase will verify Clerk-signed JWTs and your RLS policies will work.

### 4d. Create your first org and member

In Clerk → **Users**, invite yourself (use your real email so SSO works). After signing in, create an org named `Acme PMO` (matching the seed data's display, though `org_id` in seed is `org_demo` — see the note below).

> **Local dev note:** the seed file inserts `org_id = 'org_demo'`. In real Clerk, your org_id will look like `org_2abc...`. For end-to-end auth to work with seeded data, either (a) update `seed.sql` to use your actual Clerk `org_id` before running it, or (b) use the **service-role** Supabase client (which bypasses RLS) for initial dev — `lib/supabase.ts` already exports `supabaseAdmin()` for this.

---

## 5. Anthropic (Claude)

1. Go to [console.anthropic.com](https://console.anthropic.com) → API Keys → Create.
2. Name: `projectpulse-dev`.
3. Copy → `ANTHROPIC_API_KEY`.
4. Confirm `ANTHROPIC_MODEL=claude-sonnet-4-6` in your `.env.local`.

Set a spend limit: **Settings → Limits → $20/mo** is fine for dev.

---

## 6. Fill `.env.local`

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in everything you've collected so far. For the fast path, leave Stripe / Pinecone / Resend / Upstash / Sentry / PostHog blank — the code branches will fail loudly when called, which is fine while you're not using them.

For the pipeline, **also** create `pipeline/.env`:

```bash
cat > pipeline/.env <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-6
RESEND_API_KEY=
RESEND_FROM_EMAIL=reports@projectpulseai.com
EOF
```

---

## 7. Run the frontend

```bash
npm run dev
```

Open http://localhost:3000. You should hit the Clerk sign-in screen, sign in, and land on the overview page with the three seeded projects. The Kanban page should show them in their RAG columns. The risks page should show 6 risks sorted by score.

If you see "no rows," it's RLS — your Clerk `org_id` doesn't match `org_demo`. Either reseed with your real `org_id` (replace `'org_demo'` in `seed.sql`) or temporarily switch the dashboard pages to `supabaseAdmin()` to bypass RLS.

---

## 8. Run the Python pipeline (CLI)

The pipeline is a separate Python process. For local dev you run it directly:

```bash
cd pipeline
source venv/bin/activate
python -m pipeline.agents --org-id org_demo
```

What this does, end-to-end:

```
collect       → reads projects + milestones from Supabase
score         → trains a synthetic XGBoost model, scores all projects
analyse_gaps  → computes schedule + budget variance per project
visualise     → renders 3 Plotly charts as PNG bytes
narrate       → calls Claude Sonnet 4.6 for the 600-word narrative
format        → assembles a .pptx via python-pptx
distribute    → uploads to Supabase Storage, inserts a reports row, emails (if Resend set)
```

After it finishes, check:
- Supabase **Table Editor → reports** for the new row
- **Storage → reports** for the `.pptx`
- The `Reports` page in the dashboard at http://localhost:3000/reports

> ⚠️ The current `score` node trains on synthetic data each run. That's fine for the demo. To use real data, replace `synthetic_training_set()` with a query against a `risk_history` table once you have ≥6 weeks of labelled outcomes.

---

## 9. (Optional) Wire `/api/generate-report` to the pipeline

The Next.js route `app/api/generate-report/route.ts` calls `PIPELINE_URL` over HTTP. For local dev, expose the pipeline as a tiny FastAPI server:

```bash
pip install fastapi uvicorn
```

Create `pipeline/server.py`:

```python
from fastapi import FastAPI, Header, HTTPException
from .agents import run

app = FastAPI()
SECRET = "dev-secret-change-me"

@app.post("/run")
def run_pipeline(payload: dict, authorization: str = Header(None)):
    if authorization != f"Bearer {SECRET}":
        raise HTTPException(status_code=401)
    return run(payload["org_id"], payload["period_start"], payload["period_end"])
```

Run it:

```bash
uvicorn pipeline.server:app --port 8001
```

Add to `.env.local`:

```
PIPELINE_URL=http://localhost:8001
PIPELINE_SECRET=dev-secret-change-me
```

Now clicking **Generate now** in the reports page calls the pipeline.

---

## 10. (Optional, full path) The other services

When you're ready, add these one at a time. Each one slots into existing code — nothing else needs to change.

### Stripe
1. Sign up, **switch to Test mode**.
2. Create three products: Starter $299/mo, Growth $899/mo, Enterprise $3500/mo.
3. Copy each `price_xxx` → `STRIPE_PRICE_*` env vars.
4. Get Secret + publishable keys from **Developers → API keys**.
5. Create a webhook endpoint pointing to `https://<your-tunnel>.ngrok.io/api/webhooks/stripe` listening on `checkout.session.completed` and `customer.subscription.deleted`. The signing secret → `STRIPE_WEBHOOK_SECRET`.

### Resend
1. Sign up, add domain `projectpulseai.com`, add the DNS records they give you.
2. After verification, copy API key → `RESEND_API_KEY`.

### Upstash Redis
1. [console.upstash.com](https://console.upstash.com) → Create database, type Regional, region us-east-1.
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

### Pinecone
1. [pinecone.io](https://pinecone.io) → New index named `projectpulse-docs`, dimension `1536`, metric `cosine`.
2. **Rotate the key you pasted in chat earlier — assume it's compromised.**
3. New API key → `PINECONE_API_KEY`.

### PostHog + Sentry
Both have step-by-step Next.js installers. Run the wizards:
```bash
npx posthog-init
npx @sentry/wizard@latest -i nextjs
```

---

## 11. Deploy

### Frontend → Vercel
```bash
npm i -g vercel
vercel
```
Connect to the GitHub repo, paste every `.env.local` value into **Project Settings → Environment Variables**, then `vercel --prod`.

### Pipeline → Modal (recommended)
Modal handles Python with heavy ML deps (sentence-transformers + XGBoost) better than Vercel.

```bash
pip install modal
modal token new
```

Create `pipeline/modal_app.py`:

```python
import modal
from .agents import run

stub = modal.Stub("projectpulse-pipeline")
image = modal.Image.debian_slim().pip_install_from_requirements("pipeline/requirements.txt")

@stub.function(image=image, secrets=[modal.Secret.from_name("projectpulse-secrets")])
@modal.web_endpoint(method="POST")
def run_endpoint(payload: dict):
    return run(payload["org_id"], payload["period_start"], payload["period_end"])
```

```bash
modal deploy pipeline/modal_app.py
```

Modal returns a URL → set as `PIPELINE_URL` in Vercel.

### DNS
1. Buy `projectpulseai.com` on Namecheap.
2. Create Cloudflare account, add the site, copy nameservers, paste into Namecheap.
3. In Vercel: **Project → Domains → Add `projectpulseai.com` and `demo.projectpulseai.com`**. Vercel gives you a CNAME — add it in Cloudflare.

---

## 12. Smoke test

Working setup means all of these pass:

- [ ] `npm run dev` shows the dashboard with 3 projects
- [ ] Kanban page displays Delta/Alpha/Omega in their right columns
- [ ] Risks page displays 6 rows sorted by score, top one is OMEGA-03 budget blowout (0.94)
- [ ] `python -m pipeline.agents --org-id org_demo` exits with `done. distributed: True` (or `False` if Resend isn't configured — that's fine)
- [ ] A new row appears in Supabase `reports` table
- [ ] A `.pptx` file appears in Supabase Storage `reports/<org_id>/`
- [ ] (Full path) `vercel --prod` deploys, demo.projectpulseai.com loads

---

## Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Dashboard shows "0 projects" | RLS — Clerk `org_id` doesn't match `org_demo` | Reseed with your real org_id, or switch pages to `supabaseAdmin()` |
| `Cannot find module '@clerk/nextjs/server'` | Wrong Clerk version | `npm i @clerk/nextjs@latest` |
| Pipeline `OperationalError: relation "projects" does not exist` | Schema not run | `psql "$SUPABASE_DB_URL" -f supabase/schema.sql` |
| `xgboost` install fails on M-series Mac | libomp missing | `brew install libomp` |
| Plotly `kaleido` errors at chart render | Sandbox blocking | `pip install --upgrade kaleido` |
| Claude returns 401 | Wrong env var name | It's `ANTHROPIC_API_KEY`, not `CLAUDE_API_KEY` |
| Supabase RLS blocks even your own queries | JWT secret mismatch | Re-paste the Clerk JWT signing key into Supabase JWT settings |

---

## What "done" looks like for the portfolio

- [ ] Pin the GitHub repo on your profile
- [ ] Live demo at https://demo.projectpulseai.com loads, shows seeded data
- [ ] README renders the case study cleanly (it does — open it on GitHub)
- [ ] 3-min Loom: login → kanban → click a risk → reports → click Generate now → show the email
- [ ] LinkedIn post: 3 sentences + the demo link

When you're ready to record the Loom, do a fresh `seed.sql` run so the data looks crisp, and use a screen recorder that hides your environment variables.
