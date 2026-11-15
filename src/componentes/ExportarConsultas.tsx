import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ErrorApi } from '../api/clienteApi'
import type { DatosExportacionConsultas } from '../api/tipos'
import { fechaAccionLegible, hoyArgentina } from '../accionesCliente'
import { archivoExportacionVigente, exportacionEnCurso, fechaDesdeExportacion, guardarExcel, seguirExportacion,
  validarPeriodoExportacion } from '../exportaciones'
import { obtenerMensajeError } from '../utilidades'
import { Aviso, Icono } from './Comun'

/** Mantiene el acceso en la misma barra de acciones y monta el seguimiento solo al abrirlo. */
export function ExportarConsultas({ clienteUuid, permitido }: { clienteUuid: string; permitido: boolean }) {
  const [abierto, cambiarAbierto] = useState(false)
  if (!permitido) return null
  return <>
    <button type="button" className="boton boton-secundario boton-chico detalle-accion detalle-accion-exportar"
      onClick={() => cambiarAbierto(true)}>
      <Icono nombre="descargar" tamano={18} /><span>Exportar histórico</span>
    </button>
    {abierto && <DialogoExportarConsultas key={clienteUuid} clienteUuid={clienteUuid}
      alCerrar={() => cambiarAbierto(false)} />}
  </>
}

/** Recupera el proceso del servidor y permite preparar o descargar el histórico del cliente. */
export function DialogoExportarConsultas({ clienteUuid, alCerrar }: { clienteUuid: string; alCerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const solicitudes = useRef<AbortController | null>(null)
  const [desde, cambiarDesde] = useState('')
  const [proceso, cambiarProceso] = useState<DatosExportacionConsultas | null>(null)
  const [cargando, cambiarCargando] = useState(true)
  const [enviando, cambiarEnviando] = useState(false)
  const [descargando, cambiarDescargando] = useState(false)
  const [error, cambiarError] = useState('')
  const [mensajeDescarga, cambiarMensajeDescarga] = useState('')
  const hasta = hoyArgentina()
  const enCurso = exportacionEnCurso(proceso)
  const disponible = archivoExportacionVigente(proceso)

  /** El servidor conserva el proceso; cerrar la ventana solo cancela su seguimiento en el navegador. */
  useEffect(() => {
    const elemento = dialogo.current!
    const controlador = new AbortController()
    solicitudes.current = controlador
    elemento.showModal()
    void api.exportaciones.obtener(clienteUuid, controlador.signal).then((actual) => {
      if (controlador.signal.aborted) return
      cambiarProceso(actual)
      if (actual) cambiarDesde(actual.desde)
    }).catch((causa: unknown) => {
      if (!controlador.signal.aborted) cambiarError(obtenerMensajeError(causa))
    }).finally(() => {
      if (!controlador.signal.aborted) cambiarCargando(false)
    })
    return () => {
      controlador.abort()
      if (elemento.open) elemento.close()
    }
  }, [clienteUuid])

  /** El seguimiento dura únicamente mientras el proceso está abierto y todavía trabaja. */
  useEffect(() => {
    if (!enCurso) return
    const controlador = new AbortController()
    void seguirExportacion(() => api.exportaciones.obtener(clienteUuid, controlador.signal),
      cambiarProceso, controlador.signal).catch((causa: unknown) => {
      if (!controlador.signal.aborted) cambiarError(obtenerMensajeError(causa))
    })
    return () => controlador.abort()
  }, [clienteUuid, enCurso, proceso?.procesoUuid])

  /** Envía fechas concretas; el backend decide si reutiliza un archivo o inicia la preparación. */
  async function preparar(evento: FormEvent) {
    evento.preventDefault()
    if (cargando || enviando || enCurso) return
    const fechas = { desde, hasta: hoyArgentina() }
    const motivo = validarPeriodoExportacion(fechas.desde, fechas.hasta)
    cambiarError(motivo ?? '')
    cambiarMensajeDescarga('')
    if (motivo) return
    const senal = solicitudes.current!.signal
    cambiarEnviando(true)
    try {
      const actual = await api.exportaciones.iniciar(clienteUuid, fechas, senal)
      if (!senal.aborted) cambiarProceso(actual)
    } catch (causa) {
      if (senal.aborted) return
      cambiarError(obtenerMensajeError(causa))
      if (causa instanceof ErrorApi && causa.estado === 409) {
        try {
          const actual = await api.exportaciones.obtener(clienteUuid, senal)
          if (!senal.aborted) cambiarProceso(actual)
        } catch { /* Conserva el conflicto original y permite volver a abrir el seguimiento. */ }
      }
    } finally {
      if (!senal.aborted) cambiarEnviando(false)
    }
  }

  /** Descarga la versión identificada, conservando autenticación y renovación del JWT. */
  async function descargar() {
    if (!proceso?.archivoUuid || !archivoExportacionVigente(proceso) || descargando) return
    const actual = proceso
    const senal = solicitudes.current!.signal
    cambiarDescargando(true)
    cambiarError('')
    cambiarMensajeDescarga('')
    try {
      const archivo = await api.exportaciones.descargar(clienteUuid, actual.archivoUuid!, senal)
      if (!senal.aborted) {
        guardarExcel(archivo, 'historico_' + actual.archivoDesde + '_' + actual.archivoHasta + '.xlsx')
        cambiarMensajeDescarga('La descarga del Excel está lista.')
      }
    } catch (causa) {
      if (senal.aborted) return
      cambiarError(obtenerMensajeError(causa))
      if (causa instanceof ErrorApi && causa.estado === 410) {
        cambiarProceso((anterior) => anterior ? { ...anterior, archivoUuid: null, urlDescarga: null, venceEn: null } : null)
      }
    } finally {
      if (!senal.aborted) cambiarDescargando(false)
    }
  }

  return <dialog ref={dialogo} className="dialogo-tipo formulario-accion dialogo-exportacion"
    aria-labelledby="exportacion-titulo" aria-describedby="exportacion-descripcion"
    onCancel={(evento) => { evento.preventDefault(); alCerrar() }}>
    <form className="dialogo-tipo-contenido" onSubmit={preparar}>
      <div className="dialogo-tipo-icono exportacion-icono"><Icono nombre="descargar" tamano={22} /></div>
      <span className="sobrelinea">HISTÓRICO DE CONSULTAS</span>
      <h2 id="exportacion-titulo">Exportar a Excel</h2>
      <p id="exportacion-descripcion">Reuní las preguntas, respuestas y análisis completados en un solo archivo.</p>
      <fieldset disabled={cargando || enviando || enCurso}>
        <label htmlFor="exportacion-desde">Desde</label>
        <input id="exportacion-desde" type="date" required max={hasta} value={desde} autoFocus
          onChange={(evento) => cambiarDesde(evento.target.value)} />
        <div className="exportacion-periodos" role="group" aria-label="Selección rápida de fecha desde">
          {([15, 30] as const).map((dias) => {
            const fecha = fechaDesdeExportacion(dias, hasta)
            return <button key={dias} type="button" className="boton boton-secundario boton-chico"
              aria-pressed={desde === fecha} onClick={() => cambiarDesde(fecha)}>
              Últimos {dias} días
            </button>
          })}
        </div>
        <label htmlFor="exportacion-hasta">Hasta</label>
        <input id="exportacion-hasta" type="date" value={hasta} readOnly />
        <small>Incluye hoy, según el horario de Argentina.</small>
      </fieldset>
      {cargando && <Aviso tipo="informacion">Consultando el histórico disponible…</Aviso>}
      {enCurso && <Aviso tipo="informacion">
        {proceso?.estado === 'PENDIENTE' ? 'La exportación está en espera.' : 'Estamos preparando tu Excel.'}
        {' '}Período: {fechaAccionLegible(proceso!.desde)} al {fechaAccionLegible(proceso!.hasta)}.
        {' '}Podés cerrar esta ventana y volver cuando quieras.
      </Aviso>}
      {proceso?.estado === 'SIN_DATOS' && <Aviso tipo="informacion">{proceso.mensaje || 'Sin datos para exportar en ese período.'}</Aviso>}
      {proceso?.estado === 'FALLIDO' && <Aviso>{proceso.mensaje || 'La exportación no se completó. Podés solicitarla nuevamente.'}</Aviso>}
      {proceso?.estado === 'VENCIDO' && <Aviso tipo="informacion">La descarga anterior venció. Podés preparar otro Excel.</Aviso>}
      {disponible && proceso && <section className="exportacion-resultado" aria-label="Excel disponible">
        <strong>Excel disponible</strong>
        <p>{fechaAccionLegible(proceso.archivoDesde!)} al {fechaAccionLegible(proceso.archivoHasta!)}
          {' · '}{proceso.cantidadFilas} {proceso.cantidadFilas === 1 ? 'respuesta' : 'respuestas'}</p>
        <p>Disponible hasta las 00:00, hora de Argentina.</p>
        <button type="button" className="boton boton-secundario" disabled={descargando} onClick={() => void descargar()}>
          <Icono nombre="descargar" tamano={17} />{descargando ? 'Descargando…' : 'Descargar Excel'}
        </button>
      </section>}
      {error && <Aviso>{error}</Aviso>}
      {mensajeDescarga && <Aviso tipo="exito">{mensajeDescarga}</Aviso>}
      <div className="dialogo-tipo-acciones">
        <button type="button" className="boton boton-secundario" onClick={alCerrar}>Cerrar</button>
        <button type="submit" className="boton boton-primario" disabled={cargando || enviando || enCurso}>
          {enviando ? 'Solicitando…' : enCurso ? 'Preparando Excel…' : 'Preparar Excel'}
        </button>
      </div>
    </form>
  </dialog>
}
