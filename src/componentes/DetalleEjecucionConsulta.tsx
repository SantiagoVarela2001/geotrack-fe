import { useEffect, useRef, useState } from 'react'
import { ErrorApi, api } from '../api/clienteApi'
import type { DatosCliente, DatosConsulta, DatosCuenta, DatosEjecucionConsulta } from '../api/tipos'
import { obtenerMensajeError, tienePermiso, urlWebSegura } from '../utilidades'
import { Aviso, Icono } from './Comun'

const numero = new Intl.NumberFormat('es-AR')
const fecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
const segundos = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
const importe = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 8,
})
const nombresEstado: Record<DatosEjecucionConsulta['estado'], string> = {
  PENDIENTE: 'En espera',
  PROCESANDO: 'Procesando',
  FINALIZADO: 'Finalizada',
  FALLIDO: 'Fallida',
}

/** Da una explicación útil para los estados HTTP específicos de la ejecución. */
function mensajeErrorEjecucion(causa: unknown): string {
  if (causa instanceof ErrorApi) {
    if (causa.estado === 403) return 'Tu cuenta no tiene permiso para esta acción.'
    if (causa.estado === 404) return 'La consulta o la ejecución ya no está disponible.'
    if (causa.estado === 409) return 'La consulta o el cliente ya no están aptos para ejecutar.'
    if (causa.estado === 503) return 'La integración de OpenAI no está configurada.'
  }
  return obtenerMensajeError(causa)
}

function datoNumerico(valor: number | null | undefined): string {
  return valor == null ? '—' : numero.format(valor)
}

/** La respuesta original y el análisis de marca pueden terminar en momentos distintos. */
function tieneTrabajoPendiente(datos: DatosEjecucionConsulta | null): boolean {
  return (
    datos?.estado === 'PENDIENTE' ||
    datos?.estado === 'PROCESANDO' ||
    (datos?.estado === 'FINALIZADO' &&
      (datos.estadoNormalizacion === 'PENDIENTE' ||
        datos.estadoNormalizacion === 'PROCESANDO'))
  )
}

/** Sin CLIENTES_VER no se lee el cliente; el backend valida su estado al ejecutar. */
function puedeIniciarConsulta(
  cuenta: DatosCuenta,
  cliente: DatosCliente | null,
  consulta: DatosConsulta | null,
): boolean {
  return (
    cuenta.tipoCuenta === 'ORGANIZACION' &&
    tienePermiso(cuenta.permisos, 'CONSULTAS_EJECUTAR') &&
    cliente?.estado !== 'ARCHIVADO' &&
    consulta?.estadoConsulta === 'APROBADA'
  )
}

/** La ejecución histórica sigue disponible aunque la consulta actual haya sido dada de baja. */
async function cargarDatosPagina(
  clienteUuid: string,
  temaUuid: string,
  consultaUuid: string,
  puedeVerCliente: boolean,
) {
  const [ultima, cliente, consulta] = await Promise.allSettled([
    api.ejecuciones.obtenerUltima(clienteUuid, consultaUuid),
    puedeVerCliente ? api.clientes.obtener(clienteUuid) : Promise.resolve(null),
    api.consultas.obtener(clienteUuid, temaUuid, consultaUuid),
  ])
  if (ultima.status === 'rejected') throw ultima.reason
  if (consulta.status === 'rejected' && !ultima.value) throw consulta.reason
  return {
    ejecucion: ultima.value,
    cliente: cliente.status === 'fulfilled' ? cliente.value : null,
    consulta: consulta.status === 'fulfilled' ? consulta.value : null,
    errorContexto:
      cliente.status === 'rejected' ||
      (consulta.status === 'rejected' &&
        !(consulta.reason instanceof ErrorApi && consulta.reason.estado === 404)),
  }
}

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt>{etiqueta}</dt>
      <dd>{valor}</dd>
    </div>
  )
}

export function DetalleEjecucionConsulta({
  clienteUuid,
  temaUuid,
  consultaUuid,
  cuenta,
  iniciarAlAbrir = false,
  alVolver,
}: {
  clienteUuid: string
  temaUuid: string
  consultaUuid: string
  cuenta: DatosCuenta
  iniciarAlAbrir?: boolean
  alVolver: () => void
}) {
  const abierto = useRef(true)
  const inicioAlAbrirEnviado = useRef(false)
  const [cliente, cambiarCliente] = useState<DatosCliente | null>(null)
  const [consulta, cambiarConsulta] = useState<DatosConsulta | null>(null)
  const [ejecucion, cambiarEjecucion] = useState<DatosEjecucionConsulta | null>(null)
  const [cargandoUltima, cambiarCargandoUltima] = useState(true)
  const [iniciando, cambiarIniciando] = useState(iniciarAlAbrir)
  const [consultandoEstado, cambiarConsultandoEstado] = useState(false)
  const [sondeoPausado, cambiarSondeoPausado] = useState(false)
  const [cargaFallida, cambiarCargaFallida] = useState(false)
  const [errorContexto, cambiarErrorContexto] = useState(false)
  const [error, cambiarError] = useState('')
  const puedeEjecutar = puedeIniciarConsulta(cuenta, cliente, consulta)
  const enCurso = ejecucion?.estado === 'PENDIENTE' || ejecucion?.estado === 'PROCESANDO'
  const normalizacionEnCurso =
    ejecucion?.estado === 'FINALIZADO' &&
    (ejecucion.estadoNormalizacion === 'PENDIENTE' ||
      ejecucion.estadoNormalizacion === 'PROCESANDO')
  const procesoEnCurso = tieneTrabajoPendiente(ejecucion)
  const ejecucionUuid = ejecucion?.uuid

  useEffect(() => {
    abierto.current = true
    window.scrollTo(0, 0)
    const tituloAnterior = document.title
    document.title = 'Resultado de consulta · Gelaia'
    return () => {
      abierto.current = false
      document.title = tituloAnterior
    }
  }, [])

  /** Al abrir el detalle recupera el último intento desde el servidor. */
  useEffect(() => {
    let vigente = true
    cargarDatosPagina(
      clienteUuid,
      temaUuid,
      consultaUuid,
      tienePermiso(cuenta.permisos, 'CLIENTES_VER'),
    )
      .then((datos) => {
        if (vigente) {
          cambiarEjecucion(datos.ejecucion)
          cambiarCliente(datos.cliente)
          cambiarConsulta(datos.consulta)
          cambiarErrorContexto(datos.errorContexto)
          cambiarError('')
          cambiarCargaFallida(false)
          if (
            iniciarAlAbrir &&
            (!puedeIniciarConsulta(cuenta, datos.cliente, datos.consulta) ||
              tieneTrabajoPendiente(datos.ejecucion))
          ) {
            cambiarIniciando(false)
          }
        }
      })
      .catch((causa) => {
        if (vigente) {
          cambiarError(mensajeErrorEjecucion(causa))
          cambiarCargaFallida(true)
          cambiarIniciando(false)
        }
      })
      .finally(() => {
        if (vigente) cambiarCargandoUltima(false)
      })
    return () => {
      vigente = false
    }
  }, [clienteUuid, temaUuid, consultaUuid, cuenta, iniciarAlAbrir])

  /** El acceso directo primero recupera el intento actual y evita duplicar uno todavía activo. */
  useEffect(() => {
    if (
      !iniciarAlAbrir ||
      !puedeEjecutar ||
      cargandoUltima ||
      cargaFallida ||
      inicioAlAbrirEnviado.current
    ) return
    inicioAlAbrirEnviado.current = true
    if (procesoEnCurso) return

    api.ejecuciones
      .iniciar(clienteUuid, consultaUuid)
      .then((iniciada) => {
        if (!abierto.current) return
        cambiarEjecucion(iniciada)
        cambiarSondeoPausado(false)
      })
      .catch((causa) => {
        if (abierto.current) cambiarError(mensajeErrorEjecucion(causa))
      })
      .finally(() => {
        if (abierto.current) cambiarIniciando(false)
      })
  }, [clienteUuid, consultaUuid, iniciarAlAbrir, puedeEjecutar, cargandoUltima, cargaFallida, procesoEnCurso])

  /** Mantiene el sondeo hasta que terminen tanto la respuesta como su normalización. */
  useEffect(() => {
    if (sondeoPausado || !procesoEnCurso || !ejecucionUuid) return

    let vigente = true
    let solicitudPendiente = false
    const uuid = ejecucionUuid
    const intervalo = window.setInterval(async () => {
      if (solicitudPendiente) return
      solicitudPendiente = true
      try {
        const actualizada = await api.ejecuciones.obtener(clienteUuid, uuid)
        if (!vigente) return
        cambiarEjecucion(actualizada)
        cambiarError('')
      } catch (causa) {
        if (!vigente) return
        cambiarError(mensajeErrorEjecucion(causa))
        cambiarSondeoPausado(true)
      } finally {
        solicitudPendiente = false
      }
    }, 3000)

    return () => {
      vigente = false
      window.clearInterval(intervalo)
    }
  }, [clienteUuid, ejecucionUuid, procesoEnCurso, sondeoPausado])

  /** El POST no envía body; el backend devuelve el intento activo si ya existe. */
  async function iniciar() {
    if (!puedeEjecutar || iniciando || cargandoUltima || cargaFallida || consultandoEstado) return
    if (procesoEnCurso) return
    cambiarIniciando(true)
    cambiarError('')
    try {
      const iniciada = await api.ejecuciones.iniciar(clienteUuid, consultaUuid)
      if (!abierto.current) return
      cambiarEjecucion(iniciada)
      cambiarSondeoPausado(false)
    } catch (causa) {
      if (abierto.current) cambiarError(mensajeErrorEjecucion(causa))
    } finally {
      if (abierto.current) cambiarIniciando(false)
    }
  }

  /** Permite reanudar la consulta del estado después de un error de red o API. */
  async function actualizarEstado() {
    if (!ejecucion || consultandoEstado) return
    cambiarConsultandoEstado(true)
    cambiarError('')
    try {
      const actualizada = await api.ejecuciones.obtener(clienteUuid, ejecucion.uuid)
      if (!abierto.current) return
      cambiarEjecucion(actualizada)
      cambiarSondeoPausado(false)
    } catch (causa) {
      if (abierto.current) cambiarError(mensajeErrorEjecucion(causa))
    } finally {
      if (abierto.current) cambiarConsultandoEstado(false)
    }
  }

  async function reintentarCarga() {
    cambiarCargandoUltima(true)
    cambiarIniciando(iniciarAlAbrir)
    cambiarError('')
    cambiarErrorContexto(false)
    try {
      const datos = await cargarDatosPagina(
        clienteUuid,
        temaUuid,
        consultaUuid,
        tienePermiso(cuenta.permisos, 'CLIENTES_VER'),
      )
      if (!abierto.current) return
      cambiarEjecucion(datos.ejecucion)
      cambiarCliente(datos.cliente)
      cambiarConsulta(datos.consulta)
      cambiarErrorContexto(datos.errorContexto)
      cambiarSondeoPausado(false)
      cambiarCargaFallida(false)
      if (
        iniciarAlAbrir &&
        (!puedeIniciarConsulta(cuenta, datos.cliente, datos.consulta) ||
          tieneTrabajoPendiente(datos.ejecucion))
      ) {
        cambiarIniciando(false)
      }
    } catch (causa) {
      if (abierto.current) {
        cambiarError(mensajeErrorEjecucion(causa))
        cambiarCargaFallida(true)
        cambiarIniciando(false)
      }
    } finally {
      if (abierto.current) cambiarCargandoUltima(false)
    }
  }

  const estadoTexto = ejecucion
    ? normalizacionEnCurso
      ? 'Respuesta lista · analizando marca'
      : nombresEstado[ejecucion.estado]
    : iniciando
      ? 'Iniciando'
      : 'Sin ejecuciones'
  const motivoNoEjecutable = !consulta
    ? ejecucion
      ? errorContexto
        ? 'No se pudo verificar si la consulta sigue disponible para ejecutar.'
        : 'La consulta actual ya no está disponible para volver a ejecutarla.'
      : null
    : consulta.estadoConsulta !== 'APROBADA'
      ? 'Aprobá la consulta para poder ejecutarla.'
      : cliente?.estado === 'ARCHIVADO'
        ? 'El cliente debe estar activo para ejecutar consultas.'
        : !tienePermiso(cuenta.permisos, 'CONSULTAS_EJECUTAR')
          ? 'Tu cuenta no tiene permiso para ejecutar consultas.'
          : null

  return (
    <div className="pagina-ejecucion" aria-labelledby="pagina-ejecucion-titulo">
      <button className="enlace-volver" type="button" onClick={alVolver}>
        <Icono nombre="volver" tamano={17} /> Volver al tema
      </button>
      <header className="ejecucion-cabecera">
        <div>
          <span className="sobrelinea">EJECUCIÓN MANUAL</span>
          <h1 id="pagina-ejecucion-titulo">Resultado de la consulta</h1>
          <p>Leé la respuesta, el análisis de marca y las fuentes del último intento.</p>
        </div>
      </header>

      {((procesoEnCurso && sondeoPausado) || (puedeEjecutar && !procesoEnCurso)) && (
        <div className="ejecucion-acciones">
          {procesoEnCurso && sondeoPausado && (
            <button
              className="boton boton-secundario"
              type="button"
              onClick={actualizarEstado}
              disabled={consultandoEstado}
            >
              {consultandoEstado ? 'Actualizando…' : 'Actualizar estado'}
            </button>
          )}
          {puedeEjecutar && !procesoEnCurso && (
            <button
              className="boton boton-primario"
              type="button"
              onClick={iniciar}
              disabled={iniciando || cargandoUltima || cargaFallida}
            >
              {iniciando ? 'Iniciando…' : ejecucion ? 'Volver a ejecutar' : 'Ejecutar'}
              {!iniciando && <Icono nombre="flecha" tamano={16} />}
            </button>
          )}
        </div>
      )}

      <div className="ejecucion-cuerpo">
        {(ejecucion || consulta) && (
          <div className="ejecucion-consulta">
            <span>
              {(ejecucion?.tipoConsulta ?? consulta?.tipoConsulta) === 'REFERENCIA'
                ? 'Referencia'
                : 'Descubrimiento'}
            </span>
            {ejecucion && <small>{ejecucion.nombreTema}</small>}
            <p>{ejecucion?.textoConsulta ?? consulta?.texto}</p>
          </div>
        )}
        {motivoNoEjecutable && <Aviso tipo="informacion">{motivoNoEjecutable}</Aviso>}
        {errorContexto && (
          <div>
            <Aviso tipo="informacion">
              No se pudo comprobar el estado actual del cliente o la consulta.
              {ejecucion && ' La ejecución guardada sigue disponible para lectura.'}
            </Aviso>
            <button className="boton boton-secundario reintentar" type="button" onClick={reintentarCarga}>
              Reintentar datos
            </button>
          </div>
        )}

        {cargandoUltima ? (
          <div className="cargando-bloque" role="status">
            Recuperando última ejecución…
          </div>
        ) : (
          <>
            {error && <Aviso>{error}</Aviso>}
            {cargaFallida && (
              <button className="boton boton-secundario" type="button" onClick={reintentarCarga}>
                Reintentar carga
              </button>
            )}

            {!cargaFallida && (
              <div className="ejecucion-estado-barra">
                <span
                  className={`ejecucion-estado ejecucion-estado-${ejecucion?.estado.toLowerCase() ?? 'vacio'}`}
                >
                  {enCurso && <span className="ejecucion-pulso" aria-hidden="true" />}
                  {estadoTexto}
                </span>
                {ejecucion && (
                  <div className="ejecucion-metadatos">
                    <span>{ejecucion.proveedor} · {ejecucion.modelo}</span>
                    {ejecucion.fechaInicio && <span>{fecha.format(new Date(ejecucion.fechaInicio))}</span>}
                    {ejecucion.duracionMs !== null && (
                      <span>Duración: {segundos.format(ejecucion.duracionMs / 1000)} s</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {enCurso && (
              <div className="ejecucion-progreso" role="status">
                <span className="ejecucion-progreso-linea" aria-hidden="true" />
                <strong>
                  {ejecucion?.estado === 'PENDIENTE'
                    ? 'Preparando la ejecución'
                    : 'Analizando la consulta'}
                </strong>
                <p>
                  Se están consultando fuentes y elaborando la respuesta. Podés volver al tema y
                  consultar el estado más tarde.
                </p>
              </div>
            )}

            {iniciando && !ejecucion && (
              <div className="ejecucion-progreso" role="status">
                <span className="ejecucion-progreso-linea" aria-hidden="true" />
                <strong>Iniciando la ejecución</strong>
                <p>Estamos preparando el intento para esta consulta.</p>
              </div>
            )}

            {ejecucion?.estado === 'FALLIDO' && (
              <Aviso>
                {ejecucion.mensaje || 'La ejecución no pudo completarse. Podés volver a intentarlo.'}
              </Aviso>
            )}

            {ejecucion?.resultadoNormalizado && (
              <section className="ejecucion-resumen" aria-label="Resumen del análisis">
                <div>
                  <span>Marca</span>
                  <strong>
                    {ejecucion.resultadoNormalizado.marcaMencionada
                      ? 'Mencionada'
                      : 'No mencionada'}
                  </strong>
                </div>
                <div>
                  <span>Posición</span>
                  <strong>
                    {ejecucion.resultadoNormalizado.posicionMarca === null
                      ? 'Sin clasificación'
                      : numero.format(ejecucion.resultadoNormalizado.posicionMarca)}
                  </strong>
                </div>
                <div>
                  <span>Competidores mencionados</span>
                  <strong>
                    {ejecucion.resultadoNormalizado.competidores.filter((item) => item.mencionado).length}
                    {' de '}
                    {ejecucion.resultadoNormalizado.competidores.length}
                  </strong>
                </div>
              </section>
            )}

            {ejecucion?.estado === 'FINALIZADO' && (
              <>
                <section className="ejecucion-respuesta">
                  <span className="sobrelinea">RESPUESTA</span>
                  <p>{ejecucion.respuestaTexto || 'La ejecución finalizó sin texto de respuesta.'}</p>
                </section>
                {ejecucion.citas.length > 0 && (
                  <section className="ejecucion-fuentes">
                    <h3>Fuentes citadas</h3>
                    <ul>
                      {ejecucion.citas.map((cita, indice) => {
                        const url = urlWebSegura(cita.url)
                        if (!url) return null
                        const dominio = new URL(url).hostname
                        return (
                          <li key={`${cita.url}-${indice}`}>
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <span>{cita.titulo || dominio}</span>
                              <small>{dominio}</small>
                            </a>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}
              </>
            )}

            {ejecucion?.estado === 'FINALIZADO' && (
              <section className="ejecucion-analisis">
                <div className="ejecucion-analisis-cabecera">
                  <h3>Análisis de marca</h3>
                  {ejecucion.resultadoNormalizado && (
                    <small>Modelo: {ejecucion.resultadoNormalizado.modeloNormalizador}</small>
                  )}
                </div>

                {normalizacionEnCurso && (
                  <div className="ejecucion-progreso" role="status">
                    <span className="ejecucion-progreso-linea" aria-hidden="true" />
                    <strong>
                      {ejecucion.estadoNormalizacion === 'PENDIENTE'
                        ? 'Preparando el análisis de marca'
                        : 'Analizando menciones y posiciones'}
                    </strong>
                    <p>La respuesta ya está disponible. El análisis se actualizará automáticamente.</p>
                  </div>
                )}
                {ejecucion.estadoNormalizacion === 'FALLIDA' && (
                  <Aviso>
                    {ejecucion.mensajeNormalizacion ||
                      'No se pudo completar el análisis de marca. La respuesta original sigue disponible.'}
                  </Aviso>
                )}
                {ejecucion.estadoNormalizacion === 'NO_REALIZADA' && (
                  <p className="ejecucion-vacio">Esta ejecución no incluye análisis de marca.</p>
                )}
                {ejecucion.estadoNormalizacion === 'FINALIZADA' &&
                  !ejecucion.resultadoNormalizado && (
                    <p className="ejecucion-vacio">No se recibieron datos del análisis de marca.</p>
                  )}

                {ejecucion.resultadoNormalizado && (
                  <>
                    <div className="ejecucion-analisis-entidad">
                      <span>Marca</span>
                      <strong>{ejecucion.resultadoNormalizado.nombreMarca}</strong>
                      <span>
                        {ejecucion.resultadoNormalizado.marcaMencionada
                          ? 'Mencionada'
                          : 'No mencionada'}
                        {' · '}
                        {ejecucion.resultadoNormalizado.posicionMarca === null
                          ? 'Sin posición determinada'
                          : `Posición ${numero.format(ejecucion.resultadoNormalizado.posicionMarca)}`}
                      </span>
                      {ejecucion.resultadoNormalizado.evidenciaMarca && (
                        <p>{ejecucion.resultadoNormalizado.evidenciaMarca}</p>
                      )}
                    </div>

                    {ejecucion.resultadoNormalizado.competidores.length > 0 && (
                      <div className="ejecucion-analisis-competidores">
                        <h4>Competidores configurados</h4>
                        <ul>
                          {ejecucion.resultadoNormalizado.competidores.map((competidor) => (
                            <li key={competidor.competidorUuid} className="ejecucion-analisis-entidad">
                              <strong>{competidor.nombreCompetidor}</strong>
                              <span>
                                {competidor.mencionado ? 'Mencionado' : 'No mencionado'}
                                {' · '}
                                {competidor.posicion === null
                                  ? 'Sin posición determinada'
                                  : `Posición ${numero.format(competidor.posicion)}`}
                              </span>
                              {competidor.evidencia && <p>{competidor.evidencia}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {ejecucion.resultadoNormalizado.fuentes.length > 0 && (
                      <div className="ejecucion-fuentes">
                        <h4>Fuentes del análisis</h4>
                        <ul>
                          {ejecucion.resultadoNormalizado.fuentes.map((fuente, indice) => {
                            const url = urlWebSegura(fuente.url)
                            if (!url) return null
                            return (
                              <li key={`${fuente.url}-${indice}`}>
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                  <span>{fuente.titulo || fuente.dominio}</span>
                                  <small>{fuente.dominio}</small>
                                </a>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {ejecucion && !enCurso && (
              <section className="ejecucion-metricas">
                <h3>Uso de la ejecución</h3>
                <dl>
                  <Metrica etiqueta="Búsquedas" valor={datoNumerico(ejecucion.cantidadBusquedas)} />
                  <Metrica
                    etiqueta="Llamadas web"
                    valor={datoNumerico(ejecucion.cantidadLlamadasWeb)}
                  />
                  {ejecucion.tokensEntrada !== undefined && (
                    <Metrica etiqueta="Tokens de entrada" valor={datoNumerico(ejecucion.tokensEntrada)} />
                  )}
                  {ejecucion.tokensSalida !== undefined && (
                    <Metrica etiqueta="Tokens de salida" valor={datoNumerico(ejecucion.tokensSalida)} />
                  )}
                  {ejecucion.costoEstimadoUsd !== undefined && (
                    <Metrica
                      etiqueta="Costo estimado"
                      valor={
                        ejecucion.costoEstimadoUsd === null
                          ? '—'
                          : importe.format(ejecucion.costoEstimadoUsd)
                      }
                    />
                  )}
                </dl>
              </section>
            )}

            {!ejecucion && !error && !iniciando && (
              <p className="ejecucion-vacio">Esta consulta todavía no tiene ejecuciones.</p>
            )}
          </>
        )}
      </div>

    </div>
  )
}
