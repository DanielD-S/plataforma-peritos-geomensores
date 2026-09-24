import { useCallback, useEffect, useMemo, useState } from "react"
import {
  activa as activaDe,
  actualizarPerito as peritoEn,
  cargarCartera,
  duplicar as duplicarEn,
  eliminar as eliminarEn,
  guardarCartera,
  importarJson,
  nueva as nuevaEn,
  nuevaDesdeEjemplo as ejemploEn,
  reemplazarActiva,
  seleccionar as seleccionarEn,
  serializar,
  type Cartera,
} from "../lib/cartera"
import type { Concesion, Perito } from "../lib/modelo"

function almacen(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null
  } catch {
    return null
  }
}

/** Cartera de concesiones persistida en el navegador, con la concesión activa en edición. */
export function useCartera() {
  const [cartera, setCartera] = useState<Cartera>(() => cargarCartera(almacen()))

  useEffect(() => {
    guardarCartera(almacen(), cartera)
  }, [cartera])

  const concesion = useMemo(() => activaDe(cartera), [cartera])

  const actualizar = useCallback(<K extends keyof Concesion>(campo: K, valor: Concesion[K]) => {
    setCartera((c) => reemplazarActiva(c, (a) => ({ ...a, [campo]: valor })))
  }, [])
  const actualizarVarios = useCallback((cambios: Partial<Concesion>) => {
    setCartera((c) => reemplazarActiva(c, (a) => ({ ...a, ...cambios })))
  }, [])

  const setPerito = useCallback((p: Perito) => setCartera((c) => peritoEn(c, p)), [])
  const nueva = useCallback(() => setCartera(nuevaEn), [])
  const nuevaDesdeEjemplo = useCallback(() => setCartera(ejemploEn), [])
  const duplicar = useCallback(() => setCartera(duplicarEn), [])
  const eliminar = useCallback((id: string) => setCartera((c) => eliminarEn(c, id)), [])
  const seleccionar = useCallback((id: string) => setCartera((c) => seleccionarEn(c, id)), [])
  const exportar = useCallback(() => serializar(cartera), [cartera])
  const importar = useCallback(
    (json: string) => {
      const r = importarJson(cartera, json)
      setCartera(r.cartera)
      return r.importadas
    },
    [cartera],
  )

  return { cartera, concesion, perito: cartera.perito, setPerito, actualizar, actualizarVarios, nueva, nuevaDesdeEjemplo, duplicar, eliminar, seleccionar, exportar, importar }
}
