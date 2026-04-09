# Calibracion De Deteccion

Generado por `scripts/calibrate_detection.py`.

## Resumen

- Referencias analizadas: 20
- Archivo de salida: `assets/pasos/calibration.json`
- La app carga este archivo automaticamente al arrancar por HTTP/HTTPS.

## Umbrales Recomendados

| Variable | Valor |
| --- | --- |
| `minCaptureFingerprints` | `5` |
| `minCapturePeaks` | `3` |
| `minFingerprintSimilarity` | `0.08` |
| `minFingerprintVotes` | `4` |
| `minMatchAbsoluteSimilarity` | `0.38` |
| `minMatchConfidence` | `28` |
| `minMatchEvidence` | `0.42` |
| `minOnsetContrast` | `0.097155` |
| `minOnsetThreshold` | `0.18` |
| `minPeakRate` | `0.35` |
| `minRhythmSimilarity` | `0.36` |
| `minRhythmicStability` | `0.16369` |
| `minSignalPeak` | `0.12` |
| `minSignalQuality` | `0.447761` |
| `minSignalRms` | `0.035` |

## Estadisticas Base

| Metrica | p10 | mediana | p90 |
| --- | ---: | ---: | ---: |
| `durationSeconds` | 104.4741 | 176.3265 | 261.9377 |
| `rms` | 0.099775 | 0.12113 | 0.150429 |
| `peakAmplitude` | 0.939373 | 0.999969 | 1.0 |
| `peakRate` | 0.615966 | 1.04323 | 1.371755 |
| `peaksCount` | 89.0 | 176.0 | 311.6 |
| `fingerprintsCount` | 286.5 | 1072.5 | 2149.3 |
| `onsetContrast` | 0.2159 | 0.255077 | 0.335467 |
| `rhythmicStability` | 0.363756 | 0.52381 | 0.831817 |
| `signalQuality` | 0.814111 | 0.848021 | 0.888995 |

## Referencias Analizadas

| Toque | Etiqueta | Duracion s | Golpes | Golpes/s | Fingerprints | Calidad |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Prendimiento Bonanza | Sin etiqueta | 117.0 | 148 | 1.26 | 1121 | 0.841 |
| Prendimiento Cincuentenario | Sin etiqueta | 161.2 | 170 | 1.05 | 970 | 0.879 |
| Prendimiento Cuatrera | Sin etiqueta | 261.5 | 309 | 1.18 | 1456 | 0.907 |
| Prendimiento Dolor De La Madre De Dios | Sin etiqueta | 183.4 | 92 | 0.50 | 125 | 0.883 |
| Prendimiento El Coso | Sin etiqueta | 265.5 | 274 | 1.03 | 1409 | 0.822 |
| Prendimiento Entrada Pasos | Sin etiqueta | 178.5 | 112 | 0.63 | 531 | 0.866 |
| Prendimiento Formación | Sin etiqueta | 199.8 | 182 | 0.91 | 1201 | 0.839 |
| Prendimiento Gritos | Sin etiqueta | 244.3 | 335 | 1.37 | 2788 | 0.848 |
| Prendimiento Himno (los Enanitos) | Sin etiqueta | 53.1 | 43 | 0.81 | 174 | 0.887 |
| Prendimiento Jota | Sin etiqueta | 134.7 | 178 | 1.32 | 1675 | 0.835 |
| Prendimiento La Corona | Sin etiqueta | 387.1 | 384 | 0.99 | 2098 | 0.849 |
| Prendimiento La Ola | Sin etiqueta | 157.2 | 134 | 0.85 | 299 | 0.848 |
| Prendimiento La Paloma | Sin etiqueta | 227.8 | 234 | 1.03 | 1024 | 0.854 |
| Prendimiento Lenta Que No Es Lenta | Sin etiqueta | 204.7 | 241 | 1.18 | 1155 | 0.814 |
| Prendimiento Saltiki O Sirtaki | Sin etiqueta | 191.9 | 174 | 0.91 | 691 | 0.812 |
| Prendimiento San Gines | Sin etiqueta | 108.6 | 137 | 1.26 | 870 | 0.916 |
| Prendimiento Tres Tenores | Sin etiqueta | 67.4 | 90 | 1.33 | 669 | 0.857 |
| Prendimiento Un Corazón Con Siete Puñales | Sin etiqueta | 156.4 | 80 | 0.51 | 374 | 0.794 |
| Prendimiento Yenka | Sin etiqueta | 158.3 | 218 | 1.38 | 1665 | 0.825 |
| Prendimiento Zaragoza | Sin etiqueta | 174.2 | 270 | 1.55 | 2611 | 0.824 |

## Uso

Ejecuta:

```bash
python3 scripts/calibrate_detection.py
```

Despues reinicia o recarga la app. Si el archivo `assets/pasos/calibration.json`
existe, CofraBeat usara esas variables en lugar de los valores por defecto.
