# Calibracion De Deteccion

Este documento resume el papel de la calibracion dentro de CofraBeat.

## Que Es

La calibracion ajusta umbrales de deteccion a partir de la biblioteca comun actual. No entrena un modelo; calcula limites razonables para:

- energia minima
- picos minimos
- fingerprints minimos
- estabilidad ritmica
- calidad de señal
- evidencia y confianza minima
- margen entre primer y segundo candidato

## Archivo Generado

La salida real vive en:

```text
assets/pasos/calibration.json
```

Ese archivo lo usa la app al arrancar.

## Regeneracion

```bash
python3 scripts/calibrate_detection.py
```

Conviene regenerar calibracion cuando:

- cambias mucho la biblioteca de audios
- añades toques nuevos
- cambias criterios de comparacion de referencias

## Regla Practica

- si aparecen falsos positivos, revisa primero la calibracion y el dataset real
- si la app se vuelve excesivamente prudente, valida con capturas reales antes de bajar umbrales

La calibracion debe estar subordinada al dataset de campo, no al reves.
