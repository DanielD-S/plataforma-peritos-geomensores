/**
 * Plano de mensura en DXF (AutoCAD R12 / AC1009), escrito sin dependencias.
 * R12 lo abren AutoCAD, QGIS, ezdxf y cualquier visor CAD. Coordenadas del modelo en metros:
 * X = Este, Y = Norte, en el datum oficial de la mensura, sin transformar.
 *
 * Capas: MANIFESTACION, SOLICITUD, MENSURA, PERTENENCIAS, PERTENENCIAS_TEXTO, VERTICES,
 * VERTICES_TEXTO, HITO, AMARRE, AUXILIARES, CUADROS, CARATULA, NORTE.
 * La carátula es un primer diseño: se ajusta cuando haya planos de referencia de la asociación.
 */
import { crsPorEpsg } from "./crs"
import { azimutCl, coordenadaCl, fechaCl, numeroCl } from "./formato"
import { bbox, relacionDesdePunto, type Punto } from "./geometria"
import type { Concesion, Perito } from "./modelo"
import type { Derivados } from "./sernageomin"

export interface EntradaDxf {
  concesion: Concesion
  perito: Perito
  derivados: Derivados
}

/** Colores AutoCAD (ACI). */
const COLOR = { rojo: 1, amarillo: 2, verde: 3, cian: 4, azul: 5, magenta: 6, blanco: 7, gris: 8, naranja: 30, violeta: 200 }

interface Capa {
  nombre: string
  color: number
  tipoLinea: "CONTINUOUS" | "DASHED"
}

const CAPAS: Capa[] = [
  { nombre: "MANIFESTACION", color: COLOR.naranja, tipoLinea: "DASHED" },
  { nombre: "SOLICITUD", color: COLOR.violeta, tipoLinea: "DASHED" },
  { nombre: "MENSURA", color: COLOR.verde, tipoLinea: "CONTINUOUS" },
  { nombre: "PERTENENCIAS", color: COLOR.gris, tipoLinea: "CONTINUOUS" },
  { nombre: "PERTENENCIAS_TEXTO", color: COLOR.gris, tipoLinea: "CONTINUOUS" },
  { nombre: "VERTICES", color: COLOR.azul, tipoLinea: "CONTINUOUS" },
  { nombre: "VERTICES_TEXTO", color: COLOR.azul, tipoLinea: "CONTINUOUS" },
  { nombre: "HITO", color: COLOR.rojo, tipoLinea: "CONTINUOUS" },
  { nombre: "AMARRE", color: COLOR.magenta, tipoLinea: "CONTINUOUS" },
  { nombre: "AUXILIARES", color: COLOR.magenta, tipoLinea: "CONTINUOUS" },
  { nombre: "CUADROS", color: COLOR.blanco, tipoLinea: "CONTINUOUS" },
  { nombre: "CARATULA", color: COLOR.blanco, tipoLinea: "CONTINUOUS" },
  { nombre: "NORTE", color: COLOR.blanco, tipoLinea: "CONTINUOUS" },
]

function f(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, "")
}

class Escritor {
  private lineas: string[] = []
  par(codigo: number, valor: string | number): this {
    this.lineas.push(String(codigo), typeof valor === "number" ? f(valor) : valor)
    return this
  }
  texto(): string {
    return this.lineas.join("\r\n") + "\r\n"
  }
}

function polilinea(w: Escritor, capa: string, puntos: Punto[], cerrada: boolean): void {
  w.par(0, "POLYLINE").par(8, capa).par(66, 1).par(70, cerrada ? 1 : 0).par(10, 0).par(20, 0).par(30, 0)
  for (const p of puntos) w.par(0, "VERTEX").par(8, capa).par(10, p.e).par(20, p.n).par(30, 0)
  w.par(0, "SEQEND").par(8, capa)
}

function circulo(w: Escritor, capa: string, c: Punto, radio: number): void {
  w.par(0, "CIRCLE").par(8, capa).par(10, c.e).par(20, c.n).par(30, 0).par(40, radio)
}

function linea(w: Escritor, capa: string, a: Punto, b: Punto): void {
  w.par(0, "LINE").par(8, capa).par(10, a.e).par(20, a.n).par(30, 0).par(11, b.e).par(21, b.n).par(31, 0)
}

/** TEXT con justificación: 0 izquierda, 1 centro, 2 derecha (código 72), vertical medio (73 = 2). */
function texto(w: Escritor, capa: string, p: Punto, alto: number, contenido: string, justificacion: 0 | 1 | 2 = 0, rotacion = 0): void {
  w.par(0, "TEXT").par(8, capa).par(10, p.e).par(20, p.n).par(30, 0).par(40, alto).par(1, contenido).par(50, rotacion)
  if (justificacion !== 0) {
    w.par(72, justificacion).par(11, p.e).par(21, p.n).par(31, 0)
  }
}

/** Construye el DXF del plano de mensura. */
export function generarDxf({ concesion: c, perito, derivados: d }: EntradaDxf): string {
  const crs = crsPorEpsg(c.epsg)
  const { grilla } = d
  const todosPuntos: Punto[] = [...d.manifestacion, ...d.mensura, ...(c.hito && c.hito.n > 0 ? [c.hito] : [])]
  const bb = todosPuntos.length ? bbox(todosPuntos) : { nMin: 0, nMax: 100, eMin: 0, eMax: 100 }
  const ancho = Math.max(bb.eMax - bb.eMin, 100)
  const altoDib = Math.max(bb.nMax - bb.nMin, 100)
  const extension = Math.max(ancho, altoDib)
  const h = Math.max(1, extension / 90) // alto de texto base
  const margen = extension * 0.06

  const w = new Escritor()
  // ---- HEADER
  w.par(0, "SECTION").par(2, "HEADER")
  w.par(9, "$ACADVER").par(1, "AC1009")
  w.par(9, "$INSUNITS").par(70, 6)
  w.par(9, "$EXTMIN").par(10, bb.eMin - margen).par(20, bb.nMin - margen * 4).par(30, 0)
  w.par(9, "$EXTMAX").par(10, bb.eMax + margen * 6).par(20, bb.nMax + margen).par(30, 0)
  w.par(0, "ENDSEC")
  // ---- TABLES
  w.par(0, "SECTION").par(2, "TABLES")
  w.par(0, "TABLE").par(2, "LTYPE").par(70, 2)
  w.par(0, "LTYPE").par(2, "CONTINUOUS").par(70, 0).par(3, "Solid line").par(72, 65).par(73, 0).par(40, 0)
  w.par(0, "LTYPE").par(2, "DASHED").par(70, 0).par(3, "Dashed __ __ __").par(72, 65).par(73, 2).par(40, h * 3).par(49, h * 2).par(49, -h)
  w.par(0, "ENDTAB")
  w.par(0, "TABLE").par(2, "LAYER").par(70, CAPAS.length)
  for (const capa of CAPAS) w.par(0, "LAYER").par(2, capa.nombre).par(70, 0).par(62, capa.color).par(6, capa.tipoLinea)
  w.par(0, "ENDTAB")
  w.par(0, "TABLE").par(2, "STYLE").par(70, 1)
  w.par(0, "STYLE").par(2, "STANDARD").par(70, 0).par(40, 0).par(41, 1).par(50, 0).par(71, 0).par(42, h).par(3, "txt").par(4, "")
  w.par(0, "ENDTAB")
  w.par(0, "ENDSEC")
  // ---- BLOCKS
  w.par(0, "SECTION").par(2, "BLOCKS").par(0, "ENDSEC")
  // ---- ENTITIES
  w.par(0, "SECTION").par(2, "ENTITIES")

  if (d.manifestacion.length >= 3) polilinea(w, "MANIFESTACION", d.manifestacion, true)
  const solicitudDistinta = d.solicitud.length >= 3 && JSON.stringify(d.solicitud) !== JSON.stringify(d.manifestacion)
  if (solicitudDistinta) polilinea(w, "SOLICITUD", d.solicitud, true)
  if (d.mensura.length >= 3) polilinea(w, "MENSURA", d.mensura, true)

  const hPert = Math.max(0.5, Math.min(c.pertenenciaEO, c.pertenenciaNS) / 8)
  for (const p of grilla.pertenencias) {
    polilinea(w, "PERTENENCIAS", p.vertices, true)
    const centro = { n: (p.vertices[0].n + p.vertices[2].n) / 2, e: (p.vertices[0].e + p.vertices[2].e) / 2 }
    texto(w, "PERTENENCIAS_TEXTO", centro, hPert, String(p.indice), 1)
  }

  const rVertice = Math.max(0.3, extension / 400)
  for (const v of grilla.todos) {
    circulo(w, "VERTICES", v, v.tipo === "lindero" ? rVertice * 1.6 : rVertice)
    texto(w, "VERTICES_TEXTO", { n: v.n + rVertice * 2, e: v.e + rVertice * 2 }, v.tipo === "lindero" ? h * 0.9 : h * 0.6, v.nombre)
  }

  const referencias: { capa: string; p: { n: number; e: number; nombre: string } }[] = []
  if (c.hito && c.hito.n > 0) referencias.push({ capa: "HITO", p: c.hito })
  if (c.amarre && c.amarre.n > 0) referencias.push({ capa: "AMARRE", p: c.amarre })
  for (const a of c.auxiliares) if (a.n > 0) referencias.push({ capa: "AUXILIARES", p: a })
  for (const { capa, p } of referencias) {
    const r = rVertice * 2.5
    circulo(w, capa, p, r)
    linea(w, capa, { n: p.n - r * 1.5, e: p.e }, { n: p.n + r * 1.5, e: p.e })
    linea(w, capa, { n: p.n, e: p.e - r * 1.5 }, { n: p.n, e: p.e + r * 1.5 })
    texto(w, capa, { n: p.n + r * 2, e: p.e + r * 2 }, h, p.nombre)
  }

  // ---- Cuadros a la derecha del dibujo
  const xCuadro = bb.eMax + margen
  let y = bb.nMax
  const fila = h * 1.8
  const escribirFila = (celdas: string[], negrita = false, anchos: number[] = [h * 10, h * 12, h * 12]) => {
    let x = xCuadro
    celdas.forEach((t, i) => {
      texto(w, "CUADROS", { n: y, e: x }, negrita ? h * 1.05 : h, t)
      x += anchos[i] ?? h * 12
    })
    y -= fila
  }
  texto(w, "CUADROS", { n: y, e: xCuadro }, h * 1.3, `CUADRO DE COORDENADAS UTM - ${crs.datum} HUSO ${crs.huso}`)
  y -= fila * 1.5
  escribirFila(["VERTICE", "NORTE (m)", "ESTE (m)"], true)
  for (const v of grilla.linderos) escribirFila([v.nombre, coordenadaCl(v.n), coordenadaCl(v.e)])
  if (grilla.interiores.length) {
    y -= fila * 0.5
    escribirFila(["INTERIORES", "NORTE (m)", "ESTE (m)"], true)
    for (const v of grilla.interiores) escribirFila([v.nombre, coordenadaCl(v.n), coordenadaCl(v.e)])
  }
  if (c.hito && c.hito.n > 0 && grilla.linderos.length) {
    y -= fila
    texto(w, "CUADROS", { n: y, e: xCuadro }, h * 1.3, "AZIMUT Y DISTANCIA DESDE EL H.M.")
    y -= fila * 1.5
    escribirFila(["A", "AZIMUT (g)", "DIST. (m)"], true)
    for (const r of relacionDesdePunto({ ...c.hito, nombre: "H.M." }, grilla.linderos)) escribirFila([r.hasta, azimutCl(r.azimut), numeroCl(r.distancia, 2)])
  }
  const geodesicos = [...(c.amarre && c.amarre.n > 0 ? [{ ...c.amarre, rol: "AMARRE" }] : []), ...c.auxiliares.filter((a) => a.n > 0).map((a) => ({ ...a, rol: "AUX." })), ...(c.hito && c.hito.n > 0 ? [{ ...c.hito, rol: "H.M." }] : [])]
  if (geodesicos.length) {
    y -= fila
    texto(w, "CUADROS", { n: y, e: xCuadro }, h * 1.3, "VERTICES GEODESICOS")
    y -= fila * 1.5
    const anchosGeo = [h * 22, h * 13, h * 13]
    escribirFila(["VERTICE", "NORTE (m)", "ESTE (m)"], true, anchosGeo)
    for (const g of geodesicos) escribirFila([`${g.rol} ${g.nombre}`.trim(), numeroCl(g.n, 3), numeroCl(g.e, 3)], false, anchosGeo)
  }

  // ---- Norte
  const xN = bb.eMax + margen * 0.4
  const yN = bb.nMax + margen * 0.2
  linea(w, "NORTE", { n: yN, e: xN }, { n: yN + h * 5, e: xN })
  linea(w, "NORTE", { n: yN + h * 5, e: xN }, { n: yN + h * 3.5, e: xN - h * 0.8 })
  linea(w, "NORTE", { n: yN + h * 5, e: xN }, { n: yN + h * 3.5, e: xN + h * 0.8 })
  texto(w, "NORTE", { n: yN + h * 5.6, e: xN }, h * 1.2, "N", 1)

  // ---- Carátula bajo el dibujo
  // Solo bajo el dibujo: la columna de cuadros a la derecha puede ser más alta que el dibujo.
  const yC = bb.nMin - margen
  const xC = bb.eMin
  const anchoC = Math.max(ancho, h * 60)
  const altoC = fila * 8.6
  polilinea(w, "CARATULA", [{ n: yC, e: xC }, { n: yC, e: xC + anchoC }, { n: yC - altoC, e: xC + anchoC }, { n: yC - altoC, e: xC }], true)
  linea(w, "CARATULA", { n: yC - fila * 1.8, e: xC }, { n: yC - fila * 1.8, e: xC + anchoC })
  let yl = yC - fila * 1.2
  texto(w, "CARATULA", { n: yl, e: xC + h }, h * 1.5, `PLANO DE MENSURA - ${c.nombre || "SIN NOMBRE"}`)
  yl -= fila * 1.8
  const lineasCaratula = [
    `Rol nacional: ${c.rol || "-"}    Titular: ${c.acta.titular || "-"}`,
    `Comuna: ${c.acta.comuna || "-"}    Provincia: ${c.acta.provincia || "-"}    ${c.acta.region || ""}`,
    `Datum ${crs.datum} - UTM huso ${crs.huso} (EPSG ${crs.epsg})    Superficie: ${numeroCl(d.areaMensuraHa, 2)} ha    Pertenencias: ${grilla.pertenencias.length}`,
    `Fecha de mensura: ${c.fechaMensura ? fechaCl(c.fechaMensura) : "-"}    Escala: 1:${escalaSugerida(extension)}`,
    `Perito mensurador: ${perito.nombre || "-"}    RUT: ${perito.rut || "-"}`,
  ]
  for (const l of lineasCaratula) {
    texto(w, "CARATULA", { n: yl, e: xC + h }, h * 0.9, l)
    yl -= fila
  }

  w.par(0, "ENDSEC")
  w.par(0, "EOF")
  return w.texto()
}

/** Escala nominal para una lámina A1 apaisada (~80 cm útiles) según la extensión del dibujo. */
export function escalaSugerida(extensionM: number): number {
  const candidatas = [500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000]
  const minima = (extensionM * 1.4) / 0.8 // metros por metro de papel
  return candidatas.find((e) => e >= minima) ?? 100000
}
