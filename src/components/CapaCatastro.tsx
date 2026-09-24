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

export type DestinoBase = "manifestacion" | "solicitud" | "mensura"

interface Props {
  visible: boolean
  onEstado?: (e: EstadoCatastro) => void
  /** Usar la geometría de una concesión del catastro como base de la concesión en edición. */
  onUsar?: (objectId: number, destino: DestinoBase) => void
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

/** Ficha de la concesión (solo al hacer clic), con botones para usarla como base. */
function fichaPopup(f: FeatureLike, onUsar?: (objectId: number, destino: DestinoBase) => void): HTMLElement {
  const c = desdeAtributos(f.properties ?? {})
  const raiz = document.createElement("div")
  raiz.style.fontSize = "12px"
  const titulo = document.createElement("b")
  titulo.textContent = c.nombre
  raiz.appendChild(titulo)
  const tabla = document.createElement("table")
  tabla.style.marginTop = "4px"
  const filas: [string, string][] = [
    ["Rol", c.rol],
    ["Tipo", ETIQUETA_TIPO[c.tipo]],
    ["Situación", ETIQUETA_SITUACION[c.situacion]],
    ["Titular", c.titular],
    ["Superficie", c.hectareas != null ? `${c.hectareas} ha` : ""],
    ["Comuna", c.comuna],
    ["Datum", `${c.datum} huso ${c.huso}`],
  ]
  for (const [k, v] of filas) {
    if (!v) continue
    const tr = document.createElement("tr")
    const td1 = document.createElement("td")
    td1.style.color = "#6b7280"
    td1.style.paddingRight = "8px"
    td1.textContent = k
    const td2 = document.createElement("td")
    td2.textContent = v
    tr.append(td1, td2)
    tabla.appendChild(tr)
  }
  raiz.appendChild(tabla)
  if (onUsar && c.id) {
    const etiqueta = document.createElement("div")
    etiqueta.textContent = "Usar su geometría como:"
    etiqueta.style.cssText = "margin-top:8px;color:#6b7280;font-size:11px"
    raiz.appendChild(etiqueta)
    const botones = document.createElement("div")
    botones.style.cssText = "display:flex;gap:4px;margin-top:4px"
    const opciones: [DestinoBase, string][] = [
      ["manifestacion", "Manifestación"],
      ["solicitud", "Solicitud"],
      ["mensura", "Mensura"],
    ]
    for (const [destino, texto] of opciones) {
      const b = document.createElement("button")
      b.type = "button"
      b.textContent = texto
      b.style.cssText = "font-size:11px;padding:2px 6px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;cursor:pointer"
      b.addEventListener("click", () => onUsar(c.id, destino))
      botones.appendChild(b)
    }
    raiz.appendChild(botones)
  }
  return raiz
}

/**
 * Catastro Sernageomin en la vista actual, consultado al mover el mapa (zoom ≥ 12).
 * Exploración en azul, explotación en naranja, en trámite punteado.
 */
export function CapaCatastro({ visible, onEstado, onUsar }: Props) {
  const map = useMap()
  const [datos, setDatos] = useState<GeoJSON.FeatureCollection | null>(null)
  const [version, setVersion] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const onEstadoRef = useRef(onEstado)
  onEstadoRef.current = onEstado
  const onUsarRef = useRef(onUsar)
  onUsarRef.current = onUsar

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
  return (
    <GeoJSON
      key={version}
      data={datos}
      style={estilo}
      onEachFeature={(f: FeatureLike, capa: Layer) => capa.bindPopup(() => fichaPopup(f, onUsarRef.current), { maxWidth: 320 })}
      interactive
    />
  )
}
