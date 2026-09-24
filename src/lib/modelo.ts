import type { Punto } from "./geometria"

/** Datos que ingresa el perito para una concesión en sus tres etapas. */
export interface Concesion {
  nombre: string
  /** Rol nacional Sernageomin (p. ej. 20010-9160-6). */
  rol: string
  epsg: number
  /** Fechas en formato ISO AAAA-MM-DD. */
  fechaManifestacion: string
  fechaSolicitudMensura: string
  fechaMensura: string
  /** Punto de interés de la manifestación. */
  pi: Punto
  /** Lados del rectángulo de la manifestación, en metros. */
  ladoNS: number
  ladoEO: number
  /** Perímetro de la mensura (anillo abierto). Si está vacío, se usa el rectángulo de la manifestación. */
  perimetroMensura: Punto[]
  /** Tamaño de cada pertenencia, en metros. */
  pertenenciaEO: number
  pertenenciaNS: number
  /** Prefijo del nombre de cada pertenencia, p. ej. "ANTAQUENA 1,". */
  prefijoPertenencias: string
  hito: { nombre: string; n: number; e: number } | null
}

/** Caso real de referencia: acta de mensura ANTAQUENA 1 1 AL 22 (Sierra Gorda, abril 2026). */
export const CONCESION_EJEMPLO: Concesion = {
  nombre: "ANTAQUENA 1 1 AL 22",
  rol: "20010-9160-6",
  epsg: 24879,
  fechaManifestacion: "2025-12-22",
  fechaSolicitudMensura: "2026-03-23",
  fechaMensura: "2026-04-29",
  pi: { n: 7_476_800, e: 465_500 },
  ladoNS: 400,
  ladoEO: 1000,
  perimetroMensura: [
    { n: 7_477_000, e: 465_000 },
    { n: 7_477_000, e: 466_000 },
    { n: 7_476_600, e: 466_000 },
    { n: 7_476_600, e: 465_800 },
    { n: 7_476_700, e: 465_800 },
    { n: 7_476_700, e: 465_600 },
    { n: 7_476_800, e: 465_600 },
    { n: 7_476_800, e: 465_400 },
    { n: 7_476_900, e: 465_400 },
    { n: 7_476_900, e: 465_000 },
  ],
  pertenenciaEO: 100,
  pertenenciaNS: 100,
  prefijoPertenencias: "ANTAQUENA 1,",
  hito: { nombre: "HM ANTAQUENA 1 1 AL 22", n: 7_476_968.934, e: 465_054.15 },
}

export function concesionVacia(): Concesion {
  return {
    nombre: "",
    rol: "",
    epsg: 24879,
    fechaManifestacion: "",
    fechaSolicitudMensura: "",
    fechaMensura: "",
    pi: { n: 0, e: 0 },
    ladoNS: 1000,
    ladoEO: 1000,
    perimetroMensura: [],
    pertenenciaEO: 100,
    pertenenciaNS: 100,
    prefijoPertenencias: "",
    hito: null,
  }
}
