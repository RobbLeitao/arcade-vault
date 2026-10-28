import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Solo para rutas dinámicas y handlers (usa cookies()). En servidor se
// verifica la sesión con getUser(), nunca con getSession().
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: se ignora porque proxy.ts
            // refresca la sesión.
          }
        },
      },
    },
  );
}
