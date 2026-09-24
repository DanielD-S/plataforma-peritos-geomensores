import { CRS_OFICIALES } from "../lib/crs"
import type { Punto } from "../lib/geometria"
import type { Concesion, PuntoReferencia } from "../lib/modelo"

interface Props {
  concesion: Concesion
  actualizar: <K extends keyof Concesion>(campo: K, valor: Concesion[K]) => void
  onImportar: () => void
  editando: boolean
  onEditando: (v: boolean) => void
  paso: number
  onPaso: (v: number) => void
}

function num(v: string): number {
  const n = Number(v.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

function numONulo(v: string): number | null {
  if (v.trim() === "") return null
  const n = Number(v.replace(",", "."))
  return Number.isFinite(n) ? n : null
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

const REF_VACIA: PuntoReferencia = { nombre: "", n: 0, e: 0, altura: null }

function CamposReferencia({
  valor,
  onCambio,
  idBase,
  placeholderNombre,
}: {
  valor: PuntoReferencia | null
  onCambio: (v: PuntoReferencia) => void
  idBase: string
  placeholderNombre: string
}) {
  const v = valor ?? REF_VACIA
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="col-span-3">
        <label className="etiqueta" htmlFor={`${idBase}-nombre`}>Nombre</label>
        <input id={`${idBase}-nombre`} className="campo" value={v.nombre} onChange={(e) => onCambio({ ...v, nombre: e.target.value })} placeholder={placeholderNombre} />
      </div>
      <div>
        <label className="etiqueta" htmlFor={`${idBase}-n`}>Norte</label>
        <input id={`${idBase}-n`} className="campo" inputMode="decimal" value={v.n || ""} onChange={(e) => onCambio({ ...v, n: num(e.target.value) })} />
      </div>
      <div>
        <label className="etiqueta" htmlFor={`${idBase}-e`}>Este</label>
        <input id={`${idBase}-e`} className="campo" inputMode="decimal" value={v.e || ""} onChange={(e) => onCambio({ ...v, e: num(e.target.value) })} />
      </div>
      <div>
        <label className="etiqueta" htmlFor={`${idBase}-h`}>Elevación</label>
        <input id={`${idBase}-h`} className="campo" inputMode="decimal" value={v.altura ?? ""} onChange={(e) => onCambio({ ...v, altura: numONulo(e.target.value) })} placeholder="m s.n.m." />
      </div>
    </div>
  )
}

export function Formulario({ concesion: c, actualizar, onImportar, editando, onEditando, paso, onPaso }: Props) {
  return (
    <div className="flex flex-col gap-5 text-sm">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold">Identificación</h2>
        <div>
          <label className="etiqueta" htmlFor="nombre">Nombre de la concesión</label>
          <input id="nombre" className="campo" value={c.nombre} onChange={(e) => actualizar("nombre", e.target.value.toUpperCase())} placeholder="MINA QUEBRADA BLANCA 1 AL 12" />
        </div>
        <div>
          <label className="etiqueta" htmlFor="rol">Rol nacional Sernageomin</label>
          <input id="rol" className="campo" value={c.rol} onChange={(e) => actualizar("rol", e.target.value)} placeholder="20010-9160-6" />
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
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Geometría</h2>
          <button className="boton boton-secundario !px-2 !py-1 !text-xs" type="button" onClick={onImportar} title="Shapefile, KML o KMZ">
            Importar SHP / KML
          </button>
        </div>

        <h3 className="text-sm font-semibold">Manifestación</h3>
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

        <h3 className="text-sm font-semibold">Solicitud de mensura</h3>
        <div>
          <label className="etiqueta" htmlFor="perSol">Perímetro (Norte Este por línea)</label>
          <textarea
            id="perSol"
            className="campo font-mono"
            rows={4}
            defaultValue={perimetroATexto(c.perimetroSolicitud)}
            key={`sol-${perimetroATexto(c.perimetroSolicitud)}`}
            onBlur={(e) => actualizar("perimetroSolicitud", parsearPerimetro(e.target.value))}
            placeholder="Vacío = mismo rectángulo de la manifestación"
          />
        </div>

        <h3 className="text-sm font-semibold">Mensura</h3>
        <div>
          <label className="etiqueta" htmlFor="per">Perímetro (Norte Este por línea)</label>
          <textarea
            id="per"
            className="campo font-mono"
            rows={7}
            defaultValue={perimetroATexto(c.perimetroMensura)}
            key={`men-${perimetroATexto(c.perimetroMensura)}`}
            onBlur={(e) => actualizar("perimetroMensura", parsearPerimetro(e.target.value))}
            placeholder={"Vacío = misma solicitud de mensura\n7477000 465000\n7477000 466000\n..."}
          />
          <p className="mt-1 text-xs" style={{ color: "var(--pg-muted)" }}>
            Se orienta solo en sentido horario desde el vértice NW.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-md border p-2" style={{ borderColor: editando ? "#fcd34d" : "var(--pg-line)", background: editando ? "#fffbeb" : undefined }}>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={editando} onChange={(e) => onEditando(e.target.checked)} />
            Editar en el mapa
          </label>
          <label className="ml-auto flex items-center gap-1 text-xs" style={{ color: "var(--pg-muted)" }}>
            Paso
            <select className="campo !w-auto !py-0.5" value={paso} onChange={(e) => onPaso(Number(e.target.value))}>
              {[1, 10, 50, 100].map((p) => (
                <option key={p} value={p}>
                  {p} m
                </option>
              ))}
            </select>
          </label>
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
        <h2 className="text-base font-bold">Referencia geodésica</h2>
        <p className="text-xs" style={{ color: "var(--pg-muted)" }}>
          Coordenadas ya postprocesadas, en el mismo datum oficial. La plataforma no transforma datums.
        </p>
        <h3 className="text-sm font-semibold">Hito de mensura (H.M.)</h3>
        <CamposReferencia valor={c.hito} onCambio={(v) => actualizar("hito", v)} idBase="hito" placeholderNombre="HM NOMBRE CONCESIÓN" />
        <h3 className="text-sm font-semibold">Punto de amarre</h3>
        <CamposReferencia valor={c.amarre} onCambio={(v) => actualizar("amarre", v)} idBase="amarre" placeholderNombre="VÉRTICE IGM / SNGM" />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Puntos auxiliares</h3>
          <button className="boton boton-secundario !px-2 !py-1 !text-xs" type="button" onClick={() => actualizar("auxiliares", [...c.auxiliares, { ...REF_VACIA, nombre: `AUX ${c.auxiliares.length + 1}` }])}>
            Agregar
          </button>
        </div>
        {c.auxiliares.map((a, i) => (
          <div key={i} className="flex flex-col gap-1 rounded-md border p-2" style={{ borderColor: "var(--pg-line)" }}>
            <CamposReferencia
              valor={a}
              onCambio={(v) => actualizar("auxiliares", c.auxiliares.map((x, k) => (k === i ? v : x)))}
              idBase={`aux-${i}`}
              placeholderNombre={`AUX ${i + 1}`}
            />
            <button className="self-end text-xs" type="button" style={{ color: "#991b1b" }} onClick={() => actualizar("auxiliares", c.auxiliares.filter((_, k) => k !== i))}>
              Quitar
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}
