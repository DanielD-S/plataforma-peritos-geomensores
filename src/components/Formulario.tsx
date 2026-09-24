import { CRS_OFICIALES } from "../lib/crs"
import type { Punto } from "../lib/geometria"
import type { Concesion } from "../lib/modelo"

interface Props {
  concesion: Concesion
  actualizar: <K extends keyof Concesion>(campo: K, valor: Concesion[K]) => void
  cargarEjemplo: () => void
  limpiar: () => void
}

function num(v: string): number {
  const n = Number(v.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

/** Convierte el texto "N E" por línea en puntos; ignora líneas vacías o inválidas. */
export function parsearPerimetro(texto: string): Punto[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/[\s;\t]+/).map(num))
    .filter((p) => p.length >= 2 && p[0] > 0 && p[1] > 0)
    .map(([n, e]) => ({ n, e }))
}

export function perimetroATexto(p: Punto[]): string {
  return p.map((v) => `${v.n} ${v.e}`).join("\n")
}

export function Formulario({ concesion: c, actualizar, cargarEjemplo, limpiar }: Props) {
  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex gap-2">
        <button className="boton boton-secundario" onClick={cargarEjemplo} type="button">
          Cargar ejemplo (Antaquena 1)
        </button>
        <button className="boton boton-secundario" onClick={limpiar} type="button">
          Limpiar
        </button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold">Identificación</h2>
        <div>
          <label className="etiqueta" htmlFor="nombre">Nombre de la concesión</label>
          <input id="nombre" className="campo" value={c.nombre} onChange={(e) => actualizar("nombre", e.target.value.toUpperCase())} placeholder="MINA QUEBRADA BLANCA 1 AL 12" />
        </div>
        <div>
          <label className="etiqueta" htmlFor="rol">Rol nacional Sernageomin</label>
          <input id="rol" className="campo" value={c.rol} onChange={(e) => actualizar("rol", e.target.value)} placeholder="203100200-1" />
        </div>
        <div>
          <label className="etiqueta" htmlFor="epsg">Sistema de coordenadas oficial</label>
          <select id="epsg" className="campo" value={c.epsg} onChange={(e) => actualizar("epsg", Number(e.target.value))}>
            {CRS_OFICIALES.map((crs) => (
              <option key={crs.epsg} value={crs.epsg}>
                {crs.nombre} — EPSG {crs.epsg}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold">Fechas</h2>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="etiqueta" htmlFor="f1">Manifestación</label>
            <input id="f1" type="date" className="campo" value={c.fechaManifestacion} onChange={(e) => actualizar("fechaManifestacion", e.target.value)} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="f2">Sol. mensura</label>
            <input id="f2" type="date" className="campo" value={c.fechaSolicitudMensura} onChange={(e) => actualizar("fechaSolicitudMensura", e.target.value)} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="f3">Mensura</label>
            <input id="f3" type="date" className="campo" value={c.fechaMensura} onChange={(e) => actualizar("fechaMensura", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold">Manifestación</h2>
        <p className="text-xs" style={{ color: "var(--pg-muted)" }}>
          Rectángulo centrado en el punto de interés. Coordenadas UTM en metros, en el datum elegido.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="etiqueta" htmlFor="pin">P.I. Norte</label>
            <input id="pin" className="campo" inputMode="decimal" value={c.pi.n || ""} onChange={(e) => actualizar("pi", { ...c.pi, n: num(e.target.value) })} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="pie">P.I. Este</label>
            <input id="pie" className="campo" inputMode="decimal" value={c.pi.e || ""} onChange={(e) => actualizar("pi", { ...c.pi, e: num(e.target.value) })} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="lns">Lado Norte-Sur (m)</label>
            <input id="lns" className="campo" inputMode="decimal" value={c.ladoNS || ""} onChange={(e) => actualizar("ladoNS", num(e.target.value))} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="leo">Lado Este-Oeste (m)</label>
            <input id="leo" className="campo" inputMode="decimal" value={c.ladoEO || ""} onChange={(e) => actualizar("ladoEO", num(e.target.value))} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold">Mensura</h2>
        <div>
          <label className="etiqueta" htmlFor="per">Perímetro de la mensura (Norte Este por línea)</label>
          <textarea
            id="per"
            className="campo font-mono"
            rows={8}
            defaultValue={perimetroATexto(c.perimetroMensura)}
            key={perimetroATexto(c.perimetroMensura)}
            onBlur={(e) => actualizar("perimetroMensura", parsearPerimetro(e.target.value))}
            placeholder={"7477000 465000\n7477000 466000\n..."}
          />
          <p className="mt-1 text-xs" style={{ color: "var(--pg-muted)" }}>
            Vacío = mismo rectángulo de la manifestación. Se orienta solo en sentido horario desde el vértice NW.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="etiqueta" htmlFor="peo">Pertenencia E-O (m)</label>
            <input id="peo" className="campo" inputMode="decimal" value={c.pertenenciaEO || ""} onChange={(e) => actualizar("pertenenciaEO", num(e.target.value))} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="pns">Pertenencia N-S (m)</label>
            <input id="pns" className="campo" inputMode="decimal" value={c.pertenenciaNS || ""} onChange={(e) => actualizar("pertenenciaNS", num(e.target.value))} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="pre">Prefijo</label>
            <input id="pre" className="campo" value={c.prefijoPertenencias} onChange={(e) => actualizar("prefijoPertenencias", e.target.value.toUpperCase())} placeholder="MINA," />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold">Hito de mensura</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label className="etiqueta" htmlFor="hn">Nombre</label>
            <input id="hn" className="campo" value={c.hito?.nombre ?? ""} onChange={(e) => actualizar("hito", { nombre: e.target.value, n: c.hito?.n ?? 0, e: c.hito?.e ?? 0 })} placeholder="HM NOMBRE CONCESIÓN" />
          </div>
          <div>
            <label className="etiqueta" htmlFor="hnn">Norte</label>
            <input id="hnn" className="campo" inputMode="decimal" value={c.hito?.n || ""} onChange={(e) => actualizar("hito", { nombre: c.hito?.nombre ?? "", n: num(e.target.value), e: c.hito?.e ?? 0 })} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="hne">Este</label>
            <input id="hne" className="campo" inputMode="decimal" value={c.hito?.e || ""} onChange={(e) => actualizar("hito", { nombre: c.hito?.nombre ?? "", n: c.hito?.n ?? 0, e: num(e.target.value) })} />
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--pg-muted)" }}>
          Coordenadas del H.M. ya postprocesadas, en el mismo datum oficial. La plataforma no transforma datums.
        </p>
      </section>
    </div>
  )
}
