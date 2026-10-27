"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

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
  signIn: (name: string) => void;
  signOut: () => void;
  saveScore: (entry: Omit<ScoreEntry, "at">) => void;
}

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

const SessionContext = createContext<SessionContextValue | null>(null);

// Store mínimo sobre localStorage. El snapshot es el string crudo (estable
// entre lecturas); en servidor y en la hidratación es null = invitado.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function emit() {
  listeners.forEach((l) => l());
}

function getSnapshot(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

function parseUser(raw: string | null): SessionUser | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as SessionUser).name === "string"
    ) {
      return { name: (parsed as SessionUser).name };
    }
  } catch {}
  return null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const user = useMemo(() => parseUser(raw), [raw]);

  const signIn = useCallback((name: string) => {
    const clean = name.trim().toUpperCase().slice(0, 10);
    if (!clean) return;
    try {
      localStorage.setItem(USER_KEY, JSON.stringify({ name: clean }));
    } catch {}
    emit();
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}
    emit();
  }, []);

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
    () => ({ user, signIn, signOut, saveScore }),
    [user, signIn, signOut, saveScore],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
