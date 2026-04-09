# Arquitectura De CofraBeat

## Flujo Principal

1. El servidor escanea `assets/pasos`.
2. Genera `manifest.json` con la lista de audios.
3. Genera `features.json` con huellas ritmicas precomputadas si `ffmpeg` esta disponible.
4. La app carga primero `features.json`.
5. Si faltan huellas para algun audio, la app decodifica ese `mp3` en el navegador como fallback.
6. El usuario pulsa `Escuchar`.
7. La app captura muestras con `AudioWorklet`.
8. El detector valida si la captura contiene un patron de tambor usable.
9. Si la captura es usable, compara contra referencias listas.
10. Solo acepta una deteccion si supera evidencia minima de similitud, fingerprints y confianza.

## Modulos

- `index.html`: estructura de interfaz usuario/admin.
- `styles.css`: sistema visual, responsive, microinteracciones y modo movil.
- `app.js`: aplicacion principal.
- `audio-recorder-worklet.js`: captura de audio de baja latencia.
- `scripts/library_manifest.py`: escaneo de mp3, metadatos y huellas.
- `scripts/serve_app.py`: servidor HTTP, API admin y regeneracion de biblioteca.
- `scripts/serve_https.py`: servidor HTTPS local.
- `sw.js`: service worker con cache controlada.
- `tests/`: tests del generador y saneamiento de metadatos.

## Estado Y Persistencia

- `localStorage`: ajustes, historial y ultimo modo de UI.
- `IndexedDB`: audios subidos localmente desde el navegador.
- `assets/pasos/manifest.json`: biblioteca comun generada.
- `assets/pasos/features.json`: huellas comunes generadas.
- `assets/pasos/metadata.json`: nombres, etiquetas y notas globales.

## Detector

El detector se divide en tres fases:

1. Extraccion:
   - mezcla mono
   - normalizacion
   - envolvente
   - onset profile
   - picos ritmicos
   - intervalos
   - fingerprints

2. Rechazo de captura:
   - RMS minimo
   - pico minimo
   - golpes minimos
   - tasa de golpes
   - contraste de onsets
   - estabilidad ritmica
   - numero de fingerprints
   - calidad de senal

3. Aceptacion de coincidencia:
   - confianza minima
   - similitud absoluta
   - evidencia ponderada
   - votos de fingerprints
   - similitud de ritmo o fingerprint

Si una captura no supera las fases 2 o 3, se muestra `Sin toque detectable` o `Sin deteccion fiable`.

## Reglas De Mantenimiento

- No guardar la contrasena de administracion en `app.js`.
- No volver a `window.alert()` para errores de UI; usar toast/modal integrado.
- No cachear agresivamente `manifest.json` ni `features.json`.
- Mantener fallback si `features.json` falla.
- Probar siempre silencio, ruido y toque real despues de tocar el detector.
- Mantener botones y controles con tamano suficiente para movil.
- Subir `assets/pasos/metadata.json` junto con los mp3 si la biblioteca comun cambia.

## Validacion Minima

```bash
node --check app.js
node --check sw.js
node --check audio-recorder-worklet.js
python3 -m py_compile scripts/library_manifest.py scripts/serve_app.py scripts/serve_https.py tests/test_library_manifest.py tests/run_tests.py
python3 tests/run_tests.py
```

## Separacion Recomendada A Futuro

Cuando el comportamiento este estabilizado, dividir `app.js` en:

- `state.js`
- `storage.js`
- `audio-capture.js`
- `detector.js`
- `admin-ui.js`
- `user-ui.js`
