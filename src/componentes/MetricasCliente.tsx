import { useEffect, useState, type FormEvent } from 'react'
import { ErrorApi, api } from '../api/clienteApi'
import type {
  DatosCliente,
  DatosCuenta,
  DatosMetricasCliente,
  DatosMetricasConsultaMencionada,
} from '../api/tipos'
import { obtenerMensajeError, tienePermiso } from '../utilidades'
import { Aviso, Icono } from './Comun'
import { GraficoEvolucionDiaria } from './GraficoEvolucionDiaria'
import { InformeMetricas } from './InformeMetricas'

type Periodo = { desde: string; hasta: string }
type FiltroRapido = 'mes' | 'seisMeses' | 'anio'

const enteros = new Intl.NumberFormat('es-AR')
const porcentajes = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
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

function tasaLegible(valor: number | null): string {
  return valor === null ? 'Sin datos' : `${porcentajes.format(valor)} %`
}

function mensajeErrorMetricas(causa: unknown): string {
  if (causa instanceof ErrorApi && causa.estado === 404) {
    return 'Este cliente no está disponible para consultar métricas.'
  }
  return obtenerMensajeError(causa)
}

function Indicador({
  etiqueta,
  valor,
  descripcion,
}: {
  etiqueta: string
  valor: string
  descripcion?: string
}) {
  return (
    <div className="metricas-indicador">
      <dt>{etiqueta}</dt>
      <dd>{valor}</dd>
      {descripcion && <small>{descripcion}</small>}
    </div>
  )
}

function ListaConsultasMencionadas({ consultas }: { consultas: DatosMetricasConsultaMencionada[] }) {
  return (
    <ul className="metricas-competidores metricas-consultas-mencionadas">
      {consultas.map((consulta) => (
        <li key={consulta.consultaUuid}>
          <strong>{consulta.textoConsulta}</strong>
          <span><b>{enteros.format(consulta.mencionesMarca)}</b> {consulta.mencionesMarca === 1 ? 'mención' : 'menciones'}</span>
        </li>
      ))}
    </ul>
  )
}

export function MetricasCliente({
  clienteUuid,
  cuenta,
  alVolver,
}: {
  clienteUuid: string
  cuenta: DatosCuenta
  alVolver: () => void
}) {
  const [periodo, cambiarPeriodo] = useState<Periodo>(() => periodoRapido('mes'))
  const [borrador, cambiarBorrador] = useState<Periodo>(periodo)
  const [filtroActivo, cambiarFiltroActivo] = useState<FiltroRapido | null>('mes')
  const [cliente, cambiarCliente] = useState<DatosCliente | null>(null)
  const [metricas, cambiarMetricas] = useState<DatosMetricasCliente | null>(null)
  const [cargando, cambiarCargando] = useState(true)
  const [error, cambiarError] = useState('')
  const [errorFechas, cambiarErrorFechas] = useState('')
  const [informeAbierto, cambiarInformeAbierto] = useState(false)
  const puedeVerCliente = tienePermiso(cuenta.permisos, 'CLIENTES_VER')

  useEffect(() => {
    const tituloAnterior = document.title
    document.title = 'Métricas GEO · Gelaia'
    return () => {
      document.title = tituloAnterior
    }
  }, [])

  useEffect(() => {
    if (!puedeVerCliente) return
    let vigente = true
    api.clientes
      .obtener(clienteUuid)
      .then((datos) => {
        if (vigente) cambiarCliente(datos)
      })
      .catch(() => {
        if (vigente) cambiarCliente(null)
      })
    return () => {
      vigente = false
    }
  }, [clienteUuid, puedeVerCliente])

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

  const consultasMencionadas = [...(metricas?.consultasMencionadas ?? [])]
    .sort((a, b) => b.mencionesMarca - a.mencionesMarca ||
      a.textoConsulta.localeCompare(b.textoConsulta, 'es'))
  const restantes = consultasMencionadas.length - 5

  return (
    <div className="pagina-metricas">
      {puedeVerCliente && (
        <button className="enlace-volver" type="button" onClick={alVolver}>
          <Icono nombre="volver" tamano={17} /> Volver al cliente
        </button>
      )}
      <header className="metricas-cabecera">
        <span className="sobrelinea">MEDICIÓN POR CLIENTE</span>
        <h1>Métricas GEO{cliente ? ` de ${cliente.nombre}` : ''}</h1>
        <p>Resultados agregados por día de ejecución en Argentina.</p>
      </header>

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

      {cargando ? (
        <div className="cargando-bloque" role="status">
          Cargando métricas GEO…
        </div>
      ) : error ? (
        <div className="metricas-error">
          <Aviso>{error}</Aviso>
          <button className="boton boton-secundario reintentar" type="button" onClick={reintentar}>
            Reintentar
          </button>
        </div>
      ) : metricas && (
        <div className="metricas-contenido">
          <div className="metricas-periodo-acciones">
            <p className="metricas-periodo">
              Del {fechaLegible(metricas.desde)} al {fechaLegible(metricas.hasta)}, inclusive.
            </p>
            <button className="boton boton-secundario boton-chico detalle-accion metricas-informe-accion" type="button"
              aria-expanded={informeAbierto} aria-controls="metricas-informe-editor"
              onClick={() => cambiarInformeAbierto((abierto) => !abierto)}>
              <Icono nombre="documento" tamano={18} />
              <span>{informeAbierto ? 'Cerrar informe' : 'Crear informe'}</span>
            </button>
          </div>

          {informeAbierto && (
            <InformeMetricas key={`${cuenta.usuario}:${clienteUuid}`} metricas={metricas}
              cliente={cliente} cuenta={cuenta} alCerrar={() => cambiarInformeAbierto(false)} />
          )}

          <section className="metricas-seccion" aria-labelledby="metricas-resumen-titulo">
            <h2 id="metricas-resumen-titulo">Resumen del período</h2>
            <dl className="metricas-resumen">
              <Indicador etiqueta="Ejecuciones" valor={enteros.format(metricas.ejecuciones)} />
              <Indicador etiqueta="Analizadas" valor={enteros.format(metricas.analizadas)} descripcion="Mediciones completas" />
              <Indicador etiqueta="Pendientes" valor={enteros.format(metricas.pendientes)} />
              <Indicador etiqueta="Fallidas" valor={enteros.format(metricas.fallidas)} />
            </dl>
          </section>

          <section className="metricas-seccion" aria-labelledby="metricas-tasas-titulo">
            <h2 id="metricas-tasas-titulo">Marca y citas</h2>
            <dl className="metricas-tasas">
              <Indicador etiqueta="Mención de marca" valor={tasaLegible(metricas.tasaMencionMarca)}
                descripcion={`${enteros.format(metricas.mencionesMarca)} de ${enteros.format(metricas.analizadas)} analizadas`} />
              <Indicador etiqueta="Respuestas con citas" valor={tasaLegible(metricas.tasaCitas)}
                descripcion={`${enteros.format(metricas.conCitas)} de ${enteros.format(metricas.analizadas)} analizadas`} />
              <Indicador etiqueta="Citas al sitio del cliente" valor={tasaLegible(metricas.tasaCitasSitioCliente)}
                descripcion={`${enteros.format(metricas.conCitasSitioCliente)} de ${enteros.format(metricas.analizadas)} analizadas`} />
            </dl>
            <p className="metricas-nota">
              La mención de marca incluye todas las consultas, también las que nombran la marca.
              No representa presencia espontánea. Las citas propias se comparan con el sitio web
              actual del cliente.
            </p>
          </section>

          <section className="metricas-seccion" aria-labelledby="metricas-consultas-titulo">
            <h2 id="metricas-consultas-titulo">Consultas que mencionaron la marca</h2>
            {consultasMencionadas.length === 0 ? (
              <p className="metricas-vacio">No hubo consultas con menciones de marca en este período.</p>
            ) : (
              <>
                <ListaConsultasMencionadas consultas={consultasMencionadas.slice(0, 5)} />
                {restantes > 0 && (
                  <details className="metricas-consultas-restantes"
                    key={`${metricas.clienteUuid}:${metricas.desde}:${metricas.hasta}`}>
                    <summary>
                      <span className="metricas-consultas-cerrado">Ver {enteros.format(restantes)} {restantes === 1 ? 'consulta restante' : 'consultas restantes'}</span>
                      <span className="metricas-consultas-abierto">Ocultar {enteros.format(restantes)} {restantes === 1 ? 'consulta restante' : 'consultas restantes'}</span>
                    </summary>
                    <ListaConsultasMencionadas consultas={consultasMencionadas.slice(5)} />
                  </details>
                )}
              </>
            )}
            <p className="metricas-nota">Cada respuesta analizada cuenta como máximo una mención por consulta, aunque nombre la marca varias veces.</p>
          </section>

          <section className="metricas-seccion" aria-labelledby="metricas-serie-titulo">
            <h2 id="metricas-serie-titulo">Evolución diaria</h2>
            {metricas.serieDiaria.length === 0 ? (
              <p className="metricas-vacio">No hubo ejecuciones en este período.</p>
            ) : (
              <GraficoEvolucionDiaria
                key={`${metricas.clienteUuid}:${metricas.desde}:${metricas.hasta}`}
                metricas={metricas}
              />
            )}
          </section>

          <section className="metricas-seccion" aria-labelledby="metricas-competidores-titulo">
            <h2 id="metricas-competidores-titulo">Competidores en el período</h2>
            {metricas.competidores.length === 0 ? (
              <p className="metricas-vacio">No hay evaluaciones de competidores en este período.</p>
            ) : (
              <ul className="metricas-competidores">
                {[...metricas.competidores]
                  .sort((a, b) => b.menciones - a.menciones || a.nombre.localeCompare(b.nombre))
                  .map((competidor) => (
                    <li key={competidor.competidorUuid}>
                      <strong>{competidor.nombre}</strong>
                      <span><b>{enteros.format(competidor.menciones)}</b> {competidor.menciones === 1 ? 'mención' : 'menciones'}</span>
                      <small>en {enteros.format(competidor.evaluaciones)} respuestas evaluadas · {tasaLegible(competidor.tasaMencion)}</small>
                    </li>
                  ))}
              </ul>
            )}
            <p className="metricas-nota">Cada tasa usa las respuestas donde se evaluó a ese competidor; el denominador puede diferir del total del cliente.</p>
          </section>
        </div>
      )}
    </div>
  )
}
