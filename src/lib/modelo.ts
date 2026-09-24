import type { Punto } from "./geometria"

/** Punto con nombre y altura opcional: hito de mensura, punto de amarre, auxiliares. */
export interface PuntoReferencia {
  nombre: string
  n: number
  e: number
  altura: number | null
}

/** Datos que ingresa el perito para una concesión en sus tres etapas. */
export interface Concesion {
  id: string
  /** ISO 8601 de la última modificación. */
  actualizadoEn: string
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
  /** Perímetro de la solicitud de mensura (anillo abierto). Vacío = mismo rectángulo de la manifestación. */
  perimetroSolicitud: Punto[]
  /** Perímetro de la mensura (anillo abierto). Vacío = misma solicitud de mensura. */
  perimetroMensura: Punto[]
  /** Tamaño de cada pertenencia, en metros. */
  pertenenciaEO: number
  pertenenciaNS: number
  /** Prefijo del nombre de cada pertenencia, p. ej. "ANTAQUENA 1,". */
  prefijoPertenencias: string
  hito: PuntoReferencia | null
  /** Vértice geodésico de amarre (IGM, red Sernageomin o hito autorizado). */
  amarre: PuntoReferencia | null
  /** Puntos auxiliares entre el amarre y el hito. */
  auxiliares: PuntoReferencia[]
}

export function nuevoId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Caso real de referencia: acta de mensura ANTAQUENA 1 1 AL 22 (Sierra Gorda, abril 2026). */
export const CONCESION_EJEMPLO: Concesion = {
  id: "ejemplo-antaquena-1",
  actualizadoEn: "2026-04-29T00:00:00.000Z",
  nombre: "ANTAQUENA 1 1 AL 22",
  rol: "20010-9160-6",
  epsg: 24879,
  fechaManifestacion: "2025-12-22",
  fechaSolicitudMensura: "2026-03-23",
  fechaMensura: "2026-04-29",
  pi: { n: 7_476_800, e: 465_500 },
  ladoNS: 400,
  ladoEO: 1000,
  perimetroSolicitud: [],
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
  hito: { nombre: "HM ANTAQUENA 1 1 AL 22", n: 7_476_968.934, e: 465_054.15, altura: 1698.91 },
  amarre: { nombre: "VERT. SED (SNGM)", n: 7_481_235.843, e: 462_933.594, altura: 1741.65 },
  auxiliares: [],
}

export function concesionVacia(): Concesion {
  return {
    id: nuevoId(),
    actualizadoEn: new Date().toISOString(),
    nombre: "",
    rol: "",
    epsg: 24879,
    fechaManifestacion: "",
    fechaSolicitudMensura: "",
    fechaMensura: "",
    pi: { n: 0, e: 0 },
    ladoNS: 1000,
    ladoEO: 1000,
    perimetroSolicitud: [],
    perimetroMensura: [],
    pertenenciaEO: 100,
    pertenenciaNS: 100,
    prefijoPertenencias: "",
    hito: null,
    amarre: null,
    auxiliares: [],
  }
}

function numero(v: unknown, defecto: number): number {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : defecto
}

function punto(v: unknown): Punto | null {
  if (!v || typeof v !== "object") return null
  const o = v as Record<string, unknown>
  return { n: numero(o.n, 0), e: numero(o.e, 0) }
}

function referencia(v: unknown): PuntoReferencia | null {
  if (!v || typeof v !== "object") return null
  const o = v as Record<string, unknown>
  const alt = o.altura == null || o.altura === "" ? null : numero(o.altura, NaN)
  return { nombre: String(o.nombre ?? ""), n: numero(o.n, 0), e: numero(o.e, 0), altura: alt === null || Number.isNaN(alt) ? null : alt }
}

function anillo(v: unknown): Punto[] {
  return Array.isArray(v) ? v.map(punto).filter((p): p is Punto => p !== null) : []
}

/** Completa una concesión guardada con versiones anteriores del modelo, o importada desde JSON. */
export function normalizarConcesion(raw: unknown): Concesion {
  const base = concesionVacia()
  if (!raw || typeof raw !== "object") return base
  const o = raw as Record<string, unknown>
  const pi = punto(o.pi) ?? base.pi
  return {
    ...base,
    id: typeof o.id === "string" && o.id ? o.id : base.id,
    actualizadoEn: typeof o.actualizadoEn === "string" ? o.actualizadoEn : base.actualizadoEn,
    nombre: String(o.nombre ?? ""),
    rol: String(o.rol ?? ""),
    epsg: numero(o.epsg, base.epsg),
    fechaManifestacion: String(o.fechaManifestacion ?? ""),
    fechaSolicitudMensura: String(o.fechaSolicitudMensura ?? ""),
    fechaMensura: String(o.fechaMensura ?? ""),
    pi,
    ladoNS: numero(o.ladoNS, base.ladoNS),
    ladoEO: numero(o.ladoEO, base.ladoEO),
    perimetroSolicitud: anillo(o.perimetroSolicitud),
    perimetroMensura: anillo(o.perimetroMensura),
    pertenenciaEO: numero(o.pertenenciaEO, base.pertenenciaEO),
    pertenenciaNS: numero(o.pertenenciaNS, base.pertenenciaNS),
    prefijoPertenencias: String(o.prefijoPertenencias ?? ""),
    hito: referencia(o.hito),
    amarre: referencia(o.amarre),
    auxiliares: Array.isArray(o.auxiliares) ? o.auxiliares.map(referencia).filter((p): p is PuntoReferencia => p !== null) : [],
  }
}
