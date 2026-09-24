import { useState } from "react"
import type { Superposicion } from "../lib/catastro"
import { descargarBlob } from "../lib/formato"
import type { Concesion, Perito } from "../lib/modelo"
import { generarPaquete, zipCompleto, type Derivados } from "../lib/sernageomin"

interface Props {
  concesion: Concesion
  perito: Perito
  derivados: Derivados
  superposiciones: Superposicion[]
}

const ZIPS = ["Manifestacion.zip", "Solicitud_mensura.zip", "Mensura.zip", "Pertenencias.zip", "Hito_de_mensura.zip"] as const
type Descarga = (typeof ZIPS)[number] | "todo" | "acta"

/** Descargas: los 5 ZIP oficiales (o todos juntos) y el acta de mensura en Word. */
export function Descargas({ concesion, perito, derivados, superposiciones }: Props) {
  const [ocupado, setOcupado] = useState<Descarga | null>(null)
  const [error, setError] = useState<string | null>(null)
  const slug = (concesion.nombre || "concesion").replace(/[^A-Za-z0-9]+/g, "_")

  async function descargar(nombre: Descarga) {
    setOcupado(nombre)
    setError(null)
    try {
      if (nombre === "acta") {
        // La librería de Word es pesada: se carga solo al pedir el acta.
        const { generarActaDocx } = await import("../lib/acta")
        descargarBlob(`Acta_mensura_${slug}.docx`, await generarActaDocx({ concesion, perito, derivados, superposiciones }))
        return
      }
      const paquete = await generarPaquete(concesion)
      if (nombre === "todo") descargarBlob(`${slug}_shapefiles_sernageomin.zip`, await zipCompleto(paquete))
      else descargarBlob(nombre, paquete.zips[nombre])
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el archivo.")
    } finally {
      setOcupado(null)
    }
  }

  return (
    <>
      <button className="boton boton-primario" type="button" disabled={ocupado !== null} onClick={() => descargar("todo")}>
        Descargar los 5 ZIP
      </button>
      {ZIPS.map((z) => (
        <button key={z} className="boton boton-secundario" type="button" disabled={ocupado !== null} onClick={() => descargar(z)}>
          {z}
        </button>
      ))}
      <button className="boton boton-primario" type="button" disabled={ocupado !== null} onClick={() => descargar("acta")} style={{ background: "var(--pg-accent)" }}>
        {ocupado === "acta" ? "Generando…" : "Acta de mensura (Word)"}
      </button>
      {error && (
        <span className="rounded-md px-2 py-1 text-xs" style={{ background: "#fee2e2", color: "#991b1b" }}>
          {error}
        </span>
      )}
    </>
  )
}
