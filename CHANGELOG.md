# Changelog

## En desarrollo

- Ajuste visual de la barra inferior del modo usuario en movil para evitar botones cortados o desalineados.
- El boton Escuchar de la barra inferior queda alineado tambien al terminar la escucha.
- Cache publica actualizada para que GitHub Pages entregue estilos nuevos tambien bajo la ruta `/PSGANGORRIN/`.
- Deteccion mas prudente: si dos toques quedan demasiado cerca, se muestra resultado ambiguo en vez de confirmar uno.
- Perfil `Micro real` para pruebas con altavoz y microfono, escucha por defecto de 8 segundos y titulo principal mas compacto en movil.
- Perfil `Micro real` reforzado: escucha por defecto de 10 segundos, umbral visible mas realista, ranking ordenado por confianza final y avisos de senal baja, saturacion o captura ambigua.
- Analisis por tramos activos dentro de la captura para mejorar escuchas reales con silencio, eco o ruido de sala.
- Nuevo script `scripts/analyze_capture.py` para analizar WAV/MP3 reales grabados con microfono o monitor del sistema.
- Preprocesado suave de capturas reales: centrado DC y puerta de ruido ligera sin amplificar ruido debil.
- Huellas por segmentos fuertes de cada MP3 para comparar capturas reales contra la parte mas representativa de cada toque.
- Ambiguedad mas estricta: si otro toque queda justo en el margen de seguridad, la app pide repetir en vez de confirmar.
- Perfil `Micro real` menos dependiente de fingerprints exactos y mas apoyado en patron, envolvente e intervalos.
- `scripts/analyze_capture.py` muestra detalle de patron, ritmo, envolvente, intervalos, penalizacion de micro y segmento usado.
- Perfil `Micro real` refinado: la evidencia, seleccion de segmentos y confirmacion final priorizan patron ritmico, envolvente e intervalos; las coincidencias medias quedan como ambiguas o no fiables antes que confirmar un toque incorrecto.
- Biblioteca refinada con segmentos distintivos por toque y segunda huella espectral ligera; en `Micro real` se usa mas patron+timbre y menos voto bruto de fingerprint.

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
