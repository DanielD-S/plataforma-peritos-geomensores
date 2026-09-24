import { useState } from "react"
import { descargarBlob } from "../lib/formato"
import type { Concesion } from "../lib/modelo"
import { generarPaquete, piValido, zipCompleto } from "../lib/sernageomin"

interface Props {
  concesion: Concesion
}

const ZIPS = ["Manifestacion.zip", "Solicitud_mensura.zip", "Mensura.zip", "Pertenencias.zip", "Hito_de_mensura.zip"] as const

function validar(c: Concesion): string[] {
  const errores: string[] = []
  if (!c.nombre.trim()) errores.push("nombre de la concesión")
  if (!piValido(c.pi)) errores.push("punto de interés")
  if (!(c.ladoNS > 0 && c.ladoEO > 0)) errores.push("lados de la manifestación")
  if (!c.fechaManifestacion) errores.push("fecha de manifestación")
  if (!c.fechaSolicitudMensura) errores.push("fecha de solicitud de mensura")
  if (!c.fechaMensura) errores.push("fecha de mensura")
  if (!c.hito || !(c.hito.n > 0 && c.hito.e > 0)) errores.push("hito de mensura")
  if (!c.rol.trim()) errores.push("rol nacional")
  return errores
}

/** Barra compacta con las descargas de los 5 ZIP oficiales y un resumen plegable de datos faltantes. */
export function Descargas({ concesion }: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verFaltantes, setVerFaltantes] = useState(false)
  const faltantes = validar(concesion)
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
    <div className="flex flex-wrap items-center gap-2">
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
      {faltantes.length > 0 && (
        <span className="relative ml-auto text-xs">
          <button
            type="button"
            className="rounded-md px-2 py-1 font-semibold"
            style={{ background: "#fef3c7", color: "#92400e" }}
            onClick={() => setVerFaltantes((v) => !v)}
            title={faltantes.join(", ")}
          >
            {faltantes.length} {faltantes.length === 1 ? "dato faltante" : "datos faltantes"} {verFaltantes ? "▴" : "▾"}
          </button>
          {verFaltantes && (
            <ul
              className="absolute right-0 z-[1100] mt-1 w-64 list-disc rounded-md border px-3 py-2 pl-7 shadow"
              style={{ background: "#fffbeb", borderColor: "#fcd34d", color: "#92400e" }}
            >
              {faltantes.map((f) => (
                <li key={f}>Falta {f}.</li>
              ))}
            </ul>
          )}
        </span>
      )}
    </div>
  )
}
