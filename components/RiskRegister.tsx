"use client";

import { useMemo, useState } from "react";
import { Download, ArrowUpDown } from "lucide-react";

type RiskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  score: number;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "mitigating" | "closed";
  shap_features: { feature: string; contribution: number }[] | null;
  flagged_at: string;
  projects: { name: string; code: string } | null;
};

const sevTone: Record<RiskRow["severity"], string> = {
  low:      "bg-emerald-500/15 text-emerald-300",
  medium:   "bg-yellow-500/15 text-yellow-300",
  high:     "bg-orange-500/15 text-orange-300",
  critical: "bg-red-500/15 text-red-300",
};

export function RiskRegister({ risks }: { risks: RiskRow[] }) {
  const [filter, setFilter] = useState<RiskRow["status"] | "all">("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const visible = useMemo(() => {
    const filtered = filter === "all" ? risks : risks.filter((r) => r.status === filter);
    return [...filtered].sort((a, b) =>
      sortDir === "desc" ? b.score - a.score : a.score - b.score,
    );
  }, [risks, filter, sortDir]);

  const exportCsv = () => {
    const header = ["project", "title", "score", "severity", "status", "flagged_at", "top_features"];
    const rows = visible.map((r) => [
      r.projects?.code ?? "",
      r.title,
      r.score.toFixed(3),
      r.severity,
      r.status,
      r.flagged_at,
      (r.shap_features ?? []).map((f) => `${f.feature}:${f.contribution.toFixed(2)}`).join(" "),
    ]);
    const csv = [header, ...rows].map((row) => row.map(quote).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `risk-register-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-white/5 bg-[var(--panel)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/5 p-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="rounded-md border border-white/10 bg-transparent px-2 py-1 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="mitigating">Mitigating</option>
          <option value="closed">Closed</option>
        </select>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1 rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Risk</th>
            <th
              className="cursor-pointer px-4 py-3"
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            >
              <span className="inline-flex items-center gap-1">
                Score <ArrowUpDown size={12} />
              </span>
            </th>
            <th className="px-4 py-3">Severity</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Top features (SHAP)</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.id} className="border-t border-white/5 align-top">
              <td className="px-4 py-3">
                <div className="font-medium">{r.projects?.code}</div>
                <div className="text-xs text-slate-400">{r.projects?.name}</div>
              </td>
              <td className="px-4 py-3 max-w-md">
                <div className="font-medium">{r.title}</div>
                <p className="mt-1 text-xs text-slate-400">{r.description}</p>
              </td>
              <td className="px-4 py-3 font-mono">{r.score.toFixed(2)}</td>
              <td className="px-4 py-3">
                <span className={`rounded-md px-2 py-0.5 text-xs ${sevTone[r.severity]}`}>{r.severity}</span>
              </td>
              <td className="px-4 py-3 text-xs text-slate-300">{r.status}</td>
              <td className="px-4 py-3 text-xs">
                <ul className="space-y-1">
                  {(r.shap_features ?? []).slice(0, 3).map((f) => (
                    <li key={f.feature} className="flex items-center gap-2">
                      <span className="text-slate-300">{f.feature}</span>
                      <span
                        className={`font-mono ${f.contribution >= 0 ? "text-rose-300" : "text-emerald-300"}`}
                      >
                        {f.contribution >= 0 ? "+" : ""}
                        {f.contribution.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function quote(v: string) {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
