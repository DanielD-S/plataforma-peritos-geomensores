/**
 * Redacción automática de las secciones del acta de mensura que se derivan de la geometría,
 * con la misma estructura de frases que usan las actas presentadas a Sernageomin.
 * Todo lo que aquí se genera se puede editar después en el acta.
 */
import type { Superposicion } from "./catastro"
import { formatoSexagesimal, type Geograficas } from "./geodesia"
import { azimutCentesimal, distancia, type Grilla, type Punto, type Vertice } from "./geometria"
import { azimutCl, coordenadaCl, numeroCl } from "./formato"

const TOL = 1e-6

function lista(nombres: string[]): string {
  if (nombres.length === 0) return ""
  if (nombres.length === 1) return nombres[0]
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`
}

function clave(p: Punto): string {
  return `${Math.round(p.n * 1000)}|${Math.round(p.e * 1000)}`
}

function plural(n: number, singular: string, pluralTxt: string): string {
  return n === 1 ? singular : pluralTxt
}

function esLindero(v: Vertice): boolean {
  return v.tipo === "lindero"
}

/** Nodos de la grilla que quedan estrictamente entre `a` y `b` sobre una misma recta N-S o E-O, ordenados desde `a`. */
function nodosEntre(a: Punto, b: Punto, nodos: Map<string, Vertice>): Vertice[] {
  const horizontal = Math.abs(a.n - b.n) < TOL
  const vertical = Math.abs(a.e - b.e) < TOL
  if (!horizontal && !vertical) return []
  const entre = [...nodos.values()].filter((v) =>
    horizontal
      ? Math.abs(v.n - a.n) < TOL && (v.e - a.e) * (b.e - a.e) > TOL && (v.e - b.e) * (a.e - b.e) > TOL
      : Math.abs(v.e - a.e) < TOL && (v.n - a.n) * (b.n - a.n) > TOL && (v.n - b.n) * (a.n - b.n) > TOL,
  )
  return entre.sort((x, y) => (horizontal ? (x.e - y.e) * Math.sign(b.e - a.e) : (x.n - y.n) * Math.sign(b.n - a.n)))
}

/**
 * Tramos rectos de la grilla que describe el acta: cada lado del perímetro entre linderos
 * consecutivos, y las prolongaciones este-oeste de esos lados hacia el interior de la mensura
 * (las líneas de fila), desde un lindero hasta el último vértice de esa recta.
 * Las líneas norte-sur interiores no se describen: quedan implícitas en la individualización.
 */
export function tramosGrilla(grilla: Grilla, pasoEO: number, pasoNS: number): { desde: Vertice; hasta: Vertice; entre: Vertice[]; paso: number }[] {
  const nodos = new Map(grilla.todos.map((v) => [clave(v), v]))
  const { linderos } = grilla
  const tramos: { desde: Vertice; hasta: Vertice; entre: Vertice[]; paso: number }[] = []
  const vistos = new Set<string>()
  const agregar = (desde: Vertice, hasta: Vertice) => {
    const k = [clave(desde), clave(hasta)].sort().join("~")
    if (vistos.has(k)) return
    vistos.add(k)
    const horizontal = Math.abs(desde.n - hasta.n) < TOL
    tramos.push({ desde, hasta, entre: nodosEntre(desde, hasta, nodos), paso: horizontal ? pasoEO : pasoNS })
  }

  linderos.forEach((l, i) => agregar(l, linderos[(i + 1) % linderos.length]))

  // Prolongaciones este-oeste: desde cada lindero, siguiendo la recta del lado horizontal que llega a él.
  linderos.forEach((l, i) => {
    const prev = linderos[(i - 1 + linderos.length) % linderos.length]
    const next = linderos[(i + 1) % linderos.length]
    for (const vecino of [prev, next]) {
      if (Math.abs(vecino.n - l.n) >= TOL) continue // solo lados horizontales
      const dir = Math.sign(l.e - vecino.e) // seguir más allá del lindero
      let ultimo: Vertice | null = null
      let e = l.e + dir * pasoEO
      for (;;) {
        const nodo = nodos.get(clave({ n: l.n, e }))
        if (!nodo) break
        ultimo = nodo
        if (esLindero(nodo)) break
        e += dir * pasoEO
      }
      if (ultimo) agregar(l, ultimo)
    }
  })
  return tramos
}

/** "DISTRIBUCIÓN DE LOS VÉRTICES" del acta. */
export function textoDistribucionVertices(grilla: Grilla, pasoEO: number, pasoNS: number): string {
  const frases = tramosGrilla(grilla, pasoEO, pasoNS).map(({ desde, hasta, entre, paso }) => {
    const cabeza = esLindero(hasta) ? `Entre los linderos vértices ${desde.nombre} y ${hasta.nombre}` : `Entre el lindero vértice ${desde.nombre} y el vértice interior ${hasta.nombre}`
    if (entre.length === 0) return `${cabeza}, no existen vértices interiores.`
    if (entre.length === 1) return `${cabeza}, a ${numeroCl(paso, 0)} metros se encuentra el vértice interior ${entre[0].nombre}.`
    return `${cabeza} a distancias consecutivas de ${numeroCl(paso, 0)} metros se encuentran los vértices interiores ${lista(entre.map((v) => v.nombre))}.`
  })
  return frases.join(" ")
}

/** "INDIVIDUALIZACIÓN DE LAS PERTENENCIAS" del acta: párrafo de encabezado y lista nombre → vértices. */
export function textoIndividualizacion(grilla: Grilla, prefijo: string, pasoEO: number, pasoNS: number): { encabezado: string; filas: { nombre: string; vertices: string }[] } {
  const n = grilla.pertenencias.length
  const areaHa = n > 0 ? grilla.pertenencias[0].areaHa : 0
  const nombre = prefijo.trim().replace(/,$/, "")
  const encabezado =
    n === 0
      ? "No se generaron pertenencias."
      : `Las pertenencias ${nombre} 1 al ${n} tienen una superficie de ${numeroCl(areaHa, areaHa % 1 === 0 ? 0 : 2)} ${plural(areaHa, "hectárea", "hectáreas")} cada una y la extensión de los lados de las pertenencias en la orientación y longitud Norte-Sur es de ${numeroCl(pasoNS, 0)} metros y la extensión de los lados de la pertenencia en la orientación y latitud Este-Oeste es de ${numeroCl(pasoEO, 0)} metros.`
  return {
    encabezado,
    filas: grilla.pertenencias.map((p) => ({ nombre: p.nombre, vertices: p.vertices.map((v) => v.nombre).join("-") })),
  }
}

/** "COORDENADAS UTM DEL PUNTO DE INTERÉS (P.I.)". */
export function textoPuntoInteres(pi: Punto): string {
  return `Las coordenadas del P.I. en la manifestación son: Norte ${coordenadaCl(pi.n)} metros y Este ${coordenadaCl(pi.e)} metros.`
}

/** "UBICACIÓN DEL HM": coordenadas geográficas, UTM, altura y convergencia. */
export function textoHito(hito: { n: number; e: number; altura: number | null }, geo: Geograficas): string {
  const altura = hito.altura != null ? ` y a una altura sobre el nivel medio del mar de ${numeroCl(hito.altura, 2)} metros` : ""
  return `Las coordenadas del H.M. son: Latitud ${formatoSexagesimal(geo.lat, "lat").replace(/ (S|N)$/, "")} ${geo.lat < 0 ? "Sur" : "Norte"}; Longitud ${formatoSexagesimal(geo.lon, "lon").replace(/ (O|E)$/, "")} ${geo.lon < 0 ? "Oeste" : "Este"}, que corresponde a las coordenadas UTM Norte ${numeroCl(hito.n, 3)} metros y Este ${numeroCl(hito.e, 3)} metros${altura} y convergencia ${azimutCl(Math.abs(geo.convergenciaGon))} grd.`
}

/** "RELACIÓN DEL H.M. CON EL PUNTO DE AMARRE". */
export function textoRelacionAmarre(hito: Punto, amarre: Punto & { nombre: string }): string {
  return `Desde el H.M. con azimut de ${azimutCl(azimutCentesimal(hito, amarre))} grados centesimales y a una distancia UTM de ${numeroCl(distancia(hito, amarre), 2)} metros se ubica el ${amarre.nombre || "punto de amarre"}.`
}

const ORDEN: Record<string, number> = { norte: 0, este: 1, sur: 2, oeste: 3 }
const ETIQUETA: Record<string, string> = { norte: "Al norte", este: "Al este", sur: "Al sur", oeste: "Al oeste" }

/** "PERTENENCIAS VECINAS" y "ABARCAMIENTO" a partir del análisis contra el catastro. */
export function textoVecinas(superposiciones: Superposicion[]): { vecinas: string; abarcamiento: string } {
  const vecinas = superposiciones.filter((s) => s.relacion !== "abarca")
  const porLado = new Map<string, string[]>()
  for (const s of vecinas.sort((a, b) => ORDEN[a.direccion] - ORDEN[b.direccion])) {
    const l = porLado.get(s.direccion) ?? []
    l.push(`${s.concesion.nombre}, rol ${s.concesion.rol}`)
    porLado.set(s.direccion, l)
  }
  const lineas = [...porLado.entries()].map(([dir, items]) => `${ETIQUETA[dir]}: ${items.join("; ")}.`)
  const abarcadas = superposiciones.filter((s) => s.relacion === "abarca")
  const abarcamiento =
    abarcadas.length === 0
      ? "Las pertenencias mensuradas no abarcan concesiones constituidas ni en trámite según el catastro."
      : `Las pertenencias mensuradas abarcan ${abarcadas.map((s) => `${s.areaHa < 0.995 * (s.concesion.hectareas ?? Infinity) ? "parcialmente" : "totalmente"} a ${s.concesion.nombre}, rol ${s.concesion.rol} (${numeroCl(s.areaHa, 2)} ha)`).join("; ")}.`
  return {
    vecinas: lineas.length ? `Las siguientes concesiones mineras son colindantes:\n${lineas.join("\n")}` : "Según el catastro no hay concesiones colindantes.",
    abarcamiento,
  }
}
