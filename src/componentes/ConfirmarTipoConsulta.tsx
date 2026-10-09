import { useEffect, useRef } from 'react'
import type { DatosConsulta } from '../api/tipos'
import { Icono } from './Comun'

export function ConfirmarTipoConsulta({
  consulta,
  enviando,
  alCancelar,
  alConfirmar,
}: {
  consulta: DatosConsulta
  enviando: boolean
  alCancelar: () => void
  alConfirmar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const marcarReferencia = consulta.tipoConsulta === 'DESCUBRIMIENTO'

  /** showModal mantiene el foco dentro del diálogo e inhabilita el contenido de fondo. */
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
      className="dialogo-tipo"
      aria-labelledby="dialogo-tipo-titulo"
      aria-describedby="dialogo-tipo-descripcion"
      onCancel={(evento) => {
        evento.preventDefault()
        if (!enviando) alCancelar()
      }}
    >
      <div className="dialogo-tipo-contenido">
        <div className="dialogo-tipo-icono">
          <Icono nombre="estrella" tamano={22} relleno={marcarReferencia} />
        </div>
        <span className="sobrelinea">TIPO DE CONSULTA</span>
        <h2 id="dialogo-tipo-titulo">
          {marcarReferencia ? '¿Marcar como referencia?' : '¿Quitar de referencias?'}
        </h2>
        <p id="dialogo-tipo-descripcion">
          {marcarReferencia
            ? 'Pasará a Referencia y quedará destacada entre las consultas de este cliente.'
            : 'Pasará a Descubrimiento y dejará de estar destacada como referencia.'}
        </p>
        <blockquote className="dialogo-tipo-consulta">{consulta.texto}</blockquote>
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
            className="boton boton-primario"
            type="button"
            onClick={alConfirmar}
            disabled={enviando}
          >
            {enviando
              ? 'Guardando…'
              : marcarReferencia
                ? 'Marcar como referencia'
                : 'Quitar referencia'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
