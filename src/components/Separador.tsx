import { useRef } from "react"

interface Props {
  /** Alto actual del panel inferior, en px. */
  alto: number
  min: number
  max: number
  onCambio: (alto: number) => void
}

/** Barra horizontal arrastrable que cambia el alto del panel que está debajo de ella. */
export function SeparadorHorizontal({ alto, min, max, onCambio }: Props) {
  const inicio = useRef<{ y: number; alto: number } | null>(null)

  function alPresionar(e: React.PointerEvent<HTMLDivElement>) {
    inicio.current = { y: e.clientY, alto }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function alMover(e: React.PointerEvent<HTMLDivElement>) {
    if (!inicio.current) return
    const nuevo = Math.round(inicio.current.alto - (e.clientY - inicio.current.y))
    onCambio(Math.max(min, Math.min(max, nuevo)))
  }
  function alSoltar(e: React.PointerEvent<HTMLDivElement>) {
    inicio.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-valuenow={alto}
      aria-valuemin={min}
      aria-valuemax={max}
      title="Arrastra para cambiar el tamaño"
      className="group flex h-3 cursor-row-resize items-center justify-center select-none"
      onPointerDown={alPresionar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      onDoubleClick={() => onCambio(min)}
    >
      <div className="h-1 w-16 rounded-full transition-colors group-hover:bg-teal-700" style={{ background: "var(--pg-line)" }} />
    </div>
  )
}
