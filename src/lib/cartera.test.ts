import { describe, expect, it } from "vitest"
import { activa, cargarCartera, duplicar, eliminar, importarJson, nueva, reemplazarActiva, seleccionar, serializar, CLAVE_CARTERA } from "./cartera"
import { CONCESION_EJEMPLO } from "./modelo"

function almacenFalso(inicial: Record<string, string> = {}) {
  const m = new Map(Object.entries(inicial))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    claves: () => [...m.keys()],
  }
}

describe("cartera", () => {
  it("parte con el ejemplo cuando no hay nada guardado", () => {
    const c = cargarCartera(almacenFalso())
    expect(c.concesiones).toHaveLength(1)
    expect(activa(c).nombre).toBe(CONCESION_EJEMPLO.nombre)
  })

  it("migra la concesión única del prototipo anterior", () => {
    const antigua = { nombre: "MINA VIEJA", pi: { n: 7000000, e: 400000 }, hito: { nombre: "HM", n: 1, e: 2 }, perimetroMensura: [] }
    const alm = almacenFalso({ "ppg.concesion.v1": JSON.stringify(antigua) })
    const c = cargarCartera(alm)
    expect(activa(c).nombre).toBe("MINA VIEJA")
    expect(activa(c).hito).toEqual({ nombre: "HM", n: 1, e: 2, altura: null })
    expect(activa(c).amarre).toBeNull()
    expect(alm.claves()).toEqual([CLAVE_CARTERA])
  })

  it("crea, duplica, selecciona y elimina", () => {
    let c = cargarCartera(almacenFalso())
    c = nueva(c)
    expect(c.concesiones).toHaveLength(2)
    expect(activa(c).nombre).toBe("")
    c = reemplazarActiva(c, (a) => ({ ...a, nombre: "NUEVA" }))
    c = duplicar(c)
    expect(activa(c).nombre).toBe("NUEVA (copia)")
    const idEjemplo = c.concesiones[0].id
    c = seleccionar(c, idEjemplo)
    expect(activa(c).id).toBe(idEjemplo)
    c = eliminar(c, idEjemplo)
    expect(c.concesiones.map((x) => x.nombre)).toEqual(["NUEVA", "NUEVA (copia)"])
    c = eliminar(c, c.concesiones[0].id)
    c = eliminar(c, c.concesiones[0].id)
    expect(c.concesiones).toHaveLength(1)
  })

  it("exporta e importa JSON reemplazando por id", () => {
    let c = cargarCartera(almacenFalso())
    const json = serializar(c)
    c = reemplazarActiva(c, (a) => ({ ...a, nombre: "MODIFICADA" }))
    const r = importarJson(c, json)
    expect(r.importadas).toBe(1)
    expect(activa(r.cartera).nombre).toBe(CONCESION_EJEMPLO.nombre)
    expect(r.cartera.concesiones).toHaveLength(1)
    expect(() => importarJson(c, JSON.stringify({ concesiones: [{}] }))).toThrow()
  })
})
