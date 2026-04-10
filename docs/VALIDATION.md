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

La app web tambien analiza varias ventanas activas dentro de cada escucha real. Por eso, si una grabacion de microfono incluye silencio al principio o eco al final, puede detectar usando solo el tramo mas util.

La biblioteca guarda segmentos fuertes por cada MP3 dentro de `assets/pasos/features.json`. Durante la validacion, cada captura se compara contra la referencia completa y contra esos segmentos. Esto se parece mas a una escucha real, donde solo entra por el microfono una parte del toque.

Ahora esos segmentos fuertes incluyen un factor de distintividad frente al resto de toques. Ademas, la validacion ya incorpora la nueva huella espectral ligera, con perfil por bandas y flujo espectral, para acercarse mas a una escucha por micro real.

Hacer una prueba cruda totalmente aleatoria, incluyendo posibles silencios o partes sin golpes:

```bash
python3 scripts/validate_detection.py --runs 5 --min-seconds 4 --max-seconds 8 --random-segments
```

Analizar grabaciones reales ya capturadas desde microfono o monitor:

```bash
python3 scripts/analyze_capture.py /tmp/cofrabeat-mic-tests/*.wav --mode field
```

Registrar una de esas capturas dentro del dataset real del proyecto:

```bash
python3 scripts/register_field_capture.py /tmp/cofrabeat-mic-tests/03-formacion.wav \
  --expected-file "Prendimiento - Formación.mp3" \
  --source mic \
  --device "webcam-c920" \
  --notes "salon, altavoz frontal, volumen 85"
```

Y resumir luego todo el dataset real:

```bash
python3 scripts/report_field_dataset.py --mode field
```

Este comando usa la misma logica de tramos activos que la app web y muestra si la captura es usable, el ranking y si el resultado queda confirmado o ambiguo.

El analisis de capturas reales tambien aplica la misma limpieza suave que la app: centra la senal y atenúa ruido bajo entre golpes, sin amplificar artificialmente capturas debiles.

En modo `field`, el ranking incluye detalle de patron, timbre, ritmo, envolvente, intervalos, similitud espectral, flujo espectral, penalizacion de micro y si la coincidencia viene de la referencia completa o de un segmento fuerte.

Tambien muestra:

- `dominio`: cuanto domina el patron general frente al voto bruto de fingerprint
- `bonus`: bonificacion extra si el candidato lidera a la vez en patron, envolvente y espectro
- `perfil`: `lento` o `normal`, para saber si se ha activado el ajuste especial de toques lentos

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

El validador separa los casos no confirmados. Si el segundo candidato queda dentro del margen de ambiguedad, incluso justo en el limite, no se confirma un ganador:

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
Confirmadas correctas: 351
Ambiguas no confirmadas: 49
Correctas por debajo del umbral: 0
Confusiones reales: 0
Capturas no usables: 0
```

Este resultado es preferible a confirmar siempre: cuando dos toques quedan demasiado cerca, la app muestra resultado ambiguo y pide repetir la escucha.

Ensayo del perfil `Micro real`:

```text
Referencias validadas: 400
Confirmadas correctas: 297
Ambiguas no confirmadas: 102
Correctas por debajo del umbral: 1
Confusiones reales: 0
Capturas no usables: 0
```

El perfil confirma menos casos que el modo rapido, pero mantiene cero confusiones reales en este ensayo y es mas razonable para audio captado por microfono. Las capturas dudosas se clasifican como ambiguas o no fiables para que la app pida repetir en vez de inventar una coincidencia segura.

Tras el ajuste fino del perfil `Micro real`, la validacion dirigida mejora especialmente en toques lentos:

```text
Dolor de la Madre de Dios, 20 ensayos
17 confirmadas correctas
3 ambiguas no confirmadas
0 confusiones reales
```

Y en `Formacion` se mantiene el criterio conservador: sigue habiendo bastantes ambiguas, pero no aparecen confusiones reales en el ensayo dirigido.
