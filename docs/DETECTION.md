# Metodo De Deteccion

## Objetivo

Detectar si una grabacion corta del microfono contiene un toque de tambor conocido y evitar falsos positivos cuando solo hay ruido, silencio o audio no ritmico.

## Referencias Tecnicas

El enfoque toma ideas de sistemas de audio fingerprinting y deteccion de onsets:

- Shazam/Avery Wang: fingerprints robustos y votos coherentes por alineacion temporal.
- AUDFPRINT/Dan Ellis: landmarks/fingerprints y busqueda por offsets.
- Librosa onset detection: fuerza de onset y seleccion de picos.
- Web Audio API: captura con `AudioWorklet` en vez de `ScriptProcessorNode`.

Referencias consultadas:

- Avery Wang, `An Industrial-Strength Audio Search Algorithm`: https://zenodo.org/records/1416340
- Dan Ellis, `Robust Landmark-Based Audio Fingerprinting`: https://www.ee.columbia.edu/~dpwe/resources/matlab/fingerprint/
- Librosa, `onset_strength`: https://librosa.org/doc/0.10.2/generated/librosa.onset.onset_strength.html
- MDN, `ScriptProcessorNode` deprecated: https://developer.mozilla.org/en-US/docs/Web/API/ScriptProcessorNode

La implementacion de CofraBeat es mas ligera y corre en navegador, pero mantiene la idea clave: no basta con encontrar el candidato mas cercano; debe haber evidencia suficiente.

## Perfil Micro Real

El perfil `Micro real` esta pensado para pruebas en las que el audio sale por un altavoz y vuelve a entrar por el microfono del movil u ordenador.

Esa cadena no conserva el MP3 limpio: cambia el volumen, mete eco, comprime frecuencias y puede borrar golpes. Por eso el perfil reduce el peso de fingerprints exactos, da mas peso al contorno ritmico y la envolvente, y exige mas evidencia antes de confirmar un toque.

Recomendacion practica:

- usar 10 a 12 segundos de escucha
- usar volumen medio, sin saturar la entrada
- separar el microfono del altavoz, normalmente 30-80 cm
- evitar ruido de sala
- repetir si la app marca resultado ambiguo

El modo `Micro real` baja el umbral visible para permitir capturas de altavoz, pero compensa con reglas mas estrictas de evidencia, votos ritmicos y separacion entre candidatos. Si dos referencias quedan muy cerca, la app muestra resultado ambiguo.

## Tramos Activos De La Captura

La escucha real no siempre empieza justo cuando empieza el toque. Puede haber silencio inicial, eco final, ruido de sala o un golpe aislado antes del patron principal.

Antes de buscar esos tramos, la captura de microfono recibe un preprocesado suave:

- se elimina el desplazamiento DC de la senal
- se calcula el ruido de fondo aproximado
- se atenúan muestras muy bajas entre golpes con una puerta de ruido suave
- no se sube artificialmente el volumen de una captura debil

Esta ultima regla es importante: normalizar a tope cualquier audio haria que ruido bajo pareciera una senal fuerte. CofraBeat normaliza internamente la forma de la envolvente para comparar patrones, pero mantiene las metricas de energia para poder rechazar silencio o ruido.

Para reducir ese problema, CofraBeat no compara solo la grabacion completa. Primero crea varios tramos candidatos:

- grabacion completa
- tramo activo principal de energia
- ventanas de 6, 8, 10 y 12 segundos alrededor de la zona mas fuerte
- pequenas ventanas alrededor de los centros con mas energia

Cada tramo se analiza igual que una captura normal. La app escoge el tramo con mejor mezcla de evidencia, confianza, calidad ritmica y separacion respecto al segundo resultado. Si el tramo elegido no es la grabacion completa, el resultado muestra desde que segundo se ha analizado.

Esta idea sigue el principio de fingerprinting robusto: buscar evidencia local estable y alineada, no obligar a que toda la grabacion sea perfecta.

## Fase 1: Extraccion De Senal

`analyseSignal()` calcula:

- RMS y pico maximo.
- Envolvente de energia.
- Perfil de onset.
- Picos ritmicos.
- Tiempos de golpes.
- Histograma de intervalos.
- Estimacion de tempo.
- Fingerprints por pares de intervalos.
- Contraste de onsets.
- Estabilidad ritmica.
- Calidad global de senal.

## Fase 2: Rechazo De Captura

`isUsableCapture()` rechaza antes de comparar si no se cumple:

- energia minima
- pico minimo
- golpes suficientes
- tasa minima de golpes
- fingerprints suficientes
- contraste de onset suficiente
- estabilidad ritmica minima
- calidad global minima

Esto evita que ruido bajo, silencio o audio ambiente pasen a la comparacion.

## Fase 3: Comparacion

`compareAgainstReferences()` calcula para cada referencia:

- similitud de ritmo por subsecuencia
- similitud de envolvente
- distancia de intervalos
- distancia de densidad
- distancia de tempo
- votos de fingerprints alineados
- evidencia ponderada
- confianza final

Cada MP3 se compara usando su huella global y varios segmentos fuertes guardados en `assets/pasos/features.json`. Esos segmentos son ventanas de 8, 10 y 12 segundos elegidas por energia, golpes, fingerprints y calidad ritmica.

Esto ayuda con capturas reales de microfono, porque el usuario normalmente graba solo una parte concreta del toque. Si un segmento fuerte encaja mejor que el archivo completo, la app usa ese segmento como mejor evidencia para esa referencia.

La confianza se penaliza por calidad de senal y evidencia. Ya no se infla solo porque una referencia sea "la menos mala".

## Fase 4: Aceptacion

`isReliableMatch()` exige:

- confianza minima configurada
- similitud absoluta minima
- evidencia minima
- votos minimos de fingerprint
- similitud minima ritmica o de fingerprint

Si no se cumple, la app devuelve `Sin deteccion fiable` y no muestra ranking.

## Comportamiento Esperado

- Silencio: `Sin toque detectable`.
- Ruido ambiente: `Sin toque detectable` o `Sin deteccion fiable`.
- Audio con golpes sueltos no ritmicos: `Sin deteccion fiable`.
- Toque real con micro cerca: deteccion si supera evidencia suficiente.
- Toque real con mucho ruido: no concluyente antes que falso positivo.

## Calibracion Automatica

Los valores por defecto estan en `DEFAULT_DETECTION_LIMITS` dentro de `app.js`, pero la app puede cargar valores ajustados desde:

```text
assets/pasos/calibration.json
```

Ese archivo se genera con:

```bash
python3 scripts/calibrate_detection.py
```

El script analiza las referencias actuales de `assets/pasos/features.json` y calcula:

- duracion real
- RMS y pico
- golpes detectados
- golpes por segundo
- fingerprints ritmicos
- contraste de onset
- estabilidad ritmica
- calidad global

Con esas estadisticas propone variables como:

- `minSignalRms`
- `minSignalPeak`
- `minCapturePeaks`
- `minSignalQuality`
- `minOnsetContrast`
- `minCaptureFingerprints`
- `minRhythmicStability`
- `minMatchAbsoluteSimilarity`
- `minMatchEvidence`
- `minFingerprintVotes`
- `minFingerprintSimilarity`
- `minRhythmSimilarity`
- `minTopMatchMargin`

`minTopMatchMargin` evita confirmar un toque cuando el primer y segundo resultado quedan demasiado cerca. Si la diferencia es menor o igual a ese margen, la app muestra resultado ambiguo y pide repetir la escucha.

Regla practica: si aparecen falsos positivos, subir umbrales de evidencia. Si aparecen demasiados falsos negativos con toques reales claros, bajar ligeramente `minMatchEvidence` o `minRhythmicStability`. Si aparecen confusiones entre dos toques muy parecidos, subir ligeramente `minTopMatchMargin`.
