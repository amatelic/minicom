import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_REALTIME_VSN = "1.0.0" as const;
const SUPPORTED_REALTIME_VSN = new Set(["1.0.0", "2.0.0"] as const);

// Had issues with the realtimeVsn resolution so went with version 1.0.0
const resolveRealtimeVsn = (rawVsn: string | undefined): "1.0.0" | "2.0.0" => {
  if (rawVsn && SUPPORTED_REALTIME_VSN.has(rawVsn as "1.0.0" | "2.0.0")) {
    return rawVsn as "1.0.0" | "2.0.0";
  }

  return DEFAULT_REALTIME_VSN;
};

export const createSupabaseBrowserClient = (): SupabaseClient => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const realtimeVsn = resolveRealtimeVsn(process.env.NEXT_PUBLIC_SUPABASE_REALTIME_VSN?.trim());

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createClient(url, anonKey, {
    realtime: {
      vsn: realtimeVsn,
      // For now we are restricting the number of events per second to 20
      // can be changed depending on the use case
      params: {
        eventsPerSecond: 20,
      },
    },
  });
};
