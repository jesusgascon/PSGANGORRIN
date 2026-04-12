# Soporte

## Antes De Pedir Ayuda

Comprueba primero:

- que estás en la última versión de `main`
- que el navegador tiene permiso de micrófono
- que no estás usando HTTP si el navegador exige HTTPS para capturar audio
- que has recargado la app tras actualizar

## Qué Información Incluir

Si necesitas ayuda, intenta aportar:

- commit o versión
- plataforma y navegador
- móvil o desktop
- perfil de detección activo
- tiempo de escucha usado
- si el problema ocurre en usuario, admin o ambos
- captura, vídeo o salida de script si aplica

## Problemas Frecuentes

### El micrófono no funciona

- revisa permisos del navegador
- prueba HTTPS local
- revisa la tarjeta de estado del micrófono en la app

### El admin no guarda cambios

- en GitHub Pages no hay persistencia global
- para administración real usa `scripts/serve_app.py` o `scripts/serve_https.py`

### El detector duda demasiado

- prueba otra escucha
- amplía la captura `+10 s`
- revisa el historial filtrando por estados dudosos

## Canales

- Bugs y mejoras: issues del repositorio
- Cambios concretos: pull requests
- Uso y contexto: documentación del proyecto y `README.md`
