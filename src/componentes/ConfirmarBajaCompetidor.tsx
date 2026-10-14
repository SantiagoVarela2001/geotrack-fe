import { useEffect, useRef } from 'react'
import type { Competidor } from '../api/tipos'
import { Icono } from './Comun'

export function ConfirmarBajaCompetidor({
  competidor,
  enviando,
  alCancelar,
  alConfirmar,
}: {
  competidor: Competidor
  enviando: boolean
  alCancelar: () => void
  alConfirmar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)

  /** Mantiene la confirmación en primer plano y devuelve el foco al cerrarse. */
  useEffect(() => {
    const elemento = dialogo.current
    if (!elemento) return
    elemento.showModal()
    return () => {
      if (elemento.open) elemento.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogo}
      className="dialogo-tipo dialogo-baja-competidor"
      aria-labelledby="dialogo-competidor-titulo"
      aria-describedby="dialogo-competidor-descripcion"
      onCancel={(evento) => {
        evento.preventDefault()
        if (!enviando) alCancelar()
      }}
    >
      <div className="dialogo-tipo-contenido">
        <div className="dialogo-tipo-icono">
          <Icono nombre="eliminar" tamano={23} />
        </div>
        <span className="sobrelinea">COMPETIDOR</span>
        <h2 id="dialogo-competidor-titulo">¿Dar de baja este competidor?</h2>
        <p id="dialogo-competidor-descripcion">
          Dejará de evaluarse en las próximas normalizaciones. Los resultados históricos
          conservarán sus menciones.
        </p>
        <div className="dialogo-estado-nombre">
          <span>COMPETIDOR</span>
          <strong>{competidor.nombre}</strong>
        </div>
        <div className="dialogo-tipo-acciones">
          <button
            className="boton boton-secundario"
            type="button"
            onClick={alCancelar}
            disabled={enviando}
            autoFocus
          >
            Cancelar
          </button>
          <button
            className="boton boton-peligro"
            type="button"
            onClick={alConfirmar}
            disabled={enviando}
          >
            {enviando ? 'Guardando…' : 'Dar de baja'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
