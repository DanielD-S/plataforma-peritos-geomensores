import { useEffect, useRef, useState } from "react"
import type { Layer, PathOptions } from "leaflet"
import { GeoJSON, useMap, useMapEvents } from "react-leaflet"
import { consultarPorVista, desdeAtributos, ETIQUETA_SITUACION, ETIQUETA_TIPO, ZOOM_MINIMO_CATASTRO, type AtributosArcgis } from "../lib/catastro"

export interface EstadoCatastro {
  cargando: boolean
  cantidad: number
  zoomInsuficiente: boolean
  error: string | null
}

interface Props {
  visible: boolean
  onEstado?: (e: EstadoCatastro) => void
}

interface FeatureLike {
  properties?: AtributosArcgis
}

function estilo(f?: FeatureLike): PathOptions {
  const c = desdeAtributos(f?.properties ?? {})
  const color = c.tipo === "exploracion" ? "#2563eb" : c.tipo === "explotacion" ? "#ea580c" : "#6b7280"
  return {
    color,
    weight: c.situacion === "eliminada" ? 1 : 1.5,
    dashArray: c.situacion === "en_tramite" ? "4 3" : undefined,
    fillColor: color,
    fillOpacity: c.situacion === "eliminada" ? 0.02 : 0.08,
    opacity: c.situacion === "eliminada" ? 0.5 : 0.9,
  }
}

function alCrear(f: FeatureLike, capa: Layer) {
  const c = desdeAtributos(f.properties ?? {})
  capa.bindTooltip(
    `<b>${c.nombre}</b><br>Rol ${c.rol}<br>${ETIQUETA_TIPO[c.tipo]} · ${ETIQUETA_SITUACION[c.situacion]}<br>${c.titular}${c.hectareas != null ? `<br>${c.hectareas} ha` : ""}`,
    { sticky: true },
  )
}

/**
 * Catastro Sernageomin en la vista actual, consultado al mover el mapa (zoom ≥ 12).
 * Exploración en azul, explotación en naranja, en trámite punteado.
 */
export function CapaCatastro({ visible, onEstado }: Props) {
  const map = useMap()
  const [datos, setDatos] = useState<GeoJSON.FeatureCollection | null>(null)
  const [version, setVersion] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const onEstadoRef = useRef(onEstado)
  onEstadoRef.current = onEstado

  async function cargar() {
    if (!visible) return
    abortRef.current?.abort()
    if (map.getZoom() < ZOOM_MINIMO_CATASTRO) {
      setDatos(null)
      onEstadoRef.current?.({ cargando: false, cantidad: 0, zoomInsuficiente: true, error: null })
      return
    }
    const b = map.getBounds()
    const ctl = new AbortController()
    abortRef.current = ctl
    onEstadoRef.current?.({ cargando: true, cantidad: 0, zoomInsuficiente: false, error: null })
    try {
      const { crudo } = await consultarPorVista([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], ctl.signal)
      if (ctl.signal.aborted) return
      const fc = crudo as GeoJSON.FeatureCollection
      setDatos(fc)
      setVersion((v) => v + 1)
      onEstadoRef.current?.({ cargando: false, cantidad: fc.features.length, zoomInsuficiente: false, error: null })
    } catch (e) {
      if (ctl.signal.aborted) return
      onEstadoRef.current?.({ cargando: false, cantidad: 0, zoomInsuficiente: false, error: e instanceof Error ? e.message : "Error al consultar el catastro" })
    }
  }

  useMapEvents({ moveend: cargar })

  useEffect(() => {
    if (visible) void cargar()
    else {
      abortRef.current?.abort()
      setDatos(null)
    }
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  if (!visible || !datos) return null
  return <GeoJSON key={version} data={datos} style={estilo} onEachFeature={alCrear} interactive />
}
