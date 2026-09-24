import type { DatosActa, Perito } from "../lib/modelo"

interface Props {
  acta: DatosActa
  onActa: (a: DatosActa) => void
  perito: Perito
  onPerito: (p: Perito) => void
}

type CampoTexto = { [K in keyof DatosActa]: DatosActa[K] extends string ? K : never }[keyof DatosActa]
type CampoNumero = { [K in keyof DatosActa]: DatosActa[K] extends number | null ? K : never }[keyof DatosActa]

/** Antecedentes de la causa, ubicación, textos libres del acta y datos del perito. */
export function SeccionActa({ acta: a, onActa, perito, onPerito }: Props) {
  const texto = (campo: CampoTexto, etiqueta: string, placeholder = "", filas = 0) => (
    <div>
      <label className="etiqueta" htmlFor={`acta-${campo}`}>{etiqueta}</label>
      {filas > 0 ? (
        <textarea id={`acta-${campo}`} className="campo" rows={filas} value={a[campo]} onChange={(e) => onActa({ ...a, [campo]: e.target.value })} placeholder={placeholder} />
      ) : (
        <input id={`acta-${campo}`} className="campo" value={a[campo]} onChange={(e) => onActa({ ...a, [campo]: e.target.value })} placeholder={placeholder} />
      )}
    </div>
  )
  const numero = (campo: CampoNumero, etiqueta: string) => (
    <div>
      <label className="etiqueta" htmlFor={`acta-${campo}`}>{etiqueta}</label>
      <input
        id={`acta-${campo}`}
        className="campo"
        inputMode="decimal"
        value={a[campo] ?? ""}
        onChange={(e) => onActa({ ...a, [campo]: e.target.value.trim() === "" ? null : Number(e.target.value.replace(",", ".")) || null })}
      />
    </div>
  )
  const fecha = (campo: CampoTexto, etiqueta: string) => (
    <div>
      <label className="etiqueta" htmlFor={`acta-${campo}`}>{etiqueta}</label>
      <input id={`acta-${campo}`} type="date" className="campo" value={a[campo]} onChange={(e) => onActa({ ...a, [campo]: e.target.value })} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4 text-sm">
      <details open className="flex flex-col gap-3">
        <summary className="cursor-pointer text-base font-bold">Perito</summary>
        <div className="mt-2 flex flex-col gap-2">
          <div>
            <label className="etiqueta" htmlFor="perito-nombre">Nombre</label>
            <input id="perito-nombre" className="campo" value={perito.nombre} onChange={(e) => onPerito({ ...perito, nombre: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="etiqueta" htmlFor="perito-rut">RUT</label>
              <input id="perito-rut" className="campo" value={perito.rut} onChange={(e) => onPerito({ ...perito, rut: e.target.value })} placeholder="12.345.678-9" />
            </div>
            <div>
              <label className="etiqueta" htmlFor="perito-dom">Domicilio</label>
              <input id="perito-dom" className="campo" value={perito.domicilio} onChange={(e) => onPerito({ ...perito, domicilio: e.target.value })} />
            </div>
          </div>
          <p className="text-xs" style={{ color: "var(--pg-muted)" }}>
            Común a todas las concesiones de la cartera.
          </p>
        </div>
      </details>

      <details className="flex flex-col gap-3">
        <summary className="cursor-pointer text-base font-bold">Datos de la causa</summary>
        <div className="mt-2 flex flex-col gap-2">
          {texto("juzgado", "Juzgado", "2° Juzgado de Letras Civil de Antofagasta")}
          <div className="grid grid-cols-2 gap-2">
            {texto("causaRol", "Rol de la causa", "V-521-2025")}
            {texto("titular", "Titular", "Sierra Gorda SCM")}
          </div>
          {texto("manifestante", "Manifestante")}
          {texto("nombreManifestacion", "Nombre en la manifestación", "Si difiere del nombre actual")}
          <div className="grid grid-cols-2 gap-2">
            {numero("pertenenciasManifestadas", "Pertenencias manifestadas")}
            {numero("hectareasManifestadas", "Hectáreas manifestadas")}
          </div>
          {texto("conservador", "Conservador de Minas", "Conservador de Minas de Antofagasta")}
          <div className="grid grid-cols-3 gap-2">
            {fecha("fechaInscripcion", "Inscripción")}
            {texto("fojas", "Fojas")}
            {texto("numeroInscripcion", "Número")}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {numero("pertenenciasSolicitadas", "Pertenencias solicitadas")}
            {numero("hectareasSolicitadas", "Hectáreas solicitadas")}
          </div>
          {texto("exploracionInvocada", "Exploración invocada", "Vacío si no invoca")}
          <div className="grid grid-cols-2 gap-2">
            {texto("juzgadoExploracion", "Juzgado de la exploración")}
            {fecha("fechaInicioExploracion", "Inicio de tramitación")}
          </div>
        </div>
      </details>

      <details className="flex flex-col gap-3">
        <summary className="cursor-pointer text-base font-bold">Ubicación</summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {texto("region", "Región", "II Región de Antofagasta")}
          {texto("provincia", "Provincia")}
          {texto("comuna", "Comuna")}
          {texto("lugar", "Lugar")}
        </div>
      </details>

      <details className="flex flex-col gap-3">
        <summary className="cursor-pointer text-base font-bold">Textos del acta</summary>
        <div className="mt-2 flex flex-col gap-2">
          {texto("acceso", "Acceso al H.M.", "", 4)}
          {texto("yacimiento", "Yacimiento", "", 2)}
          {texto("instrumental", "Instrumental utilizado", "", 4)}
          {texto("ligazon", "Ligazón del H.M. a la red geodésica", "", 4)}
          {texto("operacion", "Operación de mensura y colocación de linderos", "", 4)}
          {texto("linderos", "Linderos", "", 3)}
          {texto("hitoDescripcion", "Descripción del H.M.", "", 3)}
          {texto("demasias", "Demasías", "", 2)}
          {texto("observaciones", "Observaciones al abarcamiento", "", 3)}
        </div>
      </details>
    </div>
  )
}
