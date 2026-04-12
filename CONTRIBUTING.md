# Contribuir A CofraBeat

Gracias por querer mejorar el proyecto.

## Principios

- Mantén el flujo ligero. La app debe seguir siendo usable en móvil.
- No metas complejidad visual o técnica sin una mejora clara de UX o fiabilidad.
- Si tocas detección, valida siempre tanto en app como en scripts CLI.
- Si tocas UI, revisa móvil y desktop.

## Flujo Recomendado

1. Crea una rama corta y enfocada.
2. Haz cambios pequeños y revisables.
3. Valida lo que toques antes de pedir revisión.
4. Documenta cualquier cambio visible o de comportamiento.

## Validaciones Mínimas

### Frontend

```bash
node --check app.js
git diff --check
```

### Scripts Python

```bash
python3 -m py_compile scripts/*.py tests/*.py
```

### Tests

```bash
python3 -u tests/run_tests.py
```

## Si Tocas La Detección

- Revisa `scripts/validate_detection.py`
- Revisa `scripts/analyze_capture.py`
- Si hay cambios de biblioteca, asegúrate de no ensuciar ficheros versionados durante tests
- No cambies umbrales a ciegas; explica el motivo

## Si Tocas La UI

- Revisa móvil y desktop
- Comprueba overlays, navegación inferior, resultado e historial
- Evita estados visuales que dependan solo del color

## Commits

Usa mensajes concretos y centrados en el cambio real.

Ejemplos:

- `Polish admin mobile navigation`
- `Fix match metric rendering in UI`
- `Add filtered history and replay actions`

## Pull Requests

Un PR bueno:

- explica qué cambia
- explica por qué
- indica cómo se ha validado
- incluye evidencia visual si toca UI
