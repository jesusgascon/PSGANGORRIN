# CofraBeat

Aplicacion web mobile-first para detectar toques de tambor de Semana Santa. La app escucha por el microfono, analiza el ritmo grabado y lo compara contra una biblioteca comun de audios `mp3`.

Version actual: `v1.1.0`

Release: <https://github.com/jesusgascon/PSGANGORRIN/releases/tag/v1.1.0>

## Que Es

CofraBeat es una herramienta para Cofradias y proyectos de Semana Santa que permite:

- Escuchar un toque de tambor desde el microfono del movil o del ordenador.
- Compararlo con una base de datos de toques ya cargados.
- Mostrar si hay una deteccion fiable.
- Consultar un ranking de coincidencias cuando la evidencia es suficiente.
- Mantener una biblioteca comun de audios de referencia.
- Administrar nombres visibles, etiquetas, notas y metadatos de cada toque.
- Escuchar previas en administracion sin que sigan sonando al salir de la zona admin.

No es una IA entrenada ni una copia completa de Shazam. Es un detector ligero de ritmo y huellas de golpes, pensado para funcionar en navegador y en movil.

## Estado Actual

El proyecto esta preparado para uso local, pruebas en red Wi-Fi y publicacion estatica en GitHub Pages.

Incluye:

- Interfaz tipo app movil.
- Modo usuario para escuchar, detectar, revisar resultados e historial.
- Modo administracion para mantener la base de toques.
- Biblioteca comun desde `assets/pasos`.
- Cargas locales persistentes en el navegador.
- Metadatos globales editables.
- Calibracion automatica de deteccion segun los audios cargados.
- Ensayos simulados repetidos para comprobar la deteccion.
- Rechazo de silencio, ruido y coincidencias debiles.
- Servidor HTTP local.
- Servidor HTTPS local para pruebas con microfono en movil.
- PWA basica con `manifest.webmanifest` y `sw.js`.

## Uso Rapido

Desde la carpeta del proyecto:

```bash
python3 ./scripts/serve_app.py --host 0.0.0.0 --port 8000
```

En este ordenador:

```text
http://localhost:8000
```

Desde un movil en la misma Wi-Fi:

```text
http://IP-DE-TU-ORDENADOR:8000
```

Importante:

- `localhost` solo funciona en el propio ordenador.
- Desde el movil hay que usar la IP del ordenador.
- En algunos moviles el microfono puede requerir HTTPS.

## Requisitos

Minimos:

- Python 3.
- Navegador moderno.
- Permiso de microfono.

Recomendados:

- `ffmpeg`, para generar huellas de audio en servidor.
- `gh`, si se quiere publicar o crear releases en GitHub desde terminal.

Comprobar `ffmpeg`:

```bash
ffmpeg -version
```

Si `ffmpeg` no esta instalado, la app puede intentar analizar audios en navegador, pero la experiencia es peor y mas lenta.

## Flujo Normal De Trabajo

1. Copiar los `mp3` de toques en `assets/pasos`.
2. Arrancar el servidor local.
3. El servidor regenera la biblioteca.
4. La app carga los toques.
5. El usuario pulsa el boton central para escuchar.
6. La app analiza la captura.
7. Si hay evidencia suficiente, muestra la deteccion.
8. Si no hay evidencia suficiente, muestra que no hay toque fiable.

Comando recomendado:

```bash
python3 ./scripts/serve_app.py --host 0.0.0.0 --port 8000
```

## Biblioteca De Toques

La biblioteca comun vive en:

```text
assets/pasos/
```

Aqui se deben poner los audios `mp3` que forman parte de la base de datos compartida de la app.

Al arrancar el servidor, se generan o actualizan estos archivos:

- `assets/pasos/manifest.json`
- `assets/pasos/features.json`
- `assets/pasos/calibration.json`

### Diferencia Entre Biblioteca Comun Y Cargas Locales

Biblioteca comun:

- Archivos dentro de `assets/pasos`.
- Los ve cualquier persona que entre a la app.
- Se puede subir a GitHub junto con el proyecto.
- Sirve como base real de deteccion.

Cargas locales desde la interfaz:

- Se guardan en `IndexedDB` del navegador.
- Solo existen en ese dispositivo.
- No las ve otro usuario.
- No modifican la biblioteca comun del proyecto.

Para que todos vean un toque, debe estar en `assets/pasos`.

## Administracion

El modo administracion permite:

- Ver todos los toques cargados.
- Buscar y filtrar referencias.
- Escuchar audios.
- Renombrar nombres visibles.
- Asignar etiquetas.
- Editar notas.
- Revisar duracion, tamano, formato, muestreo y canales.
- Contraer o expandir fichas.
- Parar automaticamente las previas al salir de administracion o cambiar de panel.
- Mantener la base comun desde el servidor local.

Clave por defecto en servidor local:

```text
psangorrin
```

Cambiar clave sin tocar codigo:

```bash
COFRABEAT_ADMIN_PASSWORD="otra-clave" python3 ./scripts/serve_app.py --host 0.0.0.0 --port 8000
```

## GitHub Pages

GitHub Pages es estatico. No ejecuta Python y no tiene endpoints `/api/admin/*`.

Por eso, en GitHub Pages:

- La zona de administracion se puede abrir como demo publica.
- No pide contrasena.
- Los cambios solo se guardan en el navegador del visitante.
- No se modifica `assets/pasos/metadata.json`.
- No se regeneran `manifest.json`, `features.json` ni `calibration.json`.

Para administracion real y guardado global, hay que usar:

```bash
python3 ./scripts/serve_app.py --host 0.0.0.0 --port 8000
```

## Calibracion De Deteccion

La calibracion sirve para que la app adapte sus valores de deteccion a los audios reales de la biblioteca.

Ejecutar manualmente:

```bash
python3 scripts/calibrate_detection.py
```

El script analiza los audios y genera:

- `assets/pasos/calibration.json`
- `docs/CALIBRATION.md`

La app carga `calibration.json` automaticamente al arrancar por HTTP o HTTPS.

La calibracion ayuda a decidir:

- Si una grabacion tiene suficiente volumen.
- Si hay suficientes golpes.
- Si hay ritmo real.
- Si hay suficientes fingerprints.
- Si una coincidencia debe aceptarse o rechazarse.
- Si ruido o silencio deben descartarse.

Despues de cambiar mucho la biblioteca de audios, conviene regenerar la calibracion.

## Como Funciona La Deteccion

El detector analiza:

- Energia RMS.
- Pico maximo.
- Envolvente de energia.
- Fuerza de onset.
- Picos ritmicos.
- Tiempos entre golpes.
- Fingerprints por intervalos.
- Estabilidad ritmica.
- Calidad global de senal.

Luego compara la captura contra las referencias.

Cada referencia tiene una huella global y varios segmentos fuertes de 8, 10 y 12 segundos guardados en `assets/pasos/features.json`. Asi, una grabacion corta de microfono puede coincidir con la parte concreta del toque que se ha escuchado, no solo con el archivo completo.

Esos segmentos ya no se escogen solo por energia. La biblioteca reordena tambien por distintividad frente al resto de toques, para intentar usar tramos que separen mejor una referencia de otra. Ademas, cada toque guarda una huella espectral ligera por bandas y flujo espectral para ayudar a distinguir patrones ritmicos parecidos.

La app no acepta automaticamente la referencia mas parecida. Primero exige evidencia minima. Esto evita falsos positivos con silencio, ruido o golpes sueltos.

Resultados esperados:

- Silencio: sin toque detectable.
- Ruido: sin deteccion fiable.
- Golpes aislados: normalmente sin deteccion fiable.
- Toque real claro: deteccion si supera el umbral.
- Toques muy parecidos: resultado ambiguo; la app pide repetir en vez de confirmar uno al azar.
- Toque real con mucho ruido: mejor no detectar antes que inventar una coincidencia.

Para pruebas reproduciendo un MP3 en el ordenador y escuchando con el microfono, usa el perfil `Micro real`, una duracion de 10 a 12 segundos, volumen medio y evita que el microfono este pegado al altavoz. Esa prueba es mas dificil que analizar el MP3 limpio porque hay eco, compresion, ruido de sala y perdida de golpes.

Si la app marca resultado ambiguo o sin deteccion fiable, no significa necesariamente que falle la biblioteca. Normalmente indica que la captura por microfono no llega clara, llega saturada o hay varios toques con patron muy parecido. En ese caso conviene repetir acercando el movil al altavoz/tambor, pero manteniendo distancia suficiente para que no sature.

El perfil `Micro real` pesa menos los fingerprints exactos y da mas importancia al patron de golpes, envolvente, intervalos y timbre espectral general. Si un candidato gana solo por coincidencias locales pero el patron o el timbre no acompanan, se penaliza y la app tiende a dejarlo ambiguo.

Mas detalle en:

```text
docs/DETECTION.md
```

## HTTPS Para Movil

Algunos navegadores moviles bloquean el microfono si la web se abre por `http://IP:8000`.

Para probar con HTTPS en red local:

```bash
chmod +x ./scripts/generate-dev-cert.sh
./scripts/generate-dev-cert.sh IP-DE-TU-ORDENADOR
python3 ./scripts/serve_https.py --host 0.0.0.0 --port 8443
```

Abrir desde el movil:

```text
https://IP-DE-TU-ORDENADOR:8443
```

El navegador puede mostrar aviso de certificado porque es un certificado local de desarrollo.

## Estructura Del Proyecto

- `index.html`: estructura principal de la app.
- `styles.css`: diseno visual, responsive, movil y escritorio.
- `app.js`: estado, interfaz, captura, almacenamiento y deteccion.
- `audio-recorder-worklet.js`: captura de audio con `AudioWorklet`.
- `manifest.webmanifest`: metadatos PWA.
- `sw.js`: service worker y cache.
- `assets/pasos/`: biblioteca comun de audios.
- `assets/pasos/manifest.json`: lista generada de audios.
- `assets/pasos/features.json`: huellas precomputadas.
- `assets/pasos/calibration.json`: variables recomendadas de deteccion.
- `assets/pasos/metadata.json`: nombres, etiquetas y notas.
- `assets/icons/`: iconos de la app.
- `scripts/library_manifest.py`: genera manifest y features.
- `scripts/calibrate_detection.py`: genera calibracion e informe.
- `scripts/validate_detection.py`: simula escuchas con MP3 de la biblioteca y valida resultados.
- `scripts/analyze_capture.py`: analiza grabaciones reales de microfono o monitor contra la biblioteca.
- `scripts/serve_app.py`: servidor HTTP local con administracion.
- `scripts/serve_https.py`: servidor HTTPS local.
- `scripts/generate-dev-cert.sh`: certificado local para HTTPS.
- `tests/`: pruebas automaticas.
- `docs/DETECTION.md`: metodo de deteccion.
- `docs/CALIBRATION.md`: informe de calibracion.
- `docs/VALIDATION.md`: como simular y validar detecciones.
- `docs/AUDIT.md`: auditorias realizadas.
- `CHANGELOG.md`: historial de versiones.
- `ARCHITECTURE.md`: arquitectura y reglas de mantenimiento.

## Validacion

Ejecutar antes de subir cambios importantes:

```bash
node --check app.js
node --check sw.js
node --check audio-recorder-worklet.js
python3 -m py_compile scripts/library_manifest.py scripts/calibrate_detection.py scripts/analyze_capture.py scripts/serve_app.py scripts/serve_https.py tests/test_library_manifest.py tests/test_detection_calibration.py tests/run_tests.py
python3 scripts/calibrate_detection.py
python3 scripts/validate_detection.py --all --skip-regenerate
python3 tests/run_tests.py
```

Validar un toque aleatorio de la biblioteca:

```bash
python3 scripts/validate_detection.py
```

Validar un archivo concreto:

```bash
python3 scripts/validate_detection.py --file "Prendimiento - Gritos.mp3"
```

Validar toda la biblioteca:

```bash
python3 scripts/validate_detection.py --all
```

Hacer 5 ensayos aleatorios con fragmentos de 4 a 8 segundos:

```bash
python3 scripts/validate_detection.py --runs 5 --min-seconds 4 --max-seconds 8 --active-segments --require-usable
```

Validar el perfil recomendado para micro real:

```bash
python3 scripts/validate_detection.py --runs 400 --min-seconds 4 --max-seconds 12 --active-segments --require-usable --skip-regenerate --mode field
```

Esta prueba no usa el microfono. Toma un fragmento simulado de cada MP3, lo compara contra la biblioteca y comprueba que la mejor coincidencia sea el mismo archivo.

El validador distingue entre detecciones confirmadas, resultados ambiguos, resultados por debajo del umbral y confusiones reales. Un resultado ambiguo no se considera una deteccion segura: la app pide repetir la escucha. El ranking se ordena por la confianza final calculada, no solo por cercania bruta, para evitar que un candidato tecnicamente cercano pero menos fiable aparezca como principal.

Analizar grabaciones reales ya capturadas desde microfono o monitor:

```bash
python3 scripts/analyze_capture.py /tmp/cofrabeat-mic-tests/*.wav --mode field
```

Este comando sirve para pruebas de campo. Si el audio se grabo por microfono real, mostrara si la captura es usable, que tramo se ha elegido y que ranking obtiene.

La captura real se limpia de forma suave antes de analizarla: se centra la senal, se reduce ruido bajo entre golpes y se evita subir artificialmente volumen a ruido debil.

La comparacion usa la huella completa de cada toque y sus segmentos fuertes. Si dos toques quedan dentro del margen de ambiguedad, la app no confirma ninguno y pide repetir. El detalle del ranking muestra patron, ritmo, envolvente, intervalos, votos, penalizacion de micro y segmento usado.

Comprobacion rapida de CSS:

```bash
python3 -c "from pathlib import Path; css=Path('styles.css').read_text(); print(css.count('{'), css.count('}'), 'ok' if css.count('{') == css.count('}') else 'mismatch')"
```

## Publicacion En GitHub

Repositorio:

```text
https://github.com/jesusgascon/PSGANGORRIN
```

Release actual:

```text
v1.1.0
```

Crear una release nueva:

```bash
gh release create v1.0.1 --target main --title "CofraBeat v1.0.1" --notes "Notas de la version"
```

Ver releases:

```bash
gh release list
```

## Archivos Locales Que No Se Suben

El archivo `resume-codex.sh` es local y sirve para volver a una sesion concreta de Codex.

Esta ignorado por Git:

```text
resume-codex.sh
```

No debe subirse nunca a GitHub.

Tambien se ignoran:

- certificados locales
- `.env`
- entornos virtuales
- caches de Python
- logs y temporales

## Recuperar Sesion De Codex

Si existe `resume-codex.sh`, se puede ejecutar:

```bash
./resume-codex.sh
```

Ese script entra automaticamente en la carpeta del proyecto y ejecuta `codex resume` con el identificador de sesion guardado.

El identificador de sesion puede cambiar si se empieza una conversacion nueva.

## Limitaciones

La app esta pensada como detector ligero en navegador.

Limitaciones actuales:

- No es un modelo de IA entrenado.
- La precision depende mucho de la calidad de los audios de referencia.
- El microfono del movil, el ruido ambiente y la distancia al tambor afectan al resultado.
- En GitHub Pages no hay administracion real ni guardado global.
- Para bibliotecas muy grandes puede hacer falta optimizar o mover parte del analisis a servidor.

## Siguientes Mejoras Posibles

Orden recomendado por menor riesgo y mas utilidad practica:

1. Crear dataset propio con grabaciones reales desde movil y webcam.
2. Añadir un script unico de validacion de campo para grabar, analizar y resumir pruebas reales.
3. Afinar toques conflictivos o muy parecidos entre si usando ese dataset real.
4. Mejorar los mensajes UX de resultado ambiguo o no concluyente.

Otras mejoras futuras:

- Medir falsos positivos y falsos negativos con pruebas reales.
- Mejorar comparacion con MFCC, DTW o embeddings.
- Entrenar un modelo ligero con TensorFlow.js.
- Crear backend real con usuarios y administracion segura.
- Exportar e importar bibliotecas completas.
- Preparar instalacion PWA mas completa.

## Dataset Real De Capturas

El dataset real de campo debe generarse en tu equipo de casa, no en remoto. Tiene valor porque recoge:

- tu movil o webcam
- tu altavoz real
- tu sala real
- tu volumen real
- tu distancia real

Estructura:

```text
data/field-dataset/
data/field-dataset/captures/
data/field-dataset/manifest.json
```

Registrar una captura real ya grabada:

```bash
python3 scripts/register_field_capture.py /tmp/cofrabeat-mic-tests/02-dolor.wav \
  --expected-file "Prendimiento - Dolor de la Madre de Dios.mp3" \
  --source mic \
  --device "webcam-c920" \
  --notes "altavoz salon, 60 cm, volumen 85"
```

Analizar en bloque todo el dataset real:

```bash
python3 scripts/report_field_dataset.py --mode field
```

Este flujo sirve para guardar capturas buenas, ambiguas o fallidas y luego afinar el detector con datos reales de casa, no solo con simulacion.

## Licencia Y Uso

Proyecto creado para pruebas y desarrollo de una herramienta de Cofradias de Semana Santa. Revisar licencias de los audios antes de publicar o distribuir una biblioteca de toques.
