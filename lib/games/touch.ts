// Mando táctil: tipos de la disposición de botones y despacho de teclas
// sintéticas. Los motores solo escuchan `keydown`/`keyup` en `window` y leen
// `e.code` y `e.repeat`, así que el táctil se comporta igual que el teclado
// sin tocar ningún motor.

export interface TouchButton {
  code: string; // KeyboardEvent.code que se despacha: "ArrowLeft", "Space"…
  label: string; // texto visible: "←", "FUEGO"
  aria: string; // nombre accesible: "Girar a la izquierda"
  repeat?: true; // autorrepetición mientras se mantiene (CAÍDA ← → ↓)
}

export interface TouchLayout {
  move: TouchButton[]; // grupo izquierdo (dirección)
  moveShape: "row" | "cross"; // fila de botones o cruceta (SERPENTINA)
  actions: TouchButton[]; // grupo derecho; [] = sin botones de acción
}

export const REPEAT_DELAY_MS = 170; // primera repetición
export const REPEAT_INTERVAL_MS = 50; // repeticiones siguientes

/** Despacha un `keydown` sintético en `window` con el `code` indicado. */
export function pressKey(code: string, repeat = false) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { code, repeat, cancelable: true }),
  );
}

/** Despacha el `keyup` correspondiente a `pressKey`. */
export function releaseKey(code: string) {
  window.dispatchEvent(new KeyboardEvent("keyup", { code, cancelable: true }));
}
