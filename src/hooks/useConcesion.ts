import { useCallback, useEffect, useState } from "react"
import { CONCESION_EJEMPLO, concesionVacia, type Concesion } from "../lib/modelo"

const CLAVE = "ppg.concesion.v1"

function cargar(): Concesion {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (raw) return { ...concesionVacia(), ...(JSON.parse(raw) as Partial<Concesion>) }
  } catch {
    /* almacenamiento no disponible: se parte del ejemplo */
  }
  return CONCESION_EJEMPLO
}

/** Estado de la concesión en edición, persistido en el navegador. */
export function useConcesion() {
  const [concesion, setConcesion] = useState<Concesion>(cargar)

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(concesion))
    } catch {
      /* ignorar */
    }
  }, [concesion])

  const actualizar = useCallback(<K extends keyof Concesion>(campo: K, valor: Concesion[K]) => {
    setConcesion((c) => ({ ...c, [campo]: valor }))
  }, [])

  const cargarEjemplo = useCallback(() => setConcesion(CONCESION_EJEMPLO), [])
  const limpiar = useCallback(() => setConcesion(concesionVacia()), [])

  return { concesion, setConcesion, actualizar, cargarEjemplo, limpiar }
}
