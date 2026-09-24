import { useEffect, useMemo, useState } from "react"
import L from "leaflet"
import proj4 from "proj4"
import { CircleMarker, MapContainer, Polygon, TileLayer, Tooltip, useMap } from "react-leaflet"
import { crsPorEpsg } from "../lib/crs"
import type { Punto, Vertice } from "../lib/geometria"
import type { Derivados } from "../lib/sernageomin"
import { CapaCatastro, type EstadoCatastro } from "./CapaCatastro"

interface Props {
  epsg: number
  derivados: Derivados
  hito: { nombre: string; n: number; e: number } | null
}

type LatLng = [number, number]

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

/**
 * Previsualización en Leaflet. La reproyección a WGS84 es solo referencial
 * (parámetros towgs84 genéricos); los archivos se entregan en el datum oficial sin transformar.
 */
export function Mapa({ epsg, derivados: d, hito }: Props) {
  const [mostrarCatastro, setMostrarCatastro] = useState(true)
  const [estadoCatastro, setEstadoCatastro] = useState<EstadoCatastro>({ cargando: false, cantidad: 0, zoomInsuficiente: false, error: null })

  const aLatLng = useMemo(() => {
    const crs = crsPorEpsg(epsg)
    return (p: Punto): LatLng => {
      const [lon, lat] = proj4(crs.proj4, "EPSG:4326", [p.e, p.n])
      return [lat, lon]
    }
  }, [epsg])

  const manifestacion = d.manifestacion.map(aLatLng)
  const mensura = d.mensura.map(aLatLng)
  const pertenencias = d.grilla.pertenencias.map((p) => ({ nombre: p.nombre, ring: p.vertices.map(aLatLng) }))
  const vertices = d.grilla.todos.map((v: Vertice) => ({ v, ll: aLatLng(v) }))
  const hitoLl = hito && hito.n && hito.e ? aLatLng(hito) : null
  const todos = [...manifestacion, ...mensura, ...(hitoLl ? [hitoLl] : [])]

  return (
    <div className="relative h-full w-full">
      <MapContainer center={[-23, -69]} zoom={5} preferCanvas className="rounded-lg">
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Esri World Imagery · Catastro SERNAGEOMIN"
          maxZoom={19}
          maxNativeZoom={17}
        />
        <Encuadre puntos={todos} />
        <CapaCatastro visible={mostrarCatastro} onEstado={setEstadoCatastro} />
        {manifestacion.length >= 3 && (
          <Polygon positions={manifestacion} pathOptions={{ color: "#b45309", weight: 2, dashArray: "6 4", fillOpacity: 0.05 }}>
            <Tooltip sticky>Manifestación</Tooltip>
          </Polygon>
        )}
        {pertenencias.map((p) => (
          <Polygon key={p.nombre} positions={p.ring} pathOptions={{ color: "#0f766e", weight: 1, fillOpacity: 0.12 }}>
            <Tooltip sticky>{p.nombre}</Tooltip>
          </Polygon>
        ))}
        {mensura.length >= 3 && <Polygon positions={mensura} pathOptions={{ color: "#0f766e", weight: 3, fill: false }} />}
        {vertices.map(({ v, ll }) => (
          <CircleMarker
            key={v.nombre}
            center={ll}
            radius={v.tipo === "lindero" ? 5 : 3}
            pathOptions={{ color: v.tipo === "lindero" ? "#1d4ed8" : "#0f766e", fillColor: "#fff", fillOpacity: 1, weight: 2 }}
          >
            <Tooltip direction="top" offset={[0, -4]}>{v.nombre}</Tooltip>
          </CircleMarker>
        ))}
        {hitoLl && (
          <CircleMarker center={hitoLl} radius={7} pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.9 }}>
            <Tooltip permanent direction="right" offset={[8, 0]}>{hito?.nombre || "H.M."}</Tooltip>
          </CircleMarker>
        )}
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
    </div>
  )
}
