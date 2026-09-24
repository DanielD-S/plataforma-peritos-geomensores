/**
 * Sistemas de referencia oficiales para mensuras mineras (Guía Sernageomin, enero 2026).
 * Solo se aceptan estos cuatro códigos EPSG. Los parámetros towgs84 son los mismos que
 * usa Pudumaps y sirven únicamente para la previsualización en el mapa: la plataforma
 * NO transforma coordenadas, recibe y entrega en el datum oficial que indique el perito.
 */

export type Datum = "PSAD56" | "SAD69"
export type Huso = 18 | 19

export interface Crs {
  epsg: number
  datum: Datum
  huso: Huso
  nombre: string
  /** Definición proj4, solo para dibujar en el mapa (referencial). */
  proj4: string
  /** Contenido exacto del archivo .prj (WKT estilo ESRI) que valida Sernageomin. */
  prj: string
}

const GEOGCS_PSAD56 =
  'GEOGCS["GCS_Provisional_S_American_1956",DATUM["D_Provisional_S_American_1956",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]'
const GEOGCS_SAD69 =
  'GEOGCS["GCS_South_American_1969",DATUM["D_South_American_1969",SPHEROID["GRS_1967_Truncated",6378160.0,298.25]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]'

function projcs(nombre: string, geogcs: string, meridianoCentral: number): string {
  return (
    `PROJCS["${nombre}",${geogcs},PROJECTION["Transverse_Mercator"],` +
    `PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",10000000.0],` +
    `PARAMETER["Central_Meridian",${meridianoCentral}.0],PARAMETER["Scale_Factor",0.9996],` +
    `PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]`
  )
}

export const CRS_OFICIALES: readonly Crs[] = [
  {
    epsg: 24878,
    datum: "PSAD56",
    huso: 18,
    nombre: "PSAD56 / UTM huso 18S",
    proj4: "+proj=utm +zone=18 +south +ellps=intl +towgs84=-302,272,-360,0,0,0,0 +units=m +no_defs +type=crs",
    prj: projcs("PSAD_1956_UTM_Zone_18S", GEOGCS_PSAD56, -75),
  },
  {
    epsg: 24879,
    datum: "PSAD56",
    huso: 19,
    nombre: "PSAD56 / UTM huso 19S",
    proj4: "+proj=utm +zone=19 +south +ellps=intl +towgs84=-302,272,-360,0,0,0,0 +units=m +no_defs +type=crs",
    prj: projcs("PSAD_1956_UTM_Zone_19S", GEOGCS_PSAD56, -69),
  },
  {
    epsg: 29188,
    datum: "SAD69",
    huso: 18,
    nombre: "SAD69 / UTM huso 18S",
    proj4: "+proj=utm +zone=18 +south +ellps=aust_SA +towgs84=-57,1,-41,0,0,0,0 +units=m +no_defs +type=crs",
    prj: projcs("SAD_1969_UTM_Zone_18S", GEOGCS_SAD69, -75),
  },
  {
    epsg: 29189,
    datum: "SAD69",
    huso: 19,
    nombre: "SAD69 / UTM huso 19S",
    proj4: "+proj=utm +zone=19 +south +ellps=aust_SA +towgs84=-57,1,-41,0,0,0,0 +units=m +no_defs +type=crs",
    prj: projcs("SAD_1969_UTM_Zone_19S", GEOGCS_SAD69, -69),
  },
]

export function crsPorEpsg(epsg: number): Crs {
  const crs = CRS_OFICIALES.find((c) => c.epsg === epsg)
  if (!crs) throw new Error(`EPSG ${epsg} no es un sistema oficial para mensuras mineras`)
  return crs
}

export function crsPorDatumHuso(datum: Datum, huso: Huso): Crs {
  const crs = CRS_OFICIALES.find((c) => c.datum === datum && c.huso === huso)
  if (!crs) throw new Error(`No existe CRS oficial para ${datum} huso ${huso}`)
  return crs
}
