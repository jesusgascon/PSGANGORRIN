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

Hacer 5 ensayos aleatorios con trozos de 4 a 8 segundos:

```bash
python3 scripts/validate_detection.py --runs 5 --min-seconds 4 --max-seconds 8 --active-segments --require-usable
```

Ensayar el perfil recomendado para micro real:

```bash
python3 scripts/validate_detection.py --runs 400 --min-seconds 4 --max-seconds 12 --active-segments --require-usable --skip-regenerate --mode field
```

Hacer una prueba cruda totalmente aleatoria, incluyendo posibles silencios o partes sin golpes:

```bash
python3 scripts/validate_detection.py --runs 5 --min-seconds 4 --max-seconds 8 --random-segments
```

## Como Leer El Resultado

Salida correcta:

```text
Referencias validadas: 20
Confirmadas correctas: 20
Ambiguas no confirmadas: 0
Correctas por debajo del umbral: 0
Confusiones reales: 0
Capturas no usables: 0
```

Cada bloque muestra:

- el toque esperado
- la mejor coincidencia encontrada
- el porcentaje de confianza
- la evidencia interna
- el ranking de alternativas

El validador separa los casos no confirmados:

- `OK`: la app confirmaria el toque correcto.
- `AMBIGUO`: hay dos toques muy cercanos; la app no debe confirmar ninguno.
- `BAJO`: el toque correcto sale primero, pero por debajo del umbral.
- `FALLO`: la app confirmaria un toque incorrecto.
- `NO USABLE`: el fragmento no tiene calidad suficiente para detectar.

## Que Significa Un Fallo

Un fallo puede indicar:

- El toque es demasiado lento para la ventana de escucha.
- Hay pocos golpes claros en el fragmento.
- El audio tiene ruido, silencios o mezcla complicada.
- Los umbrales de `calibration.json` son demasiado estrictos.
- Dos toques son ritmicamente muy parecidos.

No significa automaticamente que la app este rota. Significa que ese caso necesita revision.

Si el fallo aparece como `Captura no usable`, normalmente significa que el trozo elegido no tenia suficientes golpes. En ese caso el detector esta haciendo lo correcto: no inventa una coincidencia.

Para medir la identificacion de toques reales, usa `--active-segments --require-usable`.

Para medir que pasa si el usuario graba silencios, pausas o partes pobres, usa `--random-segments`.

## Resultado Actual

Con la biblioteca actual, la validacion completa pasa:

```text
Referencias validadas: 20
Confirmadas correctas: 20
Ambiguas no confirmadas: 0
Correctas por debajo del umbral: 0
Confusiones reales: 0
Capturas no usables: 0
```

Esto confirma que, usando fragmentos simulados de 6 segundos, cada toque se reconoce a si mismo como mejor coincidencia.

Ensayo aleatorio usable de 20 pruebas:

```text
Referencias validadas: 20
Confirmadas correctas: 20
Ambiguas no confirmadas: 0
Correctas por debajo del umbral: 0
Confusiones reales: 0
Capturas no usables: 0
```

Ese ensayo usa fragmentos aleatorios entre 4 y 8 segundos, evitando partes sin golpes suficientes.

Ensayo de estres de 400 pruebas con fragmentos activos de 4 a 12 segundos:

```text
Referencias validadas: 400
Confirmadas correctas: 386
Ambiguas no confirmadas: 10
Correctas por debajo del umbral: 4
Confusiones reales: 0
Capturas no usables: 0
```

Este resultado es preferible a confirmar siempre: cuando dos toques quedan demasiado cerca, la app muestra resultado ambiguo y pide repetir la escucha.

Ensayo del perfil `Micro real`:

```text
Referencias validadas: 400
Confirmadas correctas: 379
Ambiguas no confirmadas: 13
Correctas por debajo del umbral: 8
Confusiones reales: 0
Capturas no usables: 0
```

El perfil confirma menos casos que el modo rapido, pero mantiene cero confusiones reales en este ensayo y es mas razonable para audio captado por microfono.
