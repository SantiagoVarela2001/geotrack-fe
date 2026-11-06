import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { api, ErrorApi } from '../api/clienteApi'
import type { DatosAccionCliente, DatosCliente, DatosCuenta, DatosMetricasCliente } from '../api/tipos'
import { obtenerMensajeError, tienePermiso } from '../utilidades'
import { Aviso } from './Comun'
import { GraficoEvolucionDiaria } from './GraficoEvolucionDiaria'
import { useGestionAccionesCliente } from './useGestionAccionesCliente'
import { VentanasAccionesCliente } from './GestionAccionesCliente'

type Periodo = { desde: string; hasta: string }
type FiltroRapido = 'mes' | 'seisMeses' | 'anio'

const fechas = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const fechaArgentina = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'America/Argentina/Buenos_Aires',
})

/** Los períodos incluyen el mes actual hasta hoy, según el calendario argentino. */
function periodoRapido(filtro: FiltroRapido): Periodo {
  const partes = fechaArgentina.formatToParts(new Date())
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? ''
  const anio = Number(valor('year'))
  const mes = Number(valor('month'))
  const mesesAnteriores = filtro === 'seisMeses' ? 5 : filtro === 'anio' ? 11 : 0
  const desde = new Date(Date.UTC(anio, mes - 1 - mesesAnteriores, 1)).toISOString().slice(0, 10)
  return { desde, hasta: `${valor('year')}-${valor('month')}-${valor('day')}` }
}

function fechaLegible(iso: string): string {
  const fecha = new Date(`${iso}T12:00:00Z`)
  return Number.isNaN(fecha.getTime()) ? iso : fechas.format(fecha)
}

function mensajeErrorMetricas(causa: unknown): string {
  if (causa instanceof ErrorApi && causa.estado === 404) {
    return 'Este cliente no está disponible para consultar métricas.'
  }
  return obtenerMensajeError(causa)
}

/** Comparte filtros, consultas independientes y gráfico entre métricas y acciones. */
export function PanelEvolucionCliente({ clienteUuid, cliente, cuenta, revisionExterna = 0,
  alActualizarAcciones, accionesCabecera, children }: {
  clienteUuid: string
  cliente: DatosCliente | null
  cuenta: DatosCuenta
  revisionExterna?: number
  alActualizarAcciones?: () => void
  accionesCabecera?: ReactNode
  children?: (metricas: DatosMetricasCliente) => ReactNode
}) {
  const [periodo, cambiarPeriodo] = useState<Periodo>(() => periodoRapido('mes'))
  const [borrador, cambiarBorrador] = useState<Periodo>(periodo)
  const [filtroActivo, cambiarFiltroActivo] = useState<FiltroRapido | null>('mes')
  const [metricas, cambiarMetricas] = useState<DatosMetricasCliente | null>(null)
  const [cargando, cambiarCargando] = useState(true)
  const [error, cambiarError] = useState('')
  const [errorFechas, cambiarErrorFechas] = useState('')
  const puedeVerAcciones = tienePermiso(cuenta.permisos, 'ACCIONES_VER')
  const [resultadoAcciones, cambiarResultadoAcciones] = useState<{
    clave: string; acciones: DatosAccionCliente[]; error: string
  } | null>(null)
  const [revisionLocal, cambiarRevisionLocal] = useState(0)
  const revisionAcciones = revisionExterna + revisionLocal
  const claveAcciones = `${clienteUuid}:${periodo.desde}:${periodo.hasta}:${revisionAcciones}`
  const cargandoAcciones = resultadoAcciones?.clave !== claveAcciones
  const acciones = puedeVerAcciones && !cargandoAcciones ? resultadoAcciones.acciones : []
  const errorAcciones = cargandoAcciones ? '' : resultadoAcciones.error
  const gestionAcciones = useGestionAccionesCliente(cliente, cuenta,
    () => { cambiarRevisionLocal((actual) => actual + 1); alActualizarAcciones?.() })

  // Este efecto y el de métricas comienzan juntos; sus resultados y errores son independientes.
  useEffect(() => {
    if (!puedeVerAcciones) return
    let vigente = true
    api.acciones.listar(clienteUuid, periodo)
      .then((datos) => { if (vigente) cambiarResultadoAcciones({ clave: claveAcciones, acciones: datos, error: '' }) })
      .catch((causa) => {
        if (vigente) cambiarResultadoAcciones({ clave: claveAcciones, acciones: [], error: obtenerMensajeError(causa) })
      })
    return () => { vigente = false }
  }, [clienteUuid, periodo, puedeVerAcciones, claveAcciones])

  useEffect(() => {
    let vigente = true
    api.metricas
      .obtener(clienteUuid, periodo.desde, periodo.hasta)
      .then((datos) => {
        if (!vigente) return
        cambiarMetricas(datos)
        cambiarError('')
      })
      .catch((causa) => {
        if (!vigente) return
        cambiarMetricas(null)
        cambiarError(mensajeErrorMetricas(causa))
      })
      .finally(() => {
        if (vigente) cambiarCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [clienteUuid, periodo])

  function cargarPeriodo(siguiente: Periodo, filtro: FiltroRapido | null) {
    cambiarErrorFechas('')
    cambiarError('')
    cambiarMetricas(null)
    cambiarCargando(true)
    cambiarBorrador(siguiente)
    cambiarFiltroActivo(filtro)
    cambiarPeriodo(siguiente)
  }

  function aplicarPeriodo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(borrador.desde) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(borrador.hasta)
    ) {
      cambiarErrorFechas('Ingresá ambas fechas en formato válido.')
      return
    }
    if (borrador.desde > borrador.hasta) {
      cambiarErrorFechas('La fecha desde no puede ser posterior a la fecha hasta.')
      return
    }
    cargarPeriodo({ desde: borrador.desde, hasta: borrador.hasta }, null)
  }

  function reintentar() {
    cambiarError('')
    cambiarCargando(true)
    cambiarPeriodo({ ...periodo })
  }

  return <div className="evolucion-cliente">
      <form className="metricas-filtros" onSubmit={aplicarPeriodo}>
        <div className="metricas-filtros-rapidos" role="group" aria-label="Períodos rápidos">
          {([
            ['mes', 'Este mes'],
            ['seisMeses', 'Últimos 6 meses'],
            ['anio', 'Último año'],
          ] as const).map(([filtro, etiqueta]) => (
            <button
              key={filtro}
              className="boton boton-chico metricas-filtro-rapido"
              type="button"
              aria-pressed={filtroActivo === filtro}
              onClick={() => cargarPeriodo(periodoRapido(filtro), filtro)}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="metricas-desde">Desde</label>
          <input
            id="metricas-desde"
            type="date"
            required
            value={borrador.desde}
            onChange={(evento) => {
              cambiarBorrador((actual) => ({ ...actual, desde: evento.target.value }))
              cambiarFiltroActivo(null)
            }}
          />
        </div>
        <div>
          <label htmlFor="metricas-hasta">Hasta</label>
          <input
            id="metricas-hasta"
            type="date"
            required
            value={borrador.hasta}
            onChange={(evento) => {
              cambiarBorrador((actual) => ({ ...actual, hasta: evento.target.value }))
              cambiarFiltroActivo(null)
            }}
          />
        </div>
        <button className="boton boton-primario" type="submit" disabled={cargando}>
          Aplicar período
        </button>
        {errorFechas && <Aviso>{errorFechas}</Aviso>}
      </form>


      {cargando ? <div className="cargando-bloque" role="status">Cargando evolución…</div>
        : error ? <div className="metricas-error"><Aviso>{error}</Aviso>
          <button className="boton boton-secundario reintentar" type="button" onClick={reintentar}>Reintentar</button>
        </div> : metricas && <>
          <section className="panel-evolucion tarjeta" aria-labelledby="metricas-serie-titulo">
            <div className="evolucion-cabecera">
              <div><h2 id="metricas-serie-titulo">Evolución diaria</h2>
                <p className="metricas-periodo">{fechaLegible(metricas.desde)} — {fechaLegible(metricas.hasta)}</p>
              </div>
              {accionesCabecera}
            </div>
            {gestionAcciones.mensaje && <Aviso tipo="exito">{gestionAcciones.mensaje}</Aviso>}
            {puedeVerAcciones && cargandoAcciones && <p role="status">Cargando acciones del período…</p>}
            {puedeVerAcciones && errorAcciones && <div className="acciones-error">
              <Aviso>No se pudieron cargar los marcadores: {errorAcciones}</Aviso>
              <button className="boton boton-secundario boton-chico" type="button"
                onClick={() => cambiarRevisionLocal((actual) => actual + 1)}>Reintentar marcadores</button>
            </div>}
            {metricas.sinMarca.serieDiaria.length === 0 && metricas.conMarca.serieDiaria.length === 0 && acciones.length === 0 ? (
              <p className="metricas-vacio">No hubo ejecuciones en este período.</p>
            ) : (
              <GraficoEvolucionDiaria key={`${metricas.clienteUuid}:${metricas.desde}:${metricas.hasta}`} metricas={metricas}
                acciones={puedeVerAcciones ? acciones : []}
                gestionAcciones={puedeVerAcciones ? gestionAcciones : undefined}
                accionesDisponibles={!cargandoAcciones && !errorAcciones} />
            )}
          </section>
          {children?.(metricas)}
        </>}
      <VentanasAccionesCliente gestion={gestionAcciones} />
    </div>
}
