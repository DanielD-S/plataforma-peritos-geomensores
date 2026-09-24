import { useRef, useState } from "react"
import { coordenadaCl, numeroCl } from "../lib/formato"
import type { Punto } from "../lib/geometria"
import { importarArchivo, type ResultadoImportacion } from "../lib/importar"

export type DestinoPoligono = "manifestacion" | "solicitud" | "mensura"
export type DestinoPunto = "hito" | "amarre" | "auxiliar"

interface Props {
  epsg: number
  abierto: boolean
  onCerrar: () => void
  onPoligono: (destino: DestinoPoligono, anillo: Punto[], nombre: string) => void
  onPunto: (destino: DestinoPunto, punto: { nombre: string; n: number; e: number }) => void
}

/** Carga un shapefile (ZIP o .shp), KML o KMZ y deja elegir qué usar y para qué. */
export function ImportarDialogo({ epsg, abierto, onCerrar, onPoligono, onPunto }: Props) {
  const entrada = useRef<HTMLInputElement>(null)
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [poligonoSel, setPoligonoSel] = useState(0)
  const [destino, setDestino] = useState<DestinoPoligono>("mensura")
  const [aplicado, setAplicado] = useState<string | null>(null)

  if (!abierto) return null

  async function cargar(archivos: FileList | null) {
    const f = archivos?.[0]
    if (!f) return
    setCargando(true)
    setError(null)
    setAplicado(null)
    try {
      const r = await importarArchivo(f, epsg)
      setResultado(r)
      setPoligonoSel(0)
    } catch (e) {
      setResultado(null)
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.")
    } finally {
      setCargando(false)
      if (entrada.current) entrada.current.value = ""
    }
  }

  function aplicarPoligono() {
    const p = resultado?.poligonos[poligonoSel]
    if (!p) return
    onPoligono(destino, p.anillo, p.nombre)
    setAplicado(`"${p.nombre}" cargado como ${destino === "manifestacion" ? "manifestación" : destino === "solicitud" ? "solicitud de mensura" : "mensura"}.`)
  }

  function cerrar() {
    setResultado(null)
    setError(null)
    setAplicado(null)
    onCerrar()
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" style={{ background: "rgba(31,41,51,0.45)" }} onClick={cerrar}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-lg border p-5 shadow-xl"
        style={{ background: "var(--pg-panel)", borderColor: "var(--pg-line)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="imp-titulo"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="imp-titulo" className="text-base font-bold">Importar geometría</h2>
            <p className="text-xs" style={{ color: "var(--pg-muted)" }}>
              Shapefile en ZIP (.shp, .dbf, .prj), .shp suelto, KML o KMZ. Se leen polígonos y puntos.
            </p>
          </div>
          <button className="boton boton-secundario" type="button" onClick={cerrar}>
            Cerrar
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button className="boton boton-primario" type="button" onClick={() => entrada.current?.click()} disabled={cargando}>
            {cargando ? "Leyendo…" : "Elegir archivo"}
          </button>
          <input ref={entrada} type="file" accept=".zip,.shp,.kml,.kmz" className="hidden" onChange={(e) => void cargar(e.target.files)} />
          {resultado && (
            <span className="text-xs" style={{ color: "var(--pg-muted)" }}>
              {resultado.archivo} · {resultado.poligonos.length} polígonos · {resultado.puntos.length} puntos
            </span>
          )}
        </div>

        {error && (
          <p className="rounded-md px-3 py-2 text-xs" style={{ background: "#fee2e2", color: "#991b1b" }}>
            {error}
          </p>
        )}
        {resultado?.advertencias.map((a) => (
          <p key={a} className="rounded-md px-3 py-2 text-xs" style={{ background: "#fef3c7", color: "#92400e" }}>
            {a}
          </p>
        ))}
        {aplicado && (
          <p className="rounded-md px-3 py-2 text-xs" style={{ background: "#dcfce7", color: "#166534" }}>
            {aplicado}
          </p>
        )}

        {resultado && (
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-auto text-xs">
            <section className="flex flex-col gap-2">
              <h3 className="font-bold">Polígonos</h3>
              {resultado.poligonos.length === 0 && <p style={{ color: "var(--pg-muted)" }}>Ninguno.</p>}
              {resultado.poligonos.map((p, i) => (
                <label key={i} className="flex cursor-pointer items-start gap-2 rounded-md border p-2" style={{ borderColor: poligonoSel === i ? "var(--pg-primary)" : "var(--pg-line)" }}>
                  <input type="radio" name="poligono" checked={poligonoSel === i} onChange={() => setPoligonoSel(i)} />
                  <span>
                    <b>{p.nombre}</b>
                    <br />
                    {p.anillo.length} vértices · {numeroCl(p.areaHa, 2)} ha
                  </span>
                </label>
              ))}
              {resultado.poligonos.length > 0 && (
                <div className="flex flex-col gap-2 rounded-md border p-2" style={{ borderColor: "var(--pg-line)" }}>
                  <span className="etiqueta">Usar como</span>
                  {(
                    [
                      ["manifestacion", "Manifestación (toma su rectángulo envolvente)"],
                      ["solicitud", "Solicitud de mensura"],
                      ["mensura", "Mensura"],
                    ] as [DestinoPoligono, string][]
                  ).map(([d, t]) => (
                    <label key={d} className="flex cursor-pointer items-center gap-2">
                      <input type="radio" name="destino" checked={destino === d} onChange={() => setDestino(d)} />
                      {t}
                    </label>
                  ))}
                  <button className="boton boton-primario self-start" type="button" onClick={aplicarPoligono}>
                    Cargar polígono
                  </button>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="font-bold">Puntos</h3>
              {resultado.puntos.length === 0 && <p style={{ color: "var(--pg-muted)" }}>Ninguno.</p>}
              {resultado.puntos.map((p, i) => (
                <div key={i} className="flex flex-col gap-1 rounded-md border p-2" style={{ borderColor: "var(--pg-line)" }}>
                  <span>
                    <b>{p.nombre}</b>
                    <br />N {coordenadaCl(p.n)} · E {coordenadaCl(p.e)}
                  </span>
                  <span className="flex gap-1">
                    {(
                      [
                        ["hito", "Hito"],
                        ["amarre", "Amarre"],
                        ["auxiliar", "Auxiliar"],
                      ] as [DestinoPunto, string][]
                    ).map(([d, t]) => (
                      <button
                        key={d}
                        className="boton boton-secundario !px-2 !py-0.5 !text-xs"
                        type="button"
                        onClick={() => {
                          onPunto(d, p)
                          setAplicado(`"${p.nombre}" cargado como ${t.toLowerCase()}.`)
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </span>
                </div>
              ))}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
