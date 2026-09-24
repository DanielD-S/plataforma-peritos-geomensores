import { useEffect, useMemo, useState } from "react"
import L from "leaflet"
import proj4 from "proj4"
import { CircleMarker, MapContainer, Marker, Polygon, TileLayer, Tooltip, useMap } from "react-leaflet"
import { crsPorEpsg } from "../lib/crs"
import type { Punto, Vertice } from "../lib/geometria"
import type { Concesion } from "../lib/modelo"
import type { Derivados } from "../lib/sernageomin"
import { CapaCatastro, type EstadoCatastro } from "./CapaCatastro"
import { EditorVertices } from "./EditorVertices"

interface Props {
  concesion: Concesion
  derivados: Derivados
  /** Edición del perímetro de la mensura sobre el mapa. */
  editando: boolean
  paso: number
  onPerimetro: (perimetro: Punto[]) => void
}

type LatLng = [number, number]

const ICONO_AMARRE = L.divIcon({ className: "ppg-amarre", iconSize: [14, 13], iconAnchor: [7, 7] })
const ICONO_AUXILIAR = L.divIcon({ className: "ppg-auxiliar", iconSize: [10, 10], iconAnchor: [5, 5] })

function Encuadre({ puntos }: { puntos: LatLng[] }) {
  const map = useMap()
  const clave = puntos.map((p) => p.join(",")).join(";")
  useEffect(() => {
    if (puntos.length === 0) return
    map.fitBounds(L.latLngBounds(puntos), { padding: [24, 24], maxZoom: 17 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, map])
  return null
}

function textoEstado(e: EstadoCatastro): string {
  if (e.error) return `Catastro: ${e.error}`
  if (e.cargando) return "Consultando catastro…"
  if (e.zoomInsuficiente) return "Acerca el mapa para ver el catastro"
  return `${e.cantidad} concesiones en la vista`
}

function mismoAnillo(a: Punto[], b: Punto[]): boolean {
  return a.length === b.length && a.every((p, i) => Math.abs(p.n - b[i].n) < 1e-6 && Math.abs(p.e - b[i].e) < 1e-6)
}

/**
 * Previsualización en Leaflet. La reproyección a WGS84 es solo referencial
 * (parámetros towgs84 genéricos); los archivos se entregan en el datum oficial sin transformar.
 */
export function Mapa({ concesion: c, derivados: d, editando, paso, onPerimetro }: Props) {
  const [mostrarCatastro, setMostrarCatastro] = useState(true)
  const [estadoCatastro, setEstadoCatastro] = useState<EstadoCatastro>({ cargando: false, cantidad: 0, zoomInsuficiente: false, error: null })

  const { aLatLng, dePunto } = useMemo(() => {
    const crs = crsPorEpsg(c.epsg)
    return {
      aLatLng: (p: Punto): LatLng => {
        const [lon, lat] = proj4(crs.proj4, "EPSG:4326", [p.e, p.n])
        return [lat, lon]
      },
      dePunto: (ll: LatLng): Punto => {
        const [e, n] = proj4("EPSG:4326", crs.proj4, [ll[1], ll[0]])
        return { n, e }
      },
    }
  }, [c.epsg])

  const manifestacion = d.manifestacion.map(aLatLng)
  const solicitudDistinta = !mismoAnillo(d.solicitud, d.manifestacion)
  const solicitud = solicitudDistinta ? d.solicitud.map(aLatLng) : []
  const mensura = d.mensura.map(aLatLng)
  const pertenencias = d.grilla.pertenencias.map((p) => ({ nombre: p.nombre, ring: p.vertices.map(aLatLng) }))
  const vertices = d.grilla.todos.map((v: Vertice) => ({ v, ll: aLatLng(v) }))
  const valido = <T extends { n: number; e: number }>(p: T | null): T | null => (p && p.n > 0 && p.e > 0 ? p : null)
  const hito = valido(c.hito)
  const amarre = valido(c.amarre)
  const auxiliares = c.auxiliares.filter((a) => a.n > 0 && a.e > 0)
  const hitoLl = hito ? aLatLng(hito) : null
  const encuadre = [...manifestacion, ...mensura, ...(hitoLl ? [hitoLl] : [])]

  return (
    <div className="relative h-full w-full">
      <MapContainer center={[-27, -70]} zoom={5} preferCanvas className="rounded-lg">
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Esri World Imagery · Catastro SERNAGEOMIN"
          maxZoom={19}
          maxNativeZoom={17}
        />
        <Encuadre puntos={encuadre} />
        <CapaCatastro visible={mostrarCatastro} onEstado={setEstadoCatastro} />
        {manifestacion.length >= 3 && (
          <Polygon positions={manifestacion} pathOptions={{ color: "#b45309", weight: 2, dashArray: "6 4", fillOpacity: 0.05 }}>
            <Tooltip sticky>Manifestación</Tooltip>
          </Polygon>
        )}
        {solicitud.length >= 3 && (
          <Polygon positions={solicitud} pathOptions={{ color: "#7c3aed", weight: 2, dashArray: "2 4", fillOpacity: 0.04 }}>
            <Tooltip sticky>Solicitud de mensura</Tooltip>
          </Polygon>
        )}
        {pertenencias.map((p) => (
          <Polygon key={p.nombre} positions={p.ring} pathOptions={{ color: "#0f766e", weight: 1, fillOpacity: 0.12 }}>
            <Tooltip sticky>{p.nombre}</Tooltip>
          </Polygon>
        ))}
        {mensura.length >= 3 && <Polygon positions={mensura} pathOptions={{ color: "#0f766e", weight: 3, fill: false }} />}
        {!editando &&
          vertices.map(({ v, ll }) => (
            <CircleMarker
              key={v.nombre}
              center={ll}
              radius={v.tipo === "lindero" ? 5 : 3}
              pathOptions={{ color: v.tipo === "lindero" ? "#1d4ed8" : "#0f766e", fillColor: "#fff", fillOpacity: 1, weight: 2 }}
            >
              <Tooltip direction="top" offset={[0, -4]}>{v.nombre}</Tooltip>
            </CircleMarker>
          ))}
        {editando && d.mensura.length >= 3 && <EditorVertices perimetro={d.mensura} aLatLng={aLatLng} dePunto={dePunto} paso={paso} onCambio={onPerimetro} />}
        {hitoLl && (
          <CircleMarker center={hitoLl} radius={7} pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.9 }}>
            <Tooltip permanent direction="right" offset={[8, 0]}>{hito?.nombre || "H.M."}</Tooltip>
          </CircleMarker>
        )}
        {amarre && (
          <Marker position={aLatLng(amarre)} icon={ICONO_AMARRE}>
            <Tooltip direction="right" offset={[8, 0]}>Amarre · {amarre.nombre || "sin nombre"}</Tooltip>
          </Marker>
        )}
        {auxiliares.map((a, i) => (
          <Marker key={`aux-${i}`} position={aLatLng(a)} icon={ICONO_AUXILIAR}>
            <Tooltip direction="right" offset={[6, 0]}>Auxiliar · {a.nombre || `A${i + 1}`}</Tooltip>
          </Marker>
        ))}
      </MapContainer>

      <div
        className="absolute right-3 top-3 z-[1000] flex flex-col gap-1 rounded-md border px-3 py-2 text-xs shadow"
        style={{ background: "var(--pg-panel)", borderColor: "var(--pg-line)" }}
      >
        <label className="flex cursor-pointer items-center gap-2 font-semibold">
          <input type="checkbox" checked={mostrarCatastro} onChange={(e) => setMostrarCatastro(e.target.checked)} />
          Catastro SERNAGEOMIN
        </label>
        <span style={{ color: estadoCatastro.error ? "#991b1b" : "var(--pg-muted)" }}>{textoEstado(estadoCatastro)}</span>
        {mostrarCatastro && (
          <span className="flex gap-3" style={{ color: "var(--pg-muted)" }}>
            <span><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#2563eb" }} /> Exploración</span>
            <span><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#ea580c" }} /> Explotación</span>
          </span>
        )}
      </div>
      {editando && (
        <div className="absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2 rounded-md border px-3 py-1.5 text-xs font-semibold shadow" style={{ background: "#fffbeb", borderColor: "#fcd34d", color: "#92400e" }}>
          Editando la mensura · arrastra un lindero, clic en + para insertar, clic derecho para quitar · paso {paso} m
        </div>
      )}
    </div>
  )
}
