import { supabaseServer } from "@/lib/supabase";
import { KanbanBoard } from "@/components/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
  const sb = supabaseServer();
  const { data: projects } = await sb
    .from("projects")
    .select("id, name, code, owner, status, rag, budget_usd, spent_usd, target_date");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Governance board</h1>
        <p className="text-sm text-slate-400">
          Live status — updates without refresh as the risk engine flags new items.
        </p>
      </div>
      <KanbanBoard initial={projects ?? []} />
    </div>
  );
}
