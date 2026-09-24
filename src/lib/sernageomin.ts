/**
 * Construye los 7 shapefiles y los 5 ZIP exigidos por la "Guía para la presentación de
 * archivos Shapefile" (Sernageomin, enero 2026) a partir de una concesión.
 *
 * Decisiones donde la guía es ambigua (documentadas para revisarlas con Sernageomin):
 *  - El campo "AREA (ha)" no es un nombre DBF válido; se escribe AREA_HA.
 *  - Los nombres de archivo van sin tildes ni espacios ("vertices_mensura", no "vértices_mensura"),
 *    como pide el punto 4.3 de la misma guía.
 *  - FECHA se escribe como campo tipo fecha (D), que QGIS/ArcGIS muestran como DD-MM-AAAA.
 */
import JSZip from "jszip"
import { crsPorEpsg } from "./crs"
import { areaHa, generarGrilla, normalizarPerimetro, rectanguloDesdePI, type Grilla, type Punto, type Vertice } from "./geometria"
import type { Concesion } from "./modelo"
import { crearShapefile, type ArchivosShapefile, type CampoDbf, type Coordenada } from "./shapefile"

const C_NOMBRE: CampoDbf = { nombre: "NOMBRE", tipo: "C", longitud: 100 }
const C_AREA: CampoDbf = { nombre: "AREA_HA", tipo: "N", longitud: 14, decimales: 2 }
const C_FECHA: CampoDbf = { nombre: "FECHA", tipo: "D", longitud: 8 }
const C_NORTE: CampoDbf = { nombre: "NORTE", tipo: "N", longitud: 15, decimales: 3 }
const C_ESTE: CampoDbf = { nombre: "ESTE", tipo: "N", longitud: 15, decimales: 3 }
const C_ROL: CampoDbf = { nombre: "ROL", tipo: "C", longitud: 20 }

export interface Derivados {
  manifestacion: Punto[]
  solicitud: Punto[]
  mensura: Punto[]
  grilla: Grilla
  areaManifestacionHa: number
  areaMensuraHa: number
}

/** Geometrías derivadas de los datos ingresados. */
/** Un P.I. en 0,0 es un formulario vacío, no una coordenada: en UTM sur caería en la Antártida. */
export function piValido(pi: Punto): boolean {
  return pi.n > 0 && pi.e > 0
}

export function derivar(c: Concesion): Derivados {
  const manifestacion = piValido(c.pi) && c.ladoNS > 0 && c.ladoEO > 0 ? rectanguloDesdePI(c.pi, c.ladoNS, c.ladoEO) : []
  const solicitud = normalizarPerimetro(c.perimetroSolicitud.length >= 3 ? c.perimetroSolicitud : manifestacion)
  const mensura = normalizarPerimetro(c.perimetroMensura.length >= 3 ? c.perimetroMensura : solicitud)
  const grilla = generarGrilla(mensura, c.pertenenciaEO, c.pertenenciaNS, c.prefijoPertenencias)
  return {
    manifestacion,
    solicitud,
    mensura,
    grilla,
    areaManifestacionHa: areaHa(manifestacion),
    areaMensuraHa: areaHa(mensura),
  }
}

function anillo(poligono: Punto[]): Coordenada[] {
  return poligono.map((p) => [p.e, p.n])
}

function capaPoligono(base: string, nombre: string, poligono: Punto[], fecha: string | null, prj: string): ArchivosShapefile {
  const campos = fecha === null ? [C_NOMBRE, C_AREA] : [C_NOMBRE, C_AREA, C_FECHA]
  const atributos: Record<string, string | number> = { NOMBRE: nombre, AREA_HA: areaHa(poligono) }
  if (fecha !== null) atributos.FECHA = fecha
  const entidades = poligono.length >= 3 ? [{ geometria: { tipo: "poligono" as const, anillos: [anillo(poligono)] }, atributos }] : []
  return crearShapefile(base, campos, entidades, prj)
}

function capaVertices(base: string, vertices: Vertice[], prj: string): ArchivosShapefile {
  return crearShapefile(
    base,
    [C_NOMBRE, C_NORTE, C_ESTE],
    vertices.map((v) => ({
      geometria: { tipo: "punto", x: v.e, y: v.n },
      atributos: { NOMBRE: v.nombre, NORTE: v.n, ESTE: v.e },
    })),
    prj,
  )
}

export interface PaqueteSernageomin {
  shapefiles: ArchivosShapefile[]
  /** Nombre de ZIP → contenido. */
  zips: Record<string, Blob>
  derivados: Derivados
}

export async function generarPaquete(c: Concesion): Promise<PaqueteSernageomin> {
  const crs = crsPorEpsg(c.epsg)
  const d = derivar(c)
  const prj = crs.prj

  const manifestacion = capaPoligono("manifestacion", c.nombre, d.manifestacion, c.fechaManifestacion, prj)
  const solicitud = capaPoligono("solicitud_mensura", c.nombre, d.solicitud, c.fechaSolicitudMensura, prj)
  const mensura = capaPoligono("mensura", c.nombre, d.mensura, c.fechaMensura, prj)
  const verticesMensura = capaVertices("vertices_mensura", d.grilla.linderos, prj)
  const pertenencias = crearShapefile(
    "pertenencias",
    [C_NOMBRE, C_AREA],
    d.grilla.pertenencias.map((p) => ({
      geometria: { tipo: "poligono", anillos: [anillo(p.vertices)] },
      atributos: { NOMBRE: p.nombre, AREA_HA: p.areaHa },
    })),
    prj,
  )
  const verticesPertenencias = capaVertices("vertices_pertenencias", d.grilla.todos, prj)
  const hito = crearShapefile(
    "hito_de_mensura",
    [C_ROL, C_NOMBRE, C_NORTE, C_ESTE],
    c.hito
      ? [{ geometria: { tipo: "punto", x: c.hito.e, y: c.hito.n }, atributos: { ROL: c.rol, NOMBRE: c.hito.nombre || c.nombre, NORTE: c.hito.n, ESTE: c.hito.e } }]
      : [],
    prj,
  )

  const shapefiles = [manifestacion, solicitud, mensura, verticesMensura, pertenencias, verticesPertenencias, hito]

  const zips: Record<string, Blob> = {
    "Manifestacion.zip": await zip([manifestacion]),
    "Solicitud_mensura.zip": await zip([solicitud]),
    "Mensura.zip": await zip([mensura, verticesMensura]),
    "Pertenencias.zip": await zip([pertenencias, verticesPertenencias]),
    "Hito_de_mensura.zip": await zip([hito]),
  }
  return { shapefiles, zips, derivados: d }
}

async function zip(capas: ArchivosShapefile[]): Promise<Blob> {
  const z = new JSZip()
  for (const capa of capas) {
    for (const [nombre, contenido] of Object.entries(capa.archivos)) z.file(nombre, contenido)
  }
  return z.generateAsync({ type: "blob", compression: "DEFLATE" })
}

/** Un solo ZIP con los cinco ZIP oficiales dentro, para descargar todo de una vez. */
export async function zipCompleto(p: PaqueteSernageomin): Promise<Blob> {
  const z = new JSZip()
  for (const [nombre, blob] of Object.entries(p.zips)) z.file(nombre, blob)
  return z.generateAsync({ type: "blob" })
}
