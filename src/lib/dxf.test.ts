import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { escalaSugerida, generarDxf } from "./dxf"
import { CONCESION_EJEMPLO, peritoVacio } from "./modelo"
import { derivar } from "./sernageomin"

/** Convierte el DXF en pares [código, valor]. */
function pares(dxf: string): [number, string][] {
  const l = dxf.split(/\r?\n/)
  const out: [number, string][] = []
  for (let i = 0; i + 1 < l.length; i += 2) out.push([Number(l[i]), l[i + 1]])
  return out
}

describe("plano DXF", () => {
  const c = CONCESION_EJEMPLO
  const dxf = generarDxf({ concesion: c, perito: { nombre: "Patricio Maya Aguirre", rut: "12.216.698-8", domicilio: "" }, derivados: derivar(c) })
  const p = pares(dxf)

  it("tiene la estructura R12 completa", () => {
    expect(dxf.startsWith("0\r\nSECTION\r\n2\r\nHEADER")).toBe(true)
    expect(dxf.trimEnd().endsWith("0\r\nEOF")).toBe(true)
    expect(p.filter(([k, v]) => k === 0 && v === "SECTION")).toHaveLength(4)
    expect(p.some(([k, v]) => k === 1 && v === "AC1009")).toBe(true)
    const capas = p.filter(([k, v], i) => k === 0 && v === "LAYER" && p[i + 1][0] === 2).map((_, idx, arr) => arr[idx])
    expect(capas.length).toBe(13)
  })

  it("dibuja manifestación, mensura, 22 pertenencias y 37 vértices", () => {
    const polilineas = p.filter(([k, v]) => k === 0 && v === "POLYLINE")
    // manifestación + mensura + 22 pertenencias + carátula
    expect(polilineas).toHaveLength(1 + 1 + 22 + 1)
    const circulos = p.filter(([k, v]) => k === 0 && v === "CIRCLE")
    // 37 vértices + hito + amarre
    expect(circulos).toHaveLength(37 + 2)
    const textos = p.filter(([k]) => k === 1).map(([, v]) => v)
    expect(textos).toContain("L-1")
    expect(textos).toContain("37")
    expect(textos).toContain("HM ANTAQUENA 1 1 AL 22")
    expect(textos).toContain("CUADRO DE COORDENADAS UTM - PSAD56 HUSO 19")
    expect(textos).toContain("7.477.000,00")
    expect(textos).toContain("333,1589")
    expect(textos).toContain("PLANO DE MENSURA - ANTAQUENA 1 1 AL 22")
    expect(textos.some((t) => t.includes("Perito mensurador: Patricio Maya Aguirre"))).toBe(true)
  })

  it("las coordenadas del modelo son X = Este, Y = Norte sin transformar", () => {
    const idx = p.findIndex(([k, v]) => k === 8 && v === "MENSURA")
    const vertice = p.slice(idx).findIndex(([k, v]) => k === 0 && v === "VERTEX")
    const x = p[idx + vertice + 2]
    const y = p[idx + vertice + 3]
    expect(x).toEqual([10, "465000"])
    expect(y).toEqual([20, "7477000"])
  })

  it("no falla con una concesión sin geometría", () => {
    const vacia = { ...c, pi: { n: 0, e: 0 }, perimetroMensura: [], hito: null, amarre: null }
    expect(() => generarDxf({ concesion: vacia, perito: peritoVacio(), derivados: derivar(vacia) })).not.toThrow()
  })

  it("escala sugerida", () => {
    expect(escalaSugerida(1000)).toBe(2000)
    expect(escalaSugerida(300)).toBe(1000)
    expect(escalaSugerida(10000)).toBe(20000)
  })

  it("escribe el DXF a disco si PPG_SALIDA está definido", () => {
    const salida = process.env.PPG_SALIDA
    if (!salida) return
    mkdirSync(salida, { recursive: true })
    writeFileSync(join(salida, "plano_antaquena.dxf"), dxf)
  })
})
