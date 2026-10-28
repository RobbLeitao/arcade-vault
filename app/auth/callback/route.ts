import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT = "/";

// Solo rutas internas relativas: empieza por "/" pero no por "//" ni "/\"
// (que el navegador interpretaría como otro sitio).
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || /^\/[/\\]/.test(next)) {
    return DEFAULT_NEXT;
  }
  return next;
}

// Destino del OAuth (Google, GitHub) y del enlace de confirmación de correo.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/acceso?error=oauth`);
}
