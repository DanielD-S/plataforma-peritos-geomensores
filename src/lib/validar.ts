/**
 * Revisión de una concesión antes de generar los archivos. No bloquea la descarga:
 * el perito decide. "error" es algo que Sernageomin o la norma objetarían;
 * "aviso" es un dato faltante o una rareza que conviene mirar.
 */
import polygonClipping, { type Polygon as PolygonPc } from "polygon-clipping"
import proj4 from "proj4"
import { crsPorEpsg } from "./crs"
import { distancia, type Punto } from "./geometria"
import type { Concesion } from "./modelo"
import { piValido, type Derivados } from "./sernageomin"

export type Severidad = "error" | "aviso"

export interface Hallazgo {
  severidad: Severidad
  mensaje: string
}

const TOL_M = 0.001
/** Rango de norte UTM que cubre Chile continental e insular (aprox. 17,5° S a 56° S). */
const N_MIN = 3_700_000
const N_MAX = 8_100_000
/** Rango razonable de este dentro de un huso UTM, con holgura para concesiones en el huso vecino. */
const E_MIN = 100_000
const E_MAX = 900_000

function aPc(p: Punto[]): PolygonPc {
  return [[...p, p[0]].map((v) => [v.e, v.n] as [number, number])]
}

function areaPc(mp: [number, number][][][]): number {
  let total = 0
  for (const poly of mp) {
    poly.forEach((anillo, i) => {
      let s = 0
      for (let k = 0; k < anillo.length - 1; k++) s += anillo[k][0] * anillo[k + 1][1] - anillo[k + 1][0] * anillo[k][1]
      total += i === 0 ? Math.abs(s / 2) : -Math.abs(s / 2)
    })
  }
  return total
}

/** Área (m²) de la parte de `interior` que queda fuera de `exterior`. */
export function areaFuera(interior: Punto[], exterior: Punto[]): number {
  if (interior.length < 3 || exterior.length < 3) return 0
  try {
    return areaPc(polygonClipping.difference(aPc(interior), aPc(exterior)))
  } catch {
    return 0
  }
}

export function esRectilineo(p: Punto[]): boolean {
  return p.every((v, i) => {
    const s = p[(i + 1) % p.length]
    return Math.abs(v.n - s.n) < TOL_M || Math.abs(v.e - s.e) < TOL_M
  })
}

function husoDe(pi: Punto, epsg: number): number | null {
  try {
    const [lon] = proj4(crsPorEpsg(epsg).proj4, "EPSG:4326", [pi.e, pi.n])
    return Math.floor((lon + 180) / 6) + 1
  } catch {
    return null
  }
}

function fueraDeRango(p: Punto): boolean {
  return p.n < N_MIN || p.n > N_MAX || p.e < E_MIN || p.e > E_MAX
}

export function validarConcesion(c: Concesion, d: Derivados): Hallazgo[] {
  const h: Hallazgo[] = []
  const aviso = (mensaje: string) => h.push({ severidad: "aviso", mensaje })
  const error = (mensaje: string) => h.push({ severidad: "error", mensaje })

  // Datos faltantes
  if (!c.nombre.trim()) aviso("Falta el nombre de la concesión.")
  if (!c.rol.trim()) aviso("Falta el rol nacional (va en el atributo ROL del hito).")
  else if (!/^\d{5}-\d{4}-[\dkK]$/.test(c.rol.trim())) aviso(`El rol "${c.rol}" no tiene el formato 20010-9160-6.`)
  if (!piValido(c.pi)) aviso("Falta el punto de interés de la manifestación.")
  if (!(c.ladoNS > 0 && c.ladoEO > 0)) aviso("Los lados de la manifestación deben ser mayores que cero.")
  if (!c.fechaManifestacion) aviso("Falta la fecha de manifestación.")
  if (!c.fechaSolicitudMensura) aviso("Falta la fecha de solicitud de mensura.")
  if (!c.fechaMensura) aviso("Falta la fecha de mensura.")
  if (!c.hito || !(c.hito.n > 0 && c.hito.e > 0)) aviso("Falta el hito de mensura: el ZIP del hito saldrá vacío.")

  // Fechas en orden
  if (c.fechaManifestacion && c.fechaSolicitudMensura && c.fechaManifestacion > c.fechaSolicitudMensura) error("La solicitud de mensura es anterior a la manifestación.")
  if (c.fechaSolicitudMensura && c.fechaMensura && c.fechaSolicitudMensura > c.fechaMensura) error("La mensura es anterior a la solicitud de mensura.")

  // Coordenadas y huso
  const crs = crsPorEpsg(c.epsg)
  if (piValido(c.pi)) {
    if (fueraDeRango(c.pi)) error("El punto de interés queda fuera del rango UTM de Chile: revisa norte y este.")
    else {
      const huso = husoDe(c.pi, c.epsg)
      if (huso !== null && huso !== crs.huso) aviso(`El punto de interés cae en el huso ${huso} y el sistema elegido es huso ${crs.huso}. La guía permite usar el huso donde queda la mayor parte de la concesión.`)
    }
  }
  const puntosRef = [c.hito, c.amarre, ...c.auxiliares].filter((p): p is NonNullable<typeof p> => !!p && p.n > 0 && p.e > 0)
  for (const p of puntosRef) if (fueraDeRango(p)) error(`El punto "${p.nombre || "sin nombre"}" queda fuera del rango UTM de Chile.`)

  // Geometría de la mensura
  const m = d.mensura
  if (m.length >= 3) {
    if (!esRectilineo(m)) aviso("El perímetro de la mensura tiene lados que no son norte-sur ni este-oeste.")
    else {
      m.forEach((v, i) => {
        const s = m[(i + 1) % m.length]
        const largo = distancia(v, s)
        const paso = Math.abs(v.n - s.n) < TOL_M ? c.pertenenciaEO : c.pertenenciaNS
        if (paso > 0 && Math.abs(largo / paso - Math.round(largo / paso)) > 1e-6) {
          aviso(`El lado L-${i + 1} a L-${(i + 1) % m.length + 1} mide ${largo.toFixed(2)} m y no es múltiplo de ${paso} m.`)
        }
      })
    }
    const areaPert = d.grilla.pertenencias.reduce((s, p) => s + p.areaHa, 0)
    if (Math.abs(areaPert - d.areaMensuraHa) > 1e-4) {
      error(`Las pertenencias cubren ${areaPert.toFixed(2)} ha de ${d.areaMensuraHa.toFixed(2)} ha: hay parte del perímetro sin pertenencias.`)
    }
    if (d.grilla.pertenencias.length === 0) error("No se generó ninguna pertenencia dentro del perímetro.")
    if (d.solicitud.length >= 3 && areaFuera(m, d.solicitud) > 1) error("La mensura se sale de la solicitud de mensura.")
  }
  if (d.solicitud.length >= 3 && d.manifestacion.length >= 3 && areaFuera(d.solicitud, d.manifestacion) > 1) {
    error("La solicitud de mensura se sale de la manifestación.")
  }
  if (c.hito && c.hito.n > 0 && m.length >= 3) {
    const lejos = m.every((v) => distancia(v, c.hito!) > 5_000)
    if (lejos) aviso("El hito de mensura está a más de 5 km de todos los linderos: revisa sus coordenadas.")
  }
  if (c.amarre && c.amarre.n > 0 && c.hito && c.hito.n > 0 && distancia(c.amarre, c.hito) > 50_000) {
    aviso("El punto de amarre está a más de 50 km del hito: revisa sus coordenadas.")
  }

  return h
}
