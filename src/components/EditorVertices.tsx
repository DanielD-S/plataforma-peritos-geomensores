import { useMemo } from "react"
import L from "leaflet"
import { Marker, Tooltip } from "react-leaflet"
import type { Punto } from "../lib/geometria"

type LatLng = [number, number]

interface Props {
  /** Perímetro normalizado (horario desde el NW). */
  perimetro: Punto[]
  aLatLng: (p: Punto) => LatLng
  dePunto: (ll: LatLng) => Punto
  /** Paso de ajuste en metros: las coordenadas se redondean a múltiplos de este valor. */
  paso: number
  onCambio: (perimetro: Punto[]) => void
}

const ICONO_VERTICE = L.divIcon({ className: "ppg-vertice", iconSize: [12, 12], iconAnchor: [6, 6] })
const ICONO_MEDIO = L.divIcon({ className: "ppg-medio", html: "+", iconSize: [14, 14], iconAnchor: [7, 7] })

function ajustar(v: number, paso: number): number {
  return paso > 0 ? Math.round(v / paso) * paso : Math.round(v * 1000) / 1000
}

/**
 * Edición del perímetro sobre el mapa: arrastra un lindero para moverlo (se ajusta al paso),
 * clic en un "+" inserta un vértice en la mitad del lado, clic derecho sobre un lindero lo elimina.
 */
export function EditorVertices({ perimetro, aLatLng, dePunto, paso, onCambio }: Props) {
  const medios = useMemo(
    () =>
      perimetro.map((v, i) => {
        const s = perimetro[(i + 1) % perimetro.length]
        return { n: (v.n + s.n) / 2, e: (v.e + s.e) / 2 }
      }),
    [perimetro],
  )

  function mover(i: number, ll: LatLng) {
    const p = dePunto(ll)
    const nuevo = perimetro.slice()
    nuevo[i] = { n: ajustar(p.n, paso), e: ajustar(p.e, paso) }
    onCambio(nuevo)
  }
  function insertar(i: number) {
    const nuevo = perimetro.slice()
    nuevo.splice(i + 1, 0, { n: ajustar(medios[i].n, paso), e: ajustar(medios[i].e, paso) })
    onCambio(nuevo)
  }
  function eliminar(i: number) {
    if (perimetro.length <= 4) return
    onCambio(perimetro.filter((_, k) => k !== i))
  }

  return (
    <>
      {perimetro.map((v, i) => (
        <Marker
          key={`v-${i}-${v.n}-${v.e}`}
          position={aLatLng(v)}
          icon={ICONO_VERTICE}
          draggable
          zIndexOffset={1000}
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng()
              mover(i, [ll.lat, ll.lng])
            },
            contextmenu: (e) => {
              L.DomEvent.preventDefault(e.originalEvent)
              eliminar(i)
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            L-{i + 1} · arrastra para mover, clic derecho para quitar
          </Tooltip>
        </Marker>
      ))}
      {medios.map((m, i) => (
        <Marker key={`m-${i}-${m.n}-${m.e}`} position={aLatLng(m)} icon={ICONO_MEDIO} zIndexOffset={900} eventHandlers={{ click: () => insertar(i) }}>
          <Tooltip direction="top" offset={[0, -6]}>
            Insertar vértice
          </Tooltip>
        </Marker>
      ))}
    </>
  )
}
