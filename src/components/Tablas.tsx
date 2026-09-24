import { useState } from "react"
import type { EstadoSuperposiciones } from "../hooks/useSuperposiciones"
import { ETIQUETA_SITUACION, ETIQUETA_TIPO } from "../lib/catastro"
import { descripcionPerimetro, relacionDesdePunto, type RelacionAzimut } from "../lib/geometria"
import { azimutCl, coordenadaCl, numeroCl } from "../lib/formato"
import type { Derivados } from "../lib/sernageomin"

interface Props {
  derivados: Derivados
  hito: { nombre: string; n: number; e: number; altura?: number | null } | null
  amarre: { nombre: string; n: number; e: number; altura?: number | null } | null
  auxiliares: { nombre: string; n: number; e: number; altura?: number | null }[]
  superposiciones: EstadoSuperposiciones
}

type Pestana = "vertices" | "pertenencias" | "azimut" | "perimetro" | "geodesia" | "catastro"

const DIRECCION: Record<string, string> = { norte: "Al norte", sur: "Al sur", este: "Al este", oeste: "Al oeste" }

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
export function Tablas({ derivados: d, hito, amarre, auxiliares, superposiciones: sp }: Props) {
  const [pestana, setPestana] = useState<Pestana>("vertices")
  const { grilla } = d
  const valido = <T extends { n: number; e: number }>(p: T | null): T | null => (p && p.n > 0 && p.e > 0 ? p : null)
  const hitoValido = valido(hito)
  const amarreValido = valido(amarre)
  const auxValidos = auxiliares.filter((a) => a.n > 0 && a.e > 0)
  const abarcadas = sp.lista.filter((s) => s.relacion === "abarca").length
  const geodesicos = [
    ...(amarreValido ? [{ ...amarreValido, rol: "Amarre" }] : []),
    ...auxValidos.map((a) => ({ ...a, rol: "Auxiliar" })),
    ...(hitoValido ? [{ ...hitoValido, rol: "Hito de mensura" }] : []),
  ]

  const pestanas: { id: Pestana; titulo: string }[] = [
    { id: "vertices", titulo: `Vértices (${grilla.todos.length})` },
    { id: "pertenencias", titulo: `Pertenencias (${grilla.pertenencias.length})` },
    { id: "perimetro", titulo: "Perímetro" },
    { id: "azimut", titulo: "H.M. a linderos" },
    { id: "geodesia", titulo: `Geodesia (${geodesicos.length})` },
    { id: "catastro", titulo: sp.cargando ? "Catastro…" : `Catastro (${sp.lista.length}${abarcadas ? `, ${abarcadas} superpuestas` : ""})` },
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
        {pestana === "geodesia" &&
          (geodesicos.length === 0 ? (
            <p className="p-4 text-xs" style={{ color: "var(--pg-muted)" }}>
              Ingresa el hito de mensura y el punto de amarre en "Referencia geodésica" para ver el cuadro de vértices y la ligazón.
            </p>
          ) : (
            <div className="flex flex-col gap-3 p-2">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Vértice</th>
                    <th>Función</th>
                    <th>Norte (m)</th>
                    <th>Este (m)</th>
                    <th>Elevación (m s.n.m.)</th>
                  </tr>
                </thead>
                <tbody>
                  {geodesicos.map((g, i) => (
                    <tr key={i}>
                      <td>{g.nombre || "—"}</td>
                      <td>{g.rol}</td>
                      <td>{coordenadaCl(g.n)}</td>
                      <td>{coordenadaCl(g.e)}</td>
                      <td>{g.altura != null ? numeroCl(g.altura, 2) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hitoValido && amarreValido && (
                <>
                  <p className="px-2 text-xs font-semibold" style={{ color: "var(--pg-muted)" }}>
                    Relación del H.M. con el punto de amarre y ligazón del amarre a los linderos
                  </p>
                  <TablaRelacion
                    filas={[
                      ...relacionDesdePunto({ ...hitoValido, nombre: hitoValido.nombre || "H.M." }, [{ ...amarreValido, nombre: amarreValido.nombre || "Amarre", tipo: "lindero" }]),
                      ...relacionDesdePunto({ ...amarreValido, nombre: amarreValido.nombre || "Amarre" }, grilla.linderos),
                    ]}
                  />
                </>
              )}
            </div>
          ))}
        {pestana === "catastro" && (
          <div>
            {sp.error && (
              <p className="p-3 text-xs" style={{ color: "#991b1b" }}>
                {sp.error}
              </p>
            )}
            {!sp.error && !sp.cargando && sp.lista.length === 0 && (
              <p className="p-4 text-xs" style={{ color: "var(--pg-muted)" }}>
                Ninguna concesión del catastro toca la mensura.
              </p>
            )}
            {sp.lista.length > 0 && (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Relación</th>
                    <th>Concesión</th>
                    <th>Rol</th>
                    <th>Tipo · Situación</th>
                    <th>Titular</th>
                    <th>Superposición (ha)</th>
                  </tr>
                </thead>
                <tbody>
                  {sp.lista.map((s) => (
                    <tr key={s.concesion.id} style={s.relacion === "abarca" ? { background: "#fef3c7" } : undefined}>
                      <td className="font-semibold">
                        {s.relacion === "abarca"
                          ? "Abarca"
                          : s.relacion === "colinda"
                            ? `Colinda ${DIRECCION[s.direccion].toLowerCase()}`
                            : `A ${numeroCl(s.distanciaM, 0)} m ${DIRECCION[s.direccion].toLowerCase()}`}
                      </td>
                      <td>{s.concesion.nombre}</td>
                      <td>{s.concesion.rol}</td>
                      <td>
                        {ETIQUETA_TIPO[s.concesion.tipo]} · {ETIQUETA_SITUACION[s.concesion.situacion]}
                      </td>
                      <td>{s.concesion.titular}</td>
                      <td>{s.relacion === "abarca" ? numeroCl(s.areaHa, 2) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="px-3 py-2 text-xs" style={{ color: "var(--pg-muted)" }}>
              Fuente: catastro SERNAGEOMIN en línea. Las posiciones del catastro son referenciales; confirma vecinos y abarcamientos con los antecedentes registrales.
            </p>
          </div>
        )}
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
