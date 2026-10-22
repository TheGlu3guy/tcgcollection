import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type User,
} from "@supabase/supabase-js";
import type { AppData } from "../types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

export const isCloudConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const supabase = isCloudConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export type CloudStatus =
  | "disabled"
  | "signed-out"
  | "loading"
  | "saving"
  | "synced"
  | "error";

export interface CloudCollection {
  data: Partial<AppData>;
  revision: number;
  updatedAt: string;
}

export interface CloudSyncState {
  configured: boolean;
  authReady: boolean;
  status: CloudStatus;
  email: string | null;
  lastSyncedAt: string | null;
  error: string | null;
  message: string | null;
}

export interface LiveTcgPricePoint {
  productId: number;
  printingType: string;
  marketPrice: number | null;
  listedMedianPrice: number | null;
}

export const INITIAL_CLOUD_STATE: CloudSyncState = {
  configured: isCloudConfigured,
  authReady: false,
  status: isCloudConfigured ? "loading" : "disabled",
  email: null,
  lastSyncedAt: null,
  error: null,
  message: null,
};

function requireClient() {
  if (!supabase) {
    throw new Error(
      "Cloud sync is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  return supabase;
}

export function cloudErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  return "Supabase returned an unknown error.";
}

export async function getCloudSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function subscribeToCloudSession(
  listener: (session: Session | null, event: AuthChangeEvent) => void,
): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    window.setTimeout(() => listener(session, event), 0);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInToCloud(email: string, password: string): Promise<void> {
  const { error } = await requireClient().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
}

export async function signUpForCloud(email: string, password: string): Promise<boolean> {
  const { data, error } = await requireClient().auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  });
  if (error) throw error;
  return Boolean(data.session);
}

export async function signOutOfCloud(): Promise<void> {
  const { error } = await requireClient().auth.signOut();
  if (error) throw error;
}

export async function requestCloudPasswordReset(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await requireClient().auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });
  if (error) throw error;
}

export async function updateCloudPassword(password: string): Promise<void> {
  const { error } = await requireClient().auth.updateUser({ password });
  if (error) throw error;
}

export function cloudUserEmail(user: User | null): string | null {
  return user?.email ?? null;
}

export async function loadCloudCollection(userId: string): Promise<CloudCollection | null> {
  const { data, error } = await requireClient()
    .from("tcg_collections")
    .select("data,revision,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    data: data.data as Partial<AppData>,
    revision: Number(data.revision),
    updatedAt: data.updated_at,
  };
}

export async function saveCloudCollection(
  data: AppData,
  baseRevision: number,
  clientId: string,
): Promise<{ saved: boolean; revision: number }> {
  const { data: result, error } = await requireClient().rpc("save_tcg_collection", {
    p_data: data,
    p_base_revision: baseRevision,
    p_client_id: clientId,
  });
  if (error) throw error;
  const row = Array.isArray(result) ? result[0] : result;
  if (!row) throw new Error("Supabase did not return a cloud save result.");
  return {
    saved: Boolean(row.saved),
    revision: Number(row.revision),
  };
}

export async function fetchLiveTcgplayerPrices(
  productIds: number[],
  signal?: AbortSignal,
): Promise<LiveTcgPricePoint[]> {
  if (!supabase || !SUPABASE_URL || !productIds.length) return [];
  const uniqueIds = [...new Set(productIds)].slice(0, 100);
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/card-prices`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({ productIds: uniqueIds }),
    });
    if (!response.ok) return [];
    const result = (await response.json()) as { prices?: LiveTcgPricePoint[] };
    return Array.isArray(result.prices) ? result.prices : [];
  } catch {
    return [];
  }
}
