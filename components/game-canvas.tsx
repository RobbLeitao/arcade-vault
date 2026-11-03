"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { GameCallbacks, GameEngine } from "@/lib/games/contract";
import { ENGINES } from "@/lib/games/registry";
import type { SkinId } from "@/lib/games/skins";

export type GameHandle = Pick<
  GameEngine,
  "pause" | "resume" | "restart" | "end" | "goToLevel" | "setSkin"
>;

interface GameCanvasProps extends GameCallbacks {
  gameId: string;
  label: string;
  skin?: SkinId; // solo motores con `skins` en el registro; se aplica en caliente
  ref?: Ref<GameHandle>;
}

export default function GameCanvas({
  ref,
  gameId,
  label,
  skin,
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
  // Skin vigente al crear el motor (que llega tras un import asíncrono).
  const skinRef = useRef(skin);
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

  // Cambio de skin sin recrear el motor: no reinicia la partida.
  useEffect(() => {
    skinRef.current = skin;
    if (skin) engineRef.current?.setSkin?.(skin);
  }, [skin]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !entry) return;
    let cancelled = false;
    let engine: GameEngine | null = null;
    entry.load().then((create) => {
      if (cancelled) return;
      engine = create(
        canvas,
        {
          onScore: (v) => callbacksRef.current.onScore(v),
          onLives: (v) => callbacksRef.current.onLives(v),
          onLevel: (v) => callbacksRef.current.onLevel(v),
          onStats: (v) => callbacksRef.current.onStats(v),
          onGameOver: (v) => callbacksRef.current.onGameOver(v),
          onPauseKey: () => callbacksRef.current.onPauseKey?.(),
        },
        { skin: skinRef.current },
      );
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
    setSkin: (s) => engineRef.current?.setSkin?.(s),
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
