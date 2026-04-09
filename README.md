# CofraBeat

Aplicacion web mobile-first para detectar toques de tambor de Semana Santa. La app escucha por el microfono, analiza el ritmo grabado y lo compara contra una biblioteca comun de audios `mp3`.

Version actual: `v1.0.0`

Release: <https://github.com/jesusgascon/PSGANGORRIN/releases/tag/v1.0.0>

## Que Es

CofraBeat es una herramienta para Cofradias y proyectos de Semana Santa que permite:

- Escuchar un toque de tambor desde el microfono del movil o del ordenador.
- Compararlo con una base de datos de toques ya cargados.
- Mostrar si hay una deteccion fiable.
- Consultar un ranking de coincidencias cuando la evidencia es suficiente.
- Mantener una biblioteca comun de audios de referencia.
- Administrar nombres visibles, etiquetas, notas y metadatos de cada toque.

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

La app no acepta automaticamente la referencia mas parecida. Primero exige evidencia minima. Esto evita falsos positivos con silencio, ruido o golpes sueltos.

Resultados esperados:

- Silencio: sin toque detectable.
- Ruido: sin deteccion fiable.
- Golpes aislados: normalmente sin deteccion fiable.
- Toque real claro: deteccion si supera el umbral.
- Toque real con mucho ruido: mejor no detectar antes que inventar una coincidencia.

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
- `scripts/serve_app.py`: servidor HTTP local con administracion.
- `scripts/serve_https.py`: servidor HTTPS local.
- `scripts/generate-dev-cert.sh`: certificado local para HTTPS.
- `tests/`: pruebas automaticas.
- `docs/DETECTION.md`: metodo de deteccion.
- `docs/CALIBRATION.md`: informe de calibracion.
- `docs/AUDIT.md`: auditorias realizadas.
- `ARCHITECTURE.md`: arquitectura y reglas de mantenimiento.

## Validacion

Ejecutar antes de subir cambios importantes:

```bash
node --check app.js
node --check sw.js
node --check audio-recorder-worklet.js
python3 -m py_compile scripts/library_manifest.py scripts/calibrate_detection.py scripts/serve_app.py scripts/serve_https.py tests/test_library_manifest.py tests/test_detection_calibration.py tests/run_tests.py
python3 scripts/calibrate_detection.py
python3 tests/run_tests.py
```

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
v1.0.0
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

- Crear dataset propio con grabaciones reales desde movil.
- Medir falsos positivos y falsos negativos con pruebas reales.
- Mejorar comparacion con MFCC, DTW o embeddings.
- Entrenar un modelo ligero con TensorFlow.js.
- Crear backend real con usuarios y administracion segura.
- Exportar e importar bibliotecas completas.
- Preparar instalacion PWA mas completa.

## Licencia Y Uso

Proyecto creado para pruebas y desarrollo de una herramienta de Cofradias de Semana Santa. Revisar licencias de los audios antes de publicar o distribuir una biblioteca de toques.
