"use client";

type Metrics = {
  portfolioCount: number;
  criticalCount: number;
  openHighRisk: number;
  budgetUtilization: number;
  avgSentiment: number;
};

const tiles = (m: Metrics) => [
  { label: "Active projects",    value: m.portfolioCount.toString(),                trend: [12, 14, 17, 19, 21, 22, 23] },
  { label: "Critical",           value: m.criticalCount.toString(),                 trend: [0, 1, 1, 2, 2, 1, 1],          tone: "text-rag-red" },
  { label: "High-risk open",     value: m.openHighRisk.toString(),                  trend: [4, 5, 5, 6, 7, 7, 6],          tone: "text-rag-amber" },
  { label: "Budget utilization", value: `${(m.budgetUtilization * 100).toFixed(0)}%`, trend: [0.3, 0.4, 0.5, 0.6, 0.7, 0.75, m.budgetUtilization] },
  { label: "Avg sentiment",      value: m.avgSentiment.toFixed(2),                  trend: [0.1, 0.2, 0.25, 0.3, 0.32, 0.31, 0.32], tone: "text-emerald-400" },
];

export function ExecutiveDashboard({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      {tiles(metrics).map((t) => (
        <div key={t.label} className="rounded-xl border border-white/5 bg-[var(--panel)] p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">{t.label}</p>
          <p className={`mt-2 text-2xl font-semibold ${t.tone ?? ""}`}>{t.value}</p>
          <Sparkline data={t.trend} />
        </div>
      ))}
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 24;
  const path = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-6 w-full text-brand-500">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
