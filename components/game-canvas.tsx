"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { GameCallbacks, GameEngine } from "@/lib/games/contract";
import { ENGINES } from "@/lib/games/registry";

export type GameHandle = Pick<
  GameEngine,
  "pause" | "resume" | "restart" | "end" | "goToLevel"
>;

interface GameCanvasProps extends GameCallbacks {
  gameId: string;
  label: string;
  ref?: Ref<GameHandle>;
}

export default function GameCanvas({
  ref,
  gameId,
  label,
  onScore,
  onLives,
  onLevel,
  onStats,
  onGameOver,
  onPauseKey,
}: GameCanvasProps) {
  const entry = ENGINES[gameId];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const callbacksRef = useRef<GameCallbacks>({
    onScore,
    onLives,
    onLevel,
    onStats,
    onGameOver,
    onPauseKey,
  });

  // Declarado antes que el efecto del motor: el motor emite al crearse y
  // debe encontrar ya los callbacks vigentes.
  useEffect(() => {
    callbacksRef.current = {
      onScore,
      onLives,
      onLevel,
      onStats,
      onGameOver,
      onPauseKey,
    };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !entry) return;
    let cancelled = false;
    let engine: GameEngine | null = null;
    entry.load().then((create) => {
      if (cancelled) return;
      engine = create(canvas, {
        onScore: (v) => callbacksRef.current.onScore(v),
        onLives: (v) => callbacksRef.current.onLives(v),
        onLevel: (v) => callbacksRef.current.onLevel(v),
        onStats: (v) => callbacksRef.current.onStats(v),
        onGameOver: (v) => callbacksRef.current.onGameOver(v),
        onPauseKey: () => callbacksRef.current.onPauseKey?.(),
      });
      engineRef.current = engine;
    });
    return () => {
      cancelled = true;
      engine?.destroy();
      engineRef.current = null;
    };
  }, [entry]);

  useImperativeHandle(ref, () => ({
    pause: () => engineRef.current?.pause(),
    resume: () => engineRef.current?.resume(),
    restart: () => engineRef.current?.restart(),
    end: () => engineRef.current?.end(),
    goToLevel: (level) => engineRef.current?.goToLevel?.(level),
  }));

  if (!entry) return null;

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      width={entry.width}
      height={entry.height}
      aria-label={label}
    />
  );
}
