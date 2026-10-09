import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/clienteApi'
import type {
  DatosCliente,
  DatosConsulta,
  DatosCuenta,
  DatosTema,
  SolicitudCrearConsulta,
} from '../api/tipos'
import { obtenerMensajeError, tienePermiso, urlWebSegura } from '../utilidades'
import { Aviso, Icono, Vacio } from './Comun'

const consultaInicial: SolicitudCrearConsulta = {
  texto: '',
  tipoConsulta: 'REFERENCIA',
  prioridad: 'MEDIA',
}

function EtiquetaEstado({ estado }: { estado: string }) {
  return (
    <span className={`etiqueta etiqueta-${estado.toLowerCase()}`}>
      {estado === 'BORRADOR'
        ? 'Borrador'
        : estado === 'APROBADA'
          ? 'Aprobada'
          : estado === 'ACTIVO'
            ? 'Activo'
            : 'Archivado'}
    </span>
  )
}

export function DetalleCliente({
  clienteUuid,
  cuenta,
  alVolver,
}: {
  clienteUuid: string
  cuenta: DatosCuenta
  alVolver: () => void
}) {
  const [cliente, cambiarCliente] = useState<DatosCliente | null>(null)
  const [temas, cambiarTemas] = useState<DatosTema[]>([])
  const [temaUuid, cambiarTemaUuid] = useState('')
  const [consultas, cambiarConsultas] = useState<DatosConsulta[]>([])
  const [cargandoCliente, cambiarCargandoCliente] = useState(true)
  const [cargandoTemas, cambiarCargandoTemas] = useState(true)
  const [cargandoConsultas, cambiarCargandoConsultas] = useState(false)
  const [errorCliente, cambiarErrorCliente] = useState('')
  const [errorTemas, cambiarErrorTemas] = useState('')
  const [errorConsultas, cambiarErrorConsultas] = useState('')
  const [errorAccion, cambiarErrorAccion] = useState('')
  const [mensajeAccion, cambiarMensajeAccion] = useState('')
  const [nuevoTema, cambiarNuevoTema] = useState('')
  const [creandoTema, cambiarCreandoTema] = useState(false)
  const [renombrando, cambiarRenombrando] = useState(false)
  const [nombreEditado, cambiarNombreEditado] = useState('')
  const [mostrarConsultas, cambiarMostrarConsultas] = useState(false)
  const [filasConsulta, cambiarFilasConsulta] = useState<SolicitudCrearConsulta[]>([
    { ...consultaInicial },
  ])
  const [seleccionadas, cambiarSeleccionadas] = useState<string[]>([])
  const [confirmarBaja, cambiarConfirmarBaja] = useState(false)
  const [guardando, cambiarGuardando] = useState(false)
  const [revisionTemas, cambiarRevisionTemas] = useState(0)
  const [revisionConsultas, cambiarRevisionConsultas] = useState(0)

  const puedeVerTemas = tienePermiso(cuenta.permisos, 'TEMAS_VER')
  const puedeVerConsultas = tienePermiso(cuenta.permisos, 'CONSULTAS_VER')
  const activo = cliente?.estado === 'ACTIVO' && cuenta.tipoCuenta === 'ORGANIZACION'
  const puedeCrearTema = activo && tienePermiso(cuenta.permisos, 'TEMAS_CREAR')
  const puedeEditarTema = activo && tienePermiso(cuenta.permisos, 'TEMAS_EDITAR')
  const puedeCrearConsulta = activo && tienePermiso(cuenta.permisos, 'CONSULTAS_CREAR')
  const puedeAprobar = activo && tienePermiso(cuenta.permisos, 'CONSULTAS_APROBAR')
  const puedeDarDeBaja = activo && tienePermiso(cuenta.permisos, 'CONSULTAS_ELIMINAR')
  const temaActual = temas.find((tema) => tema.uuid === temaUuid)
  const sitioWebCliente = urlWebSegura(cliente?.sitioWeb ?? null)
  const consultasElegidas = consultas.filter((consulta) => seleccionadas.includes(consulta.uuid))
  const todasBorrador =
    consultasElegidas.length > 0 &&
    consultasElegidas.every((consulta) => consulta.estadoConsulta === 'BORRADOR')

  function seleccionarTema(uuid: string) {
    if (uuid === temaUuid) return
    cambiarTemaUuid(uuid)
    cambiarConsultas([])
    cambiarSeleccionadas([])
    cambiarErrorConsultas('')
    cambiarMensajeAccion('')
    cambiarCargandoConsultas(Boolean(uuid))
  }

  useEffect(() => {
    let vigente = true
    api.clientes
      .obtener(clienteUuid)
      .then((datos) => {
        if (vigente) cambiarCliente(datos)
      })
      .catch((causa) => {
        if (vigente) cambiarErrorCliente(obtenerMensajeError(causa))
      })
      .finally(() => {
        if (vigente) cambiarCargandoCliente(false)
      })
    return () => {
      vigente = false
    }
  }, [clienteUuid])

  useEffect(() => {
    if (!puedeVerTemas) return
    let vigente = true
    api.temas
      .listar(clienteUuid)
      .then((datos) => {
        if (!vigente) return
        cambiarTemas(datos)
        cambiarTemaUuid(datos[0]?.uuid ?? '')
        cambiarCargandoConsultas(Boolean(datos[0]?.uuid))
      })
      .catch((causa) => {
        if (vigente) cambiarErrorTemas(obtenerMensajeError(causa))
      })
      .finally(() => {
        if (vigente) cambiarCargandoTemas(false)
      })
    return () => {
      vigente = false
    }
  }, [clienteUuid, puedeVerTemas, revisionTemas])

  useEffect(() => {
    if (!temaUuid || !puedeVerConsultas) return
    let vigente = true
    api.consultas
      .listar(clienteUuid, temaUuid)
      .then((datos) => {
        if (vigente) cambiarConsultas(datos)
      })
      .catch((causa) => {
        if (vigente) cambiarErrorConsultas(obtenerMensajeError(causa))
      })
      .finally(() => {
        if (vigente) cambiarCargandoConsultas(false)
      })
    return () => {
      vigente = false
    }
  }, [clienteUuid, temaUuid, puedeVerConsultas, revisionConsultas])

  async function crearTema(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    cambiarErrorAccion('')
    cambiarMensajeAccion('')
    cambiarCreandoTema(true)
    try {
      const creado = await api.temas.crear(clienteUuid, nuevoTema.trim())
      cambiarTemas((actuales) => [...actuales, creado])
      seleccionarTema(creado.uuid)
      cambiarNuevoTema('')
      cambiarMensajeAccion('Tema creado.')
    } catch (causa) {
      cambiarErrorAccion(obtenerMensajeError(causa))
    } finally {
      cambiarCreandoTema(false)
    }
  }

  async function renombrarTema(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!temaActual) return
    cambiarErrorAccion('')
    cambiarGuardando(true)
    try {
      const actualizado = await api.temas.renombrar(
        clienteUuid,
        temaActual.uuid,
        nombreEditado.trim(),
      )
      cambiarTemas((actuales) =>
        actuales.map((tema) => (tema.uuid === actualizado.uuid ? actualizado : tema)),
      )
      cambiarRenombrando(false)
      cambiarMensajeAccion('Nombre del tema actualizado.')
    } catch (causa) {
      cambiarErrorAccion(obtenerMensajeError(causa))
    } finally {
      cambiarGuardando(false)
    }
  }

  /** El endpoint recibe un array JSON directo y valida el lote de forma atómica. */
  async function crearConsultas(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!temaActual) return
    cambiarErrorAccion('')
    cambiarMensajeAccion('')
    cambiarGuardando(true)
    try {
      const creadas = await api.consultas.crear(
        clienteUuid,
        temaActual.uuid,
        filasConsulta.map((fila) => ({ ...fila, texto: fila.texto.trim() })),
      )
      cambiarConsultas((actuales) => [...actuales, ...creadas])
      cambiarFilasConsulta([{ ...consultaInicial }])
      cambiarMostrarConsultas(false)
      cambiarMensajeAccion(
        `${creadas.length} ${creadas.length === 1 ? 'consulta creada' : 'consultas creadas'} en borrador.`,
      )
    } catch (causa) {
      cambiarErrorAccion(obtenerMensajeError(causa))
    } finally {
      cambiarGuardando(false)
    }
  }

  async function aprobarSeleccionadas() {
    if (!puedeAprobar || !todasBorrador) return
    cambiarGuardando(true)
    cambiarErrorAccion('')
    cambiarMensajeAccion('')
    try {
      const aprobadas = await api.consultas.aprobar(clienteUuid, seleccionadas)
      const porUuid = new Map(aprobadas.map((consulta) => [consulta.uuid, consulta]))
      cambiarConsultas((actuales) =>
        actuales.map((consulta) => porUuid.get(consulta.uuid) ?? consulta),
      )
      cambiarSeleccionadas([])
      cambiarMensajeAccion(
        `${aprobadas.length} ${aprobadas.length === 1 ? 'consulta aprobada' : 'consultas aprobadas'}.`,
      )
    } catch (causa) {
      cambiarErrorAccion(obtenerMensajeError(causa))
      cambiarCargandoConsultas(true)
      cambiarRevisionConsultas((actual) => actual + 1)
    } finally {
      cambiarGuardando(false)
    }
  }

  /** Solo retira la selección si el backend confirmó la baja completa con 204. */
  async function darDeBajaSeleccionadas() {
    if (!puedeDarDeBaja || seleccionadas.length === 0) return
    cambiarGuardando(true)
    cambiarErrorAccion('')
    cambiarMensajeAccion('')
    try {
      await api.consultas.darDeBaja(clienteUuid, seleccionadas)
      const cantidad = seleccionadas.length
      cambiarConsultas((actuales) =>
        actuales.filter((consulta) => !seleccionadas.includes(consulta.uuid)),
      )
      cambiarSeleccionadas([])
      cambiarConfirmarBaja(false)
      cambiarMensajeAccion(
        `${cantidad} ${cantidad === 1 ? 'consulta dada' : 'consultas dadas'} de baja.`,
      )
    } catch (causa) {
      cambiarErrorAccion(obtenerMensajeError(causa))
      cambiarConfirmarBaja(false)
      cambiarCargandoConsultas(true)
      cambiarRevisionConsultas((actual) => actual + 1)
    } finally {
      cambiarGuardando(false)
    }
  }

  function cambiarFila(indice: number, campo: keyof SolicitudCrearConsulta, valor: string) {
    cambiarFilasConsulta((actuales) =>
      actuales.map((fila, posicion) => (posicion === indice ? { ...fila, [campo]: valor } : fila)),
    )
  }

  function alternarSeleccion(uuid: string) {
    cambiarSeleccionadas((actuales) =>
      actuales.includes(uuid) ? actuales.filter((item) => item !== uuid) : [...actuales, uuid],
    )
  }

  return (
    <div className="contenido-limitado">
      <button className="enlace-volver" type="button" onClick={alVolver}>
        <Icono nombre="volver" tamano={17} /> Todos los clientes
      </button>
      {cargandoCliente && <div className="cargando-bloque">Cargando cliente…</div>}
      {errorCliente && <Aviso>{errorCliente}</Aviso>}
      {cliente && (
        <>
          <div className="encabezado-pagina encabezado-detalle">
            <div>
              <span className="sobrelinea">CLIENTE MONITOREADO</span>
              <div className="titulo-con-etiqueta">
                <h1>{cliente.nombre}</h1>
                <EtiquetaEstado estado={cliente.estado} />
              </div>
              <p>Configuración de marca y consultas de seguimiento.</p>
            </div>
          </div>
          {cliente.estado === 'ARCHIVADO' && (
            <Aviso tipo="informacion">
              Este cliente está archivado. Sus datos siguen disponibles para lectura; la API no
              permite reactivarlo desde esta interfaz.
            </Aviso>
          )}
          <div className="resumen-cliente">
            <div className="dato-resumen">
              <span>MARCA</span>
              <strong>{cliente.nombreMarca}</strong>
              <small>{cliente.rubro}</small>
            </div>
            <div className="dato-resumen">
              <span>SITIO WEB</span>
              {sitioWebCliente ? (
                <a href={sitioWebCliente} target="_blank" rel="noopener noreferrer">
                  {cliente.sitioWeb}
                </a>
              ) : (
                <strong>{cliente.sitioWeb}</strong>
              )}
              <small>{sitioWebCliente ? 'Enlace externo ↗' : 'Dirección registrada'}</small>
            </div>
            <div className="dato-resumen">
              <span>MERCADO</span>
              <strong>
                {cliente.pais} <span className="dato-divisor">/</span> {cliente.idioma}
              </strong>
              <small>País e idioma</small>
            </div>
            <div className="dato-resumen">
              <span>COMPETIDORES</span>
              <strong>{cliente.competidores.length}</strong>
              <small>Definidos al crear el cliente</small>
            </div>
          </div>
          {cliente.descripcion && <p className="descripcion-cliente">{cliente.descripcion}</p>}
          {cliente.competidores.length > 0 && (
            <section className="competidores-seccion">
              <span className="sobrelinea">ENTORNO COMPETITIVO</span>
              <div className="competidores-lista">
                {cliente.competidores.map((competidor) => {
                  const sitioSeguro = urlWebSegura(competidor.sitioWeb)
                  return (
                    <span key={competidor.uuid} className="competidor-chip">
                      {sitioSeguro ? (
                        <a href={sitioSeguro} target="_blank" rel="noopener noreferrer">
                          {competidor.nombre} ↗
                        </a>
                      ) : (
                        competidor.nombre
                      )}
                    </span>
                  )
                })}
              </div>
            </section>
          )}
          <div className="trabajo-grilla">
            <section className="tarjeta temas-panel">
              <div className="seccion-cabecera">
                <div>
                  <span className="sobrelinea">ORGANIZACIÓN</span>
                  <h2>Temas</h2>
                </div>
                <span className="contador">{temas.length}</span>
              </div>
              {!puedeVerTemas ? (
                <Aviso tipo="informacion">Tu cuenta no tiene permiso para ver temas.</Aviso>
              ) : (
                <>
                  {cargandoTemas ? (
                    <p className="texto-secundario">Cargando temas…</p>
                  ) : errorTemas ? (
                    <div>
                      <Aviso>{errorTemas}</Aviso>
                      <button
                        type="button"
                        className="boton boton-secundario reintentar"
                        onClick={() => {
                          cambiarErrorTemas('')
                          cambiarCargandoTemas(true)
                          cambiarRevisionTemas((actual) => actual + 1)
                        }}
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : temas.length === 0 ? (
                    <p className="texto-secundario sin-temas">
                      Todavía no hay temas para este cliente.
                    </p>
                  ) : (
                    <div className="lista-temas">
                      {temas.map((tema, indice) => (
                        <button
                          type="button"
                          className={`item-tema ${tema.uuid === temaUuid ? 'item-tema-activo' : ''}`}
                          key={tema.uuid}
                          onClick={() => {
                            seleccionarTema(tema.uuid)
                            cambiarRenombrando(false)
                            cambiarErrorAccion('')
                          }}
                        >
                          <span className="numero-tema">{String(indice + 1).padStart(2, '0')}</span>
                          <span>{tema.nombre}</span>
                          <Icono nombre="flecha" tamano={16} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {puedeCrearTema && (
                <form className="crear-tema" onSubmit={crearTema}>
                  <label htmlFor="nuevo-tema">Nuevo tema</label>
                  <div className="entrada-con-boton">
                    <input
                      id="nuevo-tema"
                      required
                      maxLength={200}
                      value={nuevoTema}
                      onChange={(evento) => cambiarNuevoTema(evento.target.value)}
                      placeholder="Ej. Software de gestión"
                    />
                    <button
                      className="boton-icono boton-agregar"
                      type="submit"
                      disabled={creandoTema}
                      aria-label="Crear tema"
                    >
                      <Icono nombre="mas" tamano={18} />
                    </button>
                  </div>
                </form>
              )}
            </section>
            <section className="tarjeta consultas-panel">
              {!temaActual ? (
                <Vacio
                  icono="capas"
                  titulo="Elegí un tema"
                  descripcion={
                    temas.length
                      ? 'Seleccioná un tema para revisar sus consultas.'
                      : 'Creá un tema para organizar las primeras consultas de este cliente.'
                  }
                />
              ) : (
                <>
                  <div className="seccion-cabecera consultas-cabecera">
                    <div>
                      <span className="sobrelinea">TEMA SELECCIONADO</span>
                      {renombrando ? (
                        <form className="formulario renombrar-formulario" onSubmit={renombrarTema}>
                          <input
                            required
                            maxLength={200}
                            aria-label="Nuevo nombre del tema"
                            value={nombreEditado}
                            onChange={(evento) => cambiarNombreEditado(evento.target.value)}
                          />
                          <button
                            className="boton boton-primario boton-chico"
                            disabled={guardando}
                            type="submit"
                          >
                            Guardar
                          </button>
                          <button
                            className="boton boton-secundario boton-chico"
                            type="button"
                            onClick={() => cambiarRenombrando(false)}
                          >
                            Cancelar
                          </button>
                        </form>
                      ) : (
                        <h2>{temaActual.nombre}</h2>
                      )}
                    </div>
                    {puedeEditarTema && !renombrando && (
                      <button
                        className="boton-icono"
                        type="button"
                        onClick={() => {
                          cambiarNombreEditado(temaActual.nombre)
                          cambiarRenombrando(true)
                        }}
                        aria-label="Renombrar tema"
                      >
                        <Icono nombre="editar" tamano={18} />
                      </button>
                    )}
                  </div>
                  <div className="consultas-meta">
                    <span>
                      {consultas.length} {consultas.length === 1 ? 'consulta' : 'consultas'} en este
                      tema
                    </span>
                    <span>Máximo 15 activas por cliente</span>
                  </div>
                  {errorAccion && <Aviso>{errorAccion}</Aviso>}
                  {mensajeAccion && <Aviso tipo="exito">{mensajeAccion}</Aviso>}
                  {puedeVerConsultas ? (
                    <>
                      {cargandoConsultas ? (
                        <div className="cargando-bloque">Cargando consultas…</div>
                      ) : errorConsultas ? (
                        <div>
                          <Aviso>{errorConsultas}</Aviso>
                          <button
                            type="button"
                            className="boton boton-secundario reintentar"
                            onClick={() => {
                              cambiarErrorConsultas('')
                              cambiarCargandoConsultas(true)
                              cambiarRevisionConsultas((actual) => actual + 1)
                            }}
                          >
                            Reintentar
                          </button>
                        </div>
                      ) : consultas.length === 0 ? (
                        <Vacio
                          icono="documento"
                          titulo="Todavía no hay consultas"
                          descripcion="Escribí consultas de referencia o descubrimiento para este tema."
                          accion={
                            puedeCrearConsulta && (
                              <button
                                className="boton boton-primario"
                                type="button"
                                onClick={() => cambiarMostrarConsultas(true)}
                              >
                                <Icono nombre="mas" tamano={17} /> Crear consultas
                              </button>
                            )
                          }
                        />
                      ) : (
                        <>
                          <div className="consultas-herramientas">
                            <span className="texto-secundario">
                              {seleccionadas.length
                                ? `${seleccionadas.length} seleccionadas`
                                : 'Seleccioná consultas para actuar por lote'}
                            </span>
                            <div className="acciones-lote">
                              {puedeAprobar && (
                                <button
                                  className="boton boton-secundario boton-chico"
                                  type="button"
                                  onClick={aprobarSeleccionadas}
                                  disabled={!todasBorrador || guardando}
                                >
                                  <Icono nombre="check" tamano={15} /> Aprobar
                                </button>
                              )}
                              {puedeDarDeBaja && (
                                <button
                                  className="boton boton-peligro boton-chico"
                                  type="button"
                                  onClick={() => cambiarConfirmarBaja(true)}
                                  disabled={seleccionadas.length === 0 || guardando}
                                >
                                  Dar de baja
                                </button>
                              )}
                            </div>
                          </div>
                          {confirmarBaja && (
                            <div
                              className="confirmacion-baja"
                              role="alertdialog"
                              aria-label="Confirmar baja"
                            >
                              <strong>
                                ¿Dar de baja {seleccionadas.length}{' '}
                                {seleccionadas.length === 1 ? 'consulta' : 'consultas'}?
                              </strong>
                              <p>
                                Desaparecerán de las lecturas y liberarán cupo. Esta acción no se
                                puede deshacer desde la interfaz.
                              </p>
                              <div>
                                <button
                                  className="boton boton-secundario boton-chico"
                                  type="button"
                                  onClick={() => cambiarConfirmarBaja(false)}
                                >
                                  Cancelar
                                </button>
                                <button
                                  className="boton boton-peligro boton-chico"
                                  type="button"
                                  disabled={guardando}
                                  onClick={darDeBajaSeleccionadas}
                                >
                                  Confirmar baja
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="lista-consultas">
                            {consultas.map((consulta, indice) => (
                              <article className="consulta-fila" key={consulta.uuid}>
                                <div className="consulta-seleccion">
                                  {(puedeAprobar || puedeDarDeBaja) && (
                                    <input
                                      type="checkbox"
                                      aria-label={`Seleccionar consulta ${indice + 1}`}
                                      checked={seleccionadas.includes(consulta.uuid)}
                                      onChange={() => alternarSeleccion(consulta.uuid)}
                                    />
                                  )}
                                </div>
                                <div className="consulta-contenido">
                                  <div className="consulta-etiquetas">
                                    <span className="consulta-numero">
                                      {String(indice + 1).padStart(2, '0')}
                                    </span>
                                    <span>
                                      {consulta.tipoConsulta === 'REFERENCIA'
                                        ? 'Referencia'
                                        : 'Descubrimiento'}
                                    </span>
                                    <span className="punto-separador">·</span>
                                    <span>Prioridad {consulta.prioridad.toLowerCase()}</span>
                                  </div>
                                  <p>{consulta.texto}</p>
                                </div>
                                <EtiquetaEstado estado={consulta.estadoConsulta} />
                              </article>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <Aviso tipo="informacion">Tu cuenta no tiene permiso para ver consultas.</Aviso>
                  )}
                  {puedeCrearConsulta && !mostrarConsultas && consultas.length > 0 && (
                    <button
                      className="boton boton-secundario agregar-consulta"
                      type="button"
                      onClick={() => cambiarMostrarConsultas(true)}
                    >
                      <Icono nombre="mas" tamano={17} /> Agregar consultas
                    </button>
                  )}
                  {puedeCrearConsulta && mostrarConsultas && (
                    <form className="formulario formulario-consultas" onSubmit={crearConsultas}>
                      <div className="formulario-consultas-titulo">
                        <div>
                          <span className="sobrelinea">NUEVO LOTE</span>
                          <h3>Crear consultas</h3>
                        </div>
                        <button
                          className="boton-icono"
                          type="button"
                          onClick={() => cambiarMostrarConsultas(false)}
                          aria-label="Cerrar formulario de consultas"
                        >
                          <Icono nombre="cerrar" tamano={18} />
                        </button>
                      </div>
                      <p className="texto-secundario">
                        El lote se guarda completo o no se guarda. Las nuevas consultas quedan en
                        borrador.
                      </p>
                      {filasConsulta.map((fila, indice) => (
                        <div className="fila-consulta-formulario" key={indice}>
                          <div className="fila-consulta-encabezado">
                            <strong>Consulta {indice + 1}</strong>
                            {filasConsulta.length > 1 && (
                              <button
                                className="boton-texto"
                                type="button"
                                onClick={() =>
                                  cambiarFilasConsulta((actuales) =>
                                    actuales.filter((_, posicion) => posicion !== indice),
                                  )
                                }
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                          <label>
                            Texto
                            <textarea
                              required
                              maxLength={2000}
                              rows={3}
                              value={fila.texto}
                              onChange={(evento) =>
                                cambiarFila(indice, 'texto', evento.target.value)
                              }
                              placeholder="¿Qué preguntaría una persona sobre este tema?"
                            />
                          </label>
                          <div className="grilla-formulario">
                            <label>
                              Tipo
                              <select
                                value={fila.tipoConsulta}
                                onChange={(evento) =>
                                  cambiarFila(indice, 'tipoConsulta', evento.target.value)
                                }
                              >
                                <option value="REFERENCIA">Referencia</option>
                                <option value="DESCUBRIMIENTO">Descubrimiento</option>
                              </select>
                            </label>
                            <label>
                              Prioridad
                              <select
                                value={fila.prioridad}
                                onChange={(evento) =>
                                  cambiarFila(indice, 'prioridad', evento.target.value)
                                }
                              >
                                <option value="ALTA">Alta</option>
                                <option value="MEDIA">Media</option>
                                <option value="BAJA">Baja</option>
                              </select>
                            </label>
                          </div>
                        </div>
                      ))}
                      <div className="acciones-formulario">
                        <button
                          className="boton boton-secundario"
                          type="button"
                          onClick={() =>
                            cambiarFilasConsulta((actuales) => [
                              ...actuales,
                              { ...consultaInicial },
                            ])
                          }
                          disabled={filasConsulta.length >= 15}
                        >
                          <Icono nombre="mas" tamano={16} /> Otra consulta
                        </button>
                        <button className="boton boton-primario" type="submit" disabled={guardando}>
                          {guardando ? 'Guardando…' : 'Guardar lote'}{' '}
                          <Icono nombre="flecha" tamano={17} />
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
