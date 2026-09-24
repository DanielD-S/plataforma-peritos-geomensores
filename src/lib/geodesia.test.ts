import { describe, expect, it } from "vitest"
import { aGeograficas, aSexagesimal, formatoSexagesimal } from "./geodesia"
import { CONCESION_EJEMPLO } from "./modelo"

describe("geográficas del hito contra el acta ANTAQUENA 1", () => {
  const hito = CONCESION_EJEMPLO.hito!
  const g = aGeograficas(hito, 24879)

  it("latitud 22° 48' 51,3115'' S y longitud 69° 20' 25,8608'' O en PSAD56", () => {
    const lat = aSexagesimal(g.lat, "lat")
    const lon = aSexagesimal(g.lon, "lon")
    expect(lat.hemisferio).toBe("S")
    expect(lat.grados).toBe(22)
    expect(lat.minutos).toBe(48)
    expect(lat.segundos).toBeCloseTo(51.3115, 2)
    expect(lon.hemisferio).toBe("O")
    expect(lon.grados).toBe(69)
    expect(lon.minutos).toBe(20)
    expect(lon.segundos).toBeCloseTo(25.8608, 2)
  })

  it("convergencia 0,1467 gon", () => {
    expect(g.convergenciaGon).toBeCloseTo(0.1467, 3)
  })

  it("formato sexagesimal chileno", () => {
    expect(formatoSexagesimal(g.lat, "lat")).toMatch(/^22° 48' 51,31\d\d'' S$/)
    expect(formatoSexagesimal(-69.5, "lon", 1)).toBe("69° 30' 0,0'' O")
  })
})
