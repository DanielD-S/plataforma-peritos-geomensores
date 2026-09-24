# Plataforma Peritos Geomensores

Herramientas para peritos mensuradores de concesiones mineras en Chile. Este repositorio
parte con el **prototipo de la etapa 1**: generar los siete shapefiles y los cinco ZIP que exige
la *Guía para la presentación de archivos Shapefile* de Sernageomin (enero 2026) a partir de
los datos de una mensura, sin pasar por QGIS ni ArcGIS.

## Qué hace hoy

- Ingreso de la concesión: nombre, rol, sistema de coordenadas oficial (PSAD56 / SAD69, husos 18 y 19),
  fechas de manifestación, solicitud de mensura y mensura.
- Manifestación como rectángulo centrado en el punto de interés.
- Perímetro de la mensura editable (admite formas en L o cualquier polígono rectilíneo).
- Grilla de pertenencias con la convención de las actas: linderos `L-1..L-n` desde el NW en sentido horario,
  vértices interiores numerados desde `n+1` por filas de norte a sur, y cada pertenencia con sus vértices NW-NE-SE-SW.
- Cuadros calculados: vértices, individualización de pertenencias, descripción del perímetro y relación azimut
  (grados centesimales) y distancia desde el hito de mensura a cada lindero.
- Previsualización en mapa satelital.
- Descarga de `Manifestacion.zip`, `Solicitud_mensura.zip`, `Mensura.zip`, `Pertenencias.zip` y `Hito_de_mensura.zip`,
  cada uno con `.shp`, `.shx`, `.dbf`, `.prj` y `.cpg`.

Todo se genera en el navegador. No hay backend todavía y los datos quedan en `localStorage`.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run test:run   # pruebas (Vitest)
npm run build      # tsc -b + vite build
```

## Validación

Las pruebas en `src/lib/geometria.test.ts` reproducen el acta de mensura real de
**ANTAQUENA 1 1 AL 22** (Sierra Gorda, abril 2026): 22 pertenencias de 1 ha en un perímetro en L de 10 linderos,
numeración de vértices interiores 11 a 37, y azimuts y distancias desde el hito con cuatro decimales.

## Decisiones donde la guía es ambigua

| Tema | Guía | Decisión |
|---|---|---|
| Campo de área | `AREA (ha)` | `AREA_HA` (DBF no admite espacios ni paréntesis, máx. 10 caracteres) |
| Nombres de archivo | `vértices_mensura.shp` | `vertices_mensura.shp`, sin tilde, como pide el punto 4.3 |
| Campo FECHA | "Fecha, 03-03-2025" | Tipo `D` de DBF (QGIS y ArcGIS lo muestran como fecha) |
| Codificación | no especifica | UTF-8 declarado en `.cpg` |
| Datum | PSAD56 o SAD69 | Se reciben coordenadas ya en el datum oficial; no se transforma |

## Hoja de ruta

1. **Etapa 1**: este prototipo, más cuentas de perito, persistencia en Supabase y cruce con el catastro Sernageomin.
2. **Etapa 2**: plano de mensura en DXF.
3. **Etapa 3**: acta de mensura y escritos en DOCX, con las secciones calculadas desde la geometría.
