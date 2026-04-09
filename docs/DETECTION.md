# Metodo De Deteccion

## Objetivo

Detectar si una grabacion corta del microfono contiene un toque de tambor conocido y evitar falsos positivos cuando solo hay ruido, silencio o audio no ritmico.

## Referencias Tecnicas

El enfoque toma ideas de sistemas de audio fingerprinting y deteccion de onsets:

- Shazam/Avery Wang: fingerprints robustos y votos coherentes por alineacion temporal.
- AUDFPRINT/Dan Ellis: landmarks/fingerprints y busqueda por offsets.
- Librosa onset detection: fuerza de onset y seleccion de picos.

La implementacion de CofraBeat es mas ligera y corre en navegador, pero mantiene la idea clave: no basta con encontrar el candidato mas cercano; debe haber evidencia suficiente.

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

## Parametros Sensibles

Los umbrales estan al principio de `app.js`:

- `MIN_SIGNAL_RMS`
- `MIN_SIGNAL_PEAK`
- `MIN_CAPTURE_PEAKS`
- `MIN_SIGNAL_QUALITY`
- `MIN_ONSET_CONTRAST`
- `MIN_CAPTURE_FINGERPRINTS`
- `MIN_RHYTHMIC_STABILITY`
- `MIN_MATCH_ABSOLUTE_SIMILARITY`
- `MIN_MATCH_EVIDENCE`
- `MIN_FINGERPRINT_VOTES`
- `MIN_FINGERPRINT_SIMILARITY`
- `MIN_RHYTHM_SIMILARITY`

Regla practica: si aparecen falsos positivos, subir umbrales de evidencia. Si aparecen demasiados falsos negativos con toques reales claros, bajar ligeramente `MIN_MATCH_EVIDENCE` o `MIN_RHYTHMIC_STABILITY`.
