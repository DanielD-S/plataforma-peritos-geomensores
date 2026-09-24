/**
 * Cartera de concesiones guardada en el navegador (localStorage), con exportación e
 * importación en JSON para respaldo o traspaso entre equipos. Sin backend por ahora.
 */
import { CONCESION_EJEMPLO, concesionVacia, normalizarConcesion, normalizarPerito, nuevoId, peritoVacio, type Concesion, type Perito } from "./modelo"

export const CLAVE_CARTERA = "ppg.cartera.v1"
/** Clave del prototipo anterior, con una sola concesión; se migra la primera vez. */
const CLAVE_ANTIGUA = "ppg.concesion.v1"

export interface Cartera {
  version: 1
  activaId: string
  concesiones: Concesion[]
  /** Datos del perito, comunes a todas las concesiones. */
  perito: Perito
}

interface AlmacenLike {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

export function carteraInicial(): Cartera {
  const ejemplo = { ...CONCESION_EJEMPLO }
  return { version: 1, activaId: ejemplo.id, concesiones: [ejemplo], perito: peritoVacio() }
}

function parsear(json: string): Cartera | null {
  try {
    const o = JSON.parse(json) as Partial<Cartera>
    if (!o || !Array.isArray(o.concesiones)) return null
    const concesiones = o.concesiones.map(normalizarConcesion)
    if (concesiones.length === 0) return null
    const activaId = concesiones.some((c) => c.id === o.activaId) ? (o.activaId as string) : concesiones[0].id
    return { version: 1, activaId, concesiones, perito: normalizarPerito(o.perito) }
  } catch {
    return null
  }
}

export function actualizarPerito(cartera: Cartera, perito: Perito): Cartera {
  return { ...cartera, perito }
}

export function cargarCartera(almacen: AlmacenLike | null): Cartera {
  if (!almacen) return carteraInicial()
  try {
    const actual = almacen.getItem(CLAVE_CARTERA)
    if (actual) {
      const c = parsear(actual)
      if (c) return c
    }
    const antigua = almacen.getItem(CLAVE_ANTIGUA)
    if (antigua) {
      const c = normalizarConcesion(JSON.parse(antigua))
      if (!c.nombre) return carteraInicial()
      const cartera: Cartera = { version: 1, activaId: c.id, concesiones: [c], perito: peritoVacio() }
      almacen.setItem(CLAVE_CARTERA, JSON.stringify(cartera))
      almacen.removeItem(CLAVE_ANTIGUA)
      return cartera
    }
  } catch {
    /* almacenamiento no disponible */
  }
  return carteraInicial()
}

export function guardarCartera(almacen: AlmacenLike | null, cartera: Cartera): void {
  try {
    almacen?.setItem(CLAVE_CARTERA, JSON.stringify(cartera))
  } catch {
    /* ignorar: cuota o modo privado */
  }
}

export function activa(cartera: Cartera): Concesion {
  return cartera.concesiones.find((c) => c.id === cartera.activaId) ?? cartera.concesiones[0]
}

export function reemplazarActiva(cartera: Cartera, cambio: (c: Concesion) => Concesion): Cartera {
  return {
    ...cartera,
    concesiones: cartera.concesiones.map((c) => (c.id === cartera.activaId ? { ...cambio(c), actualizadoEn: new Date().toISOString() } : c)),
  }
}

export function agregar(cartera: Cartera, concesion: Concesion): Cartera {
  return { ...cartera, activaId: concesion.id, concesiones: [...cartera.concesiones, concesion] }
}

export function nueva(cartera: Cartera): Cartera {
  return agregar(cartera, concesionVacia())
}

export function nuevaDesdeEjemplo(cartera: Cartera): Cartera {
  const copia: Concesion = { ...CONCESION_EJEMPLO, id: nuevoId(), actualizadoEn: new Date().toISOString() }
  return agregar(cartera, copia)
}

export function duplicar(cartera: Cartera): Cartera {
  const a = activa(cartera)
  const copia: Concesion = structuredClone({ ...a, id: nuevoId(), nombre: `${a.nombre} (copia)`.trim(), actualizadoEn: new Date().toISOString() })
  return agregar(cartera, copia)
}

export function eliminar(cartera: Cartera, id: string): Cartera {
  const restantes = cartera.concesiones.filter((c) => c.id !== id)
  if (restantes.length === 0) return { ...cartera, concesiones: [concesionVacia()], activaId: "" }
  const activaId = cartera.activaId === id ? restantes[0].id : cartera.activaId
  return { ...cartera, activaId, concesiones: restantes }
}

export function seleccionar(cartera: Cartera, id: string): Cartera {
  return cartera.concesiones.some((c) => c.id === id) ? { ...cartera, activaId: id } : cartera
}

export function serializar(cartera: Cartera): string {
  return JSON.stringify({ version: 1, exportadoEn: new Date().toISOString(), perito: cartera.perito, concesiones: cartera.concesiones }, null, 2)
}

/**
 * Importa un JSON exportado por esta misma plataforma (o una sola concesión).
 * Las concesiones con un id ya existente se reemplazan; el resto se agrega.
 */
export function importarJson(cartera: Cartera, json: string): { cartera: Cartera; importadas: number } {
  const o = JSON.parse(json) as unknown
  const lista = Array.isArray((o as { concesiones?: unknown }).concesiones)
    ? ((o as { concesiones: unknown[] }).concesiones as unknown[])
    : [o]
  const entrantes = lista.map(normalizarConcesion).filter((c) => c.nombre || c.pi.n > 0)
  if (entrantes.length === 0) throw new Error("El archivo no contiene concesiones reconocibles.")
  const porId = new Map(cartera.concesiones.map((c) => [c.id, c]))
  for (const c of entrantes) porId.set(c.id, c)
  const peritoEntrante = (o as { perito?: unknown }).perito
  const perito = peritoEntrante && !cartera.perito.nombre ? normalizarPerito(peritoEntrante) : cartera.perito
  return { cartera: { version: 1, activaId: entrantes[0].id, concesiones: [...porId.values()], perito }, importadas: entrantes.length }
}
