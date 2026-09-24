/**
 * Escritor mínimo de tablas dBASE III (.dbf) para shapefiles.
 * Tipos soportados: C (texto), N (numérico) y D (fecha YYYYMMDD).
 * Codificación UTF-8, declarada en el archivo .cpg que acompaña al shapefile.
 */

export type TipoCampo = "C" | "N" | "D"

export interface CampoDbf {
  /** Máximo 10 caracteres ASCII, sin espacios ni paréntesis (limitación del formato). */
  nombre: string
  tipo: TipoCampo
  longitud: number
  decimales?: number
}

export type RegistroDbf = Record<string, string | number | Date | null | undefined>

const encoder = new TextEncoder()

export function validarCampo(c: CampoDbf): void {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,9}$/.test(c.nombre)) {
    throw new Error(`Nombre de campo DBF inválido: "${c.nombre}" (máx. 10 caracteres, letras, dígitos y _)`)
  }
  if (c.tipo === "D" && c.longitud !== 8) throw new Error(`El campo fecha ${c.nombre} debe tener longitud 8`)
  if (c.longitud < 1 || c.longitud > 254) throw new Error(`Longitud fuera de rango en ${c.nombre}`)
}

/** Trunca un texto a `max` bytes UTF-8 sin cortar caracteres y rellena con espacios. */
function textoFijo(valor: string, max: number): Uint8Array {
  const out = new Uint8Array(max).fill(0x20)
  let pos = 0
  for (const ch of valor) {
    const b = encoder.encode(ch)
    if (pos + b.length > max) break
    out.set(b, pos)
    pos += b.length
  }
  return out
}

function numeroFijo(valor: number | null | undefined, longitud: number, decimales: number): Uint8Array {
  let s = valor == null || Number.isNaN(valor) ? "" : valor.toFixed(decimales)
  if (s.length > longitud) s = s.slice(0, longitud)
  return encoder.encode(s.padStart(longitud, " "))
}

function fechaFija(valor: string | Date | null | undefined): Uint8Array {
  if (!valor) return new Uint8Array(8).fill(0x20)
  let y: number, m: number, d: number
  if (valor instanceof Date) {
    y = valor.getFullYear()
    m = valor.getMonth() + 1
    d = valor.getDate()
  } else {
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor)
    const cl = /^(\d{2})-(\d{2})-(\d{4})$/.exec(valor)
    if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    else if (cl) [y, m, d] = [Number(cl[3]), Number(cl[2]), Number(cl[1])]
    else throw new Error(`Fecha no reconocida: ${valor} (use AAAA-MM-DD o DD-MM-AAAA)`)
  }
  return encoder.encode(`${String(y).padStart(4, "0")}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`)
}

export function escribirDbf(campos: CampoDbf[], registros: RegistroDbf[], fecha = new Date()): Uint8Array {
  campos.forEach(validarCampo)
  const largoRegistro = 1 + campos.reduce((s, c) => s + c.longitud, 0)
  const largoCabecera = 32 + 32 * campos.length + 1
  const total = largoCabecera + largoRegistro * registros.length + 1
  const buf = new ArrayBuffer(total)
  const dv = new DataView(buf)
  const bytes = new Uint8Array(buf)

  dv.setUint8(0, 0x03)
  dv.setUint8(1, fecha.getFullYear() - 1900)
  dv.setUint8(2, fecha.getMonth() + 1)
  dv.setUint8(3, fecha.getDate())
  dv.setUint32(4, registros.length, true)
  dv.setUint16(8, largoCabecera, true)
  dv.setUint16(10, largoRegistro, true)
  // bytes 12..31 reservados (0). Byte 29 = language driver; 0 y .cpg manda.

  let off = 32
  for (const c of campos) {
    bytes.set(encoder.encode(c.nombre), off)
    bytes[off + 11] = c.tipo.charCodeAt(0)
    bytes[off + 16] = c.longitud
    bytes[off + 17] = c.tipo === "N" ? (c.decimales ?? 0) : 0
    off += 32
  }
  bytes[off++] = 0x0d

  for (const r of registros) {
    bytes[off++] = 0x20
    for (const c of campos) {
      const v = r[c.nombre]
      let campo: Uint8Array
      if (c.tipo === "C") campo = textoFijo(v == null ? "" : String(v), c.longitud)
      else if (c.tipo === "N") campo = numeroFijo(typeof v === "number" ? v : v == null ? null : Number(v), c.longitud, c.decimales ?? 0)
      else campo = fechaFija(v as string | Date | null | undefined)
      bytes.set(campo, off)
      off += c.longitud
    }
  }
  bytes[off] = 0x1a
  return bytes
}
