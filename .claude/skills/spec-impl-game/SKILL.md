---
name: spec-impl-game
description: Implementa una spec de juego aprobada con el mismo flujo que /spec-impl (validación, rama spec-NN-slug, pasos con pausas, sin commits) y, al terminar, lanza en secuencia el agente skin-designer para ese juego y después mobile-porter.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — /spec-impl + skin-designer + mobile-porter

## Contexto de sesión

Estado actual del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Configuración de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no config file)"`

Motores existentes (para resolver el id del juego):
!`ls lib/games/ 2>/dev/null || echo "Aún no hay lib/games/"`

---

## Instrucciones

Responde en español. El argumento recibido es: `$ARGUMENTS`

### Fases 1–4 — Igual que /spec-impl

1. Lee `.claude/skills/spec-impl/SKILL.md` con Read y sigue **sus Fases 1, 2, 3 y 4 al pie de la letra**, usando `$ARGUMENTS` como argumento y el contexto de sesión de arriba (sustituye al de ese archivo, cuyos bloques `!` no se ejecutan al leerlo).
   - Mismas reglas: solo specs con estado que signifique «Aprobado», rama `spec-NN-slug` según `AutoCreateBranch`, resumen de la spec, implementación paso a paso con pausa y confirmación tras cada paso, **nunca hacer commits**, parar ante ambigüedades y no implementar nada fuera del alcance.
   - Si te detienes en cualquier fase (spec no encontrada, estado no aprobado, cambios sin commitear sin respuesta, etc.), **no lances ningún agente**.

2. **Comprobación de juego** (justo después de validar el estado en la Fase 2): la spec debe añadir o portar un juego con motor en `lib/games/` registrado en `ENGINES` (`lib/games/registry.ts`). Si no es una spec de juego, avísalo, sugiere usar `/spec-impl` y detente sin crear rama.

### Fase 5 — Agentes en secuencia (nunca en paralelo)

Empieza esta fase cuando el usuario confirme el último paso del plan, justo después del mensaje final de /spec-impl («All steps of the plan are implemented…»). No pidas otra confirmación.

1. **Id del juego**: la clave que la spec añadió a `ENGINES` en `lib/games/registry.ts` (compruébala leyendo el archivo).

2. **skin-designer**: lanza **un solo** agente con la herramienta Agent:
   - `subagent_type: "skin-designer"`, `description: "Skins de <id>"`.
   - `prompt`: `<id>` seguido del contexto: «Juego recién implementado con la spec `specs/NN-slug.md` en la rama `spec-NN-slug` (ya activa; trabaja en ella, no cambies de rama). Aplica los skins CLÁSICO, NEÓN y RETRO solo a este juego.»
   - **Espera la notificación de que ha terminado.** No lances mobile-porter ni ningún otro agente mientras tanto, y no inventes su resultado.
   - Cuando llegue, resume al usuario: archivos tocados, capturas, contraste y decisiones «a revisar».
   - Si falló o quedó bloqueado, detente y pregunta con AskUserQuestion si lanzar mobile-porter de todos modos.

3. **mobile-porter**: solo después de que skin-designer haya terminado, lanza **un solo** agente:
   - `subagent_type: "mobile-porter"`, `description: "Revisión móvil"`.
   - `prompt`: «Prioriza `/jugar/<id>` y `/juegos/<id>`: juego recién implementado con la spec `specs/NN-slug.md` en la rama `spec-NN-slug` (ya activa; trabaja en ella, no cambies de rama), con skins recién aplicados por skin-designer. Revisa el resto del sitio como siempre.»
   - Espera su notificación y resume lo que encontró y arregló.

4. **Mensaje final**:

   ```
   ✅ Implementación, skins y revisión móvil terminados.

   Siguiente paso: verifica los criterios de aceptación de la spec uno a uno.
   Si pasan todos, cambia su estado a "Implementado" y haz el commit final
   antes de mergear la rama spec-NN-slug.
   ```

   No hagas commit: lo decide el usuario.

---

## Resumen

```
/spec-impl-game 11-juego-frogger
  Fases 1–4 → igual que /spec-impl (valida, rama, pasos con pausas)
  Fase 5    → skin-designer <id>  → (espera) → mobile-porter (prioriza /jugar/<id>) → (espera)
              → recordatorio de criterios, estado y commit

/spec-impl-game 09  (Estado: Implementado)
  → error estándar de /spec-impl, sin rama, sin código, sin agentes
```
