/**
 * Importación de geometrías desde archivos del perito: shapefile (ZIP o .shp suelto),
 * KML y KMZ. Devuelve polígonos y puntos en el EPSG oficial de destino.
 *
 * Si el archivo ya viene en el EPSG de destino, las coordenadas se conservan exactas.
 * Si viene en otro sistema (WGS84, otro huso, otro datum) se reproyecta con proj4 con
 * parámetros genéricos y se advierte: esas coordenadas son referenciales.
 */
import JSZip from "jszip"
import proj4 from "proj4"
import { CRS_OFICIALES, crsPorEpsg } from "./crs"
import { areaHa, normalizarPerimetro, redondear, type Punto } from "./geometria"

export interface PoligonoImportado {
  nombre: string
  anillo: Punto[]
  areaHa: number
}

export interface PuntoImportado {
  nombre: string
  n: number
  e: number
}

export interface ResultadoImportacion {
  archivo: string
  poligonos: PoligonoImportado[]
  puntos: PuntoImportado[]
  /** Sistema detectado en el archivo: EPSG oficial, "wgs84" (geográficas) o null si no se pudo saber. */
  origen: number | "wgs84" | null
  /** true si las coordenadas se reproyectaron (referenciales). */
  reproyectado: boolean
  advertencias: string[]
}

type XY = [number, number]

interface GeometriasCrudas {
  poligonos: { nombre: string; anillo: XY[] }[]
  puntos: { nombre: string; xy: XY }[]
}

// ---------- Shapefile ----------

/** Lector mínimo de .shp: Point (1, 11, 21), MultiPoint (8, 18, 28) y Polygon (5, 15, 25). */
export function leerShp(buf: ArrayBuffer): { poligonos: XY[][]; puntos: XY[] } {
  const dv = new DataView(buf)
  if (dv.getInt32(0, false) !== 9994) throw new Error("El archivo .shp no es válido (código de archivo incorrecto).")
  const largo = dv.getInt32(24, false) * 2
  const poligonos: XY[][] = []
  const puntos: XY[] = []
  let off = 100
  while (off + 8 <= largo && off + 8 <= buf.byteLength) {
    const largoContenido = dv.getInt32(off + 4, false) * 2
    const base = off + 8
    const tipo = dv.getInt32(base, true)
    if (tipo === 1 || tipo === 11 || tipo === 21) {
      puntos.push([dv.getFloat64(base + 4, true), dv.getFloat64(base + 12, true)])
    } else if (tipo === 8 || tipo === 18 || tipo === 28) {
      const n = dv.getInt32(base + 36, true)
      for (let i = 0; i < n; i++) puntos.push([dv.getFloat64(base + 40 + i * 16, true), dv.getFloat64(base + 48 + i * 16, true)])
    } else if (tipo === 5 || tipo === 15 || tipo === 25 || tipo === 3 || tipo === 13 || tipo === 23) {
      const numParts = dv.getInt32(base + 36, true)
      const numPoints = dv.getInt32(base + 40, true)
      const partes: number[] = []
      for (let i = 0; i < numParts; i++) partes.push(dv.getInt32(base + 44 + i * 4, true))
      const inicioPuntos = base + 44 + numParts * 4
      const pts: XY[] = []
      for (let i = 0; i < numPoints; i++) pts.push([dv.getFloat64(inicioPuntos + i * 16, true), dv.getFloat64(inicioPuntos + i * 16 + 8, true)])
      for (let p = 0; p < numParts; p++) {
        const anillo = pts.slice(partes[p], p + 1 < numParts ? partes[p + 1] : numPoints)
        // En shapefile los anillos exteriores van en sentido horario; los huecos, antihorario. Se ignoran los huecos.
        if (anillo.length >= 4 && (tipo === 3 || tipo === 13 || tipo === 23 || areaConSigno(anillo) < 0)) poligonos.push(anillo)
      }
    }
    off = base + largoContenido
  }
  return { poligonos, puntos }
}

function areaConSigno(anillo: XY[]): number {
  let s = 0
  for (let i = 0; i < anillo.length - 1; i++) s += anillo[i][0] * anillo[i + 1][1] - anillo[i + 1][0] * anillo[i][1]
  return s / 2
}

/** Lector mínimo de .dbf: devuelve, por registro, el primer campo de texto no vacío (el nombre). */
export function leerNombresDbf(buf: ArrayBuffer): string[] {
  const dv = new DataView(buf)
  const bytes = new Uint8Array(buf)
  const numRegistros = dv.getUint32(4, true)
  const largoCabecera = dv.getUint16(8, true)
  const largoRegistro = dv.getUint16(10, true)
  const campos: { nombre: string; tipo: string; longitud: number }[] = []
  for (let off = 32; off < largoCabecera - 1 && bytes[off] !== 0x0d; off += 32) {
    let nombre = ""
    for (let i = 0; i < 11 && bytes[off + i] !== 0; i++) nombre += String.fromCharCode(bytes[off + i])
    campos.push({ nombre, tipo: String.fromCharCode(bytes[off + 11]), longitud: bytes[off + 16] })
  }
  const preferido = campos.findIndex((c) => c.tipo === "C" && /^(NOMBRE|NAME|NOM)/i.test(c.nombre))
  const idxTexto = preferido >= 0 ? preferido : campos.findIndex((c) => c.tipo === "C")
  const dec = new TextDecoder("utf-8")
  const decLatin = new TextDecoder("latin1")
  const nombres: string[] = []
  for (let r = 0; r < numRegistros; r++) {
    let off = largoCabecera + r * largoRegistro + 1
    let nombre = ""
    for (let c = 0; c < campos.length; c++) {
      if (c === idxTexto) {
        const raw = bytes.slice(off, off + campos[c].longitud)
        try {
          nombre = dec.decode(raw).trim()
        } catch {
          nombre = decLatin.decode(raw).trim()
        }
        if (!nombre) nombre = decLatin.decode(raw).trim()
      }
      off += campos[c].longitud
    }
    nombres.push(nombre)
  }
  return nombres
}

/** Detecta el sistema de coordenadas a partir del texto del .prj. */
export function detectarCrsPrj(prj: string): number | "wgs84" | null {
  const t = prj.replace(/\s+/g, " ")
  const esWgs = /WGS[_ ]?(?:19)?84|SIRGAS/i.test(t)
  const esGeografico = !/PROJCS/i.test(t) && /GEOGCS/i.test(t)
  if (esGeografico) return esWgs ? "wgs84" : null
  const datum = /PSAD|Provisional_S_American_1956|Provisional South American/i.test(t)
    ? "PSAD56"
    : /SAD.?69|South_American_1969|South American Datum 1969/i.test(t)
      ? "SAD69"
      : null
  const meridiano = /Central_Meridian",\s*(-?\d+(?:\.\d+)?)/i.exec(t)?.[1]
  const zona = /(?:Zone|Huso)[_ ]?(\d{2})S?/i.exec(t)?.[1]
  const huso = meridiano ? (Number(meridiano) === -69 ? 19 : Number(meridiano) === -75 ? 18 : null) : zona ? Number(zona) : null
  if (datum && (huso === 18 || huso === 19)) return CRS_OFICIALES.find((c) => c.datum === datum && c.huso === huso)?.epsg ?? null
  if (esWgs) {
    // UTM WGS84/SIRGAS: se reproyecta desde la definición genérica.
    if (huso === 18) return 32718
    if (huso === 19) return 32719
  }
  return null
}

// ---------- KML ----------

function parsearCoordsKml(texto: string): XY[] {
  return texto
    .trim()
    .split(/\s+/)
    .map((t) => t.split(",").map(Number))
    .filter((c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map(([lon, lat]) => [lon, lat] as XY)
}

export function leerKml(texto: string): GeometriasCrudas {
  const doc = new DOMParser().parseFromString(texto, "application/xml")
  if (doc.getElementsByTagName("parsererror").length) throw new Error("El KML no se pudo leer.")
  const poligonos: GeometriasCrudas["poligonos"] = []
  const puntos: GeometriasCrudas["puntos"] = []
  const placemarks = [...doc.getElementsByTagName("Placemark")]
  const contenedores = placemarks.length ? placemarks : [doc.documentElement]
  contenedores.forEach((pm, i) => {
    const nombre = pm.getElementsByTagName("name")[0]?.textContent?.trim() || `Elemento ${i + 1}`
    for (const pol of [...pm.getElementsByTagName("Polygon")]) {
      const outer = pol.getElementsByTagName("outerBoundaryIs")[0] ?? pol
      const coords = outer.getElementsByTagName("coordinates")[0]?.textContent
      if (coords) {
        const anillo = parsearCoordsKml(coords)
        if (anillo.length >= 4) poligonos.push({ nombre, anillo })
      }
    }
    for (const pt of [...pm.getElementsByTagName("Point")]) {
      const coords = pt.getElementsByTagName("coordinates")[0]?.textContent
      if (coords) {
        const [xy] = parsearCoordsKml(coords)
        if (xy) puntos.push({ nombre, xy })
      }
    }
  })
  return { poligonos, puntos }
}

// ---------- Orquestación ----------

function extension(nombre: string): string {
  return nombre.toLowerCase().split(".").pop() ?? ""
}

interface ShapefileEnZip {
  base: string
  shp: ArrayBuffer
  dbf?: ArrayBuffer
  prj?: string
}

/** Un ZIP puede traer varios shapefiles (p. ej. Mensura.zip trae mensura y vertices_mensura). */
async function leerZip(archivo: File): Promise<{ shapefiles: ShapefileEnZip[]; kml?: string }> {
  const zip = await JSZip.loadAsync(await archivo.arrayBuffer())
  const porBase = new Map<string, Partial<ShapefileEnZip>>()
  let kml: string | undefined
  for (const [ruta, entrada] of Object.entries(zip.files)) {
    if (entrada.dir) continue
    const ext = extension(ruta)
    const base = ruta.slice(0, ruta.length - ext.length - 1).toLowerCase()
    if (ext === "shp" || ext === "dbf" || ext === "prj") {
      const s = porBase.get(base) ?? { base }
      if (ext === "shp") s.shp = await entrada.async("arraybuffer")
      else if (ext === "dbf") s.dbf = await entrada.async("arraybuffer")
      else s.prj = await entrada.async("string")
      porBase.set(base, s)
    } else if (ext === "kml" && !kml) kml = await entrada.async("string")
  }
  const shapefiles = [...porBase.values()].filter((s): s is ShapefileEnZip => !!s.shp)
  return { shapefiles, kml }
}

function convertir(xy: XY, origen: number | "wgs84" | null, epsgDestino: number): Punto {
  if (origen === epsgDestino || origen === null) return { n: xy[1], e: xy[0] }
  const destino = crsPorEpsg(epsgDestino).proj4
  const desde =
    origen === "wgs84"
      ? "EPSG:4326"
      : origen === 32718
        ? "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs"
        : origen === 32719
          ? "+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs"
          : crsPorEpsg(origen).proj4
  const [e, n] = proj4(desde, destino, xy)
  return { n: redondear(n, 3), e: redondear(e, 3) }
}

export async function importarArchivo(archivo: File, epsgDestino: number): Promise<ResultadoImportacion> {
  const ext = extension(archivo.name)
  const advertencias: string[] = []
  let crudas: GeometriasCrudas
  let origen: number | "wgs84" | null = null

  if (ext === "zip" || ext === "kmz") {
    const z = await leerZip(archivo)
    if (z.shapefiles.length > 0) {
      crudas = { poligonos: [], puntos: [] }
      const origenes = new Set<number | "wgs84" | null>()
      for (const s of z.shapefiles) {
        const { poligonos, puntos } = leerShp(s.shp)
        const nombres = s.dbf ? leerNombresDbf(s.dbf) : []
        const prefijo = z.shapefiles.length > 1 ? `${s.base}: ` : ""
        crudas.poligonos.push(...poligonos.map((anillo, i) => ({ nombre: `${prefijo}${nombres[i] || `Polígono ${i + 1}`}`, anillo })))
        crudas.puntos.push(...puntos.map((xy, i) => ({ nombre: nombres[i] || `${prefijo}Punto ${i + 1}`, xy })))
        origenes.add(s.prj ? detectarCrsPrj(s.prj) : null)
        if (!s.prj) advertencias.push(`${s.base}.shp no trae .prj: se asume que ya está en el sistema de coordenadas elegido.`)
      }
      if (origenes.size > 1) advertencias.push("Los shapefiles del ZIP no están todos en el mismo sistema de coordenadas; se usa el del primero.")
      origen = z.shapefiles[0].prj ? detectarCrsPrj(z.shapefiles[0].prj) : null
      if (z.shapefiles[0].prj && origen === null) advertencias.push("No se reconoció el sistema de coordenadas del .prj: se asume el sistema elegido.")
    } else if (z.kml) {
      crudas = leerKml(z.kml)
      origen = "wgs84"
    } else {
      throw new Error("El ZIP no contiene un .shp ni un .kml.")
    }
  } else if (ext === "shp") {
    const { poligonos, puntos } = leerShp(await archivo.arrayBuffer())
    crudas = {
      poligonos: poligonos.map((anillo, i) => ({ nombre: `Polígono ${i + 1}`, anillo })),
      puntos: puntos.map((xy, i) => ({ nombre: `Punto ${i + 1}`, xy })),
    }
    advertencias.push("Se cargó solo el .shp: sin .prj se asume el sistema elegido y no hay nombres de atributos.")
  } else if (ext === "kml") {
    crudas = leerKml(await archivo.text())
    origen = "wgs84"
  } else {
    throw new Error("Formato no soportado. Usa un ZIP con shapefile, un .shp, un .kml o un .kmz.")
  }

  const reproyectado = origen !== null && origen !== epsgDestino
  if (origen !== null && reproyectado) {
    const nombreOrigen = origen === "wgs84" ? "WGS84 geográficas" : origen === 32718 || origen === 32719 ? `WGS84 UTM ${origen - 32700}S` : crsPorEpsg(origen).nombre
    advertencias.push(`El archivo viene en ${nombreOrigen} y se reproyectó a ${crsPorEpsg(epsgDestino).nombre} con parámetros genéricos: las coordenadas son referenciales, revísalas antes de entregar.`)
  }

  const poligonos: PoligonoImportado[] = crudas.poligonos
    .map((p) => {
      const anillo = normalizarPerimetro(p.anillo.map((xy) => convertir(xy, origen, epsgDestino)))
      return { nombre: p.nombre, anillo, areaHa: areaHa(anillo) }
    })
    .filter((p) => p.anillo.length >= 3)
  const puntos: PuntoImportado[] = crudas.puntos.map((p) => {
    const q = convertir(p.xy, origen, epsgDestino)
    return { nombre: p.nombre, n: q.n, e: q.e }
  })
  if (poligonos.length === 0 && puntos.length === 0) advertencias.push("El archivo no contiene polígonos ni puntos.")

  return { archivo: archivo.name, poligonos, puntos, origen, reproyectado, advertencias }
}
