import { useState } from "react"
import type { EstadoSuperposiciones } from "../hooks/useSuperposiciones"
import { ETIQUETA_SITUACION, ETIQUETA_TIPO } from "../lib/catastro"
import { aGeograficas, formatoSexagesimal } from "../lib/geodesia"
import { descripcionPerimetro, relacionDesdePunto, type RelacionAzimut } from "../lib/geometria"
import { azimutCl, coordenadaCl, numeroCl } from "../lib/formato"
import type { Concesion } from "../lib/modelo"
import type { Derivados } from "../lib/sernageomin"
import { textoDistribucionVertices, textoHito, textoIndividualizacion, textoPuntoInteres, textoRelacionAmarre, textoVecinas } from "../lib/textos"

interface Props {
  concesion: Concesion
  derivados: Derivados
  superposiciones: EstadoSuperposiciones
}

type Pestana = "vertices" | "pertenencias" | "azimut" | "perimetro" | "geodesia" | "catastro" | "textos"

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

function BotonCopiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      className="boton boton-secundario !px-2 !py-0.5 !text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto)
          setOk(true)
          setTimeout(() => setOk(false), 1500)
        } catch {
          /* sin portapapeles */
        }
      }}
    >
      {ok ? "Copiado" : "Copiar"}
    </button>
  )
}

function Seccion({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-md border p-2" style={{ borderColor: "var(--pg-line)" }}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--pg-muted)" }}>
          {titulo}
        </span>
        <BotonCopiar texto={texto} />
      </div>
      <p className="whitespace-pre-wrap text-xs leading-relaxed">{texto}</p>
    </div>
  )
}

/** Cuadros que van en el acta y en el plano, calculados desde la geometría. */
export function Tablas({ concesion: c, derivados: d, superposiciones: sp }: Props) {
  const [pestana, setPestana] = useState<Pestana>("vertices")
  const { grilla } = d
  const valido = <T extends { n: number; e: number }>(p: T | null): T | null => (p && p.n > 0 && p.e > 0 ? p : null)
  const hito = valido(c.hito)
  const amarre = valido(c.amarre)
  const auxiliares = c.auxiliares.filter((a) => a.n > 0 && a.e > 0)
  const abarcadas = sp.lista.filter((s) => s.relacion === "abarca").length
  const geodesicos = [
    ...(amarre ? [{ ...amarre, rol: "Amarre" }] : []),
    ...auxiliares.map((a) => ({ ...a, rol: "Auxiliar" })),
    ...(hito ? [{ ...hito, rol: "Hito de mensura" }] : []),
  ].map((g) => ({ ...g, geo: aGeograficas(g, c.epsg) }))

  const pestanas: { id: Pestana; titulo: string }[] = [
    { id: "vertices", titulo: `Vértices (${grilla.todos.length})` },
    { id: "pertenencias", titulo: `Pertenencias (${grilla.pertenencias.length})` },
    { id: "perimetro", titulo: "Perímetro" },
    { id: "azimut", titulo: "H.M. a linderos" },
    { id: "geodesia", titulo: `Geodesia (${geodesicos.length})` },
    { id: "catastro", titulo: sp.cargando ? "Catastro…" : `Catastro (${sp.lista.length}${abarcadas ? `, ${abarcadas} superpuestas` : ""})` },
    { id: "textos", titulo: "Textos del acta" },
  ]

  const individualizacion = textoIndividualizacion(grilla, c.prefijoPertenencias, c.pertenenciaEO, c.pertenenciaNS)
  const vecinas = textoVecinas(sp.lista)

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 overflow-x-auto border-b px-2" style={{ borderColor: "var(--pg-line)" }}>
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPestana(p.id)}
            className="whitespace-nowrap px-3 py-2 text-xs font-semibold"
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
          (hito ? (
            <TablaRelacion filas={relacionDesdePunto({ ...hito, nombre: hito.nombre || "H.M." }, grilla.linderos)} />
          ) : (
            <p className="p-4 text-xs" style={{ color: "var(--pg-muted)" }}>
              Ingresa las coordenadas del hito de mensura para calcular azimut y distancia a cada lindero.
            </p>
          ))}
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
                    <th>Elevación (m)</th>
                    <th>Latitud</th>
                    <th>Longitud</th>
                    <th>Convergencia (g)</th>
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
                      <td>{formatoSexagesimal(g.geo.lat, "lat")}</td>
                      <td>{formatoSexagesimal(g.geo.lon, "lon")}</td>
                      <td>{azimutCl(g.geo.convergenciaGon)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-2 text-xs" style={{ color: "var(--pg-muted)" }}>
                Geográficas en el mismo datum de la mensura (inversa de la proyección, sin cambio de datum), como exige el acta.
              </p>
              {hito && amarre && (
                <>
                  <p className="px-2 text-xs font-semibold" style={{ color: "var(--pg-muted)" }}>
                    Relación del H.M. con el punto de amarre y ligazón del amarre a los linderos
                  </p>
                  <TablaRelacion
                    filas={[
                      ...relacionDesdePunto({ ...hito, nombre: hito.nombre || "H.M." }, [{ ...amarre, nombre: amarre.nombre || "Amarre", tipo: "lindero" }]),
                      ...relacionDesdePunto({ ...amarre, nombre: amarre.nombre || "Amarre" }, grilla.linderos),
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
        {pestana === "textos" && (
          <div className="flex flex-col gap-2 p-2">
            <Seccion titulo="Coordenadas UTM del punto de interés" texto={textoPuntoInteres(c.pi)} />
            <Seccion titulo="Ubicación del H.M." texto={hito ? textoHito(hito, aGeograficas(hito, c.epsg)) : "Ingresa el hito de mensura."} />
            <Seccion titulo="Relación del H.M. con el punto de amarre" texto={hito && amarre ? textoRelacionAmarre(hito, amarre) : "Ingresa el hito y el punto de amarre."} />
            <Seccion titulo="Distribución de los vértices" texto={textoDistribucionVertices(grilla, c.pertenenciaEO, c.pertenenciaNS)} />
            <Seccion
              titulo="Individualización de las pertenencias"
              texto={`${individualizacion.encabezado}\n${individualizacion.filas.map((f) => `${f.nombre}: ${f.vertices}`).join("\n")}`}
            />
            <Seccion titulo="Pertenencias vecinas" texto={sp.cargando ? "Consultando el catastro…" : vecinas.vecinas} />
            <Seccion titulo="Abarcamiento" texto={sp.cargando ? "Consultando el catastro…" : vecinas.abarcamiento} />
            <p className="px-1 text-xs" style={{ color: "var(--pg-muted)" }}>
              Redacción automática con la estructura de las actas. Las vecinas y el abarcamiento salen del catastro en línea: confírmalos con los antecedentes registrales.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
