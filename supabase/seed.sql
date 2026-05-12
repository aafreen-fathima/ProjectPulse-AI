-- ProjectPulse AI — seed data
-- 1 demo org, 3 dummy projects (Delta / Alpha / Omega) with milestones + risks.

insert into orgs (id, name, plan) values
    ('org_demo', 'Acme PMO', 'growth')
on conflict (id) do nothing;

insert into users (id, org_id, email, role, plan) values
    ('user_lead',    'org_demo', 'lead@acme.test',    'pmo_lead', 'growth'),
    ('user_analyst', 'org_demo', 'analyst@acme.test', 'analyst',  'growth'),
    ('user_exec',    'org_demo', 'exec@acme.test',    'exec',     'growth')
on conflict (id) do nothing;

------------------------------------------------------------------
-- Project Delta — at risk, schedule slippage
------------------------------------------------------------------
with p as (
    insert into projects (org_id, name, code, owner, status, rag, budget_usd, spent_usd, start_date, target_date, sentiment)
    values ('org_demo', 'Project Delta', 'DELTA-01', 'Priya N.', 'at_risk', 'amber', 480000, 312000, '2026-01-12', '2026-07-30', 0.21)
    returning id
)
insert into milestones (org_id, project_id, title, planned_date, actual_date, status, velocity)
select 'org_demo', p.id, t.title, t.planned, t.actual, t.status, t.velocity from p,
    (values
        ('Architecture sign-off',  date '2026-02-01', date '2026-02-04', 'done',        18.0),
        ('Phase 1 build complete', date '2026-03-15', date '2026-04-02', 'slipped',     14.5),
        ('Integration testing',    date '2026-05-01', null,              'in_progress', 11.0),
        ('UAT',                    date '2026-06-15', null,              'planned',     null),
        ('Go-live',                date '2026-07-30', null,              'planned',     null)
    ) as t(title, planned, actual, status, velocity);

insert into risks (org_id, project_id, title, description, score, severity, status, shap_features)
select 'org_demo', p.id, t.title, t.descr, t.score, t.sev, t.status, t.shap::jsonb
from (select id from projects where code = 'DELTA-01') p,
    (values
        ('Velocity declining 3 sprints in a row', 'Team velocity dropped from 18 → 11 SP/wk; trending toward target miss.', 0.82, 'high',     'open',
         '[{"feature":"velocity_trend","contribution":0.41},{"feature":"task_age","contribution":0.22},{"feature":"sentiment_score","contribution":-0.14}]'),
        ('Upstream API dependency unresolved',    'Vendor SLA still TBD; blocks integration testing milestone.',          0.71, 'high',     'mitigating',
         '[{"feature":"dependency_depth","contribution":0.38},{"feature":"days_to_milestone","contribution":0.19}]')
    ) as t(title, descr, score, sev, status, shap);

------------------------------------------------------------------
-- Project Alpha — on track
------------------------------------------------------------------
with p as (
    insert into projects (org_id, name, code, owner, status, rag, budget_usd, spent_usd, start_date, target_date, sentiment)
    values ('org_demo', 'Project Alpha', 'ALPHA-02', 'Daniel K.', 'on_track', 'green', 220000, 95000, '2026-02-01', '2026-09-15', 0.62)
    returning id
)
insert into milestones (org_id, project_id, title, planned_date, actual_date, status, velocity)
select 'org_demo', p.id, t.title, t.planned, t.actual, t.status, t.velocity from p,
    (values
        ('Discovery complete',  date '2026-02-20', date '2026-02-19', 'done',        22.0),
        ('MVP shipped',         date '2026-04-30', date '2026-04-28', 'done',        24.0),
        ('Beta cohort onboarded', date '2026-06-10', null,            'in_progress', 21.5)
    ) as t(title, planned, actual, status, velocity);

insert into risks (org_id, project_id, title, description, score, severity, status, shap_features)
select 'org_demo', p.id, 'Vendor renewal pending', 'SaaS vendor contract expires 2026-08; renewal not scheduled.', 0.34, 'low', 'open',
       '[{"feature":"days_to_milestone","contribution":0.18},{"feature":"dependency_depth","contribution":0.12}]'::jsonb
from (select id from projects where code = 'ALPHA-02') p;

------------------------------------------------------------------
-- Project Omega — critical, budget blowout
------------------------------------------------------------------
with p as (
    insert into projects (org_id, name, code, owner, status, rag, budget_usd, spent_usd, start_date, target_date, sentiment)
    values ('org_demo', 'Project Omega', 'OMEGA-03', 'Sara L.', 'critical', 'red', 750000, 712000, '2025-09-01', '2026-06-01', -0.18)
    returning id
)
insert into milestones (org_id, project_id, title, planned_date, actual_date, status, velocity)
select 'org_demo', p.id, t.title, t.planned, t.actual, t.status, t.velocity from p,
    (values
        ('Vendor onboarding',     date '2025-10-01', date '2025-10-30', 'done',        9.0),
        ('Data migration',        date '2026-01-15', date '2026-02-28', 'slipped',     7.5),
        ('Cutover dry-run',       date '2026-04-15', null,              'in_progress', 6.2),
        ('Production cutover',    date '2026-06-01', null,              'planned',     null)
    ) as t(title, planned, actual, status, velocity);

insert into risks (org_id, project_id, title, description, score, severity, status, shap_features)
select 'org_demo', p.id, t.title, t.descr, t.score, t.sev, t.status, t.shap::jsonb
from (select id from projects where code = 'OMEGA-03') p,
    (values
        ('Budget consumed > 95% with 30% scope remaining', 'Burn rate trending 2.1x baseline; supplementary funding decision needed.', 0.94, 'critical', 'open',
         '[{"feature":"budget_burn_rate","contribution":0.52},{"feature":"velocity_trend","contribution":0.21},{"feature":"sentiment_score","contribution":0.14}]'),
        ('Negative team sentiment in retro notes',         'Sentiment dropped to -0.18 over 4 weeks; attrition risk.',                  0.68, 'high',     'open',
         '[{"feature":"sentiment_score","contribution":0.44},{"feature":"task_age","contribution":0.18}]'),
        ('Cutover dependency on legacy system unstable',   'Legacy system uptime 91.4% in last 30d; below 99% requirement.',            0.76, 'high',     'mitigating',
         '[{"feature":"dependency_depth","contribution":0.39},{"feature":"days_to_milestone","contribution":0.27}]')
    ) as t(title, descr, score, sev, status, shap);

------------------------------------------------------------------
-- A few tracked actions
------------------------------------------------------------------
insert into actions (org_id, project_id, title, owner, due_date, status)
select 'org_demo', id, 'Schedule vendor SLA review', 'Priya N.',  date '2026-05-15', 'open' from projects where code = 'DELTA-01'
union all
select 'org_demo', id, 'Draft supplementary funding memo', 'Sara L.', date '2026-05-12', 'in_progress' from projects where code = 'OMEGA-03'
union all
select 'org_demo', id, 'Run retro on attrition risk',      'Sara L.', date '2026-05-20', 'open'        from projects where code = 'OMEGA-03';
