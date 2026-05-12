import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser client — used in client components for realtime subscriptions. */
export const supabaseBrowser = () => createBrowserClient(url, anon);

/** Server client — reads Clerk JWT from cookies, RLS scopes by org_id claim. */
export const supabaseServer = () => {
  const store = cookies();
  return createServerClient(url, anon, {
    cookies: {
      get: (key) => store.get(key)?.value,
      set: (key, value, opts) => store.set({ name: key, value, ...opts }),
      remove: (key, opts) => store.set({ name: key, value: "", ...opts }),
    },
  });
};

/** Service-role client — bypasses RLS. Server-only, use sparingly (cron jobs, webhooks). */
export const supabaseAdmin = () =>
  createServerClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: { get: () => undefined, set: () => {}, remove: () => {} },
  });

export type Project = {
  id: string;
  org_id: string;
  name: string;
  code: string;
  owner: string | null;
  status: "on_track" | "at_risk" | "critical";
  rag: "green" | "amber" | "red";
  budget_usd: number;
  spent_usd: number;
  start_date: string | null;
  target_date: string | null;
  sentiment: number | null;
};

export type Risk = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  score: number;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "mitigating" | "closed";
  shap_features: { feature: string; contribution: number }[] | null;
  flagged_at: string;
};
