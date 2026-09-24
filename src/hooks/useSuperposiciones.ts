import { useEffect, useState } from "react"
import { analizarSuperposiciones, consultarIntersectantes, type Superposicion } from "../lib/catastro"
import type { Punto } from "../lib/geometria"

export interface EstadoSuperposiciones {
  cargando: boolean
  error: string | null
  lista: Superposicion[]
  /** Momento de la última consulta exitosa, para mostrar al usuario. */
  consultadoEn: Date | null
}

const RETARDO_MS = 700

/** Consulta el catastro Sernageomin con el perímetro de la mensura y clasifica vecinas y superposiciones. */
export function useSuperposiciones(mensura: Punto[], epsg: number): EstadoSuperposiciones {
  const [estado, setEstado] = useState<EstadoSuperposiciones>({ cargando: false, error: null, lista: [], consultadoEn: null })
  const clave = `${epsg}|${mensura.map((p) => `${p.n},${p.e}`).join(";")}`

  useEffect(() => {
    if (mensura.length < 3) {
      setEstado({ cargando: false, error: null, lista: [], consultadoEn: null })
      return
    }
    const ctl = new AbortController()
    const t = setTimeout(async () => {
      setEstado((s) => ({ ...s, cargando: true, error: null }))
      try {
        const entidades = await consultarIntersectantes(mensura, epsg, ctl.signal)
        if (ctl.signal.aborted) return
        setEstado({ cargando: false, error: null, lista: analizarSuperposiciones(mensura, entidades), consultadoEn: new Date() })
      } catch (e) {
        if (ctl.signal.aborted) return
        setEstado({ cargando: false, error: e instanceof Error ? e.message : "No se pudo consultar el catastro", lista: [], consultadoEn: null })
      }
    }, RETARDO_MS)
    return () => {
      clearTimeout(t)
      ctl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  return estado
}
