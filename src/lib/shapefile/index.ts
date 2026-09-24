import { escribirDbf, type CampoDbf, type RegistroDbf } from "./dbf"
import { escribirShp, type GeometriaShp } from "./shp"

export type { CampoDbf, RegistroDbf } from "./dbf"
export type { GeometriaShp, Coordenada } from "./shp"

export interface ArchivosShapefile {
  /** Nombre base sin extensión, p. ej. "mensura". */
  base: string
  archivos: Record<string, Uint8Array>
}

export interface EntidadShapefile {
  geometria: GeometriaShp
  atributos: RegistroDbf
}

/**
 * Genera el conjunto completo .shp/.shx/.dbf/.prj/.cpg de una capa.
 * La cantidad de geometrías y de registros de atributos debe coincidir.
 */
export function crearShapefile(base: string, campos: CampoDbf[], entidades: EntidadShapefile[], prj: string): ArchivosShapefile {
  if (!/^[a-z0-9_]+$/i.test(base)) throw new Error(`Nombre de shapefile inválido: ${base}`)
  const { shp, shx } = escribirShp(entidades.map((e) => e.geometria))
  const dbf = escribirDbf(campos, entidades.map((e) => e.atributos))
  const enc = new TextEncoder()
  return {
    base,
    archivos: {
      [`${base}.shp`]: shp,
      [`${base}.shx`]: shx,
      [`${base}.dbf`]: dbf,
      [`${base}.prj`]: enc.encode(prj),
      [`${base}.cpg`]: enc.encode("UTF-8"),
    },
  }
}
