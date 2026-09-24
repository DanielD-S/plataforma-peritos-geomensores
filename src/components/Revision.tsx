import { useState } from "react"
import type { Hallazgo } from "../lib/validar"

interface Props {
  hallazgos: Hallazgo[]
}

/** Botón con el resumen de la revisión y una lista desplegable de errores y avisos. */
export function Revision({ hallazgos }: Props) {
  const [abierto, setAbierto] = useState(false)
  const errores = hallazgos.filter((h) => h.severidad === "error")
  const avisos = hallazgos.filter((h) => h.severidad === "aviso")

  const estilo =
    errores.length > 0
      ? { background: "#fee2e2", color: "#991b1b" }
      : avisos.length > 0
        ? { background: "#fef3c7", color: "#92400e" }
        : { background: "#dcfce7", color: "#166534" }
  const texto =
    hallazgos.length === 0
      ? "Revisión: sin observaciones"
      : `Revisión: ${errores.length ? `${errores.length} ${errores.length === 1 ? "error" : "errores"}` : ""}${errores.length && avisos.length ? " · " : ""}${avisos.length ? `${avisos.length} ${avisos.length === 1 ? "aviso" : "avisos"}` : ""}`

  return (
    <span className="relative ml-auto text-xs">
      <button type="button" className="rounded-md px-2 py-1 font-semibold" style={estilo} onClick={() => setAbierto((v) => !v)} disabled={hallazgos.length === 0}>
        {texto} {hallazgos.length > 0 && (abierto ? "▴" : "▾")}
      </button>
      {abierto && hallazgos.length > 0 && (
        <ul className="absolute right-0 z-[1100] mt-1 w-96 rounded-md border p-2 shadow" style={{ background: "var(--pg-panel)", borderColor: "var(--pg-line)" }}>
          {[...errores, ...avisos].map((h, i) => (
            <li key={i} className="flex gap-2 py-1" style={{ color: h.severidad === "error" ? "#991b1b" : "#92400e" }}>
              <span className="shrink-0 font-bold">{h.severidad === "error" ? "Error" : "Aviso"}</span>
              <span style={{ color: "var(--pg-ink)" }}>{h.mensaje}</span>
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}
