import { describe, expect, it } from "vitest"
import { escribirDbf } from "./dbf"
import { anilloExterior, escribirShp } from "./shp"
import { crearShapefile } from "./index"

const dec = new TextDecoder()

describe("DBF", () => {
  it("escribe cabecera, campos y registros con tipos C, N y D", () => {
    const dbf = escribirDbf(
      [
        { nombre: "NOMBRE", tipo: "C", longitud: 20 },
        { nombre: "AREA_HA", tipo: "N", longitud: 10, decimales: 2 },
        { nombre: "FECHA", tipo: "D", longitud: 8 },
      ],
      [{ NOMBRE: "MINA ÑUBLE", AREA_HA: 100, FECHA: "2025-03-03" }],
      new Date(2026, 0, 15),
    )
    const dv = new DataView(dbf.buffer)
    expect(dv.getUint8(0)).toBe(0x03)
    expect(dv.getUint32(4, true)).toBe(1)
    const largoCabecera = dv.getUint16(8, true)
    const largoRegistro = dv.getUint16(10, true)
    expect(largoCabecera).toBe(32 + 32 * 3 + 1)
    expect(largoRegistro).toBe(1 + 20 + 10 + 8)
    expect(dbf[largoCabecera - 1]).toBe(0x0d)
    expect(dbf[dbf.length - 1]).toBe(0x1a)
    expect(dbf.length).toBe(largoCabecera + largoRegistro + 1)

    const registro = dbf.slice(largoCabecera, largoCabecera + largoRegistro)
    expect(registro[0]).toBe(0x20)
    const texto = dec.decode(registro.slice(1, 21))
    expect(texto.startsWith("MINA ÑUBLE")).toBe(true)
    expect(dec.decode(registro.slice(21, 31))).toBe("    100.00")
    expect(dec.decode(registro.slice(31, 39))).toBe("20250303")
  })

  it("rechaza nombres de campo inválidos", () => {
    expect(() => escribirDbf([{ nombre: "AREA (ha)", tipo: "N", longitud: 10 }], [])).toThrow()
    expect(() => escribirDbf([{ nombre: "NOMBRE_MUY_LARGO", tipo: "C", longitud: 10 }], [])).toThrow()
  })

  it("acepta fechas DD-MM-AAAA", () => {
    const dbf = escribirDbf([{ nombre: "FECHA", tipo: "D", longitud: 8 }], [{ FECHA: "03-03-2025" }])
    const largoCabecera = 32 + 32 + 1
    expect(dec.decode(dbf.slice(largoCabecera + 1, largoCabecera + 9))).toBe("20250303")
  })
})

describe("SHP", () => {
  it("orienta anillos exteriores en sentido horario y los cierra", () => {
    const ccw: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]
    const a = anilloExterior(ccw)
    expect(a).toHaveLength(5)
    expect(a[0]).toEqual(a[4])
    expect(a[1]).toEqual([0, 10])
  })

  it("escribe un polígono con cabecera válida", () => {
    const { shp, shx, tipo } = escribirShp([{ tipo: "poligono", anillos: [[[465000, 7477000], [466000, 7477000], [466000, 7476600], [465000, 7476600]]] }])
    const dv = new DataView(shp.buffer)
    expect(tipo).toBe(5)
    expect(dv.getInt32(0, false)).toBe(9994)
    expect(dv.getInt32(28, true)).toBe(1000)
    expect(dv.getInt32(32, true)).toBe(5)
    expect(dv.getInt32(24, false) * 2).toBe(shp.length)
    expect(dv.getFloat64(36, true)).toBe(465000)
    expect(dv.getFloat64(60, true)).toBe(7477000)
    // registro 1
    expect(dv.getInt32(100, false)).toBe(1)
    const largoContenido = dv.getInt32(104, false) * 2
    expect(dv.getInt32(108, true)).toBe(5)
    expect(dv.getInt32(108 + 36, true)).toBe(1) // numParts
    expect(dv.getInt32(108 + 40, true)).toBe(5) // numPoints (cerrado)
    expect(largoContenido).toBe(4 + 32 + 8 + 4 + 16 * 5)
    // shx
    const dx = new DataView(shx.buffer)
    expect(dx.getInt32(100, false)).toBe(50)
    expect(dx.getInt32(104, false) * 2).toBe(largoContenido)
    expect(shx.length).toBe(108)
  })

  it("escribe puntos", () => {
    const { shp, tipo } = escribirShp([{ tipo: "punto", x: 1, y: 2 }, { tipo: "punto", x: 3, y: 4 }])
    expect(tipo).toBe(1)
    expect(shp.length).toBe(100 + 2 * (8 + 20))
    const dv = new DataView(shp.buffer)
    expect(dv.getFloat64(100 + 8 + 4, true)).toBe(1)
    expect(dv.getFloat64(100 + 28 + 8 + 12, true)).toBe(4)
  })

  it("no mezcla tipos", () => {
    expect(() => escribirShp([{ tipo: "punto", x: 0, y: 0 }, { tipo: "poligono", anillos: [[[0, 0], [1, 0], [1, 1]]] }])).toThrow()
  })
})

describe("crearShapefile", () => {
  it("entrega los cinco archivos con el .prj indicado", () => {
    const s = crearShapefile("mensura", [{ nombre: "NOMBRE", tipo: "C", longitud: 50 }], [
      { geometria: { tipo: "punto", x: 1, y: 1 }, atributos: { NOMBRE: "X" } },
    ], 'PROJCS["prueba"]')
    expect(Object.keys(s.archivos).sort()).toEqual(["mensura.cpg", "mensura.dbf", "mensura.prj", "mensura.shp", "mensura.shx"])
    expect(dec.decode(s.archivos["mensura.prj"])).toBe('PROJCS["prueba"]')
    expect(dec.decode(s.archivos["mensura.cpg"])).toBe("UTF-8")
  })
})
