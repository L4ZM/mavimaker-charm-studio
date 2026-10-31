# MaviMaker Charm Studio 0.5

Editor local PNG/SVG → 3MF multicomponente. Los archivos se procesan en el navegador.

## Geometría real

La página carga `converter.js`, `vendor/earcut.js` y `contours.js` antes de iniciar el ejemplo. Tanto vista 3D como STL y 3MF utilizan los mismos polígonos vectoriales, no cubos por píxel. Los límites de colores vecinos comparten puntos: el suavizado no abre separaciones entre materiales.

- Trazado de anillos exteriores y agujeros; triangulación Earcut y extrusión con tapas y paredes orientadas. Corrección de orejas colineales para evitar caras de área cero y conservar aristas cerradas después de redondear las coordenadas exportadas.
- Suavizado limitado a 0.08 mm de desplazamiento por punto (y a 1.25 píxeles), con detección de cruces y reducción automática. Las uniones entre tres materiales permanecen fijas.
- Alto ocupado de 40 mm por defecto, tras recortar márgenes transparentes y normalizar el contorno. Resolución recomendada: 512 px, aproximadamente 0.078 mm por muestra a 40 mm.
- Se conservan las islas pequeñas: no se borran por área ni por filtro de mayoría. Los contactos diagonales ambiguos se resuelven localmente; pueden cambiar un píxel en esas uniones.
- Base continua de 2 mm con huecos interiores rellenos. Clásico: todos los colores parten de la base con relieve de 0.6 mm. Escalonado: relieves iniciales 0.6, 0.8, 1.0… mm. Cada región es sólida desde la superficie de la base hasta su altura final, sin cavidades inferiores. Alturas editables.
- 3MF Core: un ensamblaje con una pieza por color más la base, posiciones comunes y materiales. No incluye perfiles privados de impresora. Importar como un objeto con varias piezas y asignar filamentos en el laminador.
- Guardado JSON v2, con modo de construcción; recuperación de proyectos clásicos v1 añadiendo la base explícita.

La paleta fija de cinco colores solo se aplica al ejemplo incluido de Jesús para conservar la cruz y agrupar sombras del cabello. Las imágenes cargadas usan cuantización automática.

## Verificación reproducible

Instala las dependencias de `package.json`; ejecuta `npm test` y `npm run test:browser` (Chrome instalado). `MAVIMAKER_TEST_MODULES` permite usar módulos existentes y `MAVIMAKER_OUTPUT_DIR` cambia la carpeta de resultados.

Se comprobaron el PNG incluido, los modos Clásico y Escalonado, dimensiones, base conectada, aristas con dos caras de orientación opuesta, volumen positivo y ausencia de caras degeneradas. Se reabrió el ZIP/XML del 3MF y se verificaron sus mallas serializadas. Casos adicionales: agujeros múltiples, islas, trazo estrecho, ojo de un píxel y contactos diagonales. La prueba en Chrome verifica el botón de exportación capturando su Blob, controles, ambos modos, recuperación JSON y vista móvil, sin errores de JavaScript.

`examples/` contiene archivos de ambos modos y reportes. El Chrome automático de esta sesión canceló la descarga nativa de `.3mf`; el Blob generado por el botón sí se recuperó y verificó. La importación en FlashForge Studio y la impresión física no se han comprobado.

## Límites físicos y de entrada

Con boquilla de 0.4 mm, conservar un detalle en la malla no garantiza que el laminador genere una línea imprimible. Revisar especialmente trazos menores a 0.4 mm; alrededor de 0.8 mm ofrece más margen para dos líneas. El suavizado no reconstruye información ausente en un PNG de baja resolución, y SVG también se rasteriza antes del trazado. Sombras y antialias pueden generar pequeñas islas; se conservan para evitar perder ojos y boca. Usar colores planos y transparencia.

El PNG incluido muestra a Jesús sin ovejita. La captura aportada muestra otro diseño: no se dispone de su PNG original, por lo que no se ha validado ese dibujo exacto. Se necesitan el original y una revisión de capas del laminador para confirmar ojos, boca y ovejita en impresión. Imágenes con elementos separados pueden producir bases separadas; no se añaden puentes automáticamente.

La AD5X tiene cuatro canales; el ejemplo de cinco colores requiere combinar materiales o planificar cambios manuales.

Earcut 2.2.4 de Mapbox usa licencia ISC, incluida en `vendor/earcut.LICENSE`. No se incluyen código ni perfiles propietarios de otros editores.
