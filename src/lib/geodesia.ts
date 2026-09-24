/**
 * Coordenadas geográficas y convergencia meridiana en el MISMO datum de la mensura.
 * Es la inversa pura de la proyección UTM sobre el elipsoide del datum, sin ningún
 * cambio de datum: lo que exige el acta ("coordenadas geográficas del H.M.").
 */
import proj4 from "proj4"
import { crsPorEpsg } from "./crs"
import type { Punto } from "./geometria"

export interface Geograficas {
  /** Latitud en grados decimales (negativa al sur). */
  lat: number
  /** Longitud en grados decimales (negativa al oeste). */
  lon: number
  /** Convergencia meridiana en grados centesimales (gon), con signo. */
  convergenciaGon: number
  /** Convergencia meridiana en grados sexagesimales, con signo. */
  convergenciaGrados: number
}

function elipsoide(epsg: number): string {
  return crsPorEpsg(epsg).datum === "PSAD56" ? "intl" : "aust_SA"
}

/** Definiciones sin towgs84 para que proj4 no aplique ningún cambio de datum. */
function definiciones(epsg: number): { utm: string; geo: string; meridianoCentral: number } {
  const crs = crsPorEpsg(epsg)
  const ell = elipsoide(epsg)
  return {
    utm: `+proj=utm +zone=${crs.huso} +south +ellps=${ell} +units=m +no_defs`,
    geo: `+proj=longlat +ellps=${ell} +no_defs`,
    meridianoCentral: crs.huso === 19 ? -69 : -75,
  }
}

/**
 * Convergencia meridiana γ ≈ Δλ·sinφ + (Δλ³/3)·sinφ·cos²φ·(1 + 3η² + 2η⁴), suficiente al
 * diezmilésimo de gon dentro de un huso UTM. Signo: positivo cuando el norte de cuadrícula
 * queda al este del norte geográfico (en el hemisferio sur, al oeste del meridiano central).
 */
export function convergenciaMeridiana(latDeg: number, lonDeg: number, meridianoCentral: number, epsg: number): number {
  const φ = (latDeg * Math.PI) / 180
  const Δλ = ((lonDeg - meridianoCentral) * Math.PI) / 180
  const e2 = elipsoide(epsg) === "intl" ? 0.00672267 : 0.006694542
  const η2 = (e2 / (1 - e2)) * Math.cos(φ) ** 2
  const γ = Δλ * Math.sin(φ) + ((Δλ ** 3) / 3) * Math.sin(φ) * Math.cos(φ) ** 2 * (1 + 3 * η2 + 2 * η2 ** 2)
  return (γ * 180) / Math.PI
}

export function aGeograficas(p: Punto, epsg: number): Geograficas {
  const d = definiciones(epsg)
  const [lon, lat] = proj4(d.utm, d.geo, [p.e, p.n])
  const convergenciaGrados = convergenciaMeridiana(lat, lon, d.meridianoCentral, epsg)
  return { lat, lon, convergenciaGon: (convergenciaGrados * 400) / 360, convergenciaGrados }
}

export interface Sexagesimal {
  grados: number
  minutos: number
  segundos: number
  hemisferio: "N" | "S" | "E" | "O"
}

export function aSexagesimal(valor: number, eje: "lat" | "lon", decimalesSeg = 4): Sexagesimal {
  const abs = Math.abs(valor)
  let grados = Math.floor(abs)
  let minutos = Math.floor((abs - grados) * 60)
  let segundos = Number((((abs - grados) * 60 - minutos) * 60).toFixed(decimalesSeg))
  if (segundos >= 60) {
    segundos -= 60
    minutos += 1
  }
  if (minutos >= 60) {
    minutos -= 60
    grados += 1
  }
  const hemisferio = eje === "lat" ? (valor < 0 ? "S" : "N") : valor < 0 ? "O" : "E"
  return { grados, minutos, segundos, hemisferio }
}

/** 22° 48' 51,3115'' S */
export function formatoSexagesimal(valor: number, eje: "lat" | "lon", decimalesSeg = 4): string {
  const s = aSexagesimal(valor, eje, decimalesSeg)
  const seg = s.segundos.toFixed(decimalesSeg).replace(".", ",")
  return `${s.grados}° ${s.minutos}' ${seg}'' ${s.hemisferio}`
}
