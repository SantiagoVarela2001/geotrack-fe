import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { DatosConsulta, DatosTema, SolicitudEditarConsulta } from '../api/tipos'
import { Aviso } from './Comun'

export function EditarConsulta({
  consulta,
  temas,
  enviando,
  error,
  alCancelar,
  alGuardar,
}: {
  consulta: DatosConsulta
  temas: DatosTema[]
  enviando: boolean
  error: string
  alCancelar: () => void
  alGuardar: (datos: SolicitudEditarConsulta) => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [datos, cambiarDatos] = useState<SolicitudEditarConsulta>({
    texto: consulta.texto,
    temaUuid: consulta.temaUuid,
    prioridad: consulta.prioridad,
    tipoConsulta: consulta.tipoConsulta,
  })

  /** El diálogo nativo contiene el foco y bloquea las acciones de fondo. */
  useEffect(() => {
    const elemento = dialogo.current
    if (!elemento) return
    elemento.showModal()
    return () => {
      if (elemento.open) elemento.close()
    }
  }, [])

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando || !datos.texto.trim() || !temas.some((tema) => tema.uuid === datos.temaUuid)) return
    alGuardar({ ...datos, texto: datos.texto.trim() })
  }

  return (
    <dialog
      ref={dialogo}
      className="dialogo-tipo dialogo-editar-consulta"
      aria-labelledby="editar-consulta-titulo"
      aria-describedby="editar-consulta-descripcion"
      onCancel={(evento) => {
        evento.preventDefault()
        if (!enviando) alCancelar()
      }}
    >
      <div className="dialogo-tipo-contenido">
        <span className="sobrelinea">CONSULTA EN BORRADOR</span>
        <h2 id="editar-consulta-titulo">Editar consulta</h2>
        <p id="editar-consulta-descripcion">Todos los campos son obligatorios.</p>
        <form className="formulario" onSubmit={guardar} aria-busy={enviando}>
          <label>
            Texto
            <textarea
              required
              autoFocus
              maxLength={2000}
              rows={4}
              value={datos.texto}
              disabled={enviando}
              onChange={(evento) => cambiarDatos({ ...datos, texto: evento.target.value })}
            />
          </label>
          <label>
            Tema
            <select
              required
              value={datos.temaUuid}
              disabled={enviando}
              onChange={(evento) => cambiarDatos({ ...datos, temaUuid: evento.target.value })}
            >
              <option value="" disabled>Elegí un tema</option>
              {temas.map((tema) => <option key={tema.uuid} value={tema.uuid}>{tema.nombre}</option>)}
            </select>
          </label>
          <div className="grilla-formulario">
            <label>
              Prioridad
              <select
                required
                value={datos.prioridad}
                disabled={enviando}
                onChange={(evento) => cambiarDatos({
                  ...datos,
                  prioridad: evento.target.value as SolicitudEditarConsulta['prioridad'],
                })}
              >
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Media</option>
                <option value="BAJA">Baja</option>
              </select>
            </label>
            <label>
              Tipo
              <select
                required
                value={datos.tipoConsulta}
                disabled={enviando}
                onChange={(evento) => cambiarDatos({
                  ...datos,
                  tipoConsulta: evento.target.value as SolicitudEditarConsulta['tipoConsulta'],
                })}
              >
                <option value="REFERENCIA">Referencia</option>
                <option value="DESCUBRIMIENTO">Descubrimiento</option>
              </select>
            </label>
          </div>
          {error && <Aviso>{error}</Aviso>}
          <div className="dialogo-tipo-acciones">
            <button className="boton boton-secundario" type="button" onClick={alCancelar} disabled={enviando}>
              Cancelar
            </button>
            <button
              className="boton boton-primario"
              type="submit"
              disabled={enviando || !datos.texto.trim() || !temas.some((tema) => tema.uuid === datos.temaUuid)}
            >
              {enviando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
