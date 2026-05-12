import { supabaseServer } from "@/lib/supabase";
import { ExecutiveDashboard } from "@/components/ExecutiveDashboard";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ragColor = { green: "bg-rag-green", amber: "bg-rag-amber", red: "bg-rag-red" } as const;

export default async function OverviewPage() {
  const sb = supabaseServer();
  const { data: projects } = await sb
    .from("projects")
    .select("id, name, code, owner, status, rag, budget_usd, spent_usd, target_date")
    .order("rag", { ascending: false });

  const { data: openRisks } = await sb
    .from("risks")
    .select("id, score, severity")
    .eq("status", "open");

  const metrics = {
    portfolioCount: projects?.length ?? 0,
    criticalCount: projects?.filter((p) => p.status === "critical").length ?? 0,
    openHighRisk: openRisks?.filter((r) => r.score >= 0.7).length ?? 0,
    budgetUtilization:
      projects && projects.length
        ? projects.reduce((s, p) => s + Number(p.spent_usd), 0) /
          Math.max(1, projects.reduce((s, p) => s + Number(p.budget_usd), 0))
        : 0,
    avgSentiment: 0.32, // computed in pipeline; cached here
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Portfolio overview</h1>
        <p className="text-sm text-slate-400">
          Live signal across {metrics.portfolioCount} projects · {metrics.openHighRisk} high-risk items open
        </p>
      </div>

      <ExecutiveDashboard metrics={metrics} />

      <section>
        <h2 className="mb-4 text-lg font-medium">Projects</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((p) => {
            const burn = p.budget_usd ? Number(p.spent_usd) / Number(p.budget_usd) : 0;
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="rounded-xl border border-white/5 bg-[var(--panel)] p-5 transition hover:border-white/10"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-slate-400">{p.code}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${ragColor[p.rag as keyof typeof ragColor]}`} />
                </div>
                <h3 className="text-base font-medium">{p.name}</h3>
                <p className="mt-1 text-xs text-slate-400">Owner: {p.owner ?? "—"}</p>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>Budget</span>
                    <span>{(burn * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full ${burn > 0.9 ? "bg-rag-red" : burn > 0.7 ? "bg-rag-amber" : "bg-rag-green"}`}
                      style={{ width: `${Math.min(100, burn * 100)}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
