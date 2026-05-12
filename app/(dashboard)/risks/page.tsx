import { supabaseServer } from "@/lib/supabase";
import { RiskRegister } from "@/components/RiskRegister";

export const dynamic = "force-dynamic";

export default async function RisksPage() {
  const sb = supabaseServer();
  const { data: risks } = await sb
    .from("risks")
    .select("id, project_id, title, description, score, severity, status, shap_features, flagged_at, projects(name, code)")
    .order("score", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Risk register</h1>
        <p className="text-sm text-slate-400">
          Sorted by model score. Each row carries the top-3 SHAP features that drove the alert.
        </p>
      </div>
      <RiskRegister risks={risks ?? []} />
    </div>
  );
}
