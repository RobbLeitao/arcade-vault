"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

export interface SessionUser {
  name: string;
}

export interface ScoreEntry {
  game: string;
  score: number;
  name: string;
  at: number;
}

interface SessionContextValue {
  user: SessionUser | null;
  signOut: () => Promise<void>;
  saveScore: (entry: Omit<ScoreEntry, "at">) => void;
}

const LEGACY_USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // Servidor y primer render: invitado. El usuario real se carga en el efecto.
  const [user, setUser] = useState<SessionUser | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;

    // Sesión simulada de antes de Supabase: ya no se usa.
    try {
      localStorage.removeItem(LEGACY_USER_KEY);
    } catch {}

    const load = async (userId: string | null) => {
      if (!userId) {
        if (active) setUser(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .maybeSingle();
      if (active) setUser(data ? { name: data.username } : null);
    };

    supabase.auth.getUser().then(({ data }) => load(data.user?.id ?? null));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Diferido: dentro de este callback no se debe llamar a Supabase.
      setTimeout(() => load(session?.user.id ?? null), 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  const saveScore = useCallback((entry: Omit<ScoreEntry, "at">) => {
    try {
      const all: ScoreEntry[] = JSON.parse(
        localStorage.getItem(SCORES_KEY) || "[]",
      );
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem(SCORES_KEY, JSON.stringify(all));
    } catch {}
  }, []);

  const value = useMemo(
    () => ({ user, signOut, saveScore }),
    [user, signOut, saveScore],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx)
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
