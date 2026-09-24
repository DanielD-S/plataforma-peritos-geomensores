import { useEffect, useMemo, useRef, useState } from "react"
import { Descargas } from "./components/Descargas"
import { Formulario } from "./components/Formulario"
import { Mapa } from "./components/Mapa"
import { SeparadorHorizontal } from "./components/Separador"
import { Tablas } from "./components/Tablas"
import { useConcesion } from "./hooks/useConcesion"
import { useSuperposiciones } from "./hooks/useSuperposiciones"
import { crsPorEpsg } from "./lib/crs"
import { numeroCl } from "./lib/formato"
import { derivar } from "./lib/sernageomin"

const CLAVE_ALTO = "ppg.layout.altoTablas"
const ALTO_MIN = 40
const ALTO_DEFECTO = 240

function altoInicial(): number {
  try {
    const v = Number(localStorage.getItem(CLAVE_ALTO))
    if (v >= ALTO_MIN) return v
  } catch {
    /* ignorar */
  }
  return ALTO_DEFECTO
}

export default function App() {
  const { concesion, actualizar, cargarEjemplo, limpiar } = useConcesion()
  const derivados = useMemo(() => derivar(concesion), [concesion])
  const crs = crsPorEpsg(concesion.epsg)
  const superposiciones = useSuperposiciones(derivados.mensura, concesion.epsg)

  const columna = useRef<HTMLElement>(null)
  const [altoTablas, setAltoTablas] = useState(altoInicial)
  const altoMax = () => Math.max(ALTO_MIN, Math.floor((columna.current?.clientHeight ?? 800) * 0.75))
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_ALTO, String(altoTablas))
    } catch {
      /* ignorar */
    }
  }, [altoTablas])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-5 py-2.5" style={{ background: "var(--pg-panel)", borderColor: "var(--pg-line)" }}>
        <div>
          <h1 className="text-lg font-bold leading-tight">Plataforma Peritos Geomensores</h1>
          <p className="text-xs" style={{ color: "var(--pg-muted)" }}>
            Prototipo · Generador de shapefiles según la guía Sernageomin (enero 2026)
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--pg-muted)" }}>
          <span className="rounded-full border px-2.5 py-1 font-semibold" style={{ borderColor: "var(--pg-line)", color: "var(--pg-ink)" }}>
            {crs.nombre} · EPSG {crs.epsg}
          </span>
          <span>
            Manifestación <b style={{ color: "var(--pg-ink)" }}>{numeroCl(derivados.areaManifestacionHa)} ha</b>
          </span>
          <span>
            Mensura <b style={{ color: "var(--pg-ink)" }}>{numeroCl(derivados.areaMensuraHa)} ha</b> · {derivados.grilla.pertenencias.length} pertenencias
          </span>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[360px_1fr] gap-3 p-3">
        <aside className="min-h-0 overflow-y-auto rounded-lg border p-4" style={{ background: "var(--pg-panel)", borderColor: "var(--pg-line)" }}>
          <Formulario concesion={concesion} actualizar={actualizar} cargarEjemplo={cargarEjemplo} limpiar={limpiar} />
        </aside>

        <section ref={columna} className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border" style={{ borderColor: "var(--pg-line)" }}>
            <Mapa epsg={concesion.epsg} derivados={derivados} hito={concesion.hito} />
          </div>
          <div className="mt-3 rounded-lg border px-3 py-2" style={{ background: "var(--pg-panel)", borderColor: "var(--pg-line)" }}>
            <Descargas concesion={concesion} />
          </div>
          <SeparadorHorizontal alto={altoTablas} min={ALTO_MIN} max={altoMax()} onCambio={setAltoTablas} />
          <div
            className="min-h-0 overflow-hidden rounded-lg border"
            style={{ height: altoTablas, background: "var(--pg-panel)", borderColor: "var(--pg-line)" }}
          >
            <Tablas derivados={derivados} hito={concesion.hito} superposiciones={superposiciones} />
          </div>
        </section>
      </main>
    </div>
  )
}
