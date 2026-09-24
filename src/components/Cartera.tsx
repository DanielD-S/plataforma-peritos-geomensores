import { useRef, useState } from "react"
import type { Cartera as CarteraT } from "../lib/cartera"
import { descargarBlob } from "../lib/formato"

interface Props {
  cartera: CarteraT
  onSeleccionar: (id: string) => void
  onNueva: () => void
  onEjemplo: () => void
  onDuplicar: () => void
  onEliminar: (id: string) => void
  onExportar: () => string
  onImportar: (json: string) => number
}

function fechaCorta(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
}

/** Selector de la concesión activa y acciones de la cartera guardada en el navegador. */
export function Cartera({ cartera, onSeleccionar, onNueva, onEjemplo, onDuplicar, onEliminar, onExportar, onImportar }: Props) {
  const entrada = useRef<HTMLInputElement>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const activa = cartera.concesiones.find((c) => c.id === cartera.activaId)

  function exportar() {
    const fecha = new Date().toISOString().slice(0, 10)
    descargarBlob(`cartera-peritos-${fecha}.json`, new Blob([onExportar()], { type: "application/json" }))
  }

  async function importar(archivos: FileList | null) {
    const f = archivos?.[0]
    if (!f) return
    try {
      const n = onImportar(await f.text())
      setMensaje(`${n} ${n === 1 ? "concesión importada" : "concesiones importadas"}.`)
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudo importar el archivo.")
    } finally {
      if (entrada.current) entrada.current.value = ""
      setTimeout(() => setMensaje(null), 4000)
    }
  }

  function eliminar() {
    if (!activa) return
    if (window.confirm(`¿Eliminar "${activa.nombre || "concesión sin nombre"}" de la cartera? No se puede deshacer.`)) onEliminar(activa.id)
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-2" style={{ background: "#faf8f3", borderColor: "var(--pg-line)" }}>
      <label className="etiqueta" htmlFor="cartera-sel">
        Cartera · {cartera.concesiones.length} {cartera.concesiones.length === 1 ? "concesión" : "concesiones"}
      </label>
      <select id="cartera-sel" className="campo" value={cartera.activaId} onChange={(e) => onSeleccionar(e.target.value)}>
        {cartera.concesiones.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre || "(sin nombre)"} · {fechaCorta(c.actualizadoEn)}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-1">
        <button className="boton boton-secundario !px-2 !py-1 !text-xs" type="button" onClick={onNueva}>
          Nueva
        </button>
        <button className="boton boton-secundario !px-2 !py-1 !text-xs" type="button" onClick={onEjemplo} title="Agrega una copia del acta de Antaquena 1">
          Ejemplo
        </button>
        <button className="boton boton-secundario !px-2 !py-1 !text-xs" type="button" onClick={onDuplicar}>
          Duplicar
        </button>
        <button className="boton boton-secundario !px-2 !py-1 !text-xs" type="button" onClick={eliminar} style={{ color: "#991b1b" }}>
          Eliminar
        </button>
        <span className="flex-1" />
        <button className="boton boton-secundario !px-2 !py-1 !text-xs" type="button" onClick={exportar} title="Descarga toda la cartera en JSON">
          Exportar
        </button>
        <button className="boton boton-secundario !px-2 !py-1 !text-xs" type="button" onClick={() => entrada.current?.click()} title="Carga un JSON exportado desde esta plataforma">
          Importar
        </button>
        <input ref={entrada} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importar(e.target.files)} />
      </div>
      {mensaje && (
        <p className="text-xs" style={{ color: "var(--pg-muted)" }}>
          {mensaje}
        </p>
      )}
    </div>
  )
}
