"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser, type Project } from "@/lib/supabase";

const COLUMNS: { key: Project["status"]; title: string; tone: string }[] = [
  { key: "on_track", title: "On Track", tone: "border-rag-green/40" },
  { key: "at_risk",  title: "At Risk",  tone: "border-rag-amber/40" },
  { key: "critical", title: "Critical", tone: "border-rag-red/40" },
];

export function KanbanBoard({ initial }: { initial: Project[] }) {
  const [projects, setProjects] = useState(initial);

  useEffect(() => {
    const sb = supabaseBrowser();
    const channel = sb
      .channel("projects-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        (payload) => {
          setProjects((cur) => {
            if (payload.eventType === "INSERT") return [...cur, payload.new as Project];
            if (payload.eventType === "DELETE")
              return cur.filter((p) => p.id !== (payload.old as Project).id);
            return cur.map((p) =>
              p.id === (payload.new as Project).id ? (payload.new as Project) : p,
            );
          });
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const cards = projects.filter((p) => p.status === col.key);
        return (
          <div
            key={col.key}
            className={`rounded-xl border ${col.tone} bg-[var(--panel)]/40 p-4`}
          >
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-wider text-slate-300">{col.title}</h3>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">{cards.length}</span>
            </header>
            <div className="space-y-3">
              {cards.map((p) => (
                <article key={p.id} className="rounded-lg border border-white/5 bg-[var(--panel)] p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">{p.code}</span>
                    {p.target_date && (
                      <span className="text-[10px] text-slate-500">
                        Δ {new Date(p.target_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-medium">{p.name}</h4>
                  <p className="mt-0.5 text-xs text-slate-400">Owner: {p.owner ?? "—"}</p>
                </article>
              ))}
              {cards.length === 0 && (
                <p className="rounded-md border border-dashed border-white/10 p-3 text-center text-xs text-slate-500">
                  Nothing here.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
