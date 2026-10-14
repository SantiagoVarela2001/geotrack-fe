import { useEffect, useRef } from 'react'
import type { SolicitudCrearCliente } from '../api/tipos'
import { Aviso, Icono } from './Comun'

export function ConfirmarCrearCliente({
  datos,
  pais,
  idioma,
  enviando,
  error,
  alCancelar,
  alConfirmar,
}: {
  datos: SolicitudCrearCliente
  pais: string
  idioma: string
  enviando: boolean
  error: string
  alCancelar: () => void
  alConfirmar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)

  /** Abre la revisión como diálogo modal y restaura el foco al volver al formulario. */
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
      className="dialogo-tipo dialogo-crear-cliente"
      aria-labelledby="dialogo-crear-cliente-titulo"
      aria-describedby="dialogo-crear-cliente-aviso"
      onCancel={(evento) => {
        evento.preventDefault()
        if (!enviando) alCancelar()
      }}
    >
      <div className="dialogo-tipo-contenido">
        <div className="dialogo-crear-cliente-cabecera">
          <span className="dialogo-crear-cliente-icono"><Icono nombre="documento" tamano={23} /></span>
          <div>
            <span className="sobrelinea">REVISIÓN FINAL</span>
            <h2 id="dialogo-crear-cliente-titulo">¿Crear este cliente monitoreado?</h2>
            <p>Comprobá que toda la información sea correcta antes de continuar.</p>
          </div>
        </div>

        <div className="dialogo-crear-cliente-aviso" id="dialogo-crear-cliente-aviso">
          <strong>Los datos principales no se podrán editar después.</strong>
          <p>Una vez creado el cliente, cambiarlos podría alterar sus estadísticas.</p>
        </div>

        <section className="dialogo-crear-cliente-seccion" aria-labelledby="dialogo-crear-cliente-datos">
          <h3 id="dialogo-crear-cliente-datos">Datos del cliente</h3>
          <dl className="dialogo-crear-cliente-datos">
            <div><dt>Nombre del cliente</dt><dd>{datos.nombre}</dd></div>
            <div><dt>Nombre de marca</dt><dd>{datos.nombreMarca}</dd></div>
            <div className="dialogo-crear-cliente-ancho"><dt>Sitio web</dt><dd>{datos.sitioWeb}</dd></div>
            <div className="dialogo-crear-cliente-ancho"><dt>Rubro</dt><dd>{datos.rubro}</dd></div>
            <div><dt>País</dt><dd>{pais} ({datos.pais})</dd></div>
            <div><dt>Idioma</dt><dd>{idioma}</dd></div>
            <div className="dialogo-crear-cliente-ancho">
              <dt>Descripción</dt>
              <dd>{datos.descripcion || <span className="dialogo-crear-cliente-vacio">Sin descripción</span>}</dd>
            </div>
          </dl>
        </section>

        <section className="dialogo-crear-cliente-seccion" aria-labelledby="dialogo-crear-cliente-competidores">
          <h3 id="dialogo-crear-cliente-competidores">
            Competidores <span>{datos.competidores.length}</span>
          </h3>
          {datos.competidores.length === 0 ? (
            <p className="dialogo-crear-cliente-vacio">No se agregarán competidores al crear el cliente.</p>
          ) : (
            <ol className="dialogo-crear-cliente-competidores">
              {datos.competidores.map((competidor, indice) => (
                <li key={`${competidor.nombre}-${indice}`}>
                  <strong>{competidor.nombre}</strong>
                  <span>{competidor.sitioWeb || 'Sin sitio web'}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {error && <Aviso>{error}</Aviso>}
        <p className="dialogo-crear-cliente-pregunta">¿Confirmás que estos datos son correctos?</p>
        <div className="dialogo-tipo-acciones">
          <button className="boton boton-secundario" type="button" onClick={alCancelar} disabled={enviando} autoFocus>
            Volver y corregir
          </button>
          <button className="boton boton-primario" type="button" onClick={alConfirmar} disabled={enviando}>
            {enviando ? 'Creando…' : 'Sí, crear cliente'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
