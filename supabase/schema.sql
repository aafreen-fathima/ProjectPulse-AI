-- ProjectPulse AI — Supabase schema
-- Run with: psql "$SUPABASE_DB_URL" -f supabase/schema.sql
--
-- All tables are scoped by org_id (sourced from Clerk). RLS enforces that
-- a user can only see rows where org_id matches their active Clerk org.

create extension if not exists "pgcrypto";

------------------------------------------------------------------
-- ORGS + USERS (mirrored from Clerk via webhook)
------------------------------------------------------------------
create table if not exists orgs (
    id            text primary key,                -- Clerk org id
    name          text not null,
    plan          text not null default 'starter', -- starter | growth | enterprise
    created_at    timestamptz not null default now()
);

create table if not exists users (
    id            text primary key,                -- Clerk user id
    org_id        text not null references orgs(id) on delete cascade,
    email         text not null,
    role          text not null default 'analyst', -- pmo_lead | analyst | exec
    plan          text not null default 'starter',
    created_at    timestamptz not null default now()
);
create index if not exists users_org_idx on users(org_id);

------------------------------------------------------------------
-- PROJECTS
------------------------------------------------------------------
create table if not exists projects (
    id            uuid primary key default gen_random_uuid(),
    org_id        text not null references orgs(id) on delete cascade,
    name          text not null,
    code          text not null,                   -- e.g. "DELTA-01"
    owner         text,
    status        text not null default 'on_track',-- on_track | at_risk | critical
    rag           text not null default 'green',   -- green | amber | red
    budget_usd    numeric(14,2) default 0,
    spent_usd     numeric(14,2) default 0,
    start_date    date,
    target_date   date,
    sentiment     numeric(4,3),                    -- -1..1 from Slack/notes
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index if not exists projects_org_idx on projects(org_id);
create index if not exists projects_status_idx on projects(org_id, status);

------------------------------------------------------------------
-- MILESTONES
------------------------------------------------------------------
create table if not exists milestones (
    id            uuid primary key default gen_random_uuid(),
    org_id        text not null references orgs(id) on delete cascade,
    project_id    uuid not null references projects(id) on delete cascade,
    title         text not null,
    planned_date  date not null,
    actual_date   date,
    status        text not null default 'planned', -- planned | in_progress | done | slipped
    velocity      numeric(6,2),                    -- story points / week
    created_at    timestamptz not null default now()
);
create index if not exists milestones_project_idx on milestones(project_id);

------------------------------------------------------------------
-- RISKS
------------------------------------------------------------------
create table if not exists risks (
    id              uuid primary key default gen_random_uuid(),
    org_id          text not null references orgs(id) on delete cascade,
    project_id      uuid not null references projects(id) on delete cascade,
    title           text not null,
    description     text,
    score           numeric(4,3) not null,         -- 0..1 from XGBoost
    severity        text not null,                 -- low | medium | high | critical
    status          text not null default 'open',  -- open | mitigating | closed
    shap_features   jsonb,                         -- top contributing features
    flagged_at      timestamptz not null default now(),
    closed_at       timestamptz,
    created_at      timestamptz not null default now()
);
create index if not exists risks_project_idx on risks(project_id);
create index if not exists risks_status_idx on risks(org_id, status);
create index if not exists risks_score_idx on risks(score desc);

------------------------------------------------------------------
-- ACTIONS (continuous improvement tracker)
------------------------------------------------------------------
create table if not exists actions (
    id            uuid primary key default gen_random_uuid(),
    org_id        text not null references orgs(id) on delete cascade,
    project_id    uuid references projects(id) on delete cascade,
    risk_id       uuid references risks(id) on delete set null,
    title         text not null,
    owner         text,
    due_date      date,
    status        text not null default 'open',    -- open | in_progress | done
    created_at    timestamptz not null default now()
);
create index if not exists actions_project_idx on actions(project_id);

------------------------------------------------------------------
-- REPORTS
------------------------------------------------------------------
create table if not exists reports (
    id              uuid primary key default gen_random_uuid(),
    org_id          text not null references orgs(id) on delete cascade,
    period_start    date not null,
    period_end      date not null,
    pptx_url        text,
    pdf_url         text,
    narrative       text,                          -- Claude-authored summary
    metrics         jsonb,                         -- portfolio-level KPIs
    generated_at    timestamptz not null default now()
);
create index if not exists reports_org_idx on reports(org_id, generated_at desc);

------------------------------------------------------------------
-- MODEL FEEDBACK (PMO lead labels false positives → retraining)
------------------------------------------------------------------
create table if not exists model_feedback (
    id            uuid primary key default gen_random_uuid(),
    org_id        text not null references orgs(id) on delete cascade,
    risk_id       uuid not null references risks(id) on delete cascade,
    correct       boolean not null,
    note          text,
    created_at    timestamptz not null default now()
);

------------------------------------------------------------------
-- ROW-LEVEL SECURITY
------------------------------------------------------------------
-- The Clerk JWT is forwarded to Supabase; we read org_id from the
-- 'org_id' claim and compare to the row.

alter table orgs           enable row level security;
alter table users          enable row level security;
alter table projects       enable row level security;
alter table milestones     enable row level security;
alter table risks          enable row level security;
alter table actions        enable row level security;
alter table reports        enable row level security;
alter table model_feedback enable row level security;

create policy "org isolation" on projects
    for all using (org_id = (auth.jwt() ->> 'org_id'));
create policy "org isolation" on milestones
    for all using (org_id = (auth.jwt() ->> 'org_id'));
create policy "org isolation" on risks
    for all using (org_id = (auth.jwt() ->> 'org_id'));
create policy "org isolation" on actions
    for all using (org_id = (auth.jwt() ->> 'org_id'));
create policy "org isolation" on reports
    for all using (org_id = (auth.jwt() ->> 'org_id'));
create policy "org isolation" on model_feedback
    for all using (org_id = (auth.jwt() ->> 'org_id'));
create policy "self read" on users
    for select using (org_id = (auth.jwt() ->> 'org_id'));
create policy "org self" on orgs
    for select using (id = (auth.jwt() ->> 'org_id'));

------------------------------------------------------------------
-- REALTIME (subscribe in the Kanban + risk register UIs)
------------------------------------------------------------------
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table risks;
