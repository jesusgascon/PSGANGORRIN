# Changelog

## En desarrollo

- Ajuste visual de la barra inferior del modo usuario en movil para evitar botones cortados o desalineados.
- El boton Escuchar de la barra inferior queda alineado tambien al terminar la escucha.
- Cache publica actualizada para que GitHub Pages entregue estilos nuevos tambien bajo la ruta `/PSGANGORRIN/`.

## v1.1.0

Version de cierre de la primera fase funcional.

Incluye:

- Documentacion ampliada del proyecto en `README.md`.
- Guia de validacion en `docs/VALIDATION.md`.
- Script `scripts/validate_detection.py` para simular escuchas sin microfono.
- Ensayos repetidos con fragmentos aleatorios y duracion variable.
- Modo de ensayo con fragmentos activos y capturas usables.
- Calibracion ajustada para ventanas reales de escucha.
- Parada automatica de previas de audio al salir de administracion o cambiar de panel.

Resultado de validacion destacado:

```text
40 ensayos simulados
40 correctos
0 fallos
```

## v1.0.0

Primera version publica de CofraBeat.

Incluye:

- App web mobile-first para detectar toques de tambor de Semana Santa.
- Modo usuario con escucha, resultados, historial y ajustes.
- Modo administracion para gestionar la biblioteca de toques.
- Biblioteca comun de audios en `assets/pasos`.
- Metadatos globales, etiquetas y nombres visibles.
- Calibracion automatica de deteccion segun los audios cargados.
- Servidor local HTTP/HTTPS para pruebas en movil y red local.
- Documentacion tecnica y validaciones basicas.
