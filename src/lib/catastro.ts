/**
 * Catastro de concesiones mineras de Sernageomin, consultado en vivo desde su servicio
 * ArcGIS Online (el mismo que usa Pudumaps). El servicio permite CORS y reproyecta en el
 * servidor, así que se le pide directamente en el EPSG oficial de la mensura.
 *
 * Advertencia: el servicio almacena las geometrías en WGS84 y las devuelve reproyectadas
 * al EPSG pedido con parámetros genéricos. Las posiciones del catastro son referenciales
 * (error de metros); sirven para detectar vecinos y superposiciones, no para replantear.
 */
import polygonClipping, { type Geom, type MultiPolygon, type Polygon as PolygonPc } from "polygon-clipping"
import { bbox, normalizarPerimetro, type Punto } from "./geometria"

export const SERVICIO_CATASTRO =
  "https://services1.arcgis.com/OyjvVdFTl5hfSdX3/arcgis/rest/services/Marcelo_Layer/FeatureServer/2/query"

/** Bajo este zoom del mapa no se consulta el catastro: la densidad lo haría inútil. */
export const ZOOM_MINIMO_CATASTRO = 12
const MAX_ENTIDADES = 2000

const CAMPOS = [
  "OBJECTID",
  "NUMERO_ROL",
  "DV_ROL",
  "NOMBRE",
  "HECTAREAS",
  "TIPO_CONCESION",
  "SITUACION_CONCESION",
  "TITULAR_NOMBRE",
  "DATUM",
  "HUSO",
  "COMUNA",
  "ORIGEN",
].join(",")

export type TipoConcesion = "exploracion" | "explotacion" | "desconocido"
export type SituacionConcesion = "constituida" | "en_tramite" | "eliminada" | "desconocido"

export interface ConcesionCatastro {
  id: number
  rol: string
  nombre: string
  tipo: TipoConcesion
  situacion: SituacionConcesion
  titular: string
  hectareas: number | null
  datum: "PSAD56" | "SAD69"
  huso: number
  comuna: string
  origen: string
}

export const ETIQUETA_TIPO: Record<TipoConcesion, string> = {
  exploracion: "Exploración",
  explotacion: "Explotación",
  desconocido: "Sin tipo",
}

export const ETIQUETA_SITUACION: Record<SituacionConcesion, string> = {
  constituida: "Constituida",
  en_tramite: "En trámite",
  eliminada: "Eliminada",
  desconocido: "Sin información",
}

export interface AtributosArcgis {
  OBJECTID?: number
  NUMERO_ROL?: string | null
  DV_ROL?: string | null
  NOMBRE?: string | null
  HECTAREAS?: number | string | null
  TIPO_CONCESION?: string | null
  SITUACION_CONCESION?: string | null
  TITULAR_NOMBRE?: string | null
  DATUM?: string | number | null
  HUSO?: number | string | null
  COMUNA?: string | null
  ORIGEN?: string | null
}

/** `NUMERO_ROL` viene como 9 dígitos (5 de prefijo + 4 correlativo) y el DV aparte: 022010664 + 0 → 02201-0664-0. */
export function formatearRol(numero: string | null | undefined, dv: string | null | undefined): string {
  const n = (numero ?? "").trim()
  const d = (dv ?? "").trim()
  const cuerpo = /^\d{9}$/.test(n) ? `${n.slice(0, 5)}-${n.slice(5)}` : n
  return d ? `${cuerpo}-${d}` : cuerpo
}

export function desdeAtributos(a: AtributosArcgis): ConcesionCatastro {
  const tipo = String(a.TIPO_CONCESION ?? "").toUpperCase()
  const sit = String(a.SITUACION_CONCESION ?? "").toUpperCase()
  const ha = a.HECTAREAS == null ? null : Number(a.HECTAREAS)
  return {
    id: Number(a.OBJECTID ?? 0),
    rol: formatearRol(a.NUMERO_ROL, a.DV_ROL),
    nombre: (a.NOMBRE ?? "").trim(),
    tipo: tipo === "EXPLORACION" ? "exploracion" : tipo === "EXPLOTACION" ? "explotacion" : "desconocido",
    situacion: sit === "CONSTITUIDA" ? "constituida" : sit === "EN TRAMITE" ? "en_tramite" : sit === "ELIMINADA" ? "eliminada" : "desconocido",
    titular: (a.TITULAR_NOMBRE ?? "").trim(),
    hectareas: ha == null || Number.isNaN(ha) ? null : ha,
    datum: String(a.DATUM ?? "0").trim() === "1" ? "SAD69" : "PSAD56",
    huso: Number(a.HUSO ?? 19) || 19,
    comuna: (a.COMUNA ?? "").trim(),
    origen: (a.ORIGEN ?? "").trim(),
  }
}

export interface EntidadCatastro {
  concesion: ConcesionCatastro
  /** Polígono o multipolígono, anillos [x, y] en el EPSG pedido (o lon/lat si se pidió 4326). */
  geometria: Geom
}

interface FeatureGeoJson {
  properties: AtributosArcgis
  geometry: { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] } | null
}

function aGeom(g: FeatureGeoJson["geometry"]): Geom | null {
  if (!g) return null
  if (g.type === "Polygon") return g.coordinates as PolygonPc
  return g.coordinates as MultiPolygon
}

async function consultar(params: Record<string, string>, signal?: AbortSignal): Promise<{ entidades: EntidadCatastro[]; crudo: unknown }> {
  const url = `${SERVICIO_CATASTRO}?${new URLSearchParams({ f: "geojson", outFields: CAMPOS, where: "1=1", returnGeometry: "true", ...params })}`
  const resp = await fetch(url, { signal })
  if (!resp.ok) throw new Error(`Catastro Sernageomin respondió ${resp.status}`)
  const datos = (await resp.json()) as { features?: FeatureGeoJson[]; error?: { message?: string } }
  if (datos.error) throw new Error(datos.error.message ?? "Error del servicio de catastro")
  const entidades: EntidadCatastro[] = []
  for (const f of datos.features ?? []) {
    const geometria = aGeom(f.geometry)
    if (geometria) entidades.push({ concesion: desdeAtributos(f.properties), geometria })
  }
  return { entidades, crudo: datos }
}

/** Concesiones dentro de una vista del mapa. `bbox` en lon/lat (oeste, sur, este, norte); resultado en lon/lat. */
export async function consultarPorVista(bbox4326: [number, number, number, number], signal?: AbortSignal) {
  const [w, s, e, n] = bbox4326
  return consultar(
    {
      geometry: `${w},${s},${e},${n}`,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      resultRecordCount: String(MAX_ENTIDADES),
    },
    signal,
  )
}

/**
 * Margen de búsqueda alrededor de la mensura. Las geometrías del catastro llegan reproyectadas
 * con desfases de metros, así que una vecina real puede quedar a 2 o 5 m del perímetro exacto.
 */
export const DISTANCIA_BUSQUEDA_M = 150

/** Concesiones que abarcan o quedan a menos de DISTANCIA_BUSQUEDA_M del polígono (EPSG oficial); resultado en ese EPSG. */
export async function consultarIntersectantes(poligono: Punto[], epsg: number, signal?: AbortSignal): Promise<EntidadCatastro[]> {
  const p = normalizarPerimetro(poligono)
  if (p.length < 3) return []
  const anillo = [...p, p[0]].map((v) => [v.e, v.n])
  const { entidades } = await consultar(
    {
      geometry: JSON.stringify({ rings: [anillo], spatialReference: { wkid: epsg } }),
      geometryType: "esriGeometryPolygon",
      inSR: String(epsg),
      outSR: String(epsg),
      spatialRel: "esriSpatialRelIntersects",
      distance: String(DISTANCIA_BUSQUEDA_M),
      units: "esriSRUnit_Meter",
      resultRecordCount: "500",
    },
    signal,
  )
  return entidades
}

/** abarca: superposición real; colinda: comparte borde; cercana: a menos de DISTANCIA_BUSQUEDA_M sin tocar. */
export type Relacion = "abarca" | "colinda" | "cercana"
export type Direccion = "norte" | "sur" | "este" | "oeste"

export interface Superposicion {
  concesion: ConcesionCatastro
  relacion: Relacion
  /** Área de intersección con la mensura, en hectáreas. */
  areaHa: number
  /** Distancia mínima entre ambos polígonos, en metros (0 si se tocan o abarcan). */
  distanciaM: number
  direccion: Direccion
}

/** Bajo esta área de intersección la relación se considera colindancia (ruido de reproyección). */
const UMBRAL_ABARCA_M2 = 100
/** Hasta esta distancia dos polígonos se consideran en contacto (ruido de reproyección). */
const TOL_CONTACTO_M = 5
/** Paso de muestreo del borde de la vecina para medir cuánto contacto hay por cada lado. */
const PASO_MUESTREO_M = 10

function areaAnillo(anillo: number[][]): number {
  let s = 0
  for (let i = 0; i < anillo.length - 1; i++) s += anillo[i][0] * anillo[i + 1][1] - anillo[i + 1][0] * anillo[i][1]
  return s / 2
}

/** Área de un multipolígono en m² (anillos exteriores menos huecos). */
export function areaMultiPoligono(mp: MultiPolygon): number {
  let total = 0
  for (const poly of mp) {
    poly.forEach((anillo, i) => {
      const a = Math.abs(areaAnillo(anillo))
      total += i === 0 ? a : -a
    })
  }
  return total
}

function esMultiPoligono(g: Geom): g is MultiPolygon {
  return Array.isArray(g[0][0][0])
}

/** Anillos exteriores de un polígono o multipolígono. */
function anillosExteriores(g: Geom): number[][][] {
  return esMultiPoligono(g) ? g.map((p) => p[0]) : [g[0]]
}

type XY = [number, number]

function distPuntoSegmento(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  let t = l2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/** Aristas del perímetro de la mensura (ya normalizado: horario desde el NW). */
function aristas(m: Punto[]): { a: XY; b: XY; afuera: Direccion }[] {
  return m.map((v, i) => {
    const s = m[(i + 1) % m.length]
    const a: XY = [v.e, v.n]
    const b: XY = [s.e, s.n]
    // Recorrido horario: el exterior queda a la izquierda del sentido de avance.
    const outE = -(b[1] - a[1])
    const outN = b[0] - a[0]
    const afuera: Direccion = Math.abs(outN) >= Math.abs(outE) ? (outN >= 0 ? "norte" : "sur") : outE >= 0 ? "este" : "oeste"
    return { a, b, afuera }
  })
}

/** Puntos cada PASO_MUESTREO_M a lo largo de los anillos exteriores de la vecina. */
function muestrearBorde(g: Geom): XY[] {
  const out: XY[] = []
  for (const anillo of anillosExteriores(g)) {
    for (let i = 0; i < anillo.length - 1; i++) {
      const a = anillo[i] as XY
      const b = anillo[i + 1] as XY
      const largo = Math.hypot(b[0] - a[0], b[1] - a[1])
      const n = Math.max(1, Math.ceil(largo / PASO_MUESTREO_M))
      for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
    }
  }
  return out
}

/**
 * Distancia mínima entre la mensura y la vecina, y dirección en que queda la vecina.
 * Si hay contacto, gana el lado de la mensura con más borde de la vecina pegado a él.
 * Si no lo hay, se usa la posición del centro de la vecina respecto del centro de la mensura.
 */
function distanciaYDireccion(m: Punto[], g: Geom, bb: ReturnType<typeof bbox>): { distanciaM: number; direccion: Direccion } {
  const lados = aristas(m)
  const muestras = muestrearBorde(g)
  const contacto: Record<Direccion, number> = { norte: 0, sur: 0, este: 0, oeste: 0 }
  let minimo = Infinity

  for (const p of muestras) {
    let mejor = Infinity
    let lado: Direccion = "norte"
    for (const ar of lados) {
      const d = distPuntoSegmento(p, ar.a, ar.b)
      if (d < mejor) {
        mejor = d
        lado = ar.afuera
      }
    }
    if (mejor < minimo) minimo = mejor
    if (mejor <= TOL_CONTACTO_M) contacto[lado]++
  }
  // También vértices de la mensura contra las aristas de la vecina (vecina que rodea una esquina).
  for (const anillo of anillosExteriores(g)) {
    for (const v of m) {
      for (let i = 0; i < anillo.length - 1; i++) {
        const d = distPuntoSegmento([v.e, v.n], anillo[i] as XY, anillo[i + 1] as XY)
        if (d < minimo) minimo = d
      }
    }
  }

  const total = contacto.norte + contacto.sur + contacto.este + contacto.oeste
  if (total > 0) {
    return {
      distanciaM: 0,
      direccion: (Object.keys(contacto) as Direccion[]).reduce((mx, k) => (contacto[k] > contacto[mx] ? k : mx), "norte"),
    }
  }
  const pts = anillosExteriores(g).flat()
  const n = pts.length || 1
  const dn = pts.reduce((s, p) => s + p[1], 0) / n - (bb.nMin + bb.nMax) / 2
  const de = pts.reduce((s, p) => s + p[0], 0) / n - (bb.eMin + bb.eMax) / 2
  return {
    distanciaM: Number.isFinite(minimo) ? minimo : 0,
    direccion: Math.abs(dn) >= Math.abs(de) ? (dn >= 0 ? "norte" : "sur") : de >= 0 ? "este" : "oeste",
  }
}

/** Clasifica cada concesión del catastro respecto de la mensura: abarca (superposición real) o colinda. */
export function analizarSuperposiciones(mensura: Punto[], entidades: EntidadCatastro[]): Superposicion[] {
  const m = normalizarPerimetro(mensura)
  if (m.length < 3) return []
  const anilloM: PolygonPc = [[...m, m[0]].map((v) => [v.e, v.n] as [number, number])]
  const bb = bbox(m)

  const lista: Superposicion[] = entidades.map(({ concesion, geometria }) => {
    let areaM2 = 0
    try {
      areaM2 = areaMultiPoligono(polygonClipping.intersection(anilloM, geometria))
    } catch {
      areaM2 = 0
    }
    const { distanciaM, direccion } = distanciaYDireccion(m, geometria, bb)
    const relacion: Relacion = areaM2 >= UMBRAL_ABARCA_M2 ? "abarca" : distanciaM <= TOL_CONTACTO_M ? "colinda" : "cercana"
    return { concesion, relacion, areaHa: areaM2 / 10_000, distanciaM: relacion === "cercana" ? distanciaM : 0, direccion }
  })
  const ordenRel: Record<Relacion, number> = { abarca: 0, colinda: 1, cercana: 2 }
  const ordenDir: Record<Direccion, number> = { norte: 0, este: 1, sur: 2, oeste: 3 }
  return lista.sort(
    (a, b) =>
      ordenRel[a.relacion] - ordenRel[b.relacion] || ordenDir[a.direccion] - ordenDir[b.direccion] || b.areaHa - a.areaHa || a.distanciaM - b.distanciaM,
  )
}
