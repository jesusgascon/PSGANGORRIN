# Política De Seguridad

## Alcance

Este proyecto es una app web estática con scripts locales de administración y validación.

Las superficies más sensibles son:

- uso del micrófono en navegador
- servidor local de administración
- endpoints `/api/admin/*`
- ficheros locales de biblioteca y metadatos

## Recomendaciones

- No expongas el servidor local de administración a redes no confiables.
- Cambia `COFRABEAT_ADMIN_PASSWORD` si vas a usar la app fuera de un entorno privado.
- Usa HTTPS local si el navegador o el móvil bloquean el acceso al micrófono por HTTP.
- No compartas sin revisar los audios ni metadatos si incluyen material con derechos o datos sensibles.

## Reporte De Vulnerabilidades

Si encuentras una vulnerabilidad real:

1. No abras un issue público con detalles explotables.
2. Usa un canal privado razonable con el mantenedor del proyecto.
3. Incluye:
   - impacto
   - pasos de reproducción
   - versión o commit afectado
   - posible mitigación

## Lo Que No Se Considera Vulnerabilidad

- falsos positivos o ambigüedades normales del detector
- limitaciones de calidad del micrófono
- comportamiento esperado en GitHub Pages sin servidor local
