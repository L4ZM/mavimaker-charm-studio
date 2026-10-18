# MaviMaker Charm Studio 0.2

Conversor local PNG/SVG → 3MF. Abre el sitio, carga una imagen y pulsa **Procesar imagen** y **Exportar 3MF**. El ejemplo inicial es el PNG original de Jesús. Los archivos no se suben a un servidor.

## Geometría y color

- Recorta márgenes transparentes; el alto ocupado es 40 mm por defecto.
- Cinco colores semánticos: negro, café rojizo, piel, blanco y rojo. Esta opción usa una paleta fija para conservar la cruz roja y no dividir el sombreado del cabello; otros tamaños de paleta usan cuantización automática.
- Muestreo determinista a 256 píxeles de alto (0.15625 mm por celda a 40 mm), filtro mayoritario y resolución de contactos diagonales. El contorno sigue siendo rasterizado, no una curva vectorial.
- Base negra continua de 2 mm, rellenando huecos interiores de la silueta. Sobre ella se colocan cinco máscaras disjuntas, todas de 0.6 mm. Alto total: 2.6 mm.
- Mallas con vértices compartidos, caras orientadas y paredes solamente en los límites. Un recurso de materiales y un solo ensamblaje 3MF con seis componentes (base + cinco colores).
- Exportación STL y guardado/recuperación JSON. El color visual de cada pieza y su altura son editables.

## FlashForge AD5X

Importa el 3MF como **un objeto con varias piezas**, conservando su posición relativa. Selecciona AD5X, boquilla 0.4 mm y asigna filamentos por pieza. Se exporta geometría 3MF Core con materiales; no incluye perfiles de impresora, G-code ni metadatos privados de FlashForge/Bambu.

La AD5X tiene cuatro canales de filamento. El diseño de cinco colores requiere fusionar dos colores o planificar cambios manuales. Revisa detalles menores a 0.4 mm y la unión de las piezas en la previsualización de capas. Algunos laminadores pueden requerir reasignar los colores por pieza.

## Resultados y verificación

En `examples/`: 3MF de Jesús de 40 mm, vista de colores y reporte de geometría. Se verificaron todas las aristas con exactamente dos caras de orientación opuesta, volúmenes positivos, dimensiones y estructura ZIP/XML. La prueba visual de interfaz y la importación en FlashForge Studio **no se completaron** en esta sesión.

El archivo `Advance Charm Maker.3mf` aportado se inspeccionó como referencia de un ensamblaje multicomponente. No se copió código, geometría ni perfiles propietarios de Nzzleworks.

## Desarrollo

Sitio estático, sin compilación. Sirve esta carpeta por HTTP para cargar el PNG del ejemplo. Three.js y JSZip se cargan desde CDN y requieren conexión.

Instala las dependencias y ejecuta `npm test`. Para probar la interfaz con Chrome instalado: `npm run test:browser`. Opcionalmente `MAVIMAKER_TEST_MODULES` apunta a una carpeta de módulos existente y `MAVIMAKER_OUTPUT_DIR` cambia la carpeta de resultados. Las pruebas generan archivos en `test-results/` por defecto.
