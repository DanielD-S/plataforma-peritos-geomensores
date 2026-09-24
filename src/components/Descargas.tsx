import { useState } from "react"
import { descargarBlob } from "../lib/formato"
import type { Concesion } from "../lib/modelo"
import { generarPaquete, zipCompleto } from "../lib/sernageomin"

interface Props {
  concesion: Concesion
}

const ZIPS = ["Manifestacion.zip", "Solicitud_mensura.zip", "Mensura.zip", "Pertenencias.zip", "Hito_de_mensura.zip"] as const

function validar(c: Concesion): string[] {
  const errores: string[] = []
  if (!c.nombre.trim()) errores.push("Falta el nombre de la concesión.")
  if (!(c.pi.n > 0 && c.pi.e > 0)) errores.push("Falta el punto de interés.")
  if (!(c.ladoNS > 0 && c.ladoEO > 0)) errores.push("Los lados de la manifestación deben ser mayores que cero.")
  if (!c.fechaManifestacion) errores.push("Falta la fecha de manifestación.")
  if (!c.fechaSolicitudMensura) errores.push("Falta la fecha de solicitud de mensura.")
  if (!c.fechaMensura) errores.push("Falta la fecha de mensura.")
  if (!c.hito || !(c.hito.n > 0 && c.hito.e > 0)) errores.push("Falta el hito de mensura (el ZIP del hito saldrá vacío).")
  if (!c.rol.trim()) errores.push("Falta el rol nacional (va en el atributo ROL del hito).")
  return errores
}

/** Botones de descarga de los 5 ZIP oficiales, o de todos juntos. */
export function Descargas({ concesion }: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const advertencias = validar(concesion)
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className="boton boton-primario" type="button" disabled={ocupado !== null} onClick={() => descargar("todo")}>
          Descargar los 5 ZIP
        </button>
        {ZIPS.map((z) => (
          <button key={z} className="boton boton-secundario" type="button" disabled={ocupado !== null} onClick={() => descargar(z)}>
            {z}
          </button>
        ))}
      </div>
      {error && (
        <p className="rounded-md px-3 py-2 text-xs" style={{ background: "#fee2e2", color: "#991b1b" }}>
          {error}
        </p>
      )}
      {advertencias.length > 0 && (
        <ul className="list-disc rounded-md px-3 py-2 pl-7 text-xs" style={{ background: "#fef3c7", color: "#92400e" }}>
          {advertencias.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
