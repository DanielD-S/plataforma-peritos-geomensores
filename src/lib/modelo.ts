import type { Punto } from "./geometria"

/** Punto con nombre y altura opcional: hito de mensura, punto de amarre, auxiliares. */
export interface PuntoReferencia {
  nombre: string
  n: number
  e: number
  altura: number | null
}

/** Datos del perito, comunes a toda la cartera. */
export interface Perito {
  nombre: string
  rut: string
  domicilio: string
}

/** Antecedentes de la causa, ubicación y textos libres que van en el acta de mensura. */
export interface DatosActa {
  juzgado: string
  causaRol: string
  titular: string
  manifestante: string
  nombreManifestacion: string
  pertenenciasManifestadas: number | null
  hectareasManifestadas: number | null
  conservador: string
  fechaInscripcion: string
  fojas: string
  numeroInscripcion: string
  pertenenciasSolicitadas: number | null
  hectareasSolicitadas: number | null
  exploracionInvocada: string
  juzgadoExploracion: string
  fechaInicioExploracion: string
  region: string
  provincia: string
  comuna: string
  lugar: string
  /** Textos libres del acta. */
  acceso: string
  yacimiento: string
  instrumental: string
  ligazon: string
  operacion: string
  linderos: string
  hitoDescripcion: string
  demasias: string
  observaciones: string
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
  acta: DatosActa
}

export function nuevoId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function peritoVacio(): Perito {
  return { nombre: "", rut: "", domicilio: "" }
}

export function actaVacia(): DatosActa {
  return {
    juzgado: "",
    causaRol: "",
    titular: "",
    manifestante: "",
    nombreManifestacion: "",
    pertenenciasManifestadas: null,
    hectareasManifestadas: null,
    conservador: "",
    fechaInscripcion: "",
    fojas: "",
    numeroInscripcion: "",
    pertenenciasSolicitadas: null,
    hectareasSolicitadas: null,
    exploracionInvocada: "",
    juzgadoExploracion: "",
    fechaInicioExploracion: "",
    region: "",
    provincia: "",
    comuna: "",
    lugar: "",
    acceso: "",
    yacimiento: "El área amparada corresponde a sustancias minerales concesibles.",
    instrumental: "",
    ligazon: "",
    operacion: "",
    linderos:
      "Los linderos están construidos de acuerdo con el artículo 32 del Reglamento del Código de Minería, con una altura no inferior a 0,80 metros, rellenos con concreto sólido y anclados al suelo.",
    hitoDescripcion: "",
    demasias: "No hay.",
    observaciones: "",
  }
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
  acta: {
    ...actaVacia(),
    juzgado: "2° Juzgado de Letras Civil de Antofagasta",
    causaRol: "V-521-2025",
    titular: "Sierra Gorda SCM",
    manifestante: "Marisol Gómez Contreras",
    nombreManifestacion: "ANTAQUENA 1 1 AL 40",
    pertenenciasManifestadas: 40,
    hectareasManifestadas: 40,
    conservador: "Conservador de Minas de Antofagasta",
    fechaInscripcion: "2025-12-29",
    fojas: "2231",
    numeroInscripcion: "1232",
    pertenenciasSolicitadas: 40,
    hectareasSolicitadas: 40,
    exploracionInvocada: "ANTAQUENA 1",
    juzgadoExploracion: "2° Juzgado de Letras de Antofagasta",
    fechaInicioExploracion: "2023-08-16",
    region: "II Región de Antofagasta",
    provincia: "Antofagasta",
    comuna: "Sierra Gorda",
    lugar: "Sierra Gorda",
    acceso:
      "Para llegar al H.M. se debe llegar al poblado de Sierra Gorda por ruta B-25, para luego salir del poblado en dirección NE por el camino de acceso a mina Dominador, recorriendo aproximadamente 4,8 kilómetros; en este punto (N 7.477.963; E 467.269) desviarse hacia el sur oeste y recorrer unos 0,87 kilómetros; en este punto (N 7.477.300; E 466.713) desviarse en dirección nor oeste y recorrer 2,8 kilómetros; en este punto (N 7.478.829; E 464.431) tomar dirección sur y recorrer 1,9 kilómetros; en este punto (N 7.477.205; E 465.236) tomar dirección sur oeste y recorrer 307 metros hasta llegar al Hito de la mensura.",
    instrumental:
      "Se utilizaron equipos GNSS geodésicos de doble frecuencia, marca Trimble modelo R6-2, de precisión horizontal en modalidad estático rápido de 5 mm + 0,5 ppm y de 10 mm + 1 ppm en modalidad cinemático en tiempo real. Para el postproceso de los datos se utilizó el software Trimble Business Center. Para ubicar los linderos vértices se utilizó la metodología GNSS cinemático en tiempo real; el transporte de la señal RTK se hizo a través del radio módem interno de los receptores R6-2 y R8 usado como repetidora.",
    ligazon:
      "Para la mensura se adoptó el sistema de coordenadas UTM cuyo elipsoide de referencia es el Internacional de 1924, cuyo origen es el Datum Provisorio Sudamericano 1956 La Canoa Venezuela (PSAD56), meridiano central 69° W, huso 19. Utilizando el sistema satelital GNSS y con base en el VERT. SED (SNGM) se realizó la medición del H.M. a través del método de radiación en modalidad estático rápido. El tiempo de exposición de los receptores, intervalo de grabación, rastreo de satélites, PDOP y máscara de elevación se rigió por lo estipulado en las normas del SERNAGEOMIN para la utilización de GNSS en mensuras mineras.",
    operacion:
      "Utilizando el sistema GNSS y con base en el VERT. SED (SNGM) se midieron los linderos vértices L1, L8, L9 y L10 y, por encontrarse ya materializados y en correcta ubicación, fueron respetados. Los linderos L2, L3, L4, L5, L6 y L7 no se pudieron medir ni materializar en terreno al estar cubiertos por el Botadero Norte de la compañía minera Sierra Gorda SCM.",
    hitoDescripcion:
      "El H.M. está construido de concreto, tiene una base cuadrada de un metro por lado. De su centro sobresale un tronco piramidal cuadrado de 0,40 metros por lado por 0,40 metros de alto; su cara superior cuadrada tiene 0,20 metros por lado y está pintado de color blanco, identificado con el nombre de las pertenencias y la fecha de solicitud de mensura. Del centro de la cara superior sobresale 55 mm un fierro de construcción de 12 mm de diámetro.",
    observaciones:
      "Las pertenencias mensuradas abarcan parcialmente a las pertenencias constituidas Trece de Mayo 1 al 36, del mismo concesionario; se adjuntan en la cartera de terreno los certificados de dominio vigente y la autorización del titular.",
  },
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
    acta: actaVacia(),
  }
}

function numero(v: unknown, defecto: number): number {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : defecto
}

function numeroONulo(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function texto(v: unknown, defecto = ""): string {
  return typeof v === "string" ? v : defecto
}

function punto(v: unknown): Punto | null {
  if (!v || typeof v !== "object") return null
  const o = v as Record<string, unknown>
  return { n: numero(o.n, 0), e: numero(o.e, 0) }
}

function referencia(v: unknown): PuntoReferencia | null {
  if (!v || typeof v !== "object") return null
  const o = v as Record<string, unknown>
  return { nombre: texto(o.nombre), n: numero(o.n, 0), e: numero(o.e, 0), altura: numeroONulo(o.altura) }
}

function anillo(v: unknown): Punto[] {
  return Array.isArray(v) ? v.map(punto).filter((p): p is Punto => p !== null) : []
}

export function normalizarPerito(raw: unknown): Perito {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  return { nombre: texto(o.nombre), rut: texto(o.rut), domicilio: texto(o.domicilio) }
}

function normalizarActa(raw: unknown): DatosActa {
  const base = actaVacia()
  if (!raw || typeof raw !== "object") return base
  const o = raw as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(base) as (keyof DatosActa)[]) {
    out[k] = typeof base[k] === "string" ? texto(o[k], base[k] as string) : numeroONulo(o[k])
  }
  return out as unknown as DatosActa
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
    actualizadoEn: texto(o.actualizadoEn, base.actualizadoEn),
    nombre: texto(o.nombre),
    rol: texto(o.rol),
    epsg: numero(o.epsg, base.epsg),
    fechaManifestacion: texto(o.fechaManifestacion),
    fechaSolicitudMensura: texto(o.fechaSolicitudMensura),
    fechaMensura: texto(o.fechaMensura),
    pi,
    ladoNS: numero(o.ladoNS, base.ladoNS),
    ladoEO: numero(o.ladoEO, base.ladoEO),
    perimetroSolicitud: anillo(o.perimetroSolicitud),
    perimetroMensura: anillo(o.perimetroMensura),
    pertenenciaEO: numero(o.pertenenciaEO, base.pertenenciaEO),
    pertenenciaNS: numero(o.pertenenciaNS, base.pertenenciaNS),
    prefijoPertenencias: texto(o.prefijoPertenencias),
    hito: referencia(o.hito),
    amarre: referencia(o.amarre),
    auxiliares: Array.isArray(o.auxiliares) ? o.auxiliares.map(referencia).filter((p): p is PuntoReferencia => p !== null) : [],
    acta: normalizarActa(o.acta),
  }
}
