# MaviMaker Charm Studio — v0.1

Editor web de charms multicolor, orientado a FlashForge AD5X y boquilla de 0.4 mm.

## Funciones
- Importación de PNG con transparencia y SVG (rasterizado en el navegador).
- Cuantización automática de colores y edición de colores y alturas.
- Vista 2D y 3D interactiva.
- Exportación de 3MF con objetos separados por color y STL individuales.
- Guardado y recuperación de proyecto JSON.
- Tamaño inicial de 40 mm.

## Uso
Abre `index.html` en el navegador con acceso a internet para cargar Three.js y JSZip desde CDN. También funciona publicado en GitHub Pages.

## Publicar en GitHub Pages
1. Crea un repositorio público `mavimaker-charm-studio`.
2. Sube `index.html` y `README.md` a la rama principal.
3. En Settings → Pages selecciona Deploy from a branch, `main`, carpeta `/ (root)`.
4. Espera la URL de GitHub Pages.

## Limitaciones de v0.1
- La geometría se crea desde píxeles cuantizados; los contornos pueden quedar escalonados.
- El 3MF contiene cuerpos separados, pero la asignación de filamento se hace en el laminador.
- Las capas de detalle son objetos independientes y pueden necesitar ajuste en el laminador para asegurar unión física con la base.
- No crea aún una base continua bajo todo el diseño, perforaciones de argolla, limpieza morfológica ni un 3MF con perfiles específicos de FlashForge.
- SVG se rasteriza y no se preservan sus curvas vectoriales.
- Modelos complejos y resolución alta pueden consumir bastante memoria.
- Validar siempre el resultado en FlashForge Studio antes de imprimir.