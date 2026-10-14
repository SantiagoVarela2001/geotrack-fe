import { useState, type FormEvent } from 'react'
import { api } from '../api/clienteApi'
import type { DatosCliente, SolicitudCrearCliente } from '../api/tipos'
import { obtenerMensajeError, urlWebSegura } from '../utilidades'
import { Aviso, Icono } from './Comun'
import { ConfirmarCrearCliente } from './ConfirmarCrearCliente'

/** Opciones iniciales de la interfaz; la API sigue validando los códigos recibidos. */
const paises = [
  { codigo: 'AR', nombre: 'Argentina' },
  { codigo: 'CL', nombre: 'Chile' },
  { codigo: 'CO', nombre: 'Colombia' },
  { codigo: 'MX', nombre: 'México' },
  { codigo: 'PE', nombre: 'Perú' },
  { codigo: 'UY', nombre: 'Uruguay' },
  { codigo: 'ES', nombre: 'España' },
  { codigo: 'US', nombre: 'Estados Unidos' },
] as const

const idiomas = [
  { codigo: 'es-AR', nombre: 'Español (es-AR)' },
  { codigo: 'en-US', nombre: 'Inglés (en-US)' },
] as const

const datosIniciales: SolicitudCrearCliente = {
  nombre: '',
  nombreMarca: '',
  sitioWeb: '',
  descripcion: '',
  rubro: '',
  pais: 'AR',
  idioma: 'es-AR',
  competidores: [],
}

function esUrlHttpCompleta(valor: string): boolean {
  return /^https?:\/\//i.test(valor) && urlWebSegura(valor) !== null
}

export function FormularioCliente({
  alCrear,
  alCancelar,
}: {
  alCrear: (cliente: DatosCliente) => void
  alCancelar: () => void
}) {
  const [datos, cambiarDatos] = useState<SolicitudCrearCliente>(datosIniciales)
  const [datosPorConfirmar, cambiarDatosPorConfirmar] = useState<SolicitudCrearCliente | null>(null)
  const [cargando, cambiarCargando] = useState(false)
  const [error, cambiarError] = useState('')
  const [errorCreacion, cambiarErrorCreacion] = useState('')

  function cambiarCampo(campo: keyof Omit<SolicitudCrearCliente, 'competidores'>, valor: string) {
    cambiarDatos((actual) => ({ ...actual, [campo]: valor }))
  }

  /** Prepara una copia exacta de lo que se enviará para que el usuario pueda revisarla. */
  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    cambiarError('')
    const revisados: SolicitudCrearCliente = {
      ...datos,
      nombre: datos.nombre.trim(),
      nombreMarca: datos.nombreMarca.trim(),
      sitioWeb: datos.sitioWeb.trim(),
      descripcion: datos.descripcion?.trim() || undefined,
      rubro: datos.rubro.trim(),
      pais: datos.pais.trim().toUpperCase(),
      idioma: datos.idioma.trim(),
      competidores: datos.competidores.map((competidor) => ({
        nombre: competidor.nombre.trim(),
        sitioWeb: competidor.sitioWeb?.trim() || undefined,
      })),
    }

    if (
      !revisados.nombre || !revisados.nombreMarca || !revisados.sitioWeb ||
      !revisados.rubro || !revisados.pais || !revisados.idioma
    ) {
      cambiarError('Completá todos los campos obligatorios antes de revisar el cliente.')
      return
    }
    if (!esUrlHttpCompleta(revisados.sitioWeb)) {
      cambiarError('El sitio web del cliente debe ser una URL completa que comience con http:// o https://.')
      return
    }
    const nombresCompetidores = new Set<string>()
    for (const [indice, competidor] of revisados.competidores.entries()) {
      if (!competidor.nombre) {
        cambiarError(`Completá el nombre del competidor ${indice + 1} o quitá esa fila.`)
        return
      }
      if (competidor.sitioWeb && !esUrlHttpCompleta(competidor.sitioWeb)) {
        cambiarError(`El sitio web del competidor ${indice + 1} debe comenzar con http:// o https://.`)
        return
      }
      const nombreComparable = competidor.nombre.toLocaleLowerCase()
      if (nombresCompetidores.has(nombreComparable)) {
        cambiarError(`El competidor «${competidor.nombre}» está repetido.`)
        return
      }
      nombresCompetidores.add(nombreComparable)
    }
    cambiarErrorCreacion('')
    cambiarDatosPorConfirmar(revisados)
  }

  /** El alta se realiza únicamente con los datos que se mostraron en la confirmación. */
  async function confirmarCreacion() {
    if (!datosPorConfirmar || cargando) return
    cambiarErrorCreacion('')
    cambiarCargando(true)
    try {
      const cliente = await api.clientes.crear(datosPorConfirmar)
      alCrear(cliente)
    } catch (causa) {
      cambiarErrorCreacion(obtenerMensajeError(causa))
    } finally {
      cambiarCargando(false)
    }
  }

  return (
    <div className="panel-formulario">
      <div className="panel-formulario-cabecera">
        <div>
          <span className="sobrelinea">NUEVO CLIENTE</span>
          <h2>Datos de la marca</h2>
          <p className="texto-secundario">
            Completá la información que identifica al cliente y su contexto.
          </p>
        </div>
        <button
          className="boton-icono"
          type="button"
          onClick={alCancelar}
          aria-label="Cerrar formulario"
        >
          <Icono nombre="cerrar" />
        </button>
      </div>
      <form onSubmit={enviar} className="formulario" noValidate>
        <div className="grilla-formulario">
          <label>
            Nombre del cliente <span className="requerido">*</span>
            <input
              required
              maxLength={200}
              value={datos.nombre}
              onChange={(evento) => cambiarCampo('nombre', evento.target.value)}
              placeholder="Ej. Taller Norte"
            />
          </label>
          <label>
            Nombre de marca <span className="requerido">*</span>
            <input
              required
              maxLength={200}
              value={datos.nombreMarca}
              onChange={(evento) => cambiarCampo('nombreMarca', evento.target.value)}
              placeholder="Ej. Taller Norte"
            />
          </label>
          <label>
            Sitio web <span className="requerido">*</span>
            <input
              type="url"
              required
              pattern="https?://.+"
              value={datos.sitioWeb}
              onChange={(evento) => cambiarCampo('sitioWeb', evento.target.value)}
              placeholder="https://ejemplo.com"
            />
          </label>
          <label>
            Rubro <span className="requerido">*</span>
            <input
              required
              value={datos.rubro}
              onChange={(evento) => cambiarCampo('rubro', evento.target.value)}
              placeholder="Ej. Servicios automotores"
            />
          </label>
          <label>
            País <span className="requerido">*</span>
            <select
              required
              value={datos.pais}
              onChange={(evento) => cambiarCampo('pais', evento.target.value)}
            >
              {paises.map((pais) => (
                <option key={pais.codigo} value={pais.codigo}>
                  {pais.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Idioma <span className="requerido">*</span>
            <select
              required
              value={datos.idioma}
              onChange={(evento) => cambiarCampo('idioma', evento.target.value)}
            >
              {idiomas.map((idioma) => (
                <option key={idioma.codigo} value={idioma.codigo}>
                  {idioma.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="campo-completo">
            Descripción <span className="opcional">opcional</span>
            <textarea
              rows={3}
              value={datos.descripcion ?? ''}
              onChange={(evento) => cambiarCampo('descripcion', evento.target.value)}
              placeholder="Qué hace esta marca y a quién se dirige"
            />
          </label>
        </div>
        <div className="separador-formulario" />
        <div className="titulo-seccion-formulario">
          <div>
            <h3>Competidores</h3>
            <p className="texto-secundario">
              Podés agregarlos ahora o crear el cliente sin competidores.
            </p>
          </div>
          <button
            className="boton boton-secundario boton-chico"
            type="button"
            onClick={() =>
              cambiarDatos((actual) => ({
                ...actual,
                competidores: [...actual.competidores, { nombre: '', sitioWeb: '' }],
              }))
            }
          >
            <Icono nombre="mas" tamano={16} /> Agregar
          </button>
        </div>
        {datos.competidores.map((competidor, indice) => (
          <div className="fila-competidor" key={indice}>
            <label>
              Nombre
              <input
                required
                maxLength={200}
                value={competidor.nombre}
                onChange={(evento) =>
                  cambiarDatos((actual) => ({
                    ...actual,
                    competidores: actual.competidores.map((item, posicion) =>
                      posicion === indice ? { ...item, nombre: evento.target.value } : item,
                    ),
                  }))
                }
                placeholder="Nombre del competidor"
              />
            </label>
            <label>
              Sitio web <span className="opcional">opcional</span>
              <input
                type="url"
                pattern="https?://.+"
                maxLength={2048}
                value={competidor.sitioWeb ?? ''}
                onChange={(evento) =>
                  cambiarDatos((actual) => ({
                    ...actual,
                    competidores: actual.competidores.map((item, posicion) =>
                      posicion === indice ? { ...item, sitioWeb: evento.target.value } : item,
                    ),
                  }))
                }
                placeholder="https://competidor.com"
              />
            </label>
            <button
              className="boton-icono boton-eliminar-fila"
              type="button"
              aria-label={`Quitar competidor ${indice + 1}`}
              onClick={() =>
                cambiarDatos((actual) => ({
                  ...actual,
                  competidores: actual.competidores.filter((_, posicion) => posicion !== indice),
                }))
              }
            >
              <Icono nombre="cerrar" tamano={18} />
            </button>
          </div>
        ))}
        {error && <Aviso>{error}</Aviso>}
        <div className="acciones-formulario">
          <button className="boton boton-secundario" type="button" onClick={alCancelar}>
            Cancelar
          </button>
          <button className="boton boton-primario" disabled={cargando} type="submit">
            Revisar cliente <Icono nombre="flecha" tamano={17} />
          </button>
        </div>
      </form>
      {datosPorConfirmar && (
        <ConfirmarCrearCliente
          datos={datosPorConfirmar}
          pais={paises.find((pais) => pais.codigo === datosPorConfirmar.pais)?.nombre ?? datosPorConfirmar.pais}
          idioma={idiomas.find((idioma) => idioma.codigo === datosPorConfirmar.idioma)?.nombre ?? datosPorConfirmar.idioma}
          enviando={cargando}
          error={errorCreacion}
          alCancelar={() => {
            cambiarDatosPorConfirmar(null)
            cambiarErrorCreacion('')
          }}
          alConfirmar={confirmarCreacion}
        />
      )}
    </div>
  )
}
