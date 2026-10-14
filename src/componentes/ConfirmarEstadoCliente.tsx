import { useEffect, useRef } from 'react'
import type { DatosCliente } from '../api/tipos'
import { Icono } from './Comun'

export function ConfirmarEstadoCliente({
  cliente,
  enviando,
  alCancelar,
  alConfirmar,
}: {
  cliente: DatosCliente
  enviando: boolean
  alCancelar: () => void
  alConfirmar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const archivar = cliente.estado === 'ACTIVO'

  /** El diálogo modal mantiene el foco dentro y bloquea el fondo durante la confirmación. */
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
      className={`dialogo-tipo dialogo-estado-cliente ${archivar ? 'dialogo-estado-archivar' : 'dialogo-estado-reactivar'}`}
      aria-labelledby="dialogo-estado-titulo"
      aria-describedby="dialogo-estado-descripcion"
      onCancel={(evento) => {
        evento.preventDefault()
        if (!enviando) alCancelar()
      }}
    >
      <div className="dialogo-tipo-contenido">
        <div className="dialogo-tipo-icono">
          <Icono nombre={archivar ? 'archivar' : 'reactivar'} tamano={23} />
        </div>
        <span className="sobrelinea">ESTADO DEL CLIENTE</span>
        <h2 id="dialogo-estado-titulo">
          {archivar ? '¿Archivar este cliente?' : '¿Reactivar este cliente?'}
        </h2>
        <p id="dialogo-estado-descripcion">
          {archivar
            ? 'Sus datos seguirán disponibles para lectura, pero no se podrán realizar nuevas operaciones mientras esté archivado.'
            : 'El cliente volverá a estar activo y podrás continuar el trabajo según tus permisos.'}
        </p>
        <div className="dialogo-estado-nombre">
          <span>CLIENTE</span>
          <strong>{cliente.nombre}</strong>
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
            className={`boton ${archivar ? 'boton-peligro' : 'boton-primario'}`}
            type="button"
            onClick={alConfirmar}
            disabled={enviando}
          >
            {enviando ? 'Guardando…' : archivar ? 'Archivar cliente' : 'Reactivar cliente'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
