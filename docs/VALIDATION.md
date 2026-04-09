# Validacion De Deteccion

Este documento explica como comprobar que la biblioteca, la calibracion y el detector tienen sentido antes de probar con el microfono.

## Objetivo

La prueba simula una escucha usando un fragmento de un MP3 que ya esta en la biblioteca.

Si todo esta bien, la app deberia detectar como mejor resultado el mismo archivo del que salio el fragmento.

## Comandos

Validar un toque aleatorio:

```bash
python3 scripts/validate_detection.py
```

Validar toda la biblioteca:

```bash
python3 scripts/validate_detection.py --all
```

Validar un archivo concreto:

```bash
python3 scripts/validate_detection.py --file "Prendimiento - Gritos.mp3"
```

Validar sin regenerar archivos antes:

```bash
python3 scripts/validate_detection.py --all --skip-regenerate
```

## Como Leer El Resultado

Salida correcta:

```text
Referencias validadas: 20
Correctas: 20
Fallidas: 0
```

Cada bloque muestra:

- el toque esperado
- la mejor coincidencia encontrada
- el porcentaje de confianza
- la evidencia interna
- el ranking de alternativas

## Que Significa Un Fallo

Un fallo puede indicar:

- El toque es demasiado lento para la ventana de escucha.
- Hay pocos golpes claros en el fragmento.
- El audio tiene ruido, silencios o mezcla complicada.
- Los umbrales de `calibration.json` son demasiado estrictos.
- Dos toques son ritmicamente muy parecidos.

No significa automaticamente que la app este rota. Significa que ese caso necesita revision.

## Resultado Actual

Con la biblioteca actual, la validacion completa pasa:

```text
Referencias validadas: 20
Correctas: 20
Fallidas: 0
```

Esto confirma que, usando fragmentos simulados de 6 segundos, cada toque se reconoce a si mismo como mejor coincidencia.
