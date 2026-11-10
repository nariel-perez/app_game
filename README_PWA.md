# 📲 Fisicoquímica RPG: Versión PWA Instalable (`app_game`)

Esta carpeta contiene la versión **Progressive Web App (PWA)** encaminada para cuando decidas publicar la suite completa como aplicación instalable en celulares (Android / iOS) y computadoras, con funcionamiento **100% offline**.

## 📁 Archivos adicionales que la convierten en App (`Camino B`)
* **`manifest.json`**: Define el nombre de la aplicación (`Lab RPG`), el modo pantalla completa sin barras de navegador (`"display": "standalone"`), el bloqueo automático en horizontal (`"orientation": "landscape"`) y el ícono vectorial (`icons/icon.svg`).
* **`sw.js` (Service Worker)**: Guarda en la memoria caché del teléfono todos los archivos `.html`, `.css` y `.js`. Así, una vez abierta por primera vez, los estudiantes pueden usarla dentro del laboratorio aunque no tengan señal o Wi-Fi.
* **`js/pwa.js`**: Registra el Service Worker, intenta bloquear la pantalla en modo horizontal al abrir la app instalada y habilita el botón **`📲 Instalar App`** en la barra superior cuando el navegador detecta que se puede instalar.

## 🚀 ¿Cómo actualizarla cuando sumes más Trabajos Prácticos?
1. Cuando agregues un nuevo módulo JS (por ejemplo, `js/conductimetria_module.js`), sumá su ruta a la lista `ASSETS_TO_CACHE` dentro de `sw.js`.
2. Cambiá el número de versión en `sw.js` (por ejemplo, de `'lab-rpg-cache-v1'` a `'lab-rpg-cache-v2'`) para que los teléfonos de los estudiantes descarguen automáticamente la nueva versión al conectarse.
