/** Formato chileno de números y fechas, como aparecen en actas y planos. */

export function numeroCl(valor: number, decimales = 2): string {
  return new Intl.NumberFormat("es-CL", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(valor)
}

/** Coordenadas UTM: 7.477.000,00 */
export function coordenadaCl(valor: number): string {
  return numeroCl(valor, 2)
}

/** Azimut centesimal: 333,1589 */
export function azimutCl(valor: number): string {
  return numeroCl(valor, 4)
}

/** ISO AAAA-MM-DD → DD-MM-AAAA (formato oficial de la guía). */
export function fechaCl(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso
}

export function descargarBlob(nombre: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
