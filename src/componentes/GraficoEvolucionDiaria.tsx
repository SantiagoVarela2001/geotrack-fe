import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/clienteApi'
import type { DatosMetricasCliente } from '../api/tipos'
import { alinearSeries, gruposMetricas, tasaLegible } from '../metricas'
import { obtenerMensajeError } from '../utilidades'

const fechas = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const enteros = new Intl.NumberFormat('es-AR')
const colores = { sinMarca: '#159cac', conMarca: '#8865b0' }
const alto = 185
const margenIzquierdo = 28
const margenDerecho = 12
const margenSuperior = 14
const margenInferior = 30
const altoDatos = alto - margenSuperior - margenInferior

function fechaLegible(iso: string): string {
  return fechas.format(new Date(`${iso}T12:00:00Z`))
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
  const dias = useMemo(() => alinearSeries(metricas), [metricas])
  const [indiceSeleccionado, cambiarIndiceSeleccionado] = useState(() => Math.max(0,
    dias.findLastIndex((dia) => (dia.sinMarca?.ejecuciones ?? 0) + (dia.conMarca?.ejecuciones ?? 0) > 0)))
  const [explorando, cambiarExplorando] = useState(false)
  const [detalles, guardarDetalles] = useState<Record<string, DatosMetricasCliente>>(() =>
    metricas.desde === metricas.hasta ? { [metricas.desde]: metricas } : {})
  const [errorDetalle, cambiarErrorDetalle] = useState<{ dia: string; mensaje: string } | null>(null)
  const [reintentos, cambiarReintentos] = useState(0)
  const diaSeleccionado = dias[indiceSeleccionado]
  const dia = diaSeleccionado?.dia
  const detalle = dia ? detalles[dia] : undefined
  const tieneMuestra = Boolean(diaSeleccionado &&
    ((diaSeleccionado.sinMarca?.analizadas ?? 0) + (diaSeleccionado.conMarca?.analizadas ?? 0) > 0))

  /** La exploración pide ambos grupos en una sola lectura y comparte el resultado por día. */
  useEffect(() => {
    if (!dia || !explorando || !tieneMuestra || detalle) return
    let vigente = true
    const fecha = dia
    const temporizador = window.setTimeout(() => {
      api.metricas.obtener(metricas.clienteUuid, fecha, fecha)
        .then((datos) => {
          if (!vigente) return
          guardarDetalles((actuales) => ({ ...actuales, [fecha]: datos }))
          cambiarErrorDetalle(null)
        })
        .catch((causa) => {
          if (vigente) cambiarErrorDetalle({ dia: fecha, mensaje: obtenerMensajeError(causa) })
        })
    }, 180)
    return () => { vigente = false; window.clearTimeout(temporizador) }
  }, [dia, explorando, tieneMuestra, detalle, metricas.clienteUuid, reintentos])

  if (!diaSeleccionado) return <p className="metricas-vacio">No hubo ejecuciones en este período.</p>
  const ancho = Math.min(1600, Math.max(450, dias.length * 4))
  const anchoDatos = ancho - margenIzquierdo - margenDerecho
  const series = gruposMetricas.map((grupo) => {
    const valores = dias.map((dia) => dia[grupo.clave]?.mencionesMarca ?? 0)
    return { ...grupo, valores, tendencia: regresionLineal(valores) }
  })
  const maximo = Math.max(1, Math.ceil(series.reduce((mayor, serie) =>
    Math.max(serie.valores.reduce((maximo, valor) => Math.max(maximo, valor), mayor),
      serie.tendencia?.inicio ?? 0, serie.tendencia?.fin ?? 0), 0) * 1.12))
  const x = (indice: number) => margenIzquierdo + (dias.length === 1 ? anchoDatos / 2 : indice * anchoDatos / (dias.length - 1))
  const y = (valor: number) => margenSuperior + altoDatos * (1 - Math.max(0, Math.min(maximo, valor)) / maximo)

  function seleccionar(indice: number) {
    cambiarIndiceSeleccionado(Math.max(0, Math.min(dias.length - 1, indice)))
    cambiarExplorando(true)
    cambiarErrorDetalle(null)
  }

  return (
    <div className="metricas-diario">
      <div className="metricas-diario-visual">
        <div className="metricas-diario-encabezado">
          <div><strong>Menciones de marca por grupo</strong><span>Respuestas analizadas que nombraron la marca, por día</span></div>
        </div>
        <div className="metricas-leyenda">
          {series.map((serie) => <span key={serie.clave} style={{ color: colores[serie.clave] }}>
            {serie.etiqueta} · {!serie.tendencia || Math.abs(serie.tendencia.fin - serie.tendencia.inicio) < 0.25
              ? 'Tendencia estable' : serie.tendencia.fin > serie.tendencia.inicio ? 'Tendencia en aumento' : 'Tendencia en descenso'}
          </span>)}
        </div>
        <div className="metricas-diario-desplazamiento">
          <svg className="metricas-diario-grafico" viewBox={`0 0 ${ancho} ${alto}`} style={{ minWidth: ancho }}
            role="slider" tabIndex={0} aria-label="Explorar menciones de marca por día y grupo"
            aria-valuemin={0} aria-valuemax={dias.length - 1} aria-valuenow={indiceSeleccionado}
            aria-valuetext={`${fechaLegible(diaSeleccionado.dia)}: ${gruposMetricas.map((grupo) =>
              `${grupo.etiqueta}: ${diaSeleccionado[grupo.clave]?.mencionesMarca ?? 0} menciones, ${tasaLegible(diaSeleccionado[grupo.clave]?.tasaMencionMarca ?? null)}`).join('; ')}`}
            onPointerDown={(evento) => {
              const rectangulo = evento.currentTarget.getBoundingClientRect()
              const posicion = (evento.clientX - rectangulo.left) / rectangulo.width * ancho
              seleccionar(Math.round((posicion - margenIzquierdo) / anchoDatos * (dias.length - 1)))
            }}
            onKeyDown={(evento) => {
              const siguiente = evento.key === 'ArrowRight' ? indiceSeleccionado + 1
                : evento.key === 'ArrowLeft' ? indiceSeleccionado - 1 : evento.key === 'Home' ? 0
                  : evento.key === 'End' ? dias.length - 1 : null
              if (siguiente !== null) { evento.preventDefault(); seleccionar(siguiente) }
            }}>
            <line className="metricas-diario-base" x1={margenIzquierdo} x2={ancho - margenDerecho} y1={y(0)} y2={y(0)} />
            <text className="metricas-diario-eje" x={margenIzquierdo - 7} y={y(0) + 3} textAnchor="end">0</text>
            <text className="metricas-diario-eje" x={margenIzquierdo - 7} y={y(maximo) + 3} textAnchor="end">{maximo}</text>
            {series.map((serie) => <g key={serie.clave}>
              {serie.tendencia && <line className="metricas-diario-regresion" style={{ stroke: colores[serie.clave] }}
                x1={x(0)} y1={y(serie.tendencia.inicio)} x2={x(dias.length - 1)} y2={y(serie.tendencia.fin)} />}
              <polyline className="metricas-diario-linea" style={{ stroke: colores[serie.clave] }}
                points={serie.valores.map((valor, indice) => `${x(indice)},${y(valor)}`).join(' ')} />
              {serie.valores.map((valor, indice) => <circle key={dias[indice].dia} className="metricas-diario-punto"
                style={{ fill: colores[serie.clave] }} cx={x(indice)} cy={y(valor)} r={dias.length > 100 ? 1.7 : 2.5} />)}
              <circle className="metricas-diario-punto-activo" style={{ fill: colores[serie.clave] }}
                cx={x(indiceSeleccionado)} cy={y(serie.valores[indiceSeleccionado])} r={5} />
            </g>)}
            <line className="metricas-diario-seleccion" x1={x(indiceSeleccionado)} x2={x(indiceSeleccionado)} y1={margenSuperior} y2={y(0)} />
            <text className="metricas-diario-eje" x={x(0)} y={alto - 5} textAnchor={dias.length === 1 ? 'middle' : 'start'}>{fechaLegible(dias[0].dia)}</text>
            {dias.length > 1 && <text className="metricas-diario-eje" x={x(dias.length - 1)} y={alto - 5} textAnchor="end">{fechaLegible(dias[dias.length - 1].dia)}</text>}
          </svg>
        </div>
        <p className="metricas-diario-ayuda">Elegí un día para ver sus resultados. Las líneas punteadas indican la tendencia de los conteos; los días sin ejecuciones tienen cero menciones. Las tasas sin muestra permanecen vacías.</p>
      </div>
      <div className="metricas-diario-detalle">
        <h3>{fechaLegible(diaSeleccionado.dia)}</h3>
        {gruposMetricas.map((grupo) => {
          const datos = diaSeleccionado[grupo.clave]
          const competidores = [...(detalle?.[grupo.clave].competidores ?? [])]
            .sort((a, b) => b.menciones - a.menciones || a.nombre.localeCompare(b.nombre))
          return <section key={grupo.clave} aria-label={`${grupo.etiqueta} ese día`}>
            <h4>{grupo.etiqueta}</h4>
            <div className="metricas-diario-destacado">
              <strong>{enteros.format(datos?.mencionesMarca ?? 0)}</strong>
              <span>menciones en {enteros.format(datos?.analizadas ?? 0)} analizadas<br />{tasaLegible(datos?.tasaMencionMarca ?? null)}</span>
            </div>
            <dl className="metricas-diario-cifras">
              <div><dt>Ejecuciones</dt><dd>{enteros.format(datos?.ejecuciones ?? 0)}</dd></div>
              <div><dt>Con citas</dt><dd>{enteros.format(datos?.conCitas ?? 0)}</dd></div>
              <div><dt>Citan el sitio</dt><dd>{enteros.format(datos?.conCitasSitioCliente ?? 0)}</dd></div>
            </dl>
            <p className="metricas-diario-estados">{datos?.pendientes ?? 0} pendientes · {datos?.fallidas ?? 0} fallidas · {datos?.canceladas ?? 0} canceladas</p>
            {datos && Object.keys(datos.modelosAnalizados).length > 0 && <p className="metricas-nota">
              {Object.entries(datos.modelosAnalizados).map(([modelo, cantidad]) => `${modelo}: ${cantidad}`).join(' · ')}
            </p>}
            <div className="metricas-diario-competidores"><h4>Competencia ese día</h4>
              {!datos?.analizadas ? <p>Sin muestra.</p> : detalle ? competidores.length === 0 ? <p>No se evaluaron competidores.</p> : (
                <ul>{competidores.map((competidor) => <li key={competidor.competidorUuid}>
                  <span>{competidor.nombre}</span><strong>{enteros.format(competidor.menciones)}</strong>
                  <small>de {enteros.format(competidor.evaluaciones)} evaluadas · {tasaLegible(competidor.tasaMencion)}</small>
                </li>)}</ul>
              ) : !explorando ? <button className="boton boton-secundario boton-chico" type="button" onClick={() => cambiarExplorando(true)}>Ver competencia de este día</button>
                : errorDetalle?.dia === diaSeleccionado.dia ? <div className="metricas-diario-error"><p>{errorDetalle.mensaje}</p>
                  <button type="button" onClick={() => { cambiarErrorDetalle(null); cambiarReintentos((actual) => actual + 1) }}>Reintentar</button>
                </div> : <p role="status">Cargando menciones de competidores…</p>}
            </div>
          </section>
        })}
      </div>
    </div>
  )
}
