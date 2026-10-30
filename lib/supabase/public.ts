import { createClient } from "@supabase/supabase-js";

// Cliente sin sesión ni cookies, para lecturas públicas dentro de `"use cache"`.
// Solo ve lo que la RLS permite a `anon`.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
