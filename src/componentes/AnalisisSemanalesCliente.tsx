import { useEffect, useRef, useState } from 'react'
import { api } from '../api/clienteApi'
import type { DatosAnalisisSemanal, DatosCliente, DatosCuenta, Pagina } from '../api/tipos'
import { obtenerMensajeError, tienePermiso } from '../utilidades'
import { Aviso, Icono } from './Comun'

const intervaloConsultaMs = 3000

function fechaCalendario(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

function fechaHora(fecha: string | null): string | null {
  if (!fecha) return null
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(fecha))
}

function nombreEstado(estado: DatosAnalisisSemanal['estado']): string {
  const nombres: Record<DatosAnalisisSemanal['estado'], string> = {
    PENDIENTE: 'Pendiente',
    PROCESANDO: 'En proceso',
    FINALIZADO: 'Finalizado',
    FALLIDO: 'Fallido',
    CANCELADO: 'Cancelado',
  }
  return nombres[estado]
}

function ReferenciasEjecuciones({ uuids }: { uuids: string[] }) {
  if (uuids.length === 0) return null
  return (
    <details className="analisis-referencias">
      <summary>{uuids.length} {uuids.length === 1 ? 'ejecución' : 'ejecuciones'} de la muestra</summary>
      <ul>{uuids.map((uuid) => <li key={uuid}><code>{uuid}</code></li>)}</ul>
    </details>
  )
}

function InformeSemanal({ analisis }: { analisis: DatosAnalisisSemanal }) {
  const informe = analisis.informe
  if (!informe) return null

  return (
    <div className="analisis-informe">
      <div className="analisis-resumen">
        <span className="sobrelinea">EN POCAS PALABRAS</span>
        <p>{informe.resumen}</p>
      </div>
      <div className="analisis-columnas">
        <div>
          <h3>Hallazgos <span>{informe.hallazgos.length}</span></h3>
          {informe.hallazgos.length === 0 ? (
            <p className="texto-secundario">No se informaron hallazgos para esta muestra.</p>
          ) : (
            <ol className="analisis-lista">
              {informe.hallazgos.map((hallazgo, indice) => (
                <li key={`${indice}-${hallazgo.descripcion}`}>
                  <p>{hallazgo.descripcion}</p>
                  <ReferenciasEjecuciones uuids={hallazgo.ejecuciones} />
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <h3>Recomendaciones <span>{informe.recomendaciones.length}</span></h3>
          {informe.recomendaciones.length === 0 ? (
            <p className="texto-secundario">No se informaron recomendaciones para esta muestra.</p>
          ) : (
            <ol className="analisis-lista">
              {informe.recomendaciones.map((recomendacion, indice) => (
                <li key={`${indice}-${recomendacion.titulo}`}>
                  <div className="analisis-recomendacion-titulo">
                    <strong>{recomendacion.titulo}</strong>
                    <span className="analisis-prioridad">{recomendacion.prioridad.toLowerCase()}</span>
                  </div>
                  <p>{recomendacion.accion}</p>
                  <ReferenciasEjecuciones uuids={recomendacion.ejecuciones} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

export function AnalisisSemanalesCliente({
  clienteUuid,
  cliente,
  cuenta,
  confirmarAlAbrir = false,
}: {
  clienteUuid: string
  cliente: DatosCliente | null
  cuenta: DatosCuenta
  confirmarAlAbrir?: boolean
}) {
  const puedeVer = tienePermiso(cuenta.permisos, 'ANALISIS_SEMANALES_VER')
  const puedeCrear = cuenta.tipoCuenta === 'ORGANIZACION' &&
    cliente?.estado !== 'ARCHIVADO' && tienePermiso(cuenta.permisos, 'ANALISIS_SEMANALES_CREAR')
  const dialogoConfirmacion = useRef<HTMLDialogElement>(null)
  const [confirmando, cambiarConfirmando] = useState(confirmarAlAbrir && puedeCrear)
  const [confirmacionAceptada, cambiarConfirmacionAceptada] = useState(false)
  const [ultimo, cambiarUltimo] = useState<DatosAnalisisSemanal | null>(null)
  const [cargandoUltimo, cambiarCargandoUltimo] = useState(puedeVer)
  const [errorUltimo, cambiarErrorUltimo] = useState('')
  const [errorSeguimiento, cambiarErrorSeguimiento] = useState('')
  const [revisionUltimo, cambiarRevisionUltimo] = useState(0)
  const [iniciando, cambiarIniciando] = useState(false)
  const [errorInicio, cambiarErrorInicio] = useState('')
  const [historialAbierto, cambiarHistorialAbierto] = useState(false)
  const [pagina, cambiarPagina] = useState(0)
  const [revisionHistorial, cambiarRevisionHistorial] = useState(0)
  const [historial, cambiarHistorial] = useState<Pagina<DatosAnalisisSemanal> | null>(null)
  const [cargandoHistorial, cambiarCargandoHistorial] = useState(false)
  const [errorHistorial, cambiarErrorHistorial] = useState('')
  const [seleccionadoUuid, cambiarSeleccionadoUuid] = useState<string | null>(null)
  const [seleccionado, cambiarSeleccionado] = useState<DatosAnalisisSemanal | null>(null)
  const [cargandoSeleccionado, cambiarCargandoSeleccionado] = useState(false)
  const [errorSeleccionado, cambiarErrorSeleccionado] = useState('')
  const [revisionSeleccionado, cambiarRevisionSeleccionado] = useState(0)
  const ultimoUuid = ultimo?.uuid
  const ultimoEstado = ultimo?.estado

  useEffect(() => {
    const dialogo = dialogoConfirmacion.current
    if (!dialogo) return
    if (confirmando && !dialogo.open) dialogo.showModal()
    if (!confirmando && dialogo.open) dialogo.close()
    return () => { if (dialogo.open) dialogo.close() }
  }, [confirmando])

  useEffect(() => {
    if (!puedeVer) return
    let vigente = true
    api.analisisSemanales.obtenerUltimo(clienteUuid)
      .then((datos) => { if (vigente) cambiarUltimo(datos) })
      .catch((error: unknown) => {
        if (vigente) cambiarErrorUltimo(obtenerMensajeError(error))
      })
      .finally(() => { if (vigente) cambiarCargandoUltimo(false) })
    return () => { vigente = false }
  }, [clienteUuid, puedeVer, revisionUltimo])

  /** Sondea un solo proceso por UUID y espera cada respuesta antes de programar la siguiente. */
  useEffect(() => {
    if (!puedeVer || !ultimoUuid || (ultimoEstado !== 'PENDIENTE' && ultimoEstado !== 'PROCESANDO')) return
    let vigente = true
    let temporizador: ReturnType<typeof setTimeout>
    const uuid = ultimoUuid
    async function consultar() {
      try {
        const datos = await api.analisisSemanales.obtener(clienteUuid, uuid)
        if (!vigente) return
        cambiarUltimo(datos)
        cambiarErrorSeguimiento('')
        if (!['PENDIENTE', 'PROCESANDO'].includes(datos.estado)) {
          if (historialAbierto) cambiarCargandoHistorial(true)
          cambiarRevisionHistorial((actual) => actual + 1)
          return
        }
      } catch (error) {
        if (!vigente) return
        cambiarErrorSeguimiento(obtenerMensajeError(error))
      }
      if (vigente) temporizador = setTimeout(consultar, intervaloConsultaMs)
    }
    temporizador = setTimeout(consultar, intervaloConsultaMs)
    return () => { vigente = false; clearTimeout(temporizador) }
  }, [clienteUuid, puedeVer, ultimoUuid, ultimoEstado, historialAbierto])

  useEffect(() => {
    if (!puedeVer || !historialAbierto) return
    let vigente = true
    api.analisisSemanales.listar(clienteUuid, pagina)
      .then((datos) => { if (vigente) cambiarHistorial(datos) })
      .catch((error: unknown) => {
        if (vigente) cambiarErrorHistorial(obtenerMensajeError(error))
      })
      .finally(() => { if (vigente) cambiarCargandoHistorial(false) })
    return () => { vigente = false }
  }, [clienteUuid, puedeVer, historialAbierto, pagina, revisionHistorial])

  useEffect(() => {
    if (!seleccionadoUuid || !puedeVer) return
    let vigente = true
    api.analisisSemanales.obtener(clienteUuid, seleccionadoUuid)
      .then((datos) => { if (vigente) cambiarSeleccionado(datos) })
      .catch((error: unknown) => {
        if (vigente) cambiarErrorSeleccionado(obtenerMensajeError(error))
      })
      .finally(() => { if (vigente) cambiarCargandoSeleccionado(false) })
    return () => { vigente = false }
  }, [clienteUuid, puedeVer, seleccionadoUuid, revisionSeleccionado])

  function abrirHistorial() {
    if (!historialAbierto) {
      cambiarCargandoHistorial(true)
      cambiarErrorHistorial('')
    }
    cambiarHistorialAbierto(!historialAbierto)
  }

  function irAPagina(siguiente: number) {
    cambiarCargandoHistorial(true)
    cambiarErrorHistorial('')
    cambiarPagina(siguiente)
  }

  function volverAlUltimo() {
    cambiarSeleccionadoUuid(null)
    cambiarSeleccionado(null)
    cambiarCargandoSeleccionado(false)
    cambiarErrorSeleccionado('')
  }

  function verAnalisis(uuid: string) {
    if (uuid === ultimoUuid) {
      volverAlUltimo()
      return
    }
    if (uuid === seleccionadoUuid) return
    cambiarSeleccionado(null)
    cambiarCargandoSeleccionado(true)
    cambiarErrorSeleccionado('')
    cambiarSeleccionadoUuid(uuid)
  }

  function abrirConfirmacion() {
    if (!puedeCrear || iniciando || cargandoUltimo || errorUltimo) return
    cambiarErrorInicio('')
    cambiarConfirmacionAceptada(false)
    cambiarConfirmando(true)
  }

  function cerrarConfirmacion() {
    if (iniciando) return
    cambiarConfirmando(false)
    cambiarConfirmacionAceptada(false)
    cambiarErrorInicio('')
  }

  async function iniciar() {
    if (!puedeCrear || iniciando || cargandoUltimo || errorUltimo || !confirmacionAceptada ||
      ultimo?.estado === 'PENDIENTE' || ultimo?.estado === 'PROCESANDO') return
    cambiarIniciando(true)
    cambiarErrorInicio('')
    try {
      const datos = await api.analisisSemanales.iniciar(clienteUuid)
      cambiarUltimo(datos)
      cambiarErrorUltimo('')
      cambiarErrorSeguimiento('')
      volverAlUltimo()
      cambiarPagina(0)
      if (historialAbierto) cambiarCargandoHistorial(true)
      cambiarRevisionHistorial((actual) => actual + 1)
      cambiarConfirmando(false)
      cambiarConfirmacionAceptada(false)
    } catch (error) {
      cambiarErrorInicio(obtenerMensajeError(error))
    } finally {
      cambiarIniciando(false)
    }
  }

  if (!puedeVer && !puedeCrear) return null

  const enCurso = ultimo?.estado === 'PENDIENTE' || ultimo?.estado === 'PROCESANDO'
  const visible = seleccionadoUuid ? seleccionado : ultimo
  const periodo = visible ? `${fechaCalendario(visible.desde)} al ${fechaCalendario(visible.hasta)}` : null

  return (
    <div className="analisis-panel" aria-labelledby="titulo-analisis-semanal">
      <div className="analisis-cabecera">
        <div className="analisis-identidad">
          <span className="analisis-icono"><Icono nombre="documento" tamano={22} /></span>
          <div>
            <span className="sobrelinea">INFORMES · {cliente?.nombre || 'CLIENTE MONITOREADO'}</span>
            <h1 id="titulo-analisis-semanal">Análisis semanal</h1>
            <p>Hallazgos y recomendaciones de las ejecuciones incluidas en cada período de siete días.</p>
          </div>
        </div>
        {puedeCrear && (
          <button className="boton analisis-boton-crear" type="button" onClick={abrirConfirmacion}
            disabled={iniciando || enCurso || cargandoUltimo || Boolean(errorUltimo)}>
            <Icono nombre={ultimo?.estado === 'FALLIDO' ? 'reactivar' : 'mas'} tamano={17} />
            {enCurso ? 'Análisis en curso' : ultimo?.estado === 'FALLIDO' ? 'Reintentar análisis' : 'Crear análisis'}
          </button>
        )}
      </div>

      {errorUltimo && <Aviso>{errorUltimo}</Aviso>}
      {puedeVer && cargandoUltimo && <p className="texto-secundario">Consultando el último análisis…</p>}
      {puedeVer && errorUltimo && (
        <button type="button" className="boton boton-secundario reintentar"
          onClick={() => {
            cambiarCargandoUltimo(true)
            cambiarErrorUltimo('')
            cambiarRevisionUltimo((actual) => actual + 1)
          }}>Reintentar consulta</button>
      )}
      {puedeVer && !cargandoUltimo && !errorUltimo && !ultimo && !seleccionadoUuid && (
        <div className="analisis-vacio">Todavía no hay análisis para este cliente. Cuando haya ejecuciones finalizadas y normalizadas, podrás generar el primero.</div>
      )}
      {errorSeguimiento && <Aviso>Se interrumpió la actualización del proceso: {errorSeguimiento}. Volveremos a intentar.</Aviso>}
      {cargandoSeleccionado && <p className="texto-secundario">Cargando el análisis seleccionado…</p>}
      {errorSeleccionado && <Aviso>{errorSeleccionado}</Aviso>}
      {errorSeleccionado && (
        <button type="button" className="boton boton-secundario reintentar"
          onClick={() => {
            cambiarCargandoSeleccionado(true)
            cambiarErrorSeleccionado('')
            cambiarRevisionSeleccionado((actual) => actual + 1)
          }}>Reintentar análisis</button>
      )}

      {visible && !cargandoSeleccionado && (
        <section className="analisis-detalle" aria-label="Detalle del análisis semanal">
          <div className="analisis-detalle-cabecera">
            <div>
              <span className="sobrelinea">{seleccionadoUuid ? 'DEL HISTORIAL' : 'ÚLTIMO ANÁLISIS'}</span>
              <h2>{periodo}</h2>
            </div>
            <span className={`analisis-estado analisis-estado-${visible.estado.toLowerCase()}`} role="status">
              {['PENDIENTE', 'PROCESANDO'].includes(visible.estado) && <span className="analisis-pulso" />}
              {nombreEstado(visible.estado)}
            </span>
          </div>
          <dl className="analisis-datos">
            <div><dt>Período analizado</dt><dd>{periodo}</dd></div>
            <div><dt>Inicio del proceso</dt><dd>{fechaHora(visible.fechaInicio) || 'Pendiente'}</dd></div>
            <div><dt>Finalización</dt><dd>{fechaHora(visible.fechaFin) || '—'}</dd></div>
            <div><dt>Intentos</dt><dd>{visible.intentos}</dd></div>
          </dl>
          {['PENDIENTE', 'PROCESANDO'].includes(visible.estado) && (
            <p className="analisis-mensaje">
              {visible.mensaje || 'El informe se está preparando.'} Consultamos su estado cada 3 segundos.
            </p>
          )}
          {['FALLIDO', 'CANCELADO'].includes(visible.estado) && (
            <Aviso>{visible.mensaje || (visible.estado === 'FALLIDO'
              ? 'El análisis no se pudo completar.' : 'El análisis fue cancelado.')}</Aviso>
          )}
          {visible.estado === 'FINALIZADO' && visible.informe && <InformeSemanal analisis={visible} />}
          {visible.estado === 'FINALIZADO' && visible.mensaje && (
            <Aviso tipo="informacion">{visible.mensaje}</Aviso>
          )}
          {visible.estado === 'FINALIZADO' && !visible.informe && (
            <Aviso tipo="informacion">El proceso finalizó, pero todavía no hay un informe disponible.</Aviso>
          )}
        </section>
      )}

      {puedeVer && (
        <section className="analisis-historial" aria-label="Historial de análisis semanales">
          <div className="analisis-historial-cabecera">
            <button type="button" className="analisis-alternar" aria-expanded={historialAbierto}
              onClick={abrirHistorial}>
              Historial de análisis <span aria-hidden="true">{historialAbierto ? '−' : '+'}</span>
            </button>
            {seleccionadoUuid && (
              <button type="button" className="boton boton-secundario" onClick={volverAlUltimo}>
                Volver al último
              </button>
            )}
          </div>
          {historialAbierto && (
            <div className="analisis-historial-contenido">
              {cargandoHistorial && <p className="texto-secundario">Cargando historial…</p>}
              {errorHistorial && (
                <div><Aviso>{errorHistorial}</Aviso>
                  <button type="button" className="boton boton-secundario reintentar"
                    onClick={() => {
                      cambiarCargandoHistorial(true)
                      cambiarErrorHistorial('')
                      cambiarRevisionHistorial((actual) => actual + 1)
                    }}>Reintentar</button>
                </div>
              )}
              {!cargandoHistorial && !errorHistorial && historial && (
                <>
                  {historial.content.length === 0 ? (
                    <p className="texto-secundario">No hay análisis en esta página.</p>
                  ) : (
                    <ul className="analisis-historial-lista">
                      {historial.content.map((analisis) => (
                        <li key={analisis.uuid}>
                          <button type="button" className={seleccionadoUuid === analisis.uuid ? 'analisis-historial-activo' : ''}
                            aria-current={seleccionadoUuid === analisis.uuid ? 'true' : undefined}
                            onClick={() => verAnalisis(analisis.uuid)}>
                            <span><strong>{fechaCalendario(analisis.desde)} al {fechaCalendario(analisis.hasta)}</strong>
                              <small>{fechaHora(analisis.fechaInicio) || 'Sin fecha de inicio'}</small></span>
                            <span className={`analisis-estado analisis-estado-${analisis.estado.toLowerCase()}`}>
                              {nombreEstado(analisis.estado)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {historial.totalPages > 1 && (
                    <div className="analisis-paginacion">
                      <button type="button" className="boton boton-secundario" disabled={pagina === 0}
                        onClick={() => irAPagina(pagina - 1)}>Anterior</button>
                      <span>Página {historial.number + 1} de {historial.totalPages}</span>
                      <button type="button" className="boton boton-secundario"
                        disabled={pagina + 1 >= historial.totalPages}
                        onClick={() => irAPagina(pagina + 1)}>Siguiente</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      )}
      <dialog ref={dialogoConfirmacion} className="analisis-confirmacion"
        aria-labelledby="analisis-confirmacion-titulo"
        onCancel={(evento) => {
          evento.preventDefault()
          cerrarConfirmacion()
        }}>
        <div className="analisis-confirmacion-icono"><Icono nombre="documento" tamano={24} /></div>
        <span className="sobrelinea">CONFIRMAR NUEVO ANÁLISIS</span>
        <h2 id="analisis-confirmacion-titulo">
          {ultimo?.estado === 'FALLIDO' ? '¿Reintentar el análisis semanal?' : '¿Crear un análisis semanal?'}
        </h2>
        <p>{ultimo?.estado === 'FALLIDO'
          ? 'Se retomará el proceso con la misma muestra de ejecuciones para '
          : 'Se analizarán las ejecuciones disponibles de los últimos siete días calendario de Argentina, incluido hoy, para '}
          <strong>{cliente?.nombre || 'este cliente'}</strong>.</p>
        <div className="analisis-confirmacion-nota">
          <strong>Antes de continuar</strong>
          <span>El informe puede incluir datos parciales. Si no hay ejecuciones finalizadas y normalizadas, o el plan todavía no permite uno nuevo, verás el motivo indicado por el servidor.</span>
        </div>
        {enCurso && <Aviso tipo="informacion">Ya hay un análisis en curso. Su estado se actualizará aquí.</Aviso>}
        {cliente?.estado === 'ARCHIVADO' && <Aviso tipo="informacion">Este cliente está archivado y no puede iniciar un análisis.</Aviso>}
        {errorUltimo && <Aviso>Primero volvé a consultar el último análisis para confirmar que no haya otro en curso.</Aviso>}
        {errorInicio && <Aviso>{errorInicio}</Aviso>}
        <label className="analisis-confirmacion-aceptar">
          <input type="checkbox" checked={confirmacionAceptada} disabled={iniciando || enCurso || !puedeCrear || Boolean(errorUltimo)}
            onChange={(evento) => cambiarConfirmacionAceptada(evento.target.checked)} />
          <span>Revisé el cliente y quiero iniciar este análisis.</span>
        </label>
        <div className="analisis-confirmacion-acciones">
          <button type="button" className="boton boton-secundario" onClick={cerrarConfirmacion} disabled={iniciando}>Cancelar</button>
          <button type="button" className="boton boton-primario" onClick={iniciar}
            disabled={!puedeCrear || !confirmacionAceptada || iniciando || cargandoUltimo || Boolean(errorUltimo) || enCurso}>
            {iniciando ? 'Iniciando…' : ultimo?.estado === 'FALLIDO' ? 'Reintentar análisis' : 'Crear análisis'}
          </button>
        </div>
      </dialog>
    </div>
  )
}
