import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/clienteApi'
import type { DatosMetricasCliente, DatosMetricasDia } from '../api/tipos'
import { obtenerMensajeError } from '../utilidades'

const fechas = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
})
const fechasCortas = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric', month: 'short', timeZone: 'UTC',
})
const enteros = new Intl.NumberFormat('es-AR')

const alto = 165
const margenIzquierdo = 28
const margenDerecho = 12
const margenSuperior = 14
const margenInferior = 30
const altoDatos = alto - margenSuperior - margenInferior

function fechaLegible(iso: string, corta = false): string {
  const fecha = new Date(`${iso}T12:00:00Z`)
  return corta ? fechasCortas.format(fecha) : fechas.format(fecha)
}

/** La API solo envía días con ejecuciones; para la tendencia se incluyen los días vacíos. */
function completarDias(desde: string, hasta: string, serie: DatosMetricasDia[]): DatosMetricasDia[] {
  const porDia = new Map(serie.map((dia) => [dia.dia, dia]))
  const inicio = Date.parse(`${desde}T00:00:00Z`)
  const fin = Date.parse(`${hasta}T00:00:00Z`)
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || inicio > fin) return serie

  const dias: DatosMetricasDia[] = []
  for (let instante = inicio; instante <= fin; instante += 86_400_000) {
    const dia = new Date(instante).toISOString().slice(0, 10)
    dias.push(porDia.get(dia) ?? {
      dia, ejecuciones: 0, analizadas: 0, pendientes: 0, fallidas: 0,
      mencionesMarca: 0, tasaMencionMarca: null, conCitas: 0, tasaCitas: null,
      conCitasSitioCliente: 0, tasaCitasSitioCliente: null, modelosAnalizados: {},
    })
  }
  return dias
}

function regresionLineal(valores: number[]) {
  if (valores.length < 2) return null
  const promedioX = (valores.length - 1) / 2
  const promedioY = valores.reduce((suma, valor) => suma + valor, 0) / valores.length
  const numerador = valores.reduce(
    (suma, valor, indice) => suma + (indice - promedioX) * (valor - promedioY), 0,
  )
  const denominador = valores.reduce(
    (suma, _valor, indice) => suma + (indice - promedioX) ** 2, 0,
  )
  const pendiente = numerador / denominador
  return {
    inicio: promedioY - pendiente * promedioX,
    fin: promedioY + pendiente * (valores.length - 1 - promedioX),
  }
}

export function GraficoEvolucionDiaria({ metricas }: { metricas: DatosMetricasCliente }) {
  const dias = useMemo(
    () => completarDias(metricas.desde, metricas.hasta, metricas.serieDiaria),
    [metricas],
  )
  const [indiceSeleccionado, cambiarIndiceSeleccionado] = useState(() =>
    Math.max(0, dias.findLastIndex((dia) => dia.ejecuciones > 0)),
  )
  const [detalles, guardarDetalles] = useState<Record<string, DatosMetricasCliente>>(() =>
    metricas.desde === metricas.hasta ? { [metricas.desde]: metricas } : {},
  )
  const [errorDetalle, cambiarErrorDetalle] = useState<{ dia: string; mensaje: string } | null>(null)
  const [reintentos, cambiarReintentos] = useState(0)
  const diaSeleccionado = dias[indiceSeleccionado]
  const detalle = detalles[diaSeleccionado.dia]

  useEffect(() => {
    if (diaSeleccionado.analizadas === 0 || detalle) return
    let vigente = true
    const temporizador = window.setTimeout(() => {
      api.metricas.obtener(metricas.clienteUuid, diaSeleccionado.dia, diaSeleccionado.dia)
        .then((datos) => {
          if (vigente) {
            guardarDetalles((actuales) => ({ ...actuales, [diaSeleccionado.dia]: datos }))
            cambiarErrorDetalle(null)
          }
        })
        .catch((causa) => {
          if (vigente) cambiarErrorDetalle({ dia: diaSeleccionado.dia, mensaje: obtenerMensajeError(causa) })
        })
    }, 180)
    return () => {
      vigente = false
      window.clearTimeout(temporizador)
    }
  }, [detalle, diaSeleccionado.analizadas, diaSeleccionado.dia, metricas.clienteUuid, reintentos])

  const ancho = Math.min(1600, Math.max(450, dias.length * 4))
  const anchoDatos = ancho - margenIzquierdo - margenDerecho
  const valores = dias.map((dia) => dia.mencionesMarca)
  const tendencia = regresionLineal(valores)
  const maximo = Math.max(1, Math.ceil(Math.max(
    valores.reduce((mayor, valor) => Math.max(mayor, valor), 0),
    tendencia?.inicio ?? 0, tendencia?.fin ?? 0,
  ) * 1.12))
  const x = (indice: number) => margenIzquierdo +
    (dias.length === 1 ? anchoDatos / 2 : indice * anchoDatos / (dias.length - 1))
  const y = (valor: number) => margenSuperior + altoDatos *
    (1 - Math.max(0, Math.min(maximo, valor)) / maximo)
  const puntos = valores.map((valor, indice) => `${x(indice)},${y(valor)}`).join(' ')
  const diferencia = tendencia ? tendencia.fin - tendencia.inicio : 0
  const tendenciaTexto = !tendencia || Math.abs(diferencia) < 0.25
    ? 'Tendencia estable'
    : diferencia > 0 ? 'Tendencia en aumento' : 'Tendencia en descenso'
  const competidores = [...(detalle?.competidores ?? [])]
    .sort((a, b) => b.menciones - a.menciones || a.nombre.localeCompare(b.nombre))

  function seleccionarConPuntero(clientX: number, rectangulo: DOMRect) {
    const posicion = (clientX - rectangulo.left) / rectangulo.width * ancho
    const indice = Math.round((posicion - margenIzquierdo) / anchoDatos * (dias.length - 1))
    cambiarIndiceSeleccionado(Math.max(0, Math.min(dias.length - 1, indice)))
  }

  return (
    <div className="metricas-diario">
      <div className="metricas-diario-visual">
        <div className="metricas-diario-encabezado">
          <div>
            <strong>Menciones de marca</strong>
            <span>Respuestas analizadas que nombraron la marca, por día</span>
          </div>
          <span className="metricas-diario-tendencia">{tendenciaTexto}</span>
        </div>
        <div className="metricas-diario-desplazamiento">
          <svg className="metricas-diario-grafico" viewBox={`0 0 ${ancho} ${alto}`}
            style={{ minWidth: ancho }} role="slider" tabIndex={0}
            aria-label="Explorar menciones de marca por día"
            aria-valuemin={0} aria-valuemax={dias.length - 1} aria-valuenow={indiceSeleccionado}
            aria-valuetext={`${fechaLegible(diaSeleccionado.dia)}: ${diaSeleccionado.mencionesMarca} ${diaSeleccionado.mencionesMarca === 1 ? 'mención' : 'menciones'} de ${diaSeleccionado.analizadas} respuestas analizadas`}
            onPointerDown={(evento) => seleccionarConPuntero(
              evento.clientX, evento.currentTarget.getBoundingClientRect(),
            )}
            onKeyDown={(evento) => {
              const siguiente = evento.key === 'ArrowRight' ? indiceSeleccionado + 1
                : evento.key === 'ArrowLeft' ? indiceSeleccionado - 1
                  : evento.key === 'Home' ? 0
                    : evento.key === 'End' ? dias.length - 1 : null
              if (siguiente !== null) {
                evento.preventDefault()
                cambiarIndiceSeleccionado(Math.max(0, Math.min(dias.length - 1, siguiente)))
              }
            }}>
            <line className="metricas-diario-base" x1={margenIzquierdo} x2={ancho - margenDerecho}
              y1={y(0)} y2={y(0)} />
            <text className="metricas-diario-eje" x={margenIzquierdo - 7} y={y(0) + 3}
              textAnchor="end">0</text>
            <text className="metricas-diario-eje" x={margenIzquierdo - 7} y={y(maximo) + 3}
              textAnchor="end">{maximo}</text>
            {tendencia && (
              <line className="metricas-diario-regresion" x1={x(0)} y1={y(tendencia.inicio)}
                x2={x(dias.length - 1)} y2={y(tendencia.fin)} />
            )}
            <polyline className="metricas-diario-linea" points={puntos} />
            {valores.map((valor, indice) => (
              <circle key={dias[indice].dia} className="metricas-diario-punto"
                cx={x(indice)} cy={y(valor)} r={dias.length > 100 ? 1.7 : 2.5} />
            ))}
            <line className="metricas-diario-seleccion" x1={x(indiceSeleccionado)}
              x2={x(indiceSeleccionado)} y1={margenSuperior} y2={y(0)} />
            <circle className="metricas-diario-punto-activo" cx={x(indiceSeleccionado)}
              cy={y(diaSeleccionado.mencionesMarca)} r={5} />
            <text className="metricas-diario-eje" x={x(0)} y={alto - 5}
              textAnchor={dias.length === 1 ? 'middle' : 'start'}>
              {fechaLegible(dias[0].dia, true)}
            </text>
            {dias.length > 1 && (
              <text className="metricas-diario-eje" x={x(dias.length - 1)} y={alto - 5}
                textAnchor="end">{fechaLegible(dias[dias.length - 1].dia, true)}</text>
            )}
          </svg>
        </div>
        <p className="metricas-diario-ayuda">Elegí un día para ver sus resultados. La línea punteada indica la tendencia; los días sin ejecuciones cuentan como cero.</p>
      </div>

      <div className="metricas-diario-detalle">
        <h3>{fechaLegible(diaSeleccionado.dia)}</h3>
        <div className="metricas-diario-destacado">
          <strong>{enteros.format(diaSeleccionado.mencionesMarca)}</strong>
          <span>{diaSeleccionado.mencionesMarca === 1 ? 'mención' : 'menciones'} de marca<br />en {enteros.format(diaSeleccionado.analizadas)} respuestas analizadas</span>
        </div>
        <dl className="metricas-diario-cifras">
          <div><dt>Ejecuciones</dt><dd>{enteros.format(diaSeleccionado.ejecuciones)}</dd></div>
          <div><dt>Con citas</dt><dd>{enteros.format(diaSeleccionado.conCitas)}</dd></div>
          <div><dt>Citan el sitio</dt><dd>{enteros.format(diaSeleccionado.conCitasSitioCliente)}</dd></div>
        </dl>
        {(diaSeleccionado.pendientes > 0 || diaSeleccionado.fallidas > 0) && (
          <p className="metricas-diario-estados">
            {diaSeleccionado.pendientes > 0 && `${enteros.format(diaSeleccionado.pendientes)} pendientes`}
            {diaSeleccionado.pendientes > 0 && diaSeleccionado.fallidas > 0 && ' · '}
            {diaSeleccionado.fallidas > 0 && `${enteros.format(diaSeleccionado.fallidas)} fallidas`}
          </p>
        )}
        <div className="metricas-diario-competidores">
          <h4>Competencia ese día</h4>
          {diaSeleccionado.analizadas === 0 ? (
            <p>Sin respuestas analizadas.</p>
          ) : detalle ? competidores.length === 0 ? (
            <p>No se evaluaron competidores.</p>
          ) : (
            <ul>
              {competidores.map((competidor) => (
                <li key={competidor.competidorUuid}>
                  <span>{competidor.nombre}</span>
                  <strong>{enteros.format(competidor.menciones)}</strong>
                  <small>de {enteros.format(competidor.evaluaciones)} evaluadas</small>
                </li>
              ))}
            </ul>
          ) : errorDetalle?.dia === diaSeleccionado.dia ? (
            <div className="metricas-diario-error">
              <p>{errorDetalle.mensaje}</p>
              <button type="button" onClick={() => {
                cambiarErrorDetalle(null)
                cambiarReintentos((actual) => actual + 1)
              }}>Reintentar</button>
            </div>
          ) : (
            <p role="status">Cargando menciones de competidores…</p>
          )}
        </div>
      </div>
    </div>
  )
}
