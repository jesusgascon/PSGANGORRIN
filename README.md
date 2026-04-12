# CofraBeat

Aplicacion web mobile-first para detectar toques de tambor de Semana Santa a partir del microfono del movil u ordenador. CofraBeat compara una escucha corta contra una biblioteca comun de audios `mp3`, muestra el mejor candidato y evita confirmar coincidencias debiles cuando la evidencia no es suficiente.

## Estado Del Proyecto

Estado actual: estable para el flujo real de `Micro real` con la biblioteca incluida en el repositorio.

Resumen de la ultima validacion de campo consolidada:

- `20` capturas `OK confirmadas`
- `3` capturas `OK no confirmadas`
- `1` captura `Ambigua`
- `0` fallos reales

El detector actual usa:

- biblioteca `schemaVersion 5`
- fingerprints ritmicos y landmarks espectrales ligeros
- comparacion por varias variantes y segmentos fuertes por referencia
- ranking coherente entre app web, validacion CLI y analisis de capturas reales
- estados intermedios `Probable` y `Probable ambiguo` para no forzar falsos positivos

Los tres toques que siguen siendo el foco de afinado fino son:

- `La Corona`
- `Yenka`
- `Lenta que no es lenta`

## Que Hace

- escucha un toque desde el microfono
- detecta si la captura es usable o no
- compara la señal contra una biblioteca comun
- muestra un resultado confirmado, probable, ambiguo o no fiable
- guarda historial local de escuchas con filtros por estado, fecha y búsqueda
- permite administrar la biblioteca comun en modo local con servidor Python
- funciona como demo estatica en GitHub Pages

No es un clon de Shazam ni un modelo entrenado. Es un detector ligero de ritmo, envolvente, fingerprints y landmarks espectrales pensado para navegador.

## Modos De Uso

### Usuario

- escuchar un toque
- ver resultado y ranking
- repetir una escucha o ampliarla `+10 s` desde el propio resultado
- revisar historial con filtros por estado, periodo y búsqueda
- ajustar modo de deteccion y tiempo de escucha

### Administracion

- revisar la biblioteca comun
- editar nombre visible, etiquetas y notas
- buscar y filtrar referencias
- escuchar previas
- mantener metadatos y analizar el estado de la biblioteca

## Arranque Rapido

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

Si el movil no concede microfono por HTTP, usa HTTPS local:

```bash
chmod +x ./scripts/generate-dev-cert.sh
./scripts/generate-dev-cert.sh IP-DE-TU-ORDENADOR
python3 ./scripts/serve_https.py --host 0.0.0.0 --port 8443
```

## Requisitos

Minimos:

- Python 3
- navegador moderno con Web Audio API
- permiso de microfono

Recomendados:

- `ffmpeg` para generar huellas y metadatos de audio
- `gh` si quieres publicar o automatizar trabajo con GitHub desde terminal

Comprobar `ffmpeg`:

```bash
ffmpeg -version
```

## Biblioteca Comun

La biblioteca versionada vive en:

```text
assets/pasos/
```

Archivos relevantes:

- `manifest.json`: lista comun de audios
- `features.json`: huellas y segmentos precalculados
- `calibration.json`: umbrales recomendados para la biblioteca actual
- `metadata.json`: nombres visibles, etiquetas y notas

### Biblioteca Comun Vs Cargas Locales

Biblioteca comun:

- archivos dentro de `assets/pasos`
- visible para cualquier usuario que abra la app
- versionable en Git

Cargas locales:

- se guardan en `IndexedDB`
- solo existen en ese navegador
- no modifican la biblioteca comun

## GitHub Pages Vs Servidor Local

### GitHub Pages

Modo demo estatico:

- sin Python ni endpoints `/api/admin/*`
- la administracion se puede abrir, pero no guarda cambios globales
- los cambios solo se quedan en el navegador local

### Servidor Local

Modo completo:

- administracion real
- guardado global de metadatos
- regeneracion de `manifest.json`, `features.json` y `calibration.json`

Clave admin por defecto en local:

```text
psangorrin
```

Cambiar la clave:

```bash
COFRABEAT_ADMIN_PASSWORD="otra-clave" python3 ./scripts/serve_app.py --host 0.0.0.0 --port 8000
```

## Experiencia De Uso

La app está pensada para móvil y escritorio con el mismo flujo:

- overlay visual durante la carga inicial de biblioteca y calibración
- bloqueo de la interfaz durante la escucha, dejando solo `Parar`
- overlay visual de análisis mientras se calcula el resultado
- resultado con acciones rápidas:
  - `Compartir`
  - `Escuchar otra vez`
  - `Escuchar X s` para ampliar la toma actual
- historial local filtrable para revisar detecciones dudosas o repetidas

## Validacion Y Dataset Real

Validacion simulada:

```bash
python3 scripts/validate_detection.py --all
```

Analisis de capturas reales:

```bash
python3 scripts/analyze_capture.py /tmp/cofrabeat-mic-tests/*.wav --mode field
```

Registro en dataset de campo:

```bash
python3 scripts/register_field_capture.py /tmp/cofrabeat-mic-tests/mi-captura.wav \
  --expected-file "Prendimiento - Yenka.mp3" \
  --source mic \
  --device "webcam-c920" \
  --notes "prueba real"
```

Resumen del dataset de campo:

```bash
python3 scripts/report_field_dataset.py --mode field
```

## Flujo Recomendado De Trabajo

1. Colocar o actualizar `mp3` en `assets/pasos/`
2. Arrancar el servidor local
3. Dejar que la biblioteca se regenere si hay cambios
4. Probar validacion simulada
5. Hacer pruebas con `Micro real`
6. Registrar capturas reales si quieres medir el detector en campo
7. Revisar el resumen del dataset antes de tocar umbrales o pesos

## Estructura Del Repositorio

- [index.html](/home/jesus/Documentos/Codex/PSGANGORRIN/index.html): estructura principal de la app
- [styles.css](/home/jesus/Documentos/Codex/PSGANGORRIN/styles.css): sistema visual, responsive y overlays
- [app.js](/home/jesus/Documentos/Codex/PSGANGORRIN/app.js): logica principal de UI, captura y deteccion
- [audio-recorder-worklet.js](/home/jesus/Documentos/Codex/PSGANGORRIN/audio-recorder-worklet.js): captura de audio de baja latencia
- [scripts/library_manifest.py](/home/jesus/Documentos/Codex/PSGANGORRIN/scripts/library_manifest.py): generacion de manifest y features
- [scripts/calibrate_detection.py](/home/jesus/Documentos/Codex/PSGANGORRIN/scripts/calibrate_detection.py): calibracion de umbrales
- [scripts/validate_detection.py](/home/jesus/Documentos/Codex/PSGANGORRIN/scripts/validate_detection.py): validacion simulada
- [scripts/analyze_capture.py](/home/jesus/Documentos/Codex/PSGANGORRIN/scripts/analyze_capture.py): analisis de capturas reales
- [scripts/register_field_capture.py](/home/jesus/Documentos/Codex/PSGANGORRIN/scripts/register_field_capture.py): registro del dataset de campo
- [scripts/report_field_dataset.py](/home/jesus/Documentos/Codex/PSGANGORRIN/scripts/report_field_dataset.py): resumen del dataset real

## Documentacion Relacionada

- [ARCHITECTURE.md](/home/jesus/Documentos/Codex/PSGANGORRIN/ARCHITECTURE.md)
- [CHANGELOG.md](/home/jesus/Documentos/Codex/PSGANGORRIN/CHANGELOG.md)
- [docs/DETECTION.md](/home/jesus/Documentos/Codex/PSGANGORRIN/docs/DETECTION.md)
- [docs/VALIDATION.md](/home/jesus/Documentos/Codex/PSGANGORRIN/docs/VALIDATION.md)
- [docs/CALIBRATION.md](/home/jesus/Documentos/Codex/PSGANGORRIN/docs/CALIBRATION.md)
- [docs/AUDIT.md](/home/jesus/Documentos/Codex/PSGANGORRIN/docs/AUDIT.md)

## Licencia

Este proyecto se distribuye bajo licencia MIT. Consulta [LICENSE](/home/jesus/Documentos/Codex/PSGANGORRIN/LICENSE).

Nota importante:

- la licencia del codigo no implica derechos sobre los audios de `assets/pasos`
- antes de redistribuir o publicar la biblioteca de audios, confirma permisos y autoria de cada archivo
