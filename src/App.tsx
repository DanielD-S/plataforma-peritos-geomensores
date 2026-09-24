import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Cartera } from "./components/Cartera"
import { Descargas } from "./components/Descargas"
import { Formulario } from "./components/Formulario"
import { ImportarDialogo, type DestinoPoligono, type DestinoPunto } from "./components/ImportarDialogo"
import { Mapa } from "./components/Mapa"
import { Revision } from "./components/Revision"
import { SeccionActa } from "./components/SeccionActa"
import { SeparadorHorizontal } from "./components/Separador"
import { Tablas } from "./components/Tablas"
import { useCartera } from "./hooks/useCartera"
import { useSuperposiciones } from "./hooks/useSuperposiciones"
import { crsPorEpsg } from "./lib/crs"
import { numeroCl } from "./lib/formato"
import { bbox, type Punto } from "./lib/geometria"
import { derivar } from "./lib/sernageomin"
import { validarConcesion } from "./lib/validar"

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
  const { cartera, concesion, perito, setPerito, actualizar, actualizarVarios, nueva, nuevaDesdeEjemplo, duplicar, eliminar, seleccionar, exportar, importar } = useCartera()
  const derivados = useMemo(() => derivar(concesion), [concesion])
  const hallazgos = useMemo(() => validarConcesion(concesion, derivados), [concesion, derivados])
  const crs = crsPorEpsg(concesion.epsg)
  const superposiciones = useSuperposiciones(derivados.mensura, concesion.epsg)

  const [importando, setImportando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [paso, setPaso] = useState(10)

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

  // Al cambiar de concesión se sale del modo edición.
  useEffect(() => setEditando(false), [concesion.id])

  const onPerimetro = useCallback((p: Punto[]) => actualizar("perimetroMensura", p), [actualizar])

  function cargarPoligono(destino: DestinoPoligono, anillo: Punto[]) {
    if (destino === "manifestacion") {
      const b = bbox(anillo)
      actualizarVarios({
        pi: { n: Math.round(((b.nMin + b.nMax) / 2) * 1000) / 1000, e: Math.round(((b.eMin + b.eMax) / 2) * 1000) / 1000 },
        ladoNS: Math.round((b.nMax - b.nMin) * 1000) / 1000,
        ladoEO: Math.round((b.eMax - b.eMin) * 1000) / 1000,
      })
    } else if (destino === "solicitud") actualizar("perimetroSolicitud", anillo)
    else actualizar("perimetroMensura", anillo)
  }

  function cargarPunto(destino: DestinoPunto, p: { nombre: string; n: number; e: number }) {
    const ref = { nombre: p.nombre, n: p.n, e: p.e, altura: null }
    if (destino === "hito") actualizar("hito", { ...ref, nombre: concesion.hito?.nombre || p.nombre })
    else if (destino === "amarre") actualizar("amarre", ref)
    else actualizar("auxiliares", [...concesion.auxiliares, ref])
  }

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
        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-lg border p-4" style={{ background: "var(--pg-panel)", borderColor: "var(--pg-line)" }}>
          <Cartera
            cartera={cartera}
            onSeleccionar={seleccionar}
            onNueva={nueva}
            onEjemplo={nuevaDesdeEjemplo}
            onDuplicar={duplicar}
            onEliminar={eliminar}
            onExportar={exportar}
            onImportar={importar}
          />
          <Formulario
            concesion={concesion}
            actualizar={actualizar}
            onImportar={() => setImportando(true)}
            editando={editando}
            onEditando={setEditando}
            paso={paso}
            onPaso={setPaso}
          />
          <SeccionActa acta={concesion.acta} onActa={(a) => actualizar("acta", a)} perito={perito} onPerito={setPerito} />
        </aside>

        <section ref={columna} className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border" style={{ borderColor: "var(--pg-line)" }}>
            <Mapa concesion={concesion} derivados={derivados} editando={editando} paso={paso} onPerimetro={onPerimetro} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2" style={{ background: "var(--pg-panel)", borderColor: "var(--pg-line)" }}>
            <Descargas concesion={concesion} perito={perito} derivados={derivados} superposiciones={superposiciones.lista} />
            <Revision hallazgos={hallazgos} />
          </div>
          <SeparadorHorizontal alto={altoTablas} min={ALTO_MIN} max={altoMax()} onCambio={setAltoTablas} />
          <div className="min-h-0 overflow-hidden rounded-lg border" style={{ height: altoTablas, background: "var(--pg-panel)", borderColor: "var(--pg-line)" }}>
            <Tablas concesion={concesion} derivados={derivados} superposiciones={superposiciones} />
          </div>
        </section>
      </main>

      <ImportarDialogo epsg={concesion.epsg} abierto={importando} onCerrar={() => setImportando(false)} onPoligono={cargarPoligono} onPunto={cargarPunto} />
    </div>
  )
}
