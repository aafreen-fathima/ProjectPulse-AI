# ProjectPulse AI

> Autonomous PMO copilot that turns scattered project signals into governance-ready decisions before the Monday standup.

[![Live demo](https://img.shields.io/badge/demo-projectpulseai.com-7c3aed?style=flat-square)](https://demo.projectpulseai.com)
[![Case study](https://img.shields.io/badge/case_study-PDF-1e293b?style=flat-square)](https://projectpulseai.com/case-study.pdf)
[![Stack](https://img.shields.io/badge/stack-Next.js%2014%20·%20Supabase%20·%20LangGraph-0ea5e9?style=flat-square)](#tech-stack)
[![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](LICENSE)

---

## The problem

PMOs in mid-market firms run on fragmentation. Status lives in Jira, budgets in Excel, decisions in Confluence, and risks in someone's head. A program manager spends roughly **6 hours a week** stitching all of it into a slide deck nobody reads in time. By the time leadership sees a red project, it has already slipped two sprints.

The market is large and structurally underserved: enterprise PPM (Planview, Clarity) is too heavy and too expensive, project management tools (Asana, Monday) stop at the task layer, and BI tools (Tableau, Power BI) need an analyst to build every view. Nothing in the gap is opinionated about *governance*.

**Target user:** PMO lead at a 200–2,000 person firm running 10–60 concurrent projects, reporting to a CIO or COO who wants one number per project on Monday morning.

## The solution

ProjectPulse AI ingests project signals once an hour, scores risk per project with an explainable model, drafts the weekly executive narrative, and ships a branded report to stakeholders before anyone logs in. The PMO lead reviews — they don't author.

Six modules, all wired into a single LangGraph pipeline:

| Module | What it does | Lives in |
|---|---|---|
| **Kanban governance board** | Three-column live view (On Track / At Risk / Critical) with real-time risk badges | `components/KanbanBoard.tsx` |
| **Risk engine** | XGBoost classifier with SHAP explanations, scored hourly per project | `pipeline/risk_model.py` |
| **Gap analysis** | Schedule, budget, scope-creep variance computed from milestone deltas | `pipeline/gap_analysis.py` |
| **Report generation** | Claude-authored 600-word executive narrative + Plotly charts assembled into a branded `.pptx` | `pipeline/agents.py` |
| **Meeting pipeline** | Embeds meeting notes and reports into Pinecone for natural-language recall | `app/api/search/route.ts` |
| **CI tracker** | Continuous improvement log: actions assigned out of every report, tracked to closure | `app/(dashboard)/risks/page.tsx` |

## The Monday-morning user story

```
08:00  ───  Cron triggers /api/generate-report
08:01  ───  Pipeline pulls Jira, Supabase, Slack sentiment into a DataFrame
08:02  ───  XGBoost scores all 23 projects; SHAP attributes top-3 features per risk
08:03  ───  Plotly renders heatmap, burndown, budget waterfall, risk-trend
08:05  ───  Claude drafts 600-word narrative scoped to portfolio context
08:07  ───  python-pptx assembles branded deck, Resend emails to stakeholder list
08:15  ───  PMO lead reviews Kanban, approves report, replies to one risk action
```

The lead spent 15 minutes. Last quarter, that was a half-day of manual stitching.

## Architecture

```
                    ┌────────────────────────────────────────────┐
                    │              INGESTION LAYER               │
                    │  Jira  ·  Supabase  ·  Slack  ·  CSV/XLSX  │
                    └────────────────────┬───────────────────────┘
                                         │
                    ┌────────────────────▼───────────────────────┐
                    │               AI CORE (LangGraph)          │
                    │                                            │
                    │  collect ─▶ score ─▶ visualise ─▶ narrate  │
                    │     │         │          │          │      │
                    │  pandas   XGBoost+SHAP  Plotly   Claude    │
                    │                                            │
                    │              ▼ format ▶ distribute         │
                    │              python-pptx · Resend          │
                    └────────────────────┬───────────────────────┘
                                         │
                    ┌────────────────────▼───────────────────────┐
                    │            DELIVERY SURFACES               │
                    │  Next.js dashboard · Email · Slack alerts  │
                    │  Pinecone semantic search over reports     │
                    └────────────────────────────────────────────┘
```

State of record is **Supabase** (Postgres + RLS scoped by Clerk org). Hot risk scores cache in **Upstash Redis**. Embeddings live in **Pinecone**. Model runs version in **MLflow**. Everything is observable through **PostHog** (product) and **Sentry** (errors).

## Tech stack

**Frontend** — Next.js 14 (app router), TypeScript, Tailwind, Clerk for auth (org-mode), shadcn/ui primitives, Supabase realtime for the live Kanban.

**AI pipeline** — Python 3.11, LangGraph for orchestration, XGBoost + SHAP for risk, sentence-transformers for embeddings, Anthropic Claude (Sonnet 4.6) for narrative, Plotly for charts, python-pptx for decks.

**Data** — Supabase Postgres with row-level security, Upstash Redis for caches, Pinecone (1536-d, cosine) for semantic recall.

**Infra** — Vercel (frontend + API routes), Cloudflare DNS, Resend for transactional + report email, Stripe for billing, GitHub Actions for CI.

## Business model

Three tiers, plan-gated in the UI by reading `users.plan` from Supabase on each request.

| Tier | Price | Project cap | Reports | AI narrative |
|---|---|---|---|---|
| **Starter** | $299 / mo | 5 | Weekly | Templated |
| **Growth** | $899 / mo | 25 | Daily + weekly | Claude-authored |
| **Enterprise** | $3,500+ / mo | Unlimited | Real-time + custom | Claude + custom prompts, SSO, audit log |

## KPIs and targets

| Metric | Target | Why |
|---|---|---|
| Risk model F1 | **> 0.78** | Anything below this and the alerts become noise |
| Report generation time | **< 4 min** end-to-end | Fits inside the pre-standup window |
| Net Revenue Retention | **> 115%** | Validates the wedge from Starter into Growth/Enterprise |
| WAU / MAU | **> 0.55** | PMO leads should pull this open every workday |
| First-week activation | **> 65%** of signups generate a report | Time-to-value is the moat |

## Repo layout

```
projectpulse-ai/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx          # portfolio overview
│   │   ├── kanban/page.tsx   # governance board
│   │   ├── risks/page.tsx    # risk register
│   │   └── reports/page.tsx  # report viewer
│   └── api/
│       ├── generate-report/route.ts
│       ├── webhooks/stripe/route.ts
│       └── search/route.ts
├── components/
│   ├── KanbanBoard.tsx
│   ├── RiskRegister.tsx
│   └── ExecutiveDashboard.tsx
├── pipeline/                 # Python AI pipeline
│   ├── agents.py             # LangGraph graph definition
│   ├── risk_model.py         # XGBoost + SHAP
│   ├── gap_analysis.py       # pandas variance analysis
│   ├── visualiser.py         # plotly chart generation
│   └── requirements.txt
├── supabase/
│   ├── schema.sql
│   └── seed.sql
└── .env.example
```

## Getting started

```bash
# 1. Clone and install
git clone https://github.com/<you>/projectpulse-ai.git
cd projectpulse-ai
npm install

# 2. Python pipeline
cd pipeline
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cd ..

# 3. Supabase
psql "$SUPABASE_DB_URL" -f supabase/schema.sql
psql "$SUPABASE_DB_URL" -f supabase/seed.sql

# 4. Env
cp .env.example .env.local
# fill in keys, then:
npm run dev
```

## Roadmap

- [x] Phase 1 — Product case study
- [x] Phase 2 — Environment setup
- [x] Phase 3 — Database layer
- [x] Phase 4 — Next.js scaffold
- [x] Phase 5 — AI pipeline
- [x] Phase 6 — Payments + email
- [x] Phase 7 — Search + memory layer
- [ ] Phase 8 — Analytics + observability
- [ ] Phase 9 — Portfolio polish + deploy

## License

MIT — see [LICENSE](LICENSE).

---

Built by [@reen](https://linkedin.com/in/<you>). [Live demo](https://demo.projectpulseai.com) · [Case study PDF](https://projectpulseai.com/case-study.pdf)
