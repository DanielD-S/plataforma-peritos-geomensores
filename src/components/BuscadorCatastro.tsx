import { useRef, useState } from "react"
import { buscarConcesiones, ETIQUETA_SITUACION, ETIQUETA_TIPO, type ResultadoBusqueda } from "../lib/catastro"
import type { DestinoBase } from "./CapaCatastro"

interface Props {
  onUsar: (objectId: number, destino: DestinoBase) => void
  /** Encuadra el mapa en una envolvente lon/lat [oeste, sur, este, norte]. */
  onCentrar: (bbox4326: [number, number, number, number]) => void
}

/** Búsqueda de concesiones del catastro por nombre o rol; centra el mapa y permite usarlas como base. */
export function BuscadorCatastro({ onUsar, onCentrar }: Props) {
  const [texto, setTexto] = useState("")
  const [resultados, setResultados] = useState<ResultadoBusqueda[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  async function buscar() {
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    setCargando(true)
    setError(null)
    try {
      const r = await buscarConcesiones(texto, ctl.signal)
      if (!ctl.signal.aborted) setResultados(r)
    } catch (e) {
      if (!ctl.signal.aborted) setError(e instanceof Error ? e.message : "No se pudo buscar.")
    } finally {
      if (!ctl.signal.aborted) setCargando(false)
    }
  }

  function centrar(r: ResultadoBusqueda) {
    onCentrar(r.bbox4326)
  }

  return (
    <div className="flex flex-col gap-1" onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          void buscar()
        }}
      >
        <input className="campo !py-1" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar en el catastro: nombre o rol" aria-label="Buscar concesión" />
        <button className="boton boton-secundario !px-2 !py-1 !text-xs" type="submit" disabled={cargando || texto.trim().length < 3}>
          {cargando ? "…" : "Buscar"}
        </button>
      </form>
      {error && <span style={{ color: "#991b1b" }}>{error}</span>}
      {resultados && resultados.length === 0 && <span style={{ color: "var(--pg-muted)" }}>Sin resultados.</span>}
      {resultados && resultados.length > 0 && (
        <ul className="max-h-48 overflow-y-auto">
          {resultados.map((r) => (
            <li key={r.concesion.id} className="flex flex-col gap-0.5 border-t py-1" style={{ borderColor: "var(--pg-line)" }}>
              <button type="button" className="text-left font-semibold hover:underline" onClick={() => centrar(r)} title="Centrar el mapa">
                {r.concesion.nombre}
              </button>
              <span style={{ color: "var(--pg-muted)" }}>
                {r.concesion.rol} · {ETIQUETA_TIPO[r.concesion.tipo]} · {ETIQUETA_SITUACION[r.concesion.situacion]}
              </span>
              <span className="flex gap-1">
                {(
                  [
                    ["manifestacion", "Manif."],
                    ["solicitud", "Solicitud"],
                    ["mensura", "Mensura"],
                  ] as [DestinoBase, string][]
                ).map(([d, t]) => (
                  <button key={d} type="button" className="boton boton-secundario !px-1.5 !py-0 !text-[11px]" onClick={() => onUsar(r.concesion.id, d)} title={`Usar como ${t.toLowerCase()}`}>
                    {t}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
