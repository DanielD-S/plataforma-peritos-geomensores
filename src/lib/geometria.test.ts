import { describe, expect, it } from "vitest"
import {
  areaHa,
  azimutCentesimal,
  descripcionPerimetro,
  distancia,
  generarGrilla,
  normalizarPerimetro,
  rectanguloDesdePI,
  relacionDesdePunto,
} from "./geometria"
import { CONCESION_EJEMPLO } from "./modelo"

/** Valores tomados textualmente del acta de mensura ANTAQUENA 1 1 AL 22 (29-04-2026). */
const ACTA = CONCESION_EJEMPLO

describe("rectángulo de manifestación", () => {
  it("se centra en el PI y va NW, NE, SE, SW", () => {
    const r = rectanguloDesdePI({ n: 7_476_800, e: 465_500 }, 400, 1000)
    expect(r).toEqual([
      { n: 7_477_000, e: 465_000 },
      { n: 7_477_000, e: 466_000 },
      { n: 7_476_600, e: 466_000 },
      { n: 7_476_600, e: 465_000 },
    ])
    expect(areaHa(r)).toBeCloseTo(40, 6)
  })
})

describe("normalización del perímetro", () => {
  it("orienta en sentido horario y parte en el vértice NW", () => {
    const invertido = ACTA.perimetroMensura.slice().reverse()
    const n = normalizarPerimetro(invertido)
    expect(n[0]).toEqual({ n: 7_477_000, e: 465_000 })
    expect(n[1]).toEqual({ n: 7_477_000, e: 466_000 })
    expect(n).toHaveLength(10)
  })
  it("elimina el vértice de cierre duplicado", () => {
    const cerrado = [...ACTA.perimetroMensura, ACTA.perimetroMensura[0]]
    expect(normalizarPerimetro(cerrado)).toHaveLength(10)
  })
})

describe("grilla de pertenencias según el acta ANTAQUENA 1", () => {
  const g = generarGrilla(ACTA.perimetroMensura, 100, 100, "ANTAQUENA 1,")

  it("produce 22 pertenencias de 1 ha", () => {
    expect(g.pertenencias).toHaveLength(22)
    for (const p of g.pertenencias) expect(p.areaHa).toBeCloseTo(1, 9)
    expect(areaHa(normalizarPerimetro(ACTA.perimetroMensura))).toBeCloseTo(22, 9)
  })

  it("nombra 10 linderos L-1..L-10 desde el NW en sentido horario", () => {
    expect(g.linderos.map((l) => l.nombre)).toEqual(["L-1", "L-2", "L-3", "L-4", "L-5", "L-6", "L-7", "L-8", "L-9", "L-10"])
    expect(g.linderos[0]).toMatchObject({ n: 7_477_000, e: 465_000 })
    expect(g.linderos[2]).toMatchObject({ n: 7_476_600, e: 466_000 })
  })

  it("numera los vértices interiores desde 11 por filas de norte a sur", () => {
    expect(g.interiores).toHaveLength(27)
    expect(g.interiores[0].nombre).toBe("11")
    expect(g.interiores[g.interiores.length - 1].nombre).toBe("37")
    // Según el acta: 11..19 entre L1 y L2; 20,21,22 entre L10 y L9; 28 en el borde este; 37 entre L3 y L4.
    const porNombre = new Map(g.interiores.map((v) => [v.nombre, v]))
    expect(porNombre.get("11")).toMatchObject({ n: 7_477_000, e: 465_100 })
    expect(porNombre.get("19")).toMatchObject({ n: 7_477_000, e: 465_900 })
    expect(porNombre.get("20")).toMatchObject({ n: 7_476_900, e: 465_100 })
    expect(porNombre.get("22")).toMatchObject({ n: 7_476_900, e: 465_300 })
    expect(porNombre.get("28")).toMatchObject({ n: 7_476_900, e: 466_000 })
    expect(porNombre.get("29")).toMatchObject({ n: 7_476_800, e: 465_500 })
    expect(porNombre.get("34")).toMatchObject({ n: 7_476_700, e: 465_700 })
    expect(porNombre.get("37")).toMatchObject({ n: 7_476_600, e: 465_900 })
  })

  it("individualiza cada pertenencia con sus vértices NW, NE, SE, SW como el acta", () => {
    const v = (i: number) => g.pertenencias[i - 1].vertices.map((x) => x.nombre).join("-")
    expect(v(1)).toBe("L-1-11-20-L-10")
    expect(v(2)).toBe("11-12-21-20")
    expect(v(4)).toBe("13-14-L-9-22")
    expect(v(10)).toBe("19-L-2-28-27")
    expect(v(11)).toBe("L-9-23-29-L-8")
    expect(v(17)).toBe("L-7-30-34-L-6")
    expect(v(21)).toBe("L-5-35-37-L-4")
    expect(v(22)).toBe("35-36-L-3-37")
    expect(g.pertenencias[0].nombre).toBe("ANTAQUENA 1, 1")
  })
})

describe("azimut centesimal y distancia contra el acta", () => {
  const hm = { nombre: "HM", n: 7_476_968.934, e: 465_054.15 }
  const amarre = { nombre: "VERT. SED", n: 7_481_235.843, e: 462_933.594 }
  const g = generarGrilla(ACTA.perimetroMensura, 100, 100, "ANTAQUENA 1,")

  it("del HM a cada lindero", () => {
    const rel = relacionDesdePunto(hm, g.linderos)
    const esperado: Record<string, [number, number]> = {
      "L-1": [333.1589, 62.43],
      "L-2": [97.9098, 946.36],
      "L-3": [123.6762, 1015.26],
      "L-4": [129.2436, 832.11],
      "L-5": [122.0311, 792.85],
      "L-6": [129.1433, 608.5],
      "L-7": [119.1074, 571.39],
      "L-8": [128.9263, 384.9],
      "L-9": [112.5248, 352.65],
      "L-10": [242.3898, 87.66],
    }
    for (const r of rel) {
      const [az, d] = esperado[r.hasta]
      expect(r.azimut).toBeCloseTo(az, 3)
      expect(r.distancia).toBeCloseTo(d, 1)
    }
  })

  it("del punto de amarre al HM y a linderos", () => {
    expect(azimutCentesimal(hm, amarre)).toBeCloseTo(370.6374, 3)
    expect(distancia(hm, amarre)).toBeCloseTo(4764.79, 1)
    expect(azimutCentesimal(amarre, g.linderos[0])).toBeCloseTo(171.1057, 3)
    expect(distancia(amarre, g.linderos[0])).toBeCloseTo(4713.0, 1)
  })

  it("descripción tabular del perímetro", () => {
    const d = descripcionPerimetro(g.linderos)
    expect(d[0]).toMatchObject({ desde: "L-1", hasta: "L-2", azimut: 100, distancia: 1000 })
    expect(d[1]).toMatchObject({ desde: "L-2", hasta: "L-3", azimut: 200, distancia: 400 })
    expect(d[2]).toMatchObject({ desde: "L-3", hasta: "L-4", azimut: 300, distancia: 200 })
    expect(d[9]).toMatchObject({ desde: "L-10", hasta: "L-1", azimut: 0, distancia: 100 })
  })
})
