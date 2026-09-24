import { useEffect, useMemo } from "react"
import L from "leaflet"
import proj4 from "proj4"
import { CircleMarker, MapContainer, Polygon, TileLayer, Tooltip, useMap } from "react-leaflet"
import { crsPorEpsg } from "../lib/crs"
import type { Punto, Vertice } from "../lib/geometria"
import type { Derivados } from "../lib/sernageomin"

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
    map.fitBounds(L.latLngBounds(puntos), { padding: [24, 24] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, map])
  return null
}

/**
 * Previsualización en Leaflet. La reproyección a WGS84 es solo referencial
 * (parámetros towgs84 genéricos); los archivos se entregan en el datum oficial sin transformar.
 */
export function Mapa({ epsg, derivados: d, hito }: Props) {
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
    <MapContainer center={[-23, -69]} zoom={5} preferCanvas className="rounded-lg">
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Esri World Imagery"
        maxZoom={19}
      />
      <Encuadre puntos={todos} />
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
  )
}
