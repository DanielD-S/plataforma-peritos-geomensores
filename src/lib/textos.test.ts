import { describe, expect, it } from "vitest"
import type { Superposicion } from "./catastro"
import { aGeograficas } from "./geodesia"
import { generarGrilla } from "./geometria"
import { CONCESION_EJEMPLO } from "./modelo"
import { textoDistribucionVertices, textoHito, textoIndividualizacion, textoPuntoInteres, textoRelacionAmarre, textoVecinas, tramosGrilla } from "./textos"

const c = CONCESION_EJEMPLO
const grilla = generarGrilla(c.perimetroMensura, 100, 100, c.prefijoPertenencias)

describe("distribución de los vértices (acta ANTAQUENA 1)", () => {
  it("describe los 10 lados del perímetro y las 3 prolongaciones este-oeste", () => {
    const tramos = tramosGrilla(grilla, 100, 100)
    expect(tramos).toHaveLength(13)
    const resumen = tramos.map((t) => `${t.desde.nombre}>${t.hasta.nombre}:${t.entre.map((v) => v.nombre).join(",")}`)
    expect(resumen).toContain("L-1>L-2:11,12,13,14,15,16,17,18,19")
    expect(resumen).toContain("L-2>L-3:28,33,36")
    expect(resumen).toContain("L-3>L-4:37")
    expect(resumen).toContain("L-4>L-5:")
    expect(resumen).toContain("L-5>L-6:34")
    expect(resumen).toContain("L-7>L-8:29")
    expect(resumen).toContain("L-9>L-10:22,21,20")
    expect(resumen).toContain("L-9>28:23,24,25,26,27")
    expect(resumen).toContain("L-7>33:30,31,32")
    expect(resumen).toContain("L-5>36:35")
  })

  it("redacta las frases como el acta", () => {
    const t = textoDistribucionVertices(grilla, 100, 100)
    expect(t).toContain("Entre los linderos vértices L-1 y L-2 a distancias consecutivas de 100 metros se encuentran los vértices interiores 11, 12, 13, 14, 15, 16, 17, 18 y 19.")
    expect(t).toContain("Entre los linderos vértices L-3 y L-4, a 100 metros se encuentra el vértice interior 37.")
    expect(t).toContain("Entre los linderos vértices L-4 y L-5, no existen vértices interiores.")
    expect(t).toContain("Entre el lindero vértice L-9 y el vértice interior 28 a distancias consecutivas de 100 metros se encuentran los vértices interiores 23, 24, 25, 26 y 27.")
    expect(t).toContain("Entre el lindero vértice L-5 y el vértice interior 36, a 100 metros se encuentra el vértice interior 35.")
  })
})

describe("otras secciones", () => {
  it("individualización de las pertenencias", () => {
    const ind = textoIndividualizacion(grilla, c.prefijoPertenencias, 100, 100)
    expect(ind.encabezado).toBe(
      "Las pertenencias ANTAQUENA 1 1 al 22 tienen una superficie de 1 hectárea cada una y la extensión de los lados de las pertenencias en la orientación y longitud Norte-Sur es de 100 metros y la extensión de los lados de la pertenencia en la orientación y latitud Este-Oeste es de 100 metros.",
    )
    expect(ind.filas[0]).toEqual({ nombre: "ANTAQUENA 1, 1", vertices: "L-1-11-20-L-10" })
    expect(ind.filas[21]).toEqual({ nombre: "ANTAQUENA 1, 22", vertices: "35-36-L-3-37" })
  })

  it("punto de interés, hito y relación con el amarre", () => {
    expect(textoPuntoInteres(c.pi)).toBe("Las coordenadas del P.I. en la manifestación son: Norte 7.476.800,00 metros y Este 465.500,00 metros.")
    const hito = c.hito!
    const t = textoHito(hito, aGeograficas(hito, c.epsg))
    expect(t).toMatch(/^Las coordenadas del H\.M\. son: Latitud 22° 48' 51,31\d\d'' Sur; Longitud 69° 20' 25,86\d\d'' Oeste, que corresponde a las coordenadas UTM Norte 7\.476\.968,934 metros y Este 465\.054,150 metros y a una altura sobre el nivel medio del mar de 1\.698,91 metros y convergencia 0,1467 grd\.$/)
    expect(textoRelacionAmarre(hito, c.amarre!)).toBe("Desde el H.M. con azimut de 370,6374 grados centesimales y a una distancia UTM de 4.764,79 metros se ubica el VERT. SED (SNGM).")
  })

  it("pertenencias vecinas y abarcamiento", () => {
    const con = (nombre: string, rol: string, relacion: Superposicion["relacion"], direccion: Superposicion["direccion"], areaHa = 0, hectareas = 100): Superposicion => ({
      concesion: { id: 1, rol, nombre, tipo: "explotacion", situacion: "constituida", titular: "", hectareas, datum: "PSAD56", huso: 19, comuna: "", origen: "" },
      relacion,
      areaHa,
      distanciaM: 0,
      direccion,
    })
    const t = textoVecinas([
      con("TRECE DE MAYO 1/36", "02201-0664-0", "abarca", "sur", 0.167, 180),
      con("JULIO 1/20", "02206-0454-3", "cercana", "oeste"),
      con("GORDON 5 1/40", "02206-1436-0", "colinda", "norte"),
      con("TALITA 4 1/45", "02206-4963-6", "colinda", "sur"),
      con("POBREZA 1/20", "02201-0726-4", "cercana", "sur"),
    ])
    expect(t.vecinas).toBe("Las siguientes concesiones mineras son colindantes:\nAl norte: GORDON 5 1/40, rol 02206-1436-0.\nAl sur: TALITA 4 1/45, rol 02206-4963-6; POBREZA 1/20, rol 02201-0726-4.\nAl oeste: JULIO 1/20, rol 02206-0454-3.")
    expect(t.abarcamiento).toBe("Las pertenencias mensuradas abarcan parcialmente a TRECE DE MAYO 1/36, rol 02201-0664-0 (0,17 ha).")
  })
})
