# CLAUDE.md — notas para desarrollo asistido

Plataforma para peritos mensuradores de concesiones mineras en Chile. Hermana de Pudumaps
(mismo stack y convenciones); el objetivo de la etapa 1 es generar los shapefiles que exige
Sernageomin. Ver `README.md` para el alcance y la hoja de ruta.

## Verificación de cambios

- `npm run build` (corre `tsc -b` antes de `vite build`; `vite build` solo no hace type-check).
- `npm run test:run` (Vitest, entorno node; solo `src/**/*.test.ts`).
- Las pruebas de `src/lib/geometria.test.ts` son la referencia normativa: reproducen un acta real
  (ANTAQUENA 1 1 AL 22). Si un cambio las rompe, casi seguro el cambio está mal, no la prueba.

## Convenciones del dominio

- Coordenadas UTM en metros: `n` = Norte (Y), `e` = Este (X). En shapefile X = Este, Y = Norte.
- Polígonos como anillos **abiertos**, en **sentido horario** desde el vértice **más al NW**.
  `normalizarPerimetro` lo garantiza; úsala antes de nombrar vértices.
- Linderos `L-1..L-n`; vértices interiores numerados desde `n+1` por filas N→S y O→E.
  Pertenencias numeradas por filas N→S, O→E; sus vértices se listan NW, NE, SE, SW.
- Azimuts en **grados centesimales** (0 = N, 100 = E, 200 = S, 300 = O).
- Solo los cuatro EPSG oficiales (`src/lib/crs.ts`). **Nunca transformar datums**: el perito entrega
  coordenadas ya en el datum oficial. proj4 se usa solo para dibujar en el mapa.
- Formato chileno en pantalla y documentos: `7.477.000,00`, `333,1589`, fechas `DD-MM-AAAA` (`src/lib/formato.ts`).

## Estructura

- `src/lib/crs.ts` — EPSG oficiales, proj4 y contenido exacto del `.prj`.
- `src/lib/geometria.ts` — rectángulo desde P.I., grilla de pertenencias, numeración, azimut/distancia.
- `src/lib/shapefile/` — escritor propio de `.shp/.shx/.dbf` (sin dependencias). Campos DBF ≤ 10 caracteres ASCII.
- `src/lib/sernageomin.ts` — arma los 7 shapefiles y los 5 ZIP de la guía. Documenta ahí toda decisión
  donde la guía sea ambigua.
- `src/lib/modelo.ts` — tipo `Concesion`, `normalizarConcesion` (migra datos guardados con modelos anteriores) y el caso de ejemplo del acta.
- `src/lib/cartera.ts` — varias concesiones en `localStorage`, exportar/importar JSON. Hook: `src/hooks/useCartera.ts`.
- `src/lib/catastro.ts` — consulta en vivo al ArcGIS de Sernageomin (CORS abierto): capa por vista y vecinas/superposiciones.
- `src/lib/importar.ts` — lectores propios de `.shp`/`.dbf`, KML/KMZ, detección del `.prj`; reproyecta solo si hace falta y advierte.
- `src/lib/validar.ts` — revisión (errores y avisos) que se muestra en el botón "Revisión"; no bloquea descargas.
- `src/lib/geodesia.ts` — geográficas y convergencia en el MISMO datum (inversa de la proyección, sin towgs84).
- `src/lib/textos.ts` — redacción de las secciones del acta; sus pruebas reproducen frases textuales del acta real.
- `src/lib/acta.ts` — .docx con la librería `docx` (importada bajo demanda desde `Descargas`).
- `src/lib/dxf.ts` — escritor DXF R12 propio. Validar cambios con `PPG_SALIDA=.salida npx vitest run src/lib/dxf.test.ts`
  y `python -c "from ezdxf import recover; d,a=recover.readfile('.salida/plano_antaquena.dxf'); print(len(a.errors))"`.
- PWA con `vite-plugin-pwa` (`vite.config.ts`): la app entera se precachea; teselas CacheFirst, catastro NetworkFirst.
- GitHub Pages (`.github/workflows/pages.yml`): compila con `BASE_PATH=/<repo>/`; en local `base` queda en `/`.
  No uses rutas absolutas a `/` en el código: usa `import.meta.env.BASE_URL`.
- `src/components/` — `Cartera`, `Formulario`, `Mapa` (Leaflet; incluye `CapaCatastro` y `EditorVertices`), `Tablas`, `Descargas`, `Revision`, `ImportarDialogo`, `Separador`.
- Sin backend por ahora: todo el estado vive en el navegador.

## Al agregar campos al modelo

1. Añadirlos a `Concesion` y a `concesionVacia()` en `modelo.ts`.
2. Cubrirlos en `normalizarConcesion` con un valor por defecto: hay carteras guardadas con versiones anteriores.
3. Si van a un shapefile, documentar el nombre DBF (≤ 10 caracteres ASCII) en `sernageomin.ts`.

## Estilo

- React 19 + Vite + TypeScript estricto + Tailwind 4. Textos de interfaz en español.
- Colores como variables CSS en `src/index.css` (`--pg-*`); no hardcodear fuera de ahí.
- Librerías pesadas nuevas (DXF, DOCX) deben cargarse con `lazy()` / `import()` dinámico.
