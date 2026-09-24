import { useState } from "react"
import { descargarBlob } from "../lib/formato"
import type { Concesion } from "../lib/modelo"
import { generarPaquete, zipCompleto } from "../lib/sernageomin"

interface Props {
  concesion: Concesion
}

const ZIPS = ["Manifestacion.zip", "Solicitud_mensura.zip", "Mensura.zip", "Pertenencias.zip", "Hito_de_mensura.zip"] as const

/** Botones de descarga de los 5 ZIP oficiales, o de todos juntos. */
export function Descargas({ concesion }: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const slug = (concesion.nombre || "concesion").replace(/[^A-Za-z0-9]+/g, "_")

  async function descargar(nombre: (typeof ZIPS)[number] | "todo") {
    setOcupado(nombre)
    setError(null)
    try {
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
      {error && (
        <span className="rounded-md px-2 py-1 text-xs" style={{ background: "#fee2e2", color: "#991b1b" }}>
          {error}
        </span>
      )}
    </>
  )
}
