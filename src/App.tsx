import { useEffect, useState } from 'react'
import { api, configurarExpiracionSesion } from './api/clienteApi'
import type { DatosCliente, DatosConsulta, DatosCuenta } from './api/tipos'
import { Administracion } from './componentes/Administracion'
import { Aviso, Icono, Marca, Vacio } from './componentes/Comun'
import { ConfirmarEstadoCliente } from './componentes/ConfirmarEstadoCliente'
import { DetalleCliente } from './componentes/DetalleCliente'
import { DetalleEjecucionConsulta } from './componentes/DetalleEjecucionConsulta'
import { FormularioCliente } from './componentes/FormularioCliente'
import { Ingreso } from './componentes/Ingreso'
import { MetricasCliente } from './componentes/MetricasCliente'
import { PaginaAnalisisSemanales } from './componentes/PaginaAnalisisSemanales'
import { obtenerMensajeError, tienePermiso } from './utilidades'
import './App.css'

type Ruta =
  | { tipo: 'clientes' }
  | { tipo: 'cliente'; uuid: string; temaUuid?: string }
  | { tipo: 'metricas'; clienteUuid: string }
  | { tipo: 'analisis'; clienteUuid: string; confirmarAlAbrir: boolean }
  | {
      tipo: 'ejecucion'
      clienteUuid: string
      temaUuid: string
      consultaUuid: string
      iniciarAlAbrir: boolean
      ejecucionUuid?: string
    }
  | { tipo: 'administracion' }

/** El hash permite conservar la vista al recargar sin exigir rutas al servidor estático. */
function leerRuta(): Ruta {
  const ruta = window.location.hash.slice(1)
  if (ruta === '/administracion') return { tipo: 'administracion' }
  const ejecucion =
    /^\/clientes\/([0-9a-f-]+)\/temas\/([0-9a-f-]+)\/consultas\/([0-9a-f-]+)\/ejecucion(?:\/([0-9a-f-]+))?$/i.exec(ruta)
  if (ejecucion) {
    return {
      tipo: 'ejecucion',
      clienteUuid: ejecucion[1],
      temaUuid: ejecucion[2],
      consultaUuid: ejecucion[3],
      iniciarAlAbrir: false,
      ejecucionUuid: ejecucion[4],
    }
  }
  const metricas = /^\/clientes\/([0-9a-f-]+)\/metricas$/i.exec(ruta)
  if (metricas) return { tipo: 'metricas', clienteUuid: metricas[1] }
  const analisis = /^\/clientes\/([0-9a-f-]+)\/analisis-semanales(\/nuevo)?$/i.exec(ruta)
  if (analisis) {
    return { tipo: 'analisis', clienteUuid: analisis[1], confirmarAlAbrir: Boolean(analisis[2]) }
  }
  const tema = /^\/clientes\/([0-9a-f-]+)\/temas\/([0-9a-f-]+)$/i.exec(ruta)
  if (tema) return { tipo: 'cliente', uuid: tema[1], temaUuid: tema[2] }
  const cliente = /^\/clientes\/([0-9a-f-]+)$/i.exec(ruta)
  if (cliente) return { tipo: 'cliente', uuid: cliente[1] }
  return { tipo: 'clientes' }
}

function navegar(ruta: string) {
  window.location.hash = ruta
}

function ListadoClientes({ cuenta }: { cuenta: DatosCuenta }) {
  const [clientes, cambiarClientes] = useState<DatosCliente[]>([])
  const [cargando, cambiarCargando] = useState(true)
  const [error, cambiarError] = useState('')
  const [busqueda, cambiarBusqueda] = useState('')
  const [mostrarFormulario, cambiarMostrarFormulario] = useState(false)
  const [revision, cambiarRevision] = useState(0)
  const [cambiandoEstadoUuid, cambiarCambiandoEstadoUuid] = useState<string | null>(null)
  const [clientePorConfirmar, cambiarClientePorConfirmar] = useState<DatosCliente | null>(null)
  const [errorEstado, cambiarErrorEstado] = useState('')
  const [mensajeEstado, cambiarMensajeEstado] = useState('')
  const puedeVer = tienePermiso(cuenta.permisos, 'CLIENTES_VER')
  const puedeCrear =
    cuenta.tipoCuenta === 'ORGANIZACION' && tienePermiso(cuenta.permisos, 'CLIENTES_CREAR')
  const puedeCambiarEstado =
    cuenta.tipoCuenta === 'ORGANIZACION' &&
    tienePermiso(cuenta.permisos, 'CLIENTES_CAMBIAR_ESTADO')
  const puedeVerMetricas = tienePermiso(cuenta.permisos, 'CONSULTAS_VER')

  useEffect(() => {
    if (!puedeVer) return
    let vigente = true
    api.clientes
      .listar()
      .then((datos) => {
        if (vigente) cambiarClientes(datos)
      })
      .catch((causa) => {
        if (vigente) cambiarError(obtenerMensajeError(causa))
      })
      .finally(() => {
        if (vigente) cambiarCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [puedeVer, revision])

  const filtrados = clientes.filter((cliente) => {
    const termino = busqueda.trim().toLocaleLowerCase('es')
    return (
      !termino ||
      [cliente.nombre, cliente.nombreMarca, cliente.rubro].some((valor) =>
        valor.toLocaleLowerCase('es').includes(termino),
      )
    )
  })

  function reintentar() {
    cambiarCargando(true)
    cambiarError('')
    cambiarRevision((actual) => actual + 1)
  }

  /** Aplica el estado confirmado y reemplaza la fila con la respuesta de la API. */
  async function cambiarEstadoCliente() {
    const cliente = clientePorConfirmar
    if (!cliente || !puedeCambiarEstado || cambiandoEstadoUuid) return
    const estado = cliente.estado === 'ACTIVO' ? 'ARCHIVADO' : 'ACTIVO'
    cambiarErrorEstado('')
    cambiarMensajeEstado('')
    cambiarCambiandoEstadoUuid(cliente.uuid)
    try {
      const actualizado = await api.clientes.cambiarEstado(cliente.uuid, estado)
      cambiarClientes((actuales) =>
        actuales.map((actual) => (actual.uuid === cliente.uuid ? actualizado : actual)),
      )
      cambiarMensajeEstado(
        actualizado.estado === 'ARCHIVADO'
          ? `${cliente.nombre} quedó archivado.`
          : `${cliente.nombre} volvió a estar activo.`,
      )
    } catch (causa) {
      cambiarErrorEstado(
        `No se pudo cambiar el estado de ${cliente.nombre}: ${obtenerMensajeError(causa)}`,
      )
    } finally {
      cambiarCambiandoEstadoUuid(null)
      cambiarClientePorConfirmar(null)
    }
  }

  return (
    <div className="contenido-limitado">
      <div className="encabezado-pagina">
        <div>
          <span className="sobrelinea">ESPACIO DE TRABAJO</span>
          <h1>Clientes monitoreados</h1>
          <p>
            {cuenta.tipoCuenta === 'PLATAFORMA'
              ? 'Vista global de clientes registrados.'
              : 'Administrá las marcas y las consultas de tu organización.'}
          </p>
        </div>
        {puedeCrear && (
          <button
            type="button"
            className="boton boton-primario"
            onClick={() => cambiarMostrarFormulario(true)}
          >
            <Icono nombre="mas" tamano={18} /> Nuevo cliente
          </button>
        )}
      </div>
      {mostrarFormulario && (
        <FormularioCliente
          alCancelar={() => cambiarMostrarFormulario(false)}
          alCrear={(cliente) => {
            cambiarMostrarFormulario(false)
            navegar(`/clientes/${cliente.uuid}`)
          }}
        />
      )}
      {!puedeVer ? (
        <Aviso tipo="informacion">Tu cuenta no tiene permiso para ver clientes monitoreados.</Aviso>
      ) : (
        <>
          <div className="barra-listado">
            <div className="barra-listado-titulo">
              <span className="sobrelinea">CARTERA ACTUAL</span>
              <h2>
                Todos los clientes <span className="contador">{clientes.length}</span>
              </h2>
            </div>
            <label className="buscador">
              <Icono nombre="buscar" tamano={18} />
              <span className="sr-only">Buscar clientes</span>
              <input
                value={busqueda}
                onChange={(evento) => cambiarBusqueda(evento.target.value)}
                placeholder="Buscar por nombre, marca o rubro"
              />
            </label>
          </div>
          {errorEstado && (
            <div className="detalle-aviso">
              <Aviso>{errorEstado}</Aviso>
            </div>
          )}
          {mensajeEstado && (
            <div className="detalle-aviso">
              <Aviso tipo="exito">{mensajeEstado}</Aviso>
            </div>
          )}
          {cargando ? (
            <div className="cargando-bloque">Cargando clientes…</div>
          ) : error ? (
            <div>
              <Aviso>{error}</Aviso>
              <button
                className="boton boton-secundario reintentar"
                type="button"
                onClick={reintentar}
              >
                Reintentar
              </button>
            </div>
          ) : filtrados.length === 0 ? (
            <Vacio
              icono="clientes"
              titulo={clientes.length === 0 ? 'Todavía no hay clientes' : 'Sin resultados'}
              descripcion={
                clientes.length === 0
                  ? 'Los clientes que se creen aparecerán acá.'
                  : 'Probá con otro nombre, marca o rubro.'
              }
              accion={
                clientes.length === 0 &&
                puedeCrear && (
                  <button
                    className="boton boton-primario"
                    type="button"
                    onClick={() => cambiarMostrarFormulario(true)}
                  >
                    <Icono nombre="mas" tamano={17} /> Crear primer cliente
                  </button>
                )
              }
            />
          ) : (
            <div className="clientes-tabla" role="list">
              {filtrados.map((cliente) => (
                <div className="cliente-fila" role="listitem" key={cliente.uuid}>
                  <div className="cliente-datos">
                    <span className="cliente-avatar">
                      {cliente.nombreMarca.trim().charAt(0).toLocaleUpperCase('es')}
                    </span>
                    <span className="cliente-identidad">
                      <strong>{cliente.nombre}</strong>
                      <small>{cliente.nombreMarca}</small>
                    </span>
                    <span className="cliente-rubro">{cliente.rubro}</span>
                    <span className="cliente-mercado">
                      {cliente.pais} · {cliente.idioma}
                    </span>
                    <span className={`etiqueta etiqueta-${cliente.estado.toLowerCase()}`}>
                      {cliente.estado === 'ACTIVO' ? 'Activo' : 'Archivado'}
                    </span>
                  </div>
                  <div className="cliente-acciones" role="group" aria-label={`Opciones para ${cliente.nombre}`}>
                    <button
                      className="cliente-accion cliente-accion-ver"
                      type="button"
                      disabled={cambiandoEstadoUuid !== null}
                      onClick={() => navegar(`/clientes/${cliente.uuid}`)}
                      title="Ver cliente"
                      aria-label={`Ver cliente ${cliente.nombre}`}
                    >
                      <Icono nombre="ver" tamano={19} />
                    </button>
                    {puedeCambiarEstado && (
                      <button
                        className={`cliente-accion cliente-accion-${cliente.estado === 'ACTIVO' ? 'archivar' : 'reactivar'}`}
                        type="button"
                        disabled={cambiandoEstadoUuid !== null}
                        onClick={() => {
                          cambiarErrorEstado('')
                          cambiarMensajeEstado('')
                          cambiarClientePorConfirmar(cliente)
                        }}
                        title={cliente.estado === 'ACTIVO' ? 'Archivar cliente' : 'Reactivar cliente'}
                        aria-label={`${cliente.estado === 'ACTIVO' ? 'Archivar' : 'Reactivar'} a ${cliente.nombre}`}
                      >
                        <Icono
                          nombre={cliente.estado === 'ACTIVO' ? 'archivar' : 'reactivar'}
                          tamano={19}
                        />
                      </button>
                    )}
                    {puedeVerMetricas && (
                      <span
                        className="cliente-accion-contenedor"
                        title={
                          cliente.estado === 'ARCHIVADO'
                            ? 'Estadísticas GEO no disponibles para clientes archivados'
                            : 'Ver estadísticas GEO'
                        }
                      >
                        <button
                          className="cliente-accion cliente-accion-metricas"
                          type="button"
                          disabled={cambiandoEstadoUuid !== null || cliente.estado === 'ARCHIVADO'}
                          onClick={() => navegar(`/clientes/${cliente.uuid}/metricas`)}
                          aria-label={
                            cliente.estado === 'ARCHIVADO'
                              ? `Estadísticas GEO no disponibles: ${cliente.nombre} está archivado`
                              : `Ver estadísticas GEO de ${cliente.nombre}`
                          }
                        >
                          <Icono nombre="grafico" tamano={19} />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {clientePorConfirmar && (
        <ConfirmarEstadoCliente
          cliente={clientePorConfirmar}
          enviando={cambiandoEstadoUuid !== null}
          alCancelar={() => cambiarClientePorConfirmar(null)}
          alConfirmar={() => void cambiarEstadoCliente()}
        />
      )}
    </div>
  )
}

function App() {
  const [cuenta, cambiarCuenta] = useState<DatosCuenta | null>(null)
  const [restaurando, cambiarRestaurando] = useState(true)
  const [ruta, cambiarRuta] = useState<Ruta>(leerRuta)
  const [errorSalida, cambiarErrorSalida] = useState('')

  useEffect(() => {
    const actualizarRuta = () =>
      cambiarRuta((actual) => {
        const siguiente = leerRuta()
        if (
          actual.tipo === 'ejecucion' &&
          siguiente.tipo === 'ejecucion' &&
          actual.clienteUuid === siguiente.clienteUuid &&
          actual.temaUuid === siguiente.temaUuid &&
          actual.consultaUuid === siguiente.consultaUuid
        ) {
          return actual
        }
        return siguiente
      })
    window.addEventListener('hashchange', actualizarRuta)
    return () => window.removeEventListener('hashchange', actualizarRuta)
  }, [])

  useEffect(() => {
    let vigente = true
    configurarExpiracionSesion(() => {
      if (vigente) cambiarCuenta(null)
    })
    api
      .restaurarSesion()
      .then((datos) => {
        if (vigente) cambiarCuenta(datos)
      })
      .catch(() => {
        if (vigente) cambiarCuenta(null)
      })
      .finally(() => {
        if (vigente) cambiarRestaurando(false)
      })
    return () => {
      vigente = false
    }
  }, [])

  async function salir() {
    cambiarErrorSalida('')
    try {
      await api.salir()
      cambiarCuenta(null)
      navegar('/clientes')
    } catch (causa) {
      cambiarCuenta(null)
      cambiarErrorSalida(obtenerMensajeError(causa))
    }
  }

  /** Conserva el inicio inmediato solo durante esta navegación; una recarga no repite el POST. */
  function abrirEjecucion(
    clienteUuid: string,
    temaUuid: string,
    consulta: DatosConsulta,
    iniciarAlAbrir: boolean,
    ejecucionUuid?: string,
  ) {
    cambiarRuta({
      tipo: 'ejecucion',
      clienteUuid,
      temaUuid,
      consultaUuid: consulta.uuid,
      iniciarAlAbrir,
      ejecucionUuid,
    })
    navegar(`/clientes/${clienteUuid}/temas/${temaUuid}/consultas/${consulta.uuid}/ejecucion${ejecucionUuid ? `/${ejecucionUuid}` : ''}`)
  }

  if (restaurando)
    return (
      <div className="pantalla-carga">
        <Marca />
        <span>Preparando tu espacio de trabajo…</span>
      </div>
    )
  if (!cuenta)
    return (
      <>
        <Ingreso
          alIngresar={(datos) => {
            cambiarErrorSalida('')
            cambiarCuenta(datos)
          }}
        />
        {errorSalida && (
          <div className="error-salida">
            <Aviso>
              {errorSalida} La sesión local se cerró; el cierre remoto no pudo confirmarse.
            </Aviso>
          </div>
        )}
      </>
    )

  const esAdministrador =
    cuenta.roles.includes('SYSADMIN') &&
    (tienePermiso(cuenta.permisos, 'ORGANIZACIONES_CREAR') ||
      tienePermiso(cuenta.permisos, 'USUARIOS_CREAR'))
  const nombreVista =
    ruta.tipo === 'administracion'
      ? 'Administración'
      : ruta.tipo === 'cliente'
        ? 'Detalle del cliente'
        : ruta.tipo === 'metricas'
          ? 'Métricas GEO'
          : ruta.tipo === 'ejecucion'
            ? 'Ejecución de consulta'
            : 'Clientes'

  return (
    <div className="aplicacion">
      <aside className="barra-lateral">
        <div className="lateral-marca">
          <Marca compacta />
        </div>
        <div className="lateral-contenido">
          <span className="lateral-grupo">ESPACIO DE TRABAJO</span>
          <nav aria-label="Navegación principal">
            <button
              type="button"
              className={`nav-item ${ruta.tipo !== 'administracion' ? 'nav-item-activo' : ''}`}
              onClick={() => navegar('/clientes')}
            >
              <Icono nombre="clientes" tamano={19} /> Clientes
            </button>
            {esAdministrador && (
              <button
                type="button"
                className={`nav-item ${ruta.tipo === 'administracion' ? 'nav-item-activo' : ''}`}
                onClick={() => navegar('/administracion')}
              >
                <Icono nombre="ajustes" tamano={19} /> Administración
              </button>
            )}
          </nav>
        </div>
        <div className="lateral-pie">
          <div className="lateral-cuenta">
            <span className="cuenta-avatar">
              {cuenta.usuario.charAt(0).toLocaleUpperCase('es')}
            </span>
            <span>
              <strong title={cuenta.usuario}>{cuenta.usuario}</strong>
              <small>{cuenta.roles.join(', ') || cuenta.tipoCuenta}</small>
            </span>
          </div>
          <button className="nav-item cerrar-sesion" type="button" onClick={salir}>
            <Icono nombre="salir" tamano={18} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="area-principal">
        <header className="barra-superior">
          <span className="barra-ruta">
            <span className="marca-logotipo">
              <img src="/logo-completo.png" alt="Gelaia" />
            </span>
            <b>/</b> <span>{nombreVista}</span>
          </span>
          <div>
            <span className="indicador-conexion" />{' '}
            {cuenta.tipoCuenta === 'PLATAFORMA' ? 'Cuenta de plataforma' : 'Organización'}
          </div>
        </header>
        <main className="contenido-principal">
          {ruta.tipo === 'administracion' ? (
            esAdministrador ? (
              <Administracion cuenta={cuenta} />
            ) : (
              <Aviso tipo="informacion">Tu cuenta no tiene acceso a administración.</Aviso>
            )
          ) : ruta.tipo === 'ejecucion' ? (
            tienePermiso(cuenta.permisos, 'CONSULTAS_VER') ? (
              <DetalleEjecucionConsulta
                key={`${ruta.clienteUuid}:${ruta.consultaUuid}:${ruta.ejecucionUuid ?? ''}`}
                clienteUuid={ruta.clienteUuid}
                temaUuid={ruta.temaUuid}
                consultaUuid={ruta.consultaUuid}
                cuenta={cuenta}
                iniciarAlAbrir={ruta.iniciarAlAbrir}
                ejecucionInicialUuid={ruta.ejecucionUuid}
                alVolver={() => navegar(`/clientes/${ruta.clienteUuid}/temas/${ruta.temaUuid}`)}
              />
            ) : (
              <Aviso tipo="informacion">Tu cuenta no tiene permiso para ver consultas.</Aviso>
            )
          ) : ruta.tipo === 'analisis' ? (
            tienePermiso(cuenta.permisos, 'ANALISIS_SEMANALES_VER') ||
            tienePermiso(cuenta.permisos, 'ANALISIS_SEMANALES_CREAR') ? (
              <PaginaAnalisisSemanales
                key={`${ruta.clienteUuid}:${ruta.confirmarAlAbrir}`}
                clienteUuid={ruta.clienteUuid}
                cuenta={cuenta}
                confirmarAlAbrir={ruta.confirmarAlAbrir}
                alVolver={() => navegar(`/clientes/${ruta.clienteUuid}`)}
              />
            ) : (
              <Aviso tipo="informacion">Tu cuenta no tiene permiso para ver análisis semanales.</Aviso>
            )
          ) : ruta.tipo === 'metricas' ? (
            tienePermiso(cuenta.permisos, 'CONSULTAS_VER') ? (
              <MetricasCliente
                key={ruta.clienteUuid}
                clienteUuid={ruta.clienteUuid}
                cuenta={cuenta}
                alVolver={() => navegar(`/clientes/${ruta.clienteUuid}`)}
              />
            ) : (
              <Aviso tipo="informacion">Tu cuenta no tiene permiso para ver métricas GEO.</Aviso>
            )
          ) : ruta.tipo === 'cliente' ? (
            tienePermiso(cuenta.permisos, 'CLIENTES_VER') ? (
              <DetalleCliente
                key={`${ruta.uuid}:${ruta.temaUuid ?? ''}`}
                clienteUuid={ruta.uuid}
                cuenta={cuenta}
                temaInicialUuid={ruta.temaUuid}
                alAbrirEjecucion={(consulta, temaUuid, iniciar, ejecucionUuid) =>
                  abrirEjecucion(ruta.uuid, temaUuid, consulta, iniciar, ejecucionUuid)
                }
                alVerMetricas={() => navegar(`/clientes/${ruta.uuid}/metricas`)}
                alVerAnalisis={() => navegar(`/clientes/${ruta.uuid}/analisis-semanales`)}
                alCrearAnalisis={() => navegar(`/clientes/${ruta.uuid}/analisis-semanales/nuevo`)}
                alVolver={() => navegar('/clientes')}
              />
            ) : (
              <Aviso tipo="informacion">Tu cuenta no tiene permiso para ver clientes.</Aviso>
            )
          ) : (
            <ListadoClientes cuenta={cuenta} />
          )}
        </main>
        <footer className="pie-pagina">
          GELAIA <span>·</span> ORGANIZACIÓN DE CONSULTAS GEO
        </footer>
      </div>
    </div>
  )
}

export default App
