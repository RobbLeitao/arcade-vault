"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import {
  createAsteroids,
  type AsteroidsCallbacks,
  type AsteroidsEngine,
} from "@/lib/games/asteroids/engine";
import { H, W } from "@/lib/games/asteroids/entities";

export type AsteroidsHandle = Pick<
  AsteroidsEngine,
  "pause" | "resume" | "restart" | "end"
>;

interface AsteroidsCanvasProps extends AsteroidsCallbacks {
  ref?: Ref<AsteroidsHandle>;
}

export default function AsteroidsCanvas({
  ref,
  onScore,
  onLives,
  onLevel,
  onPowerUp,
  onGameOver,
}: AsteroidsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);
  const callbacksRef = useRef<AsteroidsCallbacks>({
    onScore,
    onLives,
    onLevel,
    onPowerUp,
    onGameOver,
  });

  // Declarado antes que el efecto del motor: el motor emite al crearse y
  // debe encontrar ya los callbacks vigentes.
  useEffect(() => {
    callbacksRef.current = { onScore, onLives, onLevel, onPowerUp, onGameOver };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createAsteroids(canvas, {
      onScore: (v) => callbacksRef.current.onScore(v),
      onLives: (v) => callbacksRef.current.onLives(v),
      onLevel: (v) => callbacksRef.current.onLevel(v),
      onPowerUp: (v) => callbacksRef.current.onPowerUp(v),
      onGameOver: (v) => callbacksRef.current.onGameOver(v),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    pause: () => engineRef.current?.pause(),
    resume: () => engineRef.current?.resume(),
    restart: () => engineRef.current?.restart(),
    end: () => engineRef.current?.end(),
  }));

  return (
    <canvas
      ref={canvasRef}
      className="asteroids-canvas"
      width={W}
      height={H}
      aria-label="Juego ROCAS"
    />
  );
}
