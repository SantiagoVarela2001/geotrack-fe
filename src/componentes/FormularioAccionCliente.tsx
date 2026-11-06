import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { DatosAccionCliente, SolicitudAccionCliente } from '../api/tipos'
import { hoyArgentina, validarAccion } from '../accionesCliente'
import { Aviso } from './Comun'

export function FormularioAccionCliente({ accion, guardando, permitido, error, alCerrar, alGuardar }: {
  accion: DatosAccionCliente | null
  guardando: boolean
  permitido: boolean
  error: string
  alCerrar: () => void
  alGuardar: (datos: SolicitudAccionCliente) => Promise<void>
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [titulo, cambiarTitulo] = useState(accion?.titulo ?? '')
  const [fecha, cambiarFecha] = useState(accion?.fecha ?? hoyArgentina())
  const [descripcion, cambiarDescripcion] = useState(accion?.descripcion ?? '')
  const [url, cambiarUrl] = useState(accion?.url ?? '')
  const [errorValidacion, cambiarErrorValidacion] = useState('')
  useEffect(() => {
    const elemento = dialogo.current!
    elemento.showModal()
    return () => { if (elemento.open) elemento.close() }
  }, [])

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (guardando || !permitido) return
    const datos = { titulo: titulo.trim(), fecha, descripcion: descripcion.trim() || null, url: url.trim() || null }
    const motivo = validarAccion(datos)
    cambiarErrorValidacion(motivo ?? '')
    if (!motivo) await alGuardar(datos)
  }

  return <dialog ref={dialogo} className="dialogo-tipo formulario-accion" aria-labelledby="accion-formulario-titulo"
    onCancel={(evento) => { evento.preventDefault(); if (!guardando) alCerrar() }}>
    <form className="dialogo-tipo-contenido" onSubmit={enviar}>
      <span className="sobrelinea">ACCIONES REALIZADAS</span>
      <h2 id="accion-formulario-titulo">{accion ? 'Editar acción' : 'Registrar acción'}</h2>
      <p>Registrá los cambios que ya realizaste para tu marca.</p>
      <fieldset disabled={guardando || !permitido}>
        <label htmlFor="accion-titulo">Título</label>
        <input id="accion-titulo" required maxLength={200} value={titulo} autoFocus
          onChange={(evento) => cambiarTitulo(evento.target.value)} />
        <label htmlFor="accion-fecha">Fecha de realización</label>
        <input id="accion-fecha" type="date" required max={hoyArgentina()} value={fecha}
          onChange={(evento) => cambiarFecha(evento.target.value)} />
        <small>Hoy o una fecha anterior, según el horario de Argentina.</small>
        <label htmlFor="accion-descripcion">Descripción <span>(opcional)</span></label>
        <textarea id="accion-descripcion" maxLength={2000} rows={4} value={descripcion}
          onChange={(evento) => cambiarDescripcion(evento.target.value)} />
        <label htmlFor="accion-url">Enlace <span>(opcional)</span></label>
        <input id="accion-url" type="url" maxLength={2048} placeholder="https://" value={url}
          onChange={(evento) => cambiarUrl(evento.target.value)} />
      </fieldset>
      {!permitido && <Aviso>Tu cuenta o el estado del cliente ya no permiten guardar esta acción.</Aviso>}
      {(errorValidacion || error) && <Aviso>{errorValidacion || error}</Aviso>}
      <div className="dialogo-tipo-acciones">
        <button type="button" className="boton boton-secundario" disabled={guardando} onClick={alCerrar}>Cancelar</button>
        <button type="submit" className="boton boton-primario" disabled={guardando || !permitido}>
          {guardando ? 'Guardando…' : 'Guardar acción'}
        </button>
      </div>
    </form>
  </dialog>
}
