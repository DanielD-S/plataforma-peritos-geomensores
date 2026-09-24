import { describe, expect, it } from "vitest"
import { analizarSuperposiciones, areaMultiPoligono, desdeAtributos, formatearRol, type EntidadCatastro } from "./catastro"

function cuadrado(eMin: number, nMin: number, lado: number): number[][][] {
  return [[[eMin, nMin], [eMin + lado, nMin], [eMin + lado, nMin + lado], [eMin, nMin + lado], [eMin, nMin]]]
}

function entidad(nombre: string, anillos: number[][][]): EntidadCatastro {
  return {
    concesion: desdeAtributos({ OBJECTID: 1, NOMBRE: nombre, NUMERO_ROL: "022010664", DV_ROL: "0", TIPO_CONCESION: "EXPLOTACION", SITUACION_CONCESION: "CONSTITUIDA" }),
    geometria: anillos as [number, number][][],
  }
}

describe("rol nacional", () => {
  it("separa prefijo, correlativo y dígito verificador", () => {
    expect(formatearRol("022010664", "0")).toBe("02201-0664-0")
    expect(formatearRol("200109160", "6")).toBe("20010-9160-6")
    expect(formatearRol("12345", "K")).toBe("12345-K")
    expect(formatearRol(null, null)).toBe("")
  })
})

describe("atributos del catastro", () => {
  it("normaliza tipo, situación y datum", () => {
    const c = desdeAtributos({ NOMBRE: " POBREZA 1/20 ", TIPO_CONCESION: "EXPLOTACION", SITUACION_CONCESION: "EN TRAMITE", DATUM: "1", HUSO: "18", HECTAREAS: "100" })
    expect(c).toMatchObject({ nombre: "POBREZA 1/20", tipo: "explotacion", situacion: "en_tramite", datum: "SAD69", huso: 18, hectareas: 100 })
    expect(desdeAtributos({}).tipo).toBe("desconocido")
    expect(desdeAtributos({}).datum).toBe("PSAD56")
  })
})

describe("superposiciones", () => {
  const mensura = [
    { n: 1000, e: 0 },
    { n: 1000, e: 1000 },
    { n: 0, e: 1000 },
    { n: 0, e: 0 },
  ]

  it("mide el área de intersección y clasifica abarca / colinda / cercana con su dirección", () => {
    const r = analizarSuperposiciones(mensura, [
      entidad("SOLAPA", cuadrado(500, 500, 1000)), // abarca 500x500 = 25 ha
      entidad("VECINA NORTE", cuadrado(0, 1000, 1000)), // comparte el borde norte
      entidad("VECINA OESTE", cuadrado(-1000, 0, 1000)),
      entidad("LEJANA SUR", cuadrado(0, -1050, 1000)), // a 50 m del borde sur
    ])
    expect(r.map((s) => [s.concesion.nombre, s.relacion, s.direccion])).toEqual([
      ["SOLAPA", "abarca", "norte"],
      ["VECINA NORTE", "colinda", "norte"],
      ["VECINA OESTE", "colinda", "oeste"],
      ["LEJANA SUR", "cercana", "sur"],
    ])
    expect(r[0].areaHa).toBeCloseTo(25, 6)
    expect(r[1].areaHa).toBe(0)
    expect(r[1].distanciaM).toBe(0)
    expect(r[3].distanciaM).toBeCloseTo(50, 6)
  })

  it("ignora slivers de reproyección menores a 100 m² y los trata como colindancia", () => {
    const r = analizarSuperposiciones(mensura, [entidad("CASI", cuadrado(999.95, 0, 1000))])
    expect(r[0].relacion).toBe("colinda")
    expect(r[0].direccion).toBe("este")
  })

  it("elige el lado con más contacto en una mensura en L", () => {
    // Mensura en L: franja norte completa y columna este hacia el sur.
    const enL = [
      { n: 1000, e: 0 },
      { n: 1000, e: 1000 },
      { n: 0, e: 1000 },
      { n: 0, e: 600 },
      { n: 600, e: 600 },
      { n: 600, e: 0 },
    ]
    // Vecina que llena la muesca: toca 600 m del borde sur de la franja y 600 m del borde oeste de la columna.
    const muesca = entidad("MUESCA", cuadrado(0, 0, 600))
    // Vecina en la muesca pero pegada solo al borde de la columna (oeste de la columna).
    const columna = entidad("COLUMNA", cuadrado(300, 0, 300))
    const r = analizarSuperposiciones(enL, [muesca, columna])
    const porNombre = Object.fromEntries(r.map((s) => [s.concesion.nombre, s]))
    expect(porNombre.MUESCA.relacion).toBe("colinda")
    expect(["sur", "oeste"]).toContain(porNombre.MUESCA.direccion)
    expect(porNombre.COLUMNA.direccion).toBe("oeste")
  })

  it("calcula el área de multipolígonos con huecos", () => {
    const exterior = cuadrado(0, 0, 100)[0]
    const hueco = cuadrado(10, 10, 10)[0]
    expect(areaMultiPoligono([[exterior, hueco], cuadrado(200, 200, 10)] as never)).toBeCloseTo(10_000 - 100 + 100, 6)
  })
})
