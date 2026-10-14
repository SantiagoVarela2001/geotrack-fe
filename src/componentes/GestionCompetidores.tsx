import { useState, type FormEvent } from 'react'
import { api } from '../api/clienteApi'
import type { Competidor, DatosCliente } from '../api/tipos'
import { obtenerMensajeError, urlWebSegura } from '../utilidades'
import { Aviso, Icono } from './Comun'
import { ConfirmarBajaCompetidor } from './ConfirmarBajaCompetidor'

export function GestionCompetidores({
  cliente,
  puedeCrear,
  puedeEliminar,
  alActualizar,
}: {
  cliente: DatosCliente
  puedeCrear: boolean
  puedeEliminar: boolean
  alActualizar: (cliente: DatosCliente) => void
}) {
  const [mostrandoFormulario, cambiarMostrandoFormulario] = useState(
    cliente.competidores.length === 0 && puedeCrear,
  )
  const [nombre, cambiarNombre] = useState('')
  const [sitioWeb, cambiarSitioWeb] = useState('')
  const [operacion, cambiarOperacion] = useState<'alta' | 'baja' | null>(null)
  const [competidorParaBaja, cambiarCompetidorParaBaja] = useState<Competidor | null>(null)
  const [errorAlta, cambiarErrorAlta] = useState('')
  const [errorBaja, cambiarErrorBaja] = useState('')
  const [mensaje, cambiarMensaje] = useState('')

  /** Valida los campos antes de enviar; la API decide duplicados y pertenencia. */
  async function agregarCompetidor(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!puedeCrear || operacion) return

    const nombreLimpio = nombre.trim()
    const sitioLimpio = sitioWeb.trim()
    cambiarErrorAlta('')
    cambiarErrorBaja('')
    cambiarMensaje('')
    if (!nombreLimpio) {
      cambiarErrorAlta('Ingresá el nombre del competidor.')
      return
    }
    if (nombreLimpio.length > 200) {
      cambiarErrorAlta('El nombre admite hasta 200 caracteres.')
      return
    }
    if (sitioLimpio && (sitioLimpio.length > 2048 || !urlWebSegura(sitioLimpio))) {
      cambiarErrorAlta('Ingresá una URL HTTP o HTTPS de hasta 2048 caracteres.')
      return
    }

    cambiarOperacion('alta')
    try {
      const actualizado = await api.competidores.crear(cliente.uuid, {
        nombre: nombreLimpio,
        sitioWeb: sitioLimpio || undefined,
      })
      alActualizar(actualizado)
      cambiarNombre('')
      cambiarSitioWeb('')
      cambiarMostrandoFormulario(false)
      cambiarMensaje('Competidor agregado.')
    } catch (causa) {
      cambiarErrorAlta(obtenerMensajeError(causa))
    } finally {
      cambiarOperacion(null)
    }
  }

  async function darDeBajaCompetidor() {
    if (!puedeEliminar || !competidorParaBaja || operacion) return
    cambiarErrorBaja('')
    cambiarErrorAlta('')
    cambiarMensaje('')
    cambiarOperacion('baja')
    try {
      const actualizado = await api.competidores.darDeBaja(cliente.uuid, competidorParaBaja.uuid)
      alActualizar(actualizado)
      cambiarMensaje('Competidor dado de baja.')
    } catch (causa) {
      cambiarErrorBaja(obtenerMensajeError(causa))
    } finally {
      cambiarOperacion(null)
      cambiarCompetidorParaBaja(null)
    }
  }

  return (
    <div className="gestion-competidores">
      <div className="gestion-competidores-cabecera">
        <span className="sobrelinea">COMPETIDORES ACTIVOS</span>
        {puedeCrear && !mostrandoFormulario && (
          <button
            className="boton boton-secundario boton-chico"
            type="button"
            disabled={operacion !== null}
            onClick={() => {
              cambiarErrorAlta('')
              cambiarErrorBaja('')
              cambiarMensaje('')
              cambiarMostrandoFormulario(true)
            }}
          >
            <Icono nombre="mas" tamano={16} /> Agregar competidor
          </button>
        )}
      </div>
      {errorBaja && <Aviso>{errorBaja}</Aviso>}
      {mensaje && <Aviso tipo="exito">{mensaje}</Aviso>}
      {cliente.competidores.length === 0 ? (
        <p className="competidores-vacio">Todavía no hay competidores para este cliente.</p>
      ) : (
        <div className="competidores-lista">
          {cliente.competidores.map((competidor) => {
            const sitioSeguro = urlWebSegura(competidor.sitioWeb)
            return (
              <div className="competidor-fila" key={competidor.uuid}>
                <div className="competidor-fila-datos">
                  <strong>{competidor.nombre}</strong>
                  {sitioSeguro ? (
                    <a href={sitioSeguro} target="_blank" rel="noopener noreferrer">
                      {competidor.sitioWeb} ↗
                    </a>
                  ) : (
                    <span>{competidor.sitioWeb || 'Sin sitio web'}</span>
                  )}
                </div>
                {puedeEliminar && (
                  <button
                    className="boton-icono competidor-baja"
                    type="button"
                    title={`Dar de baja a ${competidor.nombre}`}
                    aria-label={`Dar de baja a ${competidor.nombre}`}
                    disabled={operacion !== null}
                    onClick={() => {
                      cambiarErrorBaja('')
                      cambiarErrorAlta('')
                      cambiarMensaje('')
                      cambiarCompetidorParaBaja(competidor)
                    }}
                  >
                    <Icono nombre="eliminar" tamano={17} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {puedeCrear && mostrandoFormulario && (
        <form className="formulario competidor-formulario" onSubmit={agregarCompetidor} noValidate>
          {errorAlta && <Aviso>{errorAlta}</Aviso>}
          <div className="grilla-formulario">
            <label htmlFor="competidor-nombre">
              <span>
                Nombre <span className="requerido">*</span>
              </span>
              <input
                id="competidor-nombre"
                required
                maxLength={200}
                value={nombre}
                disabled={operacion !== null}
                onChange={(evento) => cambiarNombre(evento.target.value)}
                placeholder="Ej. Taller Este"
              />
            </label>
            <label htmlFor="competidor-sitio-web">
              <span>
                Sitio web <span className="opcional">opcional</span>
              </span>
              <input
                id="competidor-sitio-web"
                type="url"
                maxLength={2048}
                value={sitioWeb}
                disabled={operacion !== null}
                onChange={(evento) => cambiarSitioWeb(evento.target.value)}
                placeholder="https://competidor.com"
              />
            </label>
          </div>
          <p className="competidores-nota">
            Los cambios se aplicarán a las próximas normalizaciones.
          </p>
          <div className="competidor-formulario-acciones">
            <button
              className="boton boton-secundario boton-chico"
              type="button"
              disabled={operacion !== null}
              onClick={() => {
                cambiarMostrandoFormulario(false)
                cambiarNombre('')
                cambiarSitioWeb('')
                cambiarErrorAlta('')
              }}
            >
              Cancelar
            </button>
            <button className="boton boton-primario boton-chico" type="submit" disabled={operacion !== null}>
              {operacion === 'alta' ? 'Guardando…' : 'Guardar competidor'}
            </button>
          </div>
        </form>
      )}
      {competidorParaBaja && (
        <ConfirmarBajaCompetidor
          competidor={competidorParaBaja}
          enviando={operacion === 'baja'}
          alCancelar={() => cambiarCompetidorParaBaja(null)}
          alConfirmar={() => void darDeBajaCompetidor()}
        />
      )}
    </div>
  )
}
