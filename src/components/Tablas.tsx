import { useState } from "react"
import { descripcionPerimetro, relacionDesdePunto, type RelacionAzimut } from "../lib/geometria"
import { azimutCl, coordenadaCl, numeroCl } from "../lib/formato"
import type { Derivados } from "../lib/sernageomin"

interface Props {
  derivados: Derivados
  hito: { nombre: string; n: number; e: number } | null
}

type Pestana = "vertices" | "pertenencias" | "azimut" | "perimetro"

function TablaRelacion({ filas }: { filas: RelacionAzimut[] }) {
  return (
    <table className="tabla">
      <thead>
        <tr>
          <th>Desde</th>
          <th>Hasta</th>
          <th>Azimut (g)</th>
          <th>Distancia UTM (m)</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((r) => (
          <tr key={`${r.desde}-${r.hasta}`}>
            <td>{r.desde}</td>
            <td>{r.hasta}</td>
            <td>{azimutCl(r.azimut)}</td>
            <td>{numeroCl(r.distancia, 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Cuadros que van en el acta y en el plano, calculados desde la geometría. */
export function Tablas({ derivados: d, hito }: Props) {
  const [pestana, setPestana] = useState<Pestana>("vertices")
  const { grilla } = d
  const hitoValido = hito && hito.n > 0 && hito.e > 0 ? hito : null

  const pestanas: { id: Pestana; titulo: string }[] = [
    { id: "vertices", titulo: `Vértices (${grilla.todos.length})` },
    { id: "pertenencias", titulo: `Pertenencias (${grilla.pertenencias.length})` },
    { id: "perimetro", titulo: "Perímetro" },
    { id: "azimut", titulo: "H.M. a linderos" },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b px-2" style={{ borderColor: "var(--pg-line)" }}>
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPestana(p.id)}
            className="px-3 py-2 text-xs font-semibold"
            style={{
              color: pestana === p.id ? "var(--pg-primary)" : "var(--pg-muted)",
              borderBottom: pestana === p.id ? "2px solid var(--pg-primary)" : "2px solid transparent",
            }}
          >
            {p.titulo}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {pestana === "vertices" && (
          <table className="tabla">
            <thead>
              <tr>
                <th>Vértice</th>
                <th>Tipo</th>
                <th>Norte (m)</th>
                <th>Este (m)</th>
              </tr>
            </thead>
            <tbody>
              {grilla.todos.map((v) => (
                <tr key={v.nombre}>
                  <td>{v.nombre}</td>
                  <td>{v.tipo}</td>
                  <td>{coordenadaCl(v.n)}</td>
                  <td>{coordenadaCl(v.e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pestana === "pertenencias" && (
          <table className="tabla">
            <thead>
              <tr>
                <th>Pertenencia</th>
                <th>Vértices (NW-NE-SE-SW)</th>
                <th>Área (ha)</th>
              </tr>
            </thead>
            <tbody>
              {grilla.pertenencias.map((p) => (
                <tr key={p.indice}>
                  <td>{p.nombre}</td>
                  <td>{p.vertices.map((v) => v.nombre).join(" - ")}</td>
                  <td>{numeroCl(p.areaHa, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pestana === "perimetro" && <TablaRelacion filas={descripcionPerimetro(grilla.linderos)} />}
        {pestana === "azimut" &&
          (hitoValido ? (
            <TablaRelacion filas={relacionDesdePunto({ ...hitoValido }, grilla.linderos)} />
          ) : (
            <p className="p-4 text-xs" style={{ color: "var(--pg-muted)" }}>
              Ingresa las coordenadas del hito de mensura para calcular azimut y distancia a cada lindero.
            </p>
          ))}
      </div>
    </div>
  )
}
