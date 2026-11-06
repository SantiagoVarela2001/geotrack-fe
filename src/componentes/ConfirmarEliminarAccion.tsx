import { useEffect, useRef } from 'react'
import type { DatosAccionCliente } from '../api/tipos'
import { Aviso } from './Comun'

export function ConfirmarEliminarAccion({ accion, guardando, permitido, error, alCerrar, alConfirmar }: {
  accion: DatosAccionCliente
  guardando: boolean
  permitido: boolean
  error: string
  alCerrar: () => void
  alConfirmar: () => Promise<void>
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const elemento = dialogo.current!
    elemento.showModal()
    return () => { if (elemento.open) elemento.close() }
  }, [])
  return <dialog ref={dialogo} className="dialogo-tipo" aria-labelledby="accion-eliminar-titulo"
    onCancel={(evento) => { evento.preventDefault(); if (!guardando) alCerrar() }}>
    <div className="dialogo-tipo-contenido">
      <h2 id="accion-eliminar-titulo">¿Eliminar esta acción?</h2>
      <p>«{accion.titulo}» dejará de aparecer en el listado y en el gráfico.</p>
      {error && <Aviso>{error}</Aviso>}
      {!permitido && <Aviso>Tu cuenta o el estado del cliente ya no permiten eliminar esta acción.</Aviso>}
      <div className="dialogo-tipo-acciones">
        <button className="boton boton-secundario" type="button" autoFocus disabled={guardando} onClick={alCerrar}>Cancelar</button>
        <button className="boton boton-peligro" type="button" disabled={guardando || !permitido} onClick={alConfirmar}>
          {guardando ? 'Eliminando…' : 'Eliminar acción'}
        </button>
      </div>
    </div>
  </dialog>
}
