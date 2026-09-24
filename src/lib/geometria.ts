/**
 * Geometría de concesiones mineras en coordenadas UTM (metros).
 * Convención: N = norte (Y), E = este (X). Los polígonos son anillos abiertos
 * (el último vértice no repite el primero) recorridos en sentido horario desde el
 * vértice más al noroeste, tal como se describe en las actas de mensura.
 */

export interface Punto {
  n: number
  e: number
}

export type TipoVertice = "lindero" | "interior"

export interface Vertice extends Punto {
  nombre: string
  tipo: TipoVertice
  /** Nombre generado por la convención, antes de cualquier alias del perito. */
  nombreBase: string
}

export interface Pertenencia {
  indice: number
  nombre: string
  /** Vértices NW, NE, SE, SW (sentido horario). */
  vertices: [Vertice, Vertice, Vertice, Vertice]
  areaHa: number
}

export interface Grilla {
  pertenencias: Pertenencia[]
  linderos: Vertice[]
  interiores: Vertice[]
  /** Linderos + interiores, en orden de numeración. */
  todos: Vertice[]
}

const TOL = 1e-6

export function redondear(v: number, dec = 3): number {
  const f = 10 ** dec
  return Math.round(v * f) / f
}

/** Área con la fórmula del zapato (shoelace), en m², siempre positiva. */
export function areaM2(poligono: Punto[]): number {
  let s = 0
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i]
    const b = poligono[(i + 1) % poligono.length]
    s += a.e * b.n - b.e * a.n
  }
  return Math.abs(s) / 2
}

export function areaHa(poligono: Punto[]): number {
  return areaM2(poligono) / 10_000
}

/** Área con signo: negativa si el anillo va en sentido horario (X=E, Y=N). */
function areaConSigno(poligono: Punto[]): number {
  let s = 0
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i]
    const b = poligono[(i + 1) % poligono.length]
    s += a.e * b.n - b.e * a.n
  }
  return s / 2
}

export function esHorario(poligono: Punto[]): boolean {
  return areaConSigno(poligono) < 0
}

/**
 * Normaliza un anillo: elimina el cierre duplicado, lo orienta en sentido horario y
 * lo rota para que empiece en el vértice más al norte (y entre ellos, el más al oeste).
 */
export function normalizarPerimetro(poligono: Punto[]): Punto[] {
  let p = poligono.slice()
  if (p.length > 1) {
    const a = p[0]
    const z = p[p.length - 1]
    if (Math.abs(a.n - z.n) < TOL && Math.abs(a.e - z.e) < TOL) p = p.slice(0, -1)
  }
  if (p.length < 3) return p
  if (!esHorario(p)) p = p.reverse()
  let idx = 0
  for (let i = 1; i < p.length; i++) {
    const c = p[i]
    const m = p[idx]
    if (c.n > m.n + TOL || (Math.abs(c.n - m.n) <= TOL && c.e < m.e - TOL)) idx = i
  }
  return [...p.slice(idx), ...p.slice(0, idx)]
}

/**
 * Rectángulo centrado en el punto de interés con lados NS y EO en metros.
 * Devuelve NW, NE, SE, SW (sentido horario).
 */
export function rectanguloDesdePI(pi: Punto, ladoNS: number, ladoEO: number): Punto[] {
  const dn = ladoNS / 2
  const de = ladoEO / 2
  return [
    { n: pi.n + dn, e: pi.e - de },
    { n: pi.n + dn, e: pi.e + de },
    { n: pi.n - dn, e: pi.e + de },
    { n: pi.n - dn, e: pi.e - de },
  ]
}

/** Punto dentro o sobre el borde de un polígono (ray casting + prueba de borde). */
export function puntoEnPoligono(p: Punto, poligono: Punto[]): boolean {
  const n = poligono.length
  for (let i = 0; i < n; i++) {
    if (puntoEnSegmento(p, poligono[i], poligono[(i + 1) % n])) return true
  }
  let dentro = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = poligono[i]
    const b = poligono[j]
    const cruza = a.n > p.n !== b.n > p.n
    if (cruza) {
      const x = ((b.e - a.e) * (p.n - a.n)) / (b.n - a.n) + a.e
      if (p.e < x) dentro = !dentro
    }
  }
  return dentro
}

function puntoEnSegmento(p: Punto, a: Punto, b: Punto): boolean {
  const cruz = (b.e - a.e) * (p.n - a.n) - (b.n - a.n) * (p.e - a.e)
  if (Math.abs(cruz) > TOL * Math.max(1, Math.hypot(b.e - a.e, b.n - a.n))) return false
  const minE = Math.min(a.e, b.e) - TOL
  const maxE = Math.max(a.e, b.e) + TOL
  const minN = Math.min(a.n, b.n) - TOL
  const maxN = Math.max(a.n, b.n) + TOL
  return p.e >= minE && p.e <= maxE && p.n >= minN && p.n <= maxN
}

function clave(p: Punto): string {
  return `${Math.round(p.n * 1000)}|${Math.round(p.e * 1000)}`
}

/**
 * Genera la grilla de pertenencias dentro del perímetro de la mensura, siguiendo la
 * convención de las actas:
 *  - Linderos L-1..L-n: vértices del perímetro, desde el NW en sentido horario.
 *  - Celdas de ancho (E-O) x alto (N-S) apoyadas en la esquina NW del perímetro,
 *    numeradas por filas de norte a sur y de oeste a este; solo las totalmente contenidas.
 *  - Vértices interiores: nodos de la grilla que no son linderos, numerados desde n+1
 *    por filas de norte a sur y de oeste a este.
 *  - Cada pertenencia lista sus vértices NW, NE, SE, SW.
 */
export function generarGrilla(
  perimetroEntrada: Punto[],
  ancho: number,
  alto: number,
  prefijo: string,
  prefijoLindero = "L-",
  /** Primer número de los vértices interiores; por defecto, cantidad de linderos + 1. */
  inicioInteriores: number | null = null,
): Grilla {
  const perimetro = normalizarPerimetro(perimetroEntrada)
  if (perimetro.length < 3 || ancho <= 0 || alto <= 0) {
    return { pertenencias: [], linderos: [], interiores: [], todos: [] }
  }

  const linderos: Vertice[] = perimetro.map((p, i) => ({
    ...p,
    nombre: `${prefijoLindero}${i + 1}`,
    nombreBase: `${prefijoLindero}${i + 1}`,
    tipo: "lindero",
  }))
  const nombresLindero = new Map(linderos.map((l) => [clave(l), l]))

  const nMax = Math.max(...perimetro.map((p) => p.n))
  const nMin = Math.min(...perimetro.map((p) => p.n))
  const eMin = Math.min(...perimetro.map((p) => p.e))
  const eMax = Math.max(...perimetro.map((p) => p.e))
  const filas = Math.round((nMax - nMin) / alto + 1e-9)
  const cols = Math.round((eMax - eMin) / ancho + 1e-9)

  type Celda = { fila: number; col: number; nw: Punto; ne: Punto; se: Punto; sw: Punto }
  const celdas: Celda[] = []
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      const nTop = nMax - f * alto
      const eLeft = eMin + c * ancho
      const nw = { n: nTop, e: eLeft }
      const ne = { n: nTop, e: eLeft + ancho }
      const se = { n: nTop - alto, e: eLeft + ancho }
      const sw = { n: nTop - alto, e: eLeft }
      const centro = { n: nTop - alto / 2, e: eLeft + ancho / 2 }
      const dentro = [nw, ne, se, sw, centro].every((p) => puntoEnPoligono(p, perimetro))
      if (dentro) celdas.push({ fila: f, col: c, nw, ne, se, sw })
    }
  }

  // Nodos de la grilla que no son linderos, ordenados N desc, E asc.
  const nodos = new Map<string, Punto>()
  for (const c of celdas) {
    for (const p of [c.nw, c.ne, c.se, c.sw]) {
      const k = clave(p)
      if (!nombresLindero.has(k) && !nodos.has(k)) nodos.set(k, p)
    }
  }
  const interioresOrdenados = [...nodos.values()].sort((a, b) => b.n - a.n || a.e - b.e)
  const primero = inicioInteriores != null && inicioInteriores > 0 ? Math.round(inicioInteriores) : linderos.length + 1
  const interiores: Vertice[] = interioresOrdenados.map((p, i) => ({
    ...p,
    nombre: String(primero + i),
    nombreBase: String(primero + i),
    tipo: "interior",
  }))
  const indice = new Map<string, Vertice>([
    ...linderos.map((l) => [clave(l), l] as const),
    ...interiores.map((v) => [clave(v), v] as const),
  ])

  const pertenencias: Pertenencia[] = celdas.map((c, i) => {
    const v = (p: Punto) => indice.get(clave(p))!
    const poly = [c.nw, c.ne, c.se, c.sw]
    return {
      indice: i + 1,
      nombre: `${prefijo} ${i + 1}`.trim(),
      vertices: [v(c.nw), v(c.ne), v(c.se), v(c.sw)],
      areaHa: areaHa(poly),
    }
  })

  return { pertenencias, linderos, interiores, todos: [...linderos, ...interiores] }
}

/** Distancia UTM en metros. */
export function distancia(a: Punto, b: Punto): number {
  return Math.hypot(b.e - a.e, b.n - a.n)
}

/** Azimut UTM en grados centesimales (0 = norte, 100 = este, 200 = sur, 300 = oeste). */
export function azimutCentesimal(desde: Punto, hasta: Punto): number {
  const rad = Math.atan2(hasta.e - desde.e, hasta.n - desde.n)
  let grad = (rad * 200) / Math.PI
  if (grad < 0) grad += 400
  if (grad >= 400 - 1e-9) grad -= 400
  return grad
}

export interface RelacionAzimut {
  desde: string
  hasta: string
  azimut: number
  distancia: number
}

export function relacionDesdePunto(origen: Vertice | (Punto & { nombre: string }), destinos: Vertice[]): RelacionAzimut[] {
  return destinos.map((d) => ({
    desde: origen.nombre,
    hasta: d.nombre,
    azimut: azimutCentesimal(origen, d),
    distancia: distancia(origen, d),
  }))
}

/** Descripción tabular del perímetro: de cada lindero al siguiente. */
export function descripcionPerimetro(linderos: Vertice[]): RelacionAzimut[] {
  return linderos.map((l, i) => {
    const s = linderos[(i + 1) % linderos.length]
    return { desde: l.nombre, hasta: s.nombre, azimut: azimutCentesimal(l, s), distancia: distancia(l, s) }
  })
}

/**
 * Limpia un anillo que viene de una fuente con ruido (catastro reproyectado, KML):
 * redondea las coordenadas al paso, quita vértices repetidos y vértices colineales.
 */
export function simplificarAnillo(anillo: Punto[], paso: number): Punto[] {
  const r = (v: number) => (paso > 0 ? Math.round(v / paso) * paso : redondear(v, 3))
  let p = normalizarPerimetro(anillo).map((v) => ({ n: r(v.n), e: r(v.e) }))
  // Repetidos consecutivos
  p = p.filter((v, i) => i === 0 || Math.abs(v.n - p[i - 1].n) > TOL || Math.abs(v.e - p[i - 1].e) > TOL)
  if (p.length > 1 && Math.abs(p[0].n - p[p.length - 1].n) < TOL && Math.abs(p[0].e - p[p.length - 1].e) < TOL) p.pop()
  // Colineales (incluye giros de 180°)
  let cambio = true
  while (cambio && p.length > 3) {
    cambio = false
    for (let i = 0; i < p.length; i++) {
      const a = p[(i - 1 + p.length) % p.length]
      const b = p[i]
      const c = p[(i + 1) % p.length]
      const cruz = (b.e - a.e) * (c.n - b.n) - (b.n - a.n) * (c.e - b.e)
      if (Math.abs(cruz) < TOL) {
        p.splice(i, 1)
        cambio = true
        break
      }
    }
  }
  return normalizarPerimetro(p)
}

/** Bounding box del conjunto de puntos. */
export function bbox(puntos: Punto[]): { nMin: number; nMax: number; eMin: number; eMax: number } {
  return {
    nMin: Math.min(...puntos.map((p) => p.n)),
    nMax: Math.max(...puntos.map((p) => p.n)),
    eMin: Math.min(...puntos.map((p) => p.e)),
    eMax: Math.max(...puntos.map((p) => p.e)),
  }
}
