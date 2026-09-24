/**
 * Escritor mínimo de geometrías ESRI Shapefile (.shp + .shx).
 * Soporta Point (tipo 1) y Polygon (tipo 5) en 2D. Coordenadas X = Este, Y = Norte.
 */

export type Coordenada = [x: number, y: number]

export type GeometriaShp =
  | { tipo: "punto"; x: number; y: number }
  | { tipo: "poligono"; anillos: Coordenada[][] }

const TIPO_PUNTO = 1
const TIPO_POLIGONO = 5

function areaConSigno(anillo: Coordenada[]): number {
  let s = 0
  for (let i = 0; i < anillo.length - 1; i++) {
    s += anillo[i][0] * anillo[i + 1][1] - anillo[i + 1][0] * anillo[i][1]
  }
  return s / 2
}

/** Cierra el anillo y lo orienta en sentido horario (exigido por el formato para anillos exteriores). */
export function anilloExterior(anillo: Coordenada[]): Coordenada[] {
  let a = anillo.slice()
  const p = a[0]
  const z = a[a.length - 1]
  if (p[0] !== z[0] || p[1] !== z[1]) a.push([p[0], p[1]])
  if (areaConSigno(a) > 0) a = a.reverse()
  return a
}

function bboxDe(coords: Coordenada[]): [number, number, number, number] {
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity
  for (const [x, y] of coords) {
    if (x < xmin) xmin = x
    if (x > xmax) xmax = x
    if (y < ymin) ymin = y
    if (y > ymax) ymax = y
  }
  return [xmin, ymin, xmax, ymax]
}

interface Registro {
  contenido: Uint8Array
}

function registroPunto(x: number, y: number): Registro {
  const b = new ArrayBuffer(20)
  const dv = new DataView(b)
  dv.setInt32(0, TIPO_PUNTO, true)
  dv.setFloat64(4, x, true)
  dv.setFloat64(12, y, true)
  return { contenido: new Uint8Array(b) }
}

function registroPoligono(anillos: Coordenada[][]): Registro {
  const cerrados = anillos.map((a, i) => (i === 0 ? anilloExterior(a) : a))
  const puntos = cerrados.flat()
  const [xmin, ymin, xmax, ymax] = bboxDe(puntos)
  const largo = 4 + 32 + 4 + 4 + 4 * cerrados.length + 16 * puntos.length
  const b = new ArrayBuffer(largo)
  const dv = new DataView(b)
  let off = 0
  dv.setInt32(off, TIPO_POLIGONO, true); off += 4
  dv.setFloat64(off, xmin, true); off += 8
  dv.setFloat64(off, ymin, true); off += 8
  dv.setFloat64(off, xmax, true); off += 8
  dv.setFloat64(off, ymax, true); off += 8
  dv.setInt32(off, cerrados.length, true); off += 4
  dv.setInt32(off, puntos.length, true); off += 4
  let idx = 0
  for (const a of cerrados) {
    dv.setInt32(off, idx, true); off += 4
    idx += a.length
  }
  for (const [x, y] of puntos) {
    dv.setFloat64(off, x, true); off += 8
    dv.setFloat64(off, y, true); off += 8
  }
  return { contenido: new Uint8Array(b) }
}

function cabecera(tipo: number, largoBytes: number, bb: [number, number, number, number]): Uint8Array {
  const b = new ArrayBuffer(100)
  const dv = new DataView(b)
  dv.setInt32(0, 9994, false)
  dv.setInt32(24, largoBytes / 2, false)
  dv.setInt32(28, 1000, true)
  dv.setInt32(32, tipo, true)
  dv.setFloat64(36, bb[0], true)
  dv.setFloat64(44, bb[1], true)
  dv.setFloat64(52, bb[2], true)
  dv.setFloat64(60, bb[3], true)
  return new Uint8Array(b)
}

/**
 * Escribe todas las geometrías (todas del mismo tipo) y devuelve .shp y .shx.
 * Una lista vacía produce un shapefile válido sin registros.
 */
export function escribirShp(geometrias: GeometriaShp[]): { shp: Uint8Array; shx: Uint8Array; tipo: number } {
  if (geometrias.length === 0) {
    const h = cabecera(0, 100, [0, 0, 0, 0])
    return { shp: h, shx: h.slice(), tipo: 0 }
  }
  const tipo = geometrias[0].tipo === "punto" ? TIPO_PUNTO : TIPO_POLIGONO
  const registros: Registro[] = []
  const todos: Coordenada[] = []
  for (const g of geometrias) {
    if ((g.tipo === "punto" ? TIPO_PUNTO : TIPO_POLIGONO) !== tipo) {
      throw new Error("Todas las geometrías de un shapefile deben ser del mismo tipo")
    }
    if (g.tipo === "punto") {
      registros.push(registroPunto(g.x, g.y))
      todos.push([g.x, g.y])
    } else {
      registros.push(registroPoligono(g.anillos))
      todos.push(...g.anillos.flat())
    }
  }
  const bb = bboxDe(todos)
  const largoShp = 100 + registros.reduce((s, r) => s + 8 + r.contenido.length, 0)
  const largoShx = 100 + 8 * registros.length

  const shp = new Uint8Array(largoShp)
  const shx = new Uint8Array(largoShx)
  shp.set(cabecera(tipo, largoShp, bb), 0)
  shx.set(cabecera(tipo, largoShx, bb), 0)
  const dvShp = new DataView(shp.buffer)
  const dvShx = new DataView(shx.buffer)

  let off = 100
  registros.forEach((r, i) => {
    const largoPalabras = r.contenido.length / 2
    dvShx.setInt32(100 + i * 8, off / 2, false)
    dvShx.setInt32(100 + i * 8 + 4, largoPalabras, false)
    dvShp.setInt32(off, i + 1, false)
    dvShp.setInt32(off + 4, largoPalabras, false)
    shp.set(r.contenido, off + 8)
    off += 8 + r.contenido.length
  })
  return { shp, shx, tipo }
}
