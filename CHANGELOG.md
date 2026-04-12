# Changelog

## En desarrollo

- Pulido responsive de overlays y navegacion rapida:
  - acceso directo a `Historial` en la barra inferior de usuario
  - overlays mas compactos en pantallas bajas
  - mejora de `safe-area` superior en el banner local
  - limpieza de `z-index` y estados visuales globales
- Ajustes visuales del arranque y del analisis posterior a la escucha:
  - progreso inicial coherente hasta `100%`
  - bloqueo real de la interfaz durante la escucha
  - overlay visual de analisis al terminar la grabacion
- Mejoras de flujo para el usuario:
  - `Escuchar otra vez` desde el resultado
  - accion rapida para ampliar la escucha actual `+10 s` hasta `30 s`
  - historial local con filtros por estado, periodo y texto
  - guardado de estados `Confirmado`, `Probable`, `Ambiguo` y `No fiable`
- Tiempo de escucha ampliado hasta `30 s` con contador visual de transcurrido y restante.
- Documentacion consolidada y licencia MIT explicita.

## v1.1.0

Base estable del detector `field`.

Incluye:

- biblioteca `schemaVersion 5`
- landmarks espectrales ligeros
- agregacion multi-variante por referencia
- ranking coherente entre app web y scripts CLI
- estado `Probable` y `Probable ambiguo`
- dataset de campo sin fallos reales en la tanda consolidada:
  - `20 OK confirmadas`
  - `3 OK no confirmadas`
  - `1 Ambigua`
  - `0 Fallos reales`

Tambien incluye:

- validacion simulada y analisis de capturas reales
- scripts para registrar y resumir dataset de campo
- mejoras de UX en overlays, carga inicial y responsive movil
- test de generacion de biblioteca aislado para no ensuciar ficheros versionados

## v1.0.0

Primera version funcional del proyecto.

Incluye:

- app web mobile-first para detectar toques de tambor
- modo usuario con escucha, resultado, historial y ajustes
- modo administracion para mantener la biblioteca comun
- biblioteca comun de audios en `assets/pasos`
- servidor local HTTP y HTTPS
- generacion de `manifest.json`, `features.json` y `calibration.json`
