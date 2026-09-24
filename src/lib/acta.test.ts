import JSZip from "jszip"
import { describe, expect, it } from "vitest"
import { fechaEnLetras, generarActaBuffer } from "./acta"
import { CONCESION_EJEMPLO, concesionVacia, peritoVacio } from "./modelo"
import { derivar } from "./sernageomin"

async function textoDocumento(buf: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(buf)
  const xml = await zip.file("word/document.xml")!.async("string")
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
}

describe("acta de mensura en DOCX", () => {
  it("fecha en letras", () => {
    expect(fechaEnLetras("2026-04-29")).toBe("29 de abril del 2026")
    expect(fechaEnLetras("")).toBe("[COMPLETAR]")
  })

  it("genera un .docx válido con las secciones del acta de ANTAQUENA 1", async () => {
    const c = CONCESION_EJEMPLO
    const perito = { nombre: "Patricio Maya Aguirre", rut: "12.216.698-8", domicilio: "Antonio Poupin 1811 depto 904, Antofagasta." }
    const buf = await generarActaBuffer({ concesion: c, perito, derivados: derivar(c), superposiciones: [] })
    expect(buf.length).toBeGreaterThan(5000)
    const t = await textoDocumento(buf)
    expect(t).toContain("ACTA DE MENSURA DE LAS PERTENENCIAS MINERAS")
    expect(t).toContain('"ANTAQUENA 1 1 AL 22"')
    expect(t).toContain("ROL NACIONAL 20010-9160-6")
    expect(t).toContain("Con fecha 29 de abril del 2026, el perito que suscribe Patricio Maya Aguirre, designado perito mensurador en los autos número V-521-2025 del 2° Juzgado de Letras Civil de Antofagasta")
    expect(t).toContain("La mensura comprende: 22 pertenencias de 1 hectárea cada una, dando un total de 22 hectáreas.")
    expect(t).toContain("invocando la Concesión de Exploración denominada ANTAQUENA 1")
    expect(t).toContain("L-1 7.477.000,00 465.000,00")
    expect(t).toContain("Latitud 22° 48' 51,31")
    expect(t).toContain("Desde el H.M. con azimut de 370,6374 grados centesimales")
    expect(t).toContain("HM ANTAQUENA 1 1 AL 22 L-1 333,1589 62,43")
    expect(t).toContain("L-1 L-2 100,0000 1.000,00")
    expect(t).toContain("Entre el lindero vértice L-9 y el vértice interior 28")
    expect(t).toContain("ANTAQUENA 1, 1 L-1-11-20-L-10")
    expect(t).toContain("DEMASÍAS.- No hay.")
    expect(t).toContain("RUT 12.216.698-8")
    expect(t).not.toContain("[COMPLETAR]")
  })

  it("marca lo que falta en una concesión vacía sin fallar", async () => {
    const c = { ...concesionVacia(), nombre: "MINA X", pi: { n: 7_000_000, e: 400_000 } }
    const buf = await generarActaBuffer({ concesion: c, perito: peritoVacio(), derivados: derivar(c), superposiciones: [] })
    const t = await textoDocumento(buf)
    expect(t).toContain("[COMPLETAR]")
    expect(t).toContain("100 pertenencias de 1 hectárea cada una")
  })
})
