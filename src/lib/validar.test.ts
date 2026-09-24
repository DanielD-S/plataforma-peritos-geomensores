import { describe, expect, it } from "vitest"
import { CONCESION_EJEMPLO, concesionVacia } from "./modelo"
import { derivar } from "./sernageomin"
import { areaFuera, esRectilineo, validarConcesion } from "./validar"

const mensajes = (c: typeof CONCESION_EJEMPLO) => validarConcesion(c, derivar(c)).map((h) => `${h.severidad}: ${h.mensaje}`)

describe("validación", () => {
  it("el acta de ejemplo no tiene errores", () => {
    const h = validarConcesion(CONCESION_EJEMPLO, derivar(CONCESION_EJEMPLO))
    expect(h.filter((x) => x.severidad === "error")).toEqual([])
  })

  it("lista los datos faltantes de una concesión vacía", () => {
    const m = mensajes(concesionVacia())
    expect(m.some((x) => x.includes("nombre"))).toBe(true)
    expect(m.some((x) => x.includes("punto de interés"))).toBe(true)
    expect(m.some((x) => x.includes("hito"))).toBe(true)
    expect(m.every((x) => x.startsWith("aviso"))).toBe(true)
  })

  it("detecta fechas fuera de orden y rol mal formado", () => {
    const m = mensajes({ ...CONCESION_EJEMPLO, fechaMensura: "2026-01-01", rol: "abc" })
    expect(m).toContain("error: La mensura es anterior a la solicitud de mensura.")
    expect(m.some((x) => x.includes("formato 20010-9160-6"))).toBe(true)
  })

  it("avisa cuando el P.I. cae en otro huso y marca error fuera de Chile", () => {
    // Este 150.000 en huso 19 corresponde a unos 72,4° O: ya es huso 18.
    const m1 = mensajes({ ...CONCESION_EJEMPLO, pi: { n: 7_476_800, e: 150_000 }, perimetroMensura: [] })
    expect(m1.some((x) => x.includes("cae en el huso 18"))).toBe(true)
    const m2 = mensajes({ ...CONCESION_EJEMPLO, pi: { n: 1_000_000, e: 465_500 }, perimetroMensura: [] })
    expect(m2.some((x) => x.startsWith("error") && x.includes("fuera del rango"))).toBe(true)
  })

  it("avisa lados que no son múltiplos de la pertenencia y error si quedan zonas sin pertenencias", () => {
    const m = mensajes({
      ...CONCESION_EJEMPLO,
      perimetroMensura: [
        { n: 7_477_000, e: 465_000 },
        { n: 7_477_000, e: 465_250 },
        { n: 7_476_800, e: 465_250 },
        { n: 7_476_800, e: 465_000 },
      ],
    })
    expect(m.some((x) => x.includes("mide 250.00 m y no es múltiplo de 100 m"))).toBe(true)
    expect(m.some((x) => x.startsWith("error") && x.includes("sin pertenencias"))).toBe(true)
  })

  it("detecta que la mensura se sale de la solicitud y la solicitud de la manifestación", () => {
    const m = mensajes({
      ...CONCESION_EJEMPLO,
      perimetroSolicitud: [
        { n: 7_477_000, e: 465_000 },
        { n: 7_477_000, e: 465_500 },
        { n: 7_476_600, e: 465_500 },
        { n: 7_476_600, e: 465_000 },
      ],
    })
    expect(m).toContain("error: La mensura se sale de la solicitud de mensura.")
    // Manifestación de 500 m de ancho con una solicitud que ocupa los 1000 m originales.
    const m2 = mensajes({
      ...CONCESION_EJEMPLO,
      ladoEO: 500,
      perimetroSolicitud: [
        { n: 7_477_000, e: 465_000 },
        { n: 7_477_000, e: 466_000 },
        { n: 7_476_600, e: 466_000 },
        { n: 7_476_600, e: 465_000 },
      ],
    })
    expect(m2).toContain("error: La solicitud de mensura se sale de la manifestación.")
  })

  it("utilidades geométricas", () => {
    expect(esRectilineo(CONCESION_EJEMPLO.perimetroMensura)).toBe(true)
    expect(esRectilineo([{ n: 0, e: 0 }, { n: 10, e: 5 }, { n: 0, e: 10 }])).toBe(false)
    const cuadrado = [{ n: 10, e: 0 }, { n: 10, e: 10 }, { n: 0, e: 10 }, { n: 0, e: 0 }]
    const desplazado = cuadrado.map((p) => ({ n: p.n, e: p.e + 5 }))
    expect(areaFuera(desplazado, cuadrado)).toBeCloseTo(50, 6)
    expect(areaFuera(cuadrado, cuadrado)).toBe(0)
  })
})
