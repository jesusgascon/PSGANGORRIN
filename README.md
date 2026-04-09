# CofraBeat

Aplicacion web mobile-first para detectar toques de tambor de Semana Santa comparando lo que escucha el microfono contra una biblioteca comun de audios `mp3`.

## Estado Del Proyecto

Prototipo funcional preparado para uso local y pruebas en red Wi-Fi:

- modo usuario para escuchar, detectar y revisar resultados
- modo administracion protegido para mantener la biblioteca
- base comun de toques desde `assets/pasos`
- metadatos globales editables desde la app
- detector con rechazo de silencio, ruido y coincidencias no fiables
- interfaz visual cofrade optimizada para movil

## Funcionalidades

- Boton central para escuchar desde el microfono.
- Navegacion inferior tipo app nativa en modo usuario y administracion.
- Resultado visual con confianza y ranking solo cuando hay evidencia fiable.
- Historial local de detecciones.
- Ajustes de duracion de escucha, confianza minima y perfil de analisis.
- Panel de administracion para buscar, filtrar, etiquetar, renombrar y escuchar referencias.
- Carga manual persistente en el navegador mediante `IndexedDB`.
- Biblioteca comun global mediante archivos `mp3` en `assets/pasos`.
- Metadatos globales en `assets/pasos/metadata.json`.
- PWA basica con `manifest.webmanifest` y `sw.js`.
- Avisos integrados tipo app, sin `alert()` nativos.

## Estructura

- `index.html`: interfaz principal.
- `styles.css`: diseno visual y responsive.
- `app.js`: estado, UI, captura de audio, almacenamiento y detector.
- `audio-recorder-worklet.js`: captura de muestras con `AudioWorklet`.
- `manifest.webmanifest`: metadatos PWA.
- `sw.js`: cache PWA controlada.
- `assets/pasos/`: biblioteca comun de audios.
- `assets/pasos/manifest.json`: lista generada de referencias.
- `assets/pasos/features.json`: huellas precomputadas.
- `assets/pasos/calibration.json`: umbrales recomendados para esta biblioteca.
- `assets/pasos/metadata.json`: nombres, etiquetas y notas globales.
- `scripts/library_manifest.py`: generador de manifest y features.
- `scripts/calibrate_detection.py`: analizador de biblioteca y generador de calibracion.
- `scripts/serve_app.py`: servidor HTTP con API de administracion.
- `scripts/serve_https.py`: servidor HTTPS local para pruebas con microfono en movil.
- `tests/`: tests de generacion y saneamiento de biblioteca.
- `docs/DETECTION.md`: detalle del metodo de deteccion.
- `docs/AUDIT.md`: auditoria funcional, visual y de mantenimiento.
- `ARCHITECTURE.md`: arquitectura y reglas de mantenimiento.

## Ejecutar En Local

```bash
python3 ./scripts/serve_app.py --host 0.0.0.0 --port 8000
```

Abre en este ordenador:

```text
http://localhost:8000
```

Abre desde un movil en la misma Wi-Fi:

```text
http://IP-DE-TU-ORDENADOR:8000
```

`localhost` y `127.0.0.1` solo sirven dentro del ordenador que ejecuta el servidor.

## Administracion

El modo administracion se valida en el servidor local. La clave por defecto es:

```text
psangorrin
```

Para cambiarla sin tocar codigo:

```bash
COFRABEAT_ADMIN_PASSWORD="otra-clave" python3 ./scripts/serve_app.py --host 0.0.0.0 --port 8000
```

### GitHub Pages

En GitHub Pages no hay backend Python ni endpoints `/api/admin/*`. Por eso la app permite abrir la seccion de administracion como demo publica, sin pedir contrasena.

En esa version:

- se puede ver la zona admin
- se pueden probar filtros, fichas y organizacion
- los cambios se guardan solo en el navegador del visitante
- no se modifica `assets/pasos/metadata.json`
- no se regenera `manifest.json` ni `features.json`

Para administracion real y guardado global, usa `scripts/serve_app.py` en local o en un servidor propio.

## Biblioteca De Toques

### Base Comun

Coloca los `mp3` en:

```text
assets/pasos/
```

Al arrancar `scripts/serve_app.py`, el servidor regenera:

- `assets/pasos/manifest.json`
- `assets/pasos/features.json`
- `assets/pasos/calibration.json`

Si `ffmpeg` esta instalado, las huellas se calculan en servidor. Si no esta disponible, la app mantiene fallback en navegador.

### Calibracion De Deteccion

Para que la app ajuste sus variables a los audios reales de tu biblioteca:

```bash
python3 scripts/calibrate_detection.py
```

Ese script analiza `assets/pasos/features.json` y genera:

- `assets/pasos/calibration.json`
- `docs/CALIBRATION.md`

Al abrir la app por HTTP/HTTPS, CofraBeat carga `calibration.json` automaticamente y usa esos umbrales en la deteccion.

### Cargas Locales

Los `mp3` subidos desde la interfaz se guardan en `IndexedDB` del navegador. Sirven para ese dispositivo, pero no se comparten con otros usuarios.

## Detector

El detector actual usa:

- energia RMS y pico maximo
- envolvente de energia
- fuerza de onset
- picos ritmicos
- fingerprints por intervalos entre golpes
- comparacion por subsecuencia
- votos de fingerprints alineados
- filtro de calidad de captura
- filtro de evidencia de coincidencia

Si la captura es ruido, silencio o no contiene suficiente patron de tambor, la app devuelve `Sin toque detectable` o `Sin deteccion fiable` y no muestra candidatos.

## Validacion

```bash
node --check app.js
node --check sw.js
node --check audio-recorder-worklet.js
python3 -m py_compile scripts/library_manifest.py scripts/calibrate_detection.py scripts/serve_app.py scripts/serve_https.py tests/test_library_manifest.py tests/test_detection_calibration.py tests/run_tests.py
python3 scripts/calibrate_detection.py
python3 tests/run_tests.py
```

Comprobacion CSS:

```bash
python3 -c "from pathlib import Path; css=Path('styles.css').read_text(); print(css.count('{'), css.count('}'), 'ok' if css.count('{') == css.count('}') else 'mismatch')"
```

## HTTPS Para Movil

Algunos navegadores moviles bloquean el microfono por HTTP cuando no es `localhost`. Para probar desde movil con HTTPS:

```bash
chmod +x ./scripts/generate-dev-cert.sh
./scripts/generate-dev-cert.sh IP-DE-TU-ORDENADOR
python3 ./scripts/serve_https.py --host 0.0.0.0 --port 8443
```

Luego abre:

```text
https://IP-DE-TU-ORDENADOR:8443
```

## GitHub

El proyecto incluye los `mp3` porque forman parte de la biblioteca comun. El tamano actual es razonable para GitHub. Si la biblioteca crece mucho, usar Git LFS.

Primer commit:

```bash
git init
git add .
git commit -m "Initial CofraBeat project"
```

Crear repositorio privado y subir:

```bash
gh auth login
gh repo create PSGANGORRIN --private --source=. --remote=origin --push
```

Si el repositorio ya existe:

```bash
git remote add origin git@github.com:TU-USUARIO/PSGANGORRIN.git
git branch -M main
git push -u origin main
```

## Limitaciones

No es un modelo de IA entrenado ni una implementacion completa de Shazam. Es un detector ritmico/fingerprint ligero que corre en navegador.

Para una precision superior en procesiones reales, el siguiente paso seria:

- crear un dataset propio con grabaciones reales de movil
- medir falsos positivos y falsos negativos
- usar MFCC, embeddings o DTW
- entrenar un modelo con TensorFlow.js o mover el analisis a servidor
