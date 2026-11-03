"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  REPEAT_DELAY_MS,
  REPEAT_INTERVAL_MS,
  pressKey,
  releaseKey,
  type TouchButton,
  type TouchLayout,
} from "@/lib/games/touch";

const COARSE_QUERY = "(pointer: coarse)";

function subscribeCoarse(onChange: () => void) {
  const mql = window.matchMedia(COARSE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

const getCoarse = () => window.matchMedia(COARSE_QUERY).matches;
// El servidor no conoce el puntero: sin mando en el HTML hidratado.
const getCoarseServer = () => false;

/** `true` solo en dispositivos cuyo puntero principal es táctil. */
export function useCoarsePointer() {
  return useSyncExternalStore(subscribeCoarse, getCoarse, getCoarseServer);
}

// Clase de posición en la cruceta según la tecla.
const CROSS_SLOT: Record<string, string> = {
  ArrowUp: "up",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowDown: "down",
};

interface Hold {
  code: string;
  el: HTMLButtonElement;
}

interface TouchControlsProps {
  layout: TouchLayout;
  disabled?: boolean; // partida en pausa: los botones no despachan nada
}

export default function TouchControls({
  layout,
  disabled = false,
}: TouchControlsProps) {
  const coarse = useCoarsePointer();
  // Dedo (pointerId) → botón que mantiene. Cada toque queda ligado al botón
  // donde empezó gracias a setPointerCapture.
  const holdsRef = useRef(new Map<number, Hold>());
  // Temporizadores de autorrepetición por tecla.
  const timersRef = useRef(new Map<string, number>());
  const disabledRef = useRef(disabled);

  const stopRepeat = useCallback((code: string) => {
    const t = timersRef.current.get(code);
    if (t === undefined) return;
    // El id puede ser de setTimeout o de setInterval; ambos se cancelan igual.
    window.clearTimeout(t);
    window.clearInterval(t);
    timersRef.current.delete(code);
  }, []);

  const isHeld = (code: string) => {
    for (const h of holdsRef.current.values()) if (h.code === code) return true;
    return false;
  };

  const end = useCallback(
    (pointerId: number) => {
      const hold = holdsRef.current.get(pointerId);
      if (!hold) return;
      holdsRef.current.delete(pointerId);
      // Otro dedo sobre el mismo botón lo mantiene pulsado.
      for (const h of holdsRef.current.values())
        if (h.code === hold.code) return;
      hold.el.classList.remove("pressed");
      stopRepeat(hold.code);
      releaseKey(hold.code);
    },
    [stopRepeat],
  );

  const releaseAll = useCallback(() => {
    for (const id of [...holdsRef.current.keys()]) end(id);
    for (const code of [...timersRef.current.keys()]) stopRepeat(code);
  }, [end, stopRepeat]);

  // Al pausar, al terminar o al desmontar: ninguna tecla queda enganchada.
  useEffect(() => {
    disabledRef.current = disabled;
    if (disabled) releaseAll();
  }, [disabled, releaseAll]);

  useEffect(() => releaseAll, [releaseAll]);

  if (!coarse) return null;

  const onPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    btn: TouchButton,
  ) => {
    // Sin foco ni ratón emulado: el botón no roba el Espacio ni hace clic.
    e.preventDefault();
    if (disabledRef.current || holdsRef.current.has(e.pointerId)) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const already = isHeld(btn.code);
    holdsRef.current.set(e.pointerId, { code: btn.code, el });
    if (already) return;
    el.classList.add("pressed");
    pressKey(btn.code);
    if (btn.repeat) {
      const code = btn.code;
      timersRef.current.set(
        code,
        window.setTimeout(() => {
          pressKey(code, true);
          timersRef.current.set(
            code,
            window.setInterval(() => pressKey(code, true), REPEAT_INTERVAL_MS),
          );
        }, REPEAT_DELAY_MS),
      );
    }
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) =>
    end(e.pointerId);

  const renderButton = (btn: TouchButton, cross: boolean) => (
    <button
      key={btn.code}
      type="button"
      className={
        "touch-btn" +
        (btn.label.length > 1 ? " touch-btn-word" : "") +
        (cross ? ` touch-${CROSS_SLOT[btn.code] ?? "up"}` : "")
      }
      aria-label={btn.aria}
      aria-disabled={disabled || undefined}
      onPointerDown={(e) => onPointerDown(e, btn)}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
    >
      <span aria-hidden="true">{btn.label}</span>
    </button>
  );

  const cross = layout.moveShape === "cross";

  return (
    <div
      className={
        "touch-pad" +
        (layout.actions.length === 0 ? " touch-pad-solo" : "") +
        (disabled ? " is-disabled" : "")
      }
      role="group"
      aria-label="Mando táctil"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={"touch-group touch-move" + (cross ? " touch-cross" : "")}>
        {layout.move.map((b) => renderButton(b, cross))}
      </div>
      {layout.actions.length > 0 && (
        <div className="touch-group touch-actions">
          {layout.actions.map((b) => renderButton(b, false))}
        </div>
      )}
    </div>
  );
}
