# Arquitectura De CofraBeat

## Resumen

CofraBeat combina:

- una app web mobile-first
- una biblioteca comun de audios `mp3`
- una fase de precalculo en Python
- un detector en navegador optimizado para escucha real por microfono

La arquitectura separa claramente:

- datos comunes versionados en `assets/pasos`
- estado local de cada navegador
- mantenimiento real por servidor local
- demo estatica en GitHub Pages

## Flujo Principal

1. El servidor local escanea `assets/pasos`.
2. Genera o actualiza `manifest.json`, `features.json` y `metadata.json`.
3. `scripts/calibrate_detection.py` puede regenerar `calibration.json`.
4. La app carga calibracion, manifest y features al arrancar.
5. El usuario escucha desde el microfono.
6. La captura pasa por validacion de usabilidad.
7. Si la captura es usable, se compara contra referencias completas y segmentos fuertes.
8. La app decide entre:
   - `Resultado confirmado`
   - `Probable`
   - `Probable ambiguo`
   - `Sin deteccion fiable`

## Capas Del Sistema

### Frontend

- [index.html](/home/jesus/Documentos/Codex/PSGANGORRIN/index.html): estructura base y zonas usuario/admin
- [styles.css](/home/jesus/Documentos/Codex/PSGANGORRIN/styles.css): responsive, overlays, navegacion y estados visuales
- [app.js](/home/jesus/Documentos/Codex/PSGANGORRIN/app.js): captura, deteccion, administracion, persistencia local y UI
- [audio-recorder-worklet.js](/home/jesus/Documentos/Codex/PSGANGORRIN/audio-recorder-worklet.js): captura continua de audio

### Backend Local

- [scripts/serve_app.py](/home/jesus/Documentos/Codex/PSGANGORRIN/scripts/serve_app.py): servidor HTTP, login admin y escritura real
- [scripts/serve_https.py](/home/jesus/Documentos/Codex/PSGANGORRIN/scripts/serve_https.py): servidor HTTPS para pruebas reales con movil

### Generacion De Biblioteca

- [scripts/library_manifest.py](/home/jesus/Documentos/Codex/PSGANGORRIN/scripts/library_manifest.py): metadatos, huellas y segmentos fuertes
- [scripts/calibrate_detection.py](/home/jesus/Documentos/Codex/PSGANGORRIN/scripts/calibrate_detection.py): umbrales recomendados para la biblioteca actual

### Validacion Y Campo

- [scripts/validate_detection.py](/home/jesus/Documentos/Codex/PSGANGORRIN/scripts/validate_detection.py): validacion simulada
- [scripts/analyze_capture.py](/home/jesus/Documentos/Codex/PSGANGORRIN/scripts/analyze_capture.py): analisis de capturas reales
- [scripts/register_field_capture.py](/home/jesus/Documentos/Codex/PSGANGORRIN/scripts/register_field_capture.py): registro del dataset de campo
- [scripts/report_field_dataset.py](/home/jesus/Documentos/Codex/PSGANGORRIN/scripts/report_field_dataset.py): resumen del dataset real

## Estado Y Persistencia

Versionado en repo:

- `assets/pasos/manifest.json`
- `assets/pasos/features.json`
- `assets/pasos/calibration.json`
- `assets/pasos/metadata.json`
- `data/field-dataset/manifest.json`

Persistencia local del navegador:

- `localStorage`: modo, historial, ajustes y preferencias
- `IndexedDB`: audios subidos localmente y cambios no globales en modo demo

## Modos De Ejecucion

### GitHub Pages

Modo estatico:

- sin Python
- sin escritura global
- sin regeneracion de biblioteca
- administracion visible solo como demo

### Servidor Local

Modo completo:

- administracion real
- guardado global de metadatos
- regeneracion de biblioteca
- flujo recomendado para mantenimiento

## Detector

El detector combina varias familias de evidencia:

- energia y calidad de señal
- onsets, picos y estabilidad ritmica
- fingerprints por intervalos
- similitud de ritmo y envolvente
- landmarks espectrales ligeros
- comparacion contra referencia completa y segmentos fuertes

La decision final es conservadora:

- primero decide si la captura es usable
- luego decide si el mejor candidato domina lo suficiente
- si no domina, devuelve `Probable` o `Probable ambiguo` en lugar de confirmar de forma agresiva

## UI Y Experiencia

La interfaz se divide en:

- modo usuario
- modo administracion
- overlay de carga inicial
- overlay de analisis al terminar la escucha
- bloqueo visual y funcional mientras la app escucha o analiza

Se ha trabajado especificamente:

- responsive movil
- `safe-area` para dispositivos con notch
- accesibilidad visual de overlays y progreso
- navegacion rapida inferior para usuario y admin

## Reglas De Mantenimiento

- no exponer credenciales en frontend
- no usar `alert()` o `prompt()` nativos para flujos normales de UI
- no ensuciar `features.json` con tests
- no confirmar un toque si la evidencia es insuficiente
- recalibrar despues de cambios importantes en la biblioteca
- validar siempre:
  - simulacion
  - capturas reales
  - responsive visual basico

## Validacion Minima Recomendada

```bash
node --check app.js
node --check sw.js
node --check audio-recorder-worklet.js
python3 -m py_compile scripts/library_manifest.py scripts/calibrate_detection.py scripts/serve_app.py scripts/serve_https.py scripts/validate_detection.py scripts/analyze_capture.py scripts/register_field_capture.py scripts/report_field_dataset.py tests/test_library_manifest.py tests/test_detection_calibration.py tests/test_detection_outcomes.py tests/run_tests.py
python3 tests/run_tests.py
```

## Limites Conocidos

- la precision depende de la calidad del altavoz, sala y microfono
- la biblioteca de audios puede tener limitaciones legales independientes del codigo
- `app.js` sigue siendo grande; modularizarlo seria una mejora futura, no una urgencia de producto
