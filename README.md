# ProjectPulse-AI
# ProjectPulse AI

> AI-native PMO command centre — replaces manual status chasing with intelligent governance, real-time risk prediction, and auto-generated executive reports.

[![Next.js](https://img.shields.io/badge/Next.js_14-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Python](https://img.shields.io/badge/Python_3.11-3572A5?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Supabase](https://img.shields.io/badge/Supabase-1D9E75?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Vercel-black?style=flat-square&logo=vercel)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

---

## What it does

ProjectPulse AI is a production-grade SaaS platform that sits on top of your existing PMO tooling (JIRA, Excel, SharePoint, Teams) and turns fragmented project data into a single, intelligent governance layer.

Every Monday at 5am, a 5-agent LangGraph pipeline automatically:
1. Ingests JIRA task data, SQL budget actuals, and SharePoint documents
2. Scores every deliverable for slippage risk using a trained XGBoost model
3. Computes schedule variance, budget variance, and scope creep deltas in pandas
4. Generates publication-quality Plotly charts and a 600-word executive narrative via the Claude API
5. Delivers a branded PDF + PowerPoint deck to all stakeholders via Resend — before the first standup

**Result: 4–6 hours of manual Sunday-night work → under 15 minutes, fully automated.**

---

## Key metrics

| Metric | Target |
|---|---|
| Weekly hours saved per PMO user | 4–6 hrs |
| Report generation time (20-project portfolio) | < 4 min |
| Risk prediction F1 score | > 0.78 |
| Pipeline success rate | > 99% |
| Net revenue retention target | > 115% |

---

## Live links

- **Portfolio site:** `https://projectpulseai.com`
- **Live demo:** `https://demo.projectpulseai.com`
- **Case study PDF:** `https://projectpulseai.com/case-study.pdf`
- **Loom walkthrough:** `[3-minute demo video]`

---

## Tech stack

### Frontend
| Tool | Purpose |
|---|---|
| [Next.js 14](https://nextjs.org) (App Router) | React framework, page routing |
| [Tailwind CSS](https://tailwindcss.com) | Styling |
| [Clerk](https://clerk.com) | Auth, org management, role-based access |
| [Vercel](https://vercel.com) | Deployment, serverless API routes, cron jobs |

### AI pipeline (Python)
| Tool | Purpose |
|---|---|
| [LangGraph](https://langchain-ai.github.io/langgraph/) | Multi-agent pipeline orchestration |
| [Claude API](https://anthropic.com) (`claude-sonnet-4-6`) | Executive narrative generation |
| [XGBoost](https://xgboost.readthedocs.io) | Risk slippage prediction model |
| [SHAP](https://shap.readthedocs.io) | Model explainability (why is this project at risk?) |
| [scikit-learn](https://scikit-learn.org) | Feature engineering, model validation |
| [pandas](https://pandas.pydata.org) | Gap analysis, variance computation |
| [Plotly](https://plotly.com/python/) | Chart generation (heatmap, burn-down, waterfall) |
| [python-pptx](https://python-pptx.readthedocs.io) | PowerPoint deck assembly |
| [MLflow](https://mlflow.org) | Model versioning, experiment tracking |

### Backend & data
| Tool | Purpose |
|---|---|
| [Supabase](https://supabase.com) | PostgreSQL database, real-time subscriptions, RLS |
| [Pinecone](https://pinecone.io) | Vector database for semantic meeting/report search |
| [Upstash Redis](https://upstash.com) | Risk score caching, job queue |

### Payments & comms
| Tool | Purpose |
|---|---|
| [Stripe](https://stripe.com) | SaaS subscription billing, webhooks |
| [Resend](https://resend.com) | Transactional email — report delivery, risk alerts |

### Observability
| Tool | Purpose |
|---|---|
| [PostHog](https://posthog.com) | Product analytics — WAU, feature usage, funnels |
| [Sentry](https://sentry.io) | Error tracking — frontend + Python pipeline |

### Integrations
| Tool | Purpose |
|---|---|
| JIRA REST API | Task data ingestion, milestone tracking |
| Microsoft Graph API | Teams meeting transcripts, SharePoint documents |
| OpenAI Whisper | Meeting audio transcription |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client layer                          │
│   PMO Dashboard (Next.js)  │  Executive View  │  Portfolio   │
└──────────────┬──────────────────────┬──────────────┬─────────┘
               │                      │              │
┌──────────────▼──────────────────────▼──────────────▼─────────┐
│                      API + auth layer                         │
│   Clerk Auth  │  API Routes  │  Stripe Billing  │  Resend     │
└──────────────────────────────┬───────────────────────────────┘
                                │
┌──────────────────────────────▼───────────────────────────────┐
│                   AI pipeline  (Python / LangGraph)           │
│                                                               │
│  [collect] → [risk score] → [visualise] → [narrate] → [send]  │
│   SQL+JIRA     XGBoost+SHAP   Plotly      Claude API  Resend  │
└──────┬──────────────┬─────────────────────────────────────────┘
       │              │
┌──────▼──────┐  ┌────▼────────┐  ┌────────────┐  ┌──────────┐
│  Supabase   │  │  Pinecone   │  │  Upstash   │  │  MLflow  │
│ PostgreSQL  │  │  Vector DB  │  │   Redis    │  │ ModelReg │
│ + Real-time │  │ Sem. Search │  │   Cache    │  │          │
└─────────────┘  └─────────────┘  └────────────┘  └──────────┘
       │
┌──────▼──────────────────────────────────────────────────────┐
│                  External integrations                        │
│      JIRA REST API  │  Microsoft Graph  │  PostHog │ Sentry  │
└─────────────────────────────────────────────────────────────┘
```

### LangGraph pipeline — agent breakdown

The report generation pipeline is a stateful LangGraph graph with 5 specialist agents sharing a common state object.

```
trigger (cron: Mon 5am)
    │
    ▼
data_collector_agent
  → queries Supabase (projects, milestones, risks, budget actuals)
  → calls JIRA REST API for last week's ticket resolution data
  → merges into a unified pandas DataFrame
    │
    ▼
risk_scorer_agent
  → loads latest XGBoost model from MLflow
  → runs inference on DataFrame (50+ features)
  → computes SHAP values for top 3 risk drivers per project
  → writes enriched DataFrame + risk scores back to state
    │
    ▼
visualiser_agent
  → generates 4 Plotly charts:
      - portfolio risk heatmap (schedule vs budget variance)
      - milestone burn-down
      - budget waterfall
      - risk trend (4-week rolling)
  → saves charts as base64 PNG strings in state
    │
    ▼
narrative_agent
  → constructs structured prompt with metrics + chart descriptions
  → calls Claude API (claude-sonnet-4-6)
  → produces 600-word executive summary:
      - headline finding
      - 3 supporting data points
      - risk escalation section
      - recommended actions
  → validates output (min 400 words, must contain quantified risk)
  → retries up to 3x if validation fails
    │
    ▼
formatter_agent + distributor_agent
  → assembles branded PDF (reportlab)
  → assembles PowerPoint deck (python-pptx)
  → emails report to stakeholder list via Resend
  → updates Supabase report log + SharePoint archive
  → posts completion event to audit database
```

**Total pipeline runtime: < 4 minutes for a 20-project portfolio.**

---

## Core modules

### 1. AI Kanban governance board
Real-time portfolio view aggregating JIRA, SharePoint, and SQL into a single live dashboard. Projects are auto-rated RAG (Red/Amber/Green) using a rule-based classifier scoring schedule variance, budget burn rate, and risk score. Updates on every JIRA webhook event via Supabase real-time subscriptions — no manual refresh.

**Stack:** JIRA REST API · Supabase real-time · React · rule-based RAG classifier

### 2. Risk prediction engine
XGBoost model scores every active deliverable for slippage probability nightly. Features include: task age relative to due date, assignee workload index, dependency chain depth, sprint velocity trend (last 3 sprints), and comment sentiment score. SHAP values explain every flag in plain English. At >65% probability, a risk register entry is automatically created and routed to the project owner.

**Stack:** XGBoost · scikit-learn · SHAP · pandas · MLflow · Supabase

### 3. Automated gap analysis
Every Sunday, a Python cron job computes schedule variance (planned vs actual milestone completion), budget variance (committed vs actuals from SQL), scope creep indicators (ticket count growth vs sprint baseline), and resource utilisation gaps. Output feeds the executive report and a filterable dashboard table. Exportable to Excel via `openpyxl`.

**Stack:** pandas · SQL · PostgreSQL · openpyxl · Vercel cron

### 4. Executive report generator
The 5-agent LangGraph pipeline (detailed above) runs every Monday at 5am. Delivers a branded PDF and PowerPoint deck to stakeholders before the first standup. Report includes risk heat map, milestone burn-down, budget waterfall, risk trend, and a 600-word narrative summary with recommended actions.

**Stack:** LangGraph · Claude API · Plotly · python-pptx · Resend

### 5. Meeting-to-action pipeline
Meeting recordings (Teams/Zoom) are automatically ingested after every meeting ends. Whisper transcribes the audio. A fine-tuned BERT model extracts action items, decisions, and open questions. Each action item is parsed for owner, due date, and project reference, then written to JIRA as a new ticket. Structured summary emailed to all attendees within 10 minutes.

**Stack:** Whisper · BERT · transformers · JIRA API · Microsoft Graph API · Resend

### 6. Continuous improvement tracker
Every corrective action suggested by the system is logged with a timestamp and outcome field. When a risk resolves, analysts label whether the prediction was accurate — creating a training dataset for quarterly model retraining via MLflow. All past decisions are stored as vector embeddings in Pinecone, enabling semantic search ("What did we decide about the Q4 launch?") answered by Claude.

**Stack:** Pinecone · sentence-transformers · MLflow · Claude API · PostgreSQL

---

## Project structure

```
projectpulse-ai/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx                 # portfolio overview — RAG status grid
│   │   ├── kanban/
│   │   │   └── page.tsx             # live Kanban governance board
│   │   ├── projects/
│   │   │   └── [id]/page.tsx        # project detail — milestones, risks, AI recs
│   │   ├── risks/
│   │   │   └── page.tsx             # risk register — sortable, filterable, exportable
│   │   ├── reports/
│   │   │   └── page.tsx             # report viewer + download
│   │   └── executive/
│   │       └── page.tsx             # 5-metric exec summary (read-only)
│   ├── api/
│   │   ├── generate-report/
│   │   │   └── route.ts             # POST → triggers LangGraph pipeline
│   │   ├── webhooks/
│   │   │   ├── stripe/route.ts      # Stripe payment events
│   │   │   └── jira/route.ts        # JIRA task updates → Supabase sync
│   │   └── search/
│   │       └── route.ts             # POST query → Pinecone → Claude answer
│   ├── (marketing)/
│   │   └── page.tsx                 # portfolio spotlight / landing page
│   └── layout.tsx
│
├── components/
│   ├── KanbanBoard.tsx              # real-time project grid with RAG badges
│   ├── RiskRegister.tsx             # sortable risk table with SHAP explanations
│   ├── ExecutiveDashboard.tsx       # 5 headline metrics + sparklines
│   ├── ReportViewer.tsx             # PDF embed + download button
│   ├── MilestoneTimeline.tsx        # planned vs actual Gantt-style view
│   └── SearchBar.tsx                # semantic search input → /api/search
│
├── lib/
│   ├── supabase.ts                  # Supabase client + typed helpers
│   ├── claude.ts                    # Claude API wrapper
│   └── stripe.ts                   # Stripe client + plan helpers
│
├── pipeline/                        # Python AI pipeline (runs as serverless fn)
│   ├── agents.py                    # LangGraph graph definition — all 5 agents
│   ├── risk_model.py                # XGBoost training script + inference + SHAP
│   ├── gap_analysis.py              # pandas schedule/budget variance computation
│   ├── visualiser.py                # Plotly chart generation (4 standard charts)
│   ├── formatter.py                 # PDF (reportlab) + PPTX (python-pptx) assembly
│   ├── embedder.py                  # sentence-transformers → Pinecone upsert
│   ├── requirements.txt
│   └── Dockerfile                   # optional: containerised pipeline
│
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql                     # 3 demo projects with milestones + risks
│
├── .env.example                     # all required env vars documented
├── .github/
│   └── workflows/
│       └── deploy.yml               # CI: lint → test → Vercel deploy
├── next.config.ts
├── tailwind.config.ts
└── README.md
```

---

## Database schema

```sql
-- Core tables (see supabase/migrations/001_initial_schema.sql for full schema)

projects         (id, org_id, name, owner_id, status, phase,
                  start_date, target_end_date, actual_end_date,
                  budget_planned, budget_actual, risk_score, created_at)

milestones       (id, project_id, name, planned_date, actual_date,
                  status, owner_id, dependencies jsonb)

risks            (id, project_id, description, category, impact,
                  probability, score, status, owner_id,
                  mitigation_suggestion, mitigation_action,
                  opened_at, closed_at)

actions          (id, risk_id, project_id, description, owner_id,
                  due_date, completed_at, outcome, created_at)

reports          (id, project_id, report_type, generated_at,
                  narrative_text, chart_data jsonb,
                  distributed_to text[], mlflow_run_id)

model_feedback   (id, risk_id, prediction_score, actual_outcome,
                  analyst_label, feedback_at)
```

---

## Quick start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Supabase account (free tier)
- Anthropic API key
- Clerk account
- Stripe account (test mode)

### 1. Clone and install

```bash
git clone https://github.com/your-username/projectpulse-ai
cd projectpulse-ai
cp .env.example .env.local
npm install
```

### 2. Set up environment variables

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend
RESEND_API_KEY=re_...

# Pinecone
PINECONE_API_KEY=...
PINECONE_INDEX=projectpulse-docs

# Upstash Redis
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

### 3. Set up the database

```bash
# In the Supabase SQL editor, run in order:
supabase/migrations/001_initial_schema.sql
supabase/seed.sql
```

### 4. Run the development server

```bash
npm run dev
# → http://localhost:3000
```

### 5. Set up the Python pipeline

```bash
cd pipeline
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Trigger a report manually (for testing):
python agents.py --mode manual

# Train the risk model on seed data:
python risk_model.py --train
```

### 6. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (connects to your GitHub repo automatically)
vercel --prod
```

Add all env vars in the Vercel dashboard under Project → Settings → Environment Variables. Connect your Cloudflare domain under Project → Settings → Domains.

---

## Business model

| Plan | Price | Projects | Users | Key features |
|---|---|---|---|---|
| Starter | $299/mo | 5 | 10 | JIRA + Excel, weekly reports, Kanban |
| Growth | $899/mo | 25 | 50 | All integrations, risk engine, meeting pipeline |
| Enterprise | $3,500+/mo | Unlimited | Unlimited | SSO, on-premise, custom model training, SLA |

**Target ARR at Series A:** $5–8M  
**Payback period (Enterprise, 50 users):** < 3 months  
**Value delivered per user/year:** ~$10,000 in time saved

---

## Roadmap

- [x] Kanban governance board with real-time updates
- [x] XGBoost risk prediction + SHAP explainability
- [x] 5-agent LangGraph report generation pipeline
- [x] Stripe subscription billing
- [ ] Mobile app (React Native)
- [ ] Power BI embed for enterprise dashboards
- [ ] Slack integration for risk alerts
- [ ] Multi-language report generation (FR, DE, ES)
- [ ] Custom model fine-tuning on client historical data

---

## Portfolio context

This project is part of a 4-product AI portfolio built to demonstrate end-to-end product thinking, data science, and engineering skills for a Data Analytics & Project Management internship.

The four products cover:
1. **ProjectPulse AI** — PMO intelligence & agentic reporting *(this repo)*
2. **DataNarrate** — Agentic analytics co-pilot (NL → SQL → executive brief)
3. **TeamSync AI** — Cross-functional collaboration intelligence platform
4. **SentinelIQ** — Real-time fraud intelligence & risk operations (fintech)

Every feature in this product maps directly to the internship's required competencies: LangGraph / agentic AI pipeline design, Python (pandas + scikit-learn + XGBoost), GenAI frameworks, data visualisation, executive dashboards, risk management, and PMO governance.

---

## Skills demonstrated

| Competency | Where in this project |
|---|---|
| Agentic AI pipeline design | `pipeline/agents.py` — LangGraph 5-agent graph |
| Python (pandas, scikit-learn) | `pipeline/gap_analysis.py`, `risk_model.py` |
| XGBoost + SHAP | `pipeline/risk_model.py` |
| Claude API / GenAI | `pipeline/agents.py` — narrative agent |
| Data visualisation (Plotly) | `pipeline/visualiser.py` |
| SQL + database design | `supabase/migrations/001_initial_schema.sql` |
| Kanban / project governance | `components/KanbanBoard.tsx` |
| Risk log & issue tracking | `components/RiskRegister.tsx` |
| Executive dashboards | `components/ExecutiveDashboard.tsx` |
| Gap analysis | `pipeline/gap_analysis.py` |
| SaaS business model | Stripe integration + 3-tier pricing |
| Stakeholder reporting | Automated Resend email pipeline |

---

## Author

**Aafreen Fathima**  
 
[LinkedIn](https://linkedin.com/in/your-profile) · [Portfolio](https://your-portfolio.com) · [Email](mailto:your@email.com)

---

## License

MIT — see [LICENSE](LICENSE) for details.
