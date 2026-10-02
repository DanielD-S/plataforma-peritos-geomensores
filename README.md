# Plataforma Peritos Geomensores

Herramientas para peritos mensuradores de concesiones mineras en Chile. Este repositorio
parte con el **prototipo de la etapa 1**: generar los siete shapefiles y los cinco ZIP que exige
la *Guía para la presentación de archivos Shapefile* de Sernageomin (enero 2026) a partir de
los datos de una mensura, sin pasar por QGIS ni ArcGIS.

## Qué hace hoy

- **Cartera de concesiones** guardada en el navegador: varias concesiones, duplicar, eliminar, y exportar e importar
  toda la cartera en JSON para respaldo o traspaso entre equipos.
- Ingreso de la concesión: nombre, rol, sistema de coordenadas oficial (PSAD56 / SAD69, husos 18 y 19),
  fechas de manifestación, solicitud de mensura y mensura.
- Manifestación como rectángulo centrado en el punto de interés; solicitud de mensura y mensura con perímetro
  propio (admite formas en L o cualquier polígono rectilíneo).
- **Edición de vértices sobre el mapa**: arrastrar linderos con ajuste a paso (1, 10, 50 o 100 m), insertar
  vértices en la mitad de un lado y quitarlos con clic derecho.
- **Importar shapefile (ZIP o .shp), KML o KMZ** como manifestación, solicitud o mensura, y puntos como hito,
  amarre o auxiliar. Si el archivo trae `.prj` en el EPSG de destino las coordenadas se conservan exactas; si viene
  en otro sistema se reproyecta y se advierte que es referencial.
- **Referencia geodésica**: hito de mensura, punto de amarre y puntos auxiliares con elevación; cuadro de vértices
  geodésicos, relación del hito con el amarre y ligazón del amarre a los linderos.
- **Revisión** antes de descargar: datos faltantes, fechas fuera de orden, rol mal formado, coordenadas fuera del
  huso o de Chile, lados que no son múltiplos de la pertenencia, zonas sin pertenencias, mensura fuera de la
  solicitud y solicitud fuera de la manifestación.
- Grilla de pertenencias con la convención de las actas: linderos `L-1..L-n` desde el NW en sentido horario,
  vértices interiores numerados desde `n+1` por filas de norte a sur, y cada pertenencia con sus vértices NW-NE-SE-SW.
- Cuadros calculados: vértices, individualización de pertenencias, descripción del perímetro y relación azimut
  (grados centesimales) y distancia desde el hito de mensura a cada lindero.
- Previsualización en mapa satelital con el **catastro SERNAGEOMIN** en vivo (mismo servicio ArcGIS que usa Pudumaps;
  exploración en azul, explotación en naranja, en trámite punteado).
- **Vecinas y superposiciones**: consulta el catastro con el perímetro de la mensura y clasifica cada concesión como
  *abarca* (con el área de superposición), *colinda* (con el lado: norte, sur, este u oeste) o *cercana* (con la distancia).
  Es la base de las secciones "Pertenencias vecinas" y "Abarcamiento" del acta.
- Descarga de `Manifestacion.zip`, `Solicitud_mensura.zip`, `Mensura.zip`, `Pertenencias.zip` y `Hito_de_mensura.zip`,
  cada uno con `.shp`, `.shx`, `.dbf`, `.prj` y `.cpg`.

- **Textos del acta** redactados automáticamente con la estructura de las actas (distribución de vértices,
  individualización de pertenencias, ubicación del H.M. con geográficas sexagesimales y convergencia, relación
  con el amarre, vecinas y abarcamiento), con botón de copiar.
- **Acta de mensura en Word** (.docx) completa: encabezado y párrafo de causa desde los antecedentes ingresados,
  cuadros, secciones calculadas y textos libres del perito. Lo que falta queda marcado como `[COMPLETAR]`.
- **Plano de mensura en DXF** (R12, lo abre AutoCAD y QGIS) con capas por elemento, cuadros de coordenadas y
  azimut, vértices geodésicos, norte y una carátula inicial.
- **Nombres de vértices** configurables: prefijo de linderos, primer número interior y alias por vértice.
- **Búsqueda en el catastro** por nombre o rol y uso de la geometría de una concesión como base.
- **Aplicación instalable y sin conexión** (PWA): en terreno funciona todo salvo el catastro en línea y las
  imágenes satelitales que no se hayan visto antes.

Todo se genera en el navegador. No hay backend todavía y los datos quedan en `localStorage`
(exporta la cartera a JSON para no perderlos).

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run test:run   # pruebas (Vitest)
npm run build      # tsc -b + vite build
```

Publicada en GitHub Pages: https://danield-s.github.io/plataforma-peritos-geomensores/
El workflow `.github/workflows/pages.yml` corre pruebas, compila y despliega en cada push a `main`
(requiere *Settings → Pages → Source: GitHub Actions*).

## Validación

Las pruebas en `src/lib/geometria.test.ts` reproducen el acta de mensura real de
**ANTAQUENA 1 1 AL 22** (Sierra Gorda, abril 2026): 22 pertenencias de 1 ha en un perímetro en L de 10 linderos,
numeración de vértices interiores 11 a 37, y azimuts y distancias desde el hito con cuatro decimales.
Con el catastro en línea, la pestaña "Catastro" del mismo ejemplo reproduce las siete vecinas que lista el acta
(Gordon 5 al norte, Gordon 7 al este, Talita 3, Talita 4 y Pobreza al sur, Julio al oeste) y el abarcamiento parcial
de Trece de Mayo 1/36.

## Decisiones donde la guía es ambigua

| Tema | Guía | Decisión |
|---|---|---|
| Campo de área | `AREA (ha)` | `AREA_HA` (DBF no admite espacios ni paréntesis, máx. 10 caracteres) |
| Nombres de archivo | `vértices_mensura.shp` | `vertices_mensura.shp`, sin tilde, como pide el punto 4.3 |
| Campo FECHA | "Fecha, 03-03-2025" | Tipo `D` de DBF (QGIS y ArcGIS lo muestran como fecha) |
| Codificación | no especifica | UTF-8 declarado en `.cpg` |
| Datum | PSAD56 o SAD69 | Se reciben coordenadas ya en el datum oficial; no se transforma |

## Hoja de ruta

1. **Etapa 1**: completa en este prototipo.
2. **Etapa 2**: plano DXF con una primera carátula; la simbología y la carátula definitivas se ajustan con los
   planos de referencia de la asociación.
3. **Etapa 3**: acta de mensura lista; faltan los escritos de manifestación y solicitud de mensura.
4. **Producto**: cuentas de perito, persistencia en Supabase, historial y fotos por vértice.
