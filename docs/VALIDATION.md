# Validacion De Deteccion

Este documento describe como validar CofraBeat antes y despues de tocar biblioteca, umbrales o UI de deteccion.

## Tipos De Validacion

### 1. Validacion Simulada

Usa fragmentos sacados de la propia biblioteca.

```bash
python3 scripts/validate_detection.py --all
```

### 2. Analisis De Capturas Reales

Analiza `wav` o `mp3` grabados desde micro o monitor.

```bash
python3 scripts/analyze_capture.py /tmp/cofrabeat-mic-tests/*.wav --mode field
```

### 3. Dataset De Campo

Registra capturas reales y obtiene un resumen consolidado:

```bash
python3 scripts/register_field_capture.py /tmp/cofrabeat-mic-tests/mi-captura.wav \
  --expected-file "Prendimiento - Yenka.mp3" \
  --source mic \
  --device "webcam-c920" \
  --notes "prueba de campo"

python3 scripts/report_field_dataset.py --mode field
```

## Comandos Utiles

Validar una referencia concreta:

```bash
python3 scripts/validate_detection.py --file "Prendimiento - Gritos.mp3"
```

Ensayo aleatorio usable:

```bash
python3 scripts/validate_detection.py --runs 20 --min-seconds 4 --max-seconds 12 --active-segments --require-usable --mode field
```

Ensayo de estres:

```bash
python3 scripts/validate_detection.py --runs 400 --min-seconds 4 --max-seconds 12 --active-segments --require-usable --skip-regenerate --mode field
```

## Interpretacion De Estados

- `OK CONFIRMADO`: el detector confirmaria el toque esperado
- `OK NO CONFIRMADO`: el toque esperado queda primero, pero sin fuerza suficiente para confirmar
- `PROBABLE`: primer candidato fuerte, pero aun no confirmado
- `PROBABLE AMBIGUO`: primer candidato util, con segundo candidato demasiado cercano
- `AMBIGUO`: la escucha no permite decidir con seguridad
- `FALLO REAL`: se iria a un toque incorrecto
- `NO USABLE`: la captura no tiene calidad suficiente para competir

## Nota Sobre Confianza Visible

En la version actual, la confianza visible en web y scripts vuelve a ser la confianza real del motor.

No se aplica un boost cosmetico extra sobre el porcentaje mostrado. Eso hace que:

- el historial sea mas honesto
- `Probable` y `Confirmado` sean mas comparables entre si
- las decisiones internas y el porcentaje mostrado cuenten la misma historia

## Resultado Consolidado Actual

Estado actual del dataset de campo:

```text
OK confirmadas: 20
OK no confirmadas: 3
Ambiguas: 1
Fallos reales: 0
```

Esto permite tratar la version actual como estable para uso y pruebas reales.

## Criterio De Calidad

La prioridad no es maximizar confirmaciones a cualquier precio. La prioridad es:

1. no confirmar toques incorrectos
2. mantener `Fallos reales: 0`
3. reducir poco a poco `OK no confirmadas` y `Ambiguas`

## Flujo Recomendado

1. actualizar o añadir audios
2. regenerar biblioteca
3. pasar validacion simulada
4. hacer capturas reales en `Micro real`
5. registrar dataset de campo
6. revisar si el cambio mejora o empeora el resumen
