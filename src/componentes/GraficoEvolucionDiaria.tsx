import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/clienteApi'
import type { DatosAccionCliente, DatosMetricasCliente } from '../api/tipos'
import { alinearSeries, gruposMetricas, tasaLegible } from '../metricas'
import { obtenerMensajeError } from '../utilidades'
import { agruparAccionesPorDia, fechaAccionLegible } from '../accionesCliente'
import { ListaAccionesCliente } from './GestionAccionesCliente'
import type { useGestionAccionesCliente } from './useGestionAccionesCliente'

const fechas = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const enteros = new Intl.NumberFormat('es-AR')
const colores = { sinMarca: '#159cac', conMarca: '#8865b0' }
const alto = 210
const margenIzquierdo = 28
const margenDerecho = 24
const margenSuperior = 24
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

export function GraficoEvolucionDiaria({ metricas, acciones = [], gestionAcciones, accionesDisponibles = true }: {
  metricas: DatosMetricasCliente
  acciones?: DatosAccionCliente[]
  gestionAcciones?: ReturnType<typeof useGestionAccionesCliente>
  accionesDisponibles?: boolean
}) {
  const dias = useMemo(() => alinearSeries(metricas), [metricas])
  const indicesDias = useMemo(() => new Map(dias.map((dia, indice) => [dia.dia, indice])), [dias])
  const accionesPorDia = useMemo(() => agruparAccionesPorDia(acciones.filter((accion) =>
    accion.clienteUuid === metricas.clienteUuid && accion.fecha >= metricas.desde && accion.fecha <= metricas.hasta)),
  [acciones, metricas.clienteUuid, metricas.desde, metricas.hasta])
  const [indiceSeleccionado, cambiarIndiceSeleccionado] = useState(() => Math.max(0,
    dias.findLastIndex((dia) => (dia.sinMarca?.ejecuciones ?? 0) + (dia.conMarca?.ejecuciones ?? 0) > 0)))
  const [explorando, cambiarExplorando] = useState(false)
  const [mostrarTendencia, cambiarMostrarTendencia] = useState(false)
  const [accionesAbiertas, cambiarAccionesAbiertas] = useState(false)
  const lienzo = useRef<HTMLDivElement>(null)
  const [ancho, cambiarAncho] = useState(800)
  const [detalles, guardarDetalles] = useState<Record<string, DatosMetricasCliente>>(() =>
    metricas.desde === metricas.hasta ? { [metricas.desde]: metricas } : {})
  const [errorDetalle, cambiarErrorDetalle] = useState<{ dia: string; mensaje: string } | null>(null)
  const [reintentos, cambiarReintentos] = useState(0)
  const diaSeleccionado = dias[indiceSeleccionado]
  const dia = diaSeleccionado?.dia
  const detalle = dia ? detalles[dia] : undefined
  const tieneMuestra = Boolean(diaSeleccionado &&
    ((diaSeleccionado.sinMarca?.analizadas ?? 0) + (diaSeleccionado.conMarca?.analizadas ?? 0) > 0))

  // Mantiene la altura y el tamaño de los textos al adaptar el gráfico a la pantalla.
  useEffect(() => {
    const elemento = lienzo.current
    if (!elemento) return
    const observador = new ResizeObserver(([entrada]) => cambiarAncho(Math.max(300, entrada.contentRect.width)))
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])

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
  const anchoMinimo = Math.min(1200, Math.max(300, dias.length * 3))
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
    const siguiente = Math.max(0, Math.min(dias.length - 1, indice))
    cambiarIndiceSeleccionado(siguiente)
    cambiarAccionesAbiertas(accionesPorDia.has(dias[siguiente].dia))
    cambiarExplorando(true)
    cambiarErrorDetalle(null)
  }

  return (
    <div className="metricas-diario">
      <div className="metricas-diario-visual">
        <div className="metricas-diario-encabezado">
          <div><strong>Menciones de tu marca</strong><span>Respuestas que nombraron la marca, por día</span></div>
          <button className="evolucion-tendencia" type="button" aria-pressed={mostrarTendencia}
            onClick={() => cambiarMostrarTendencia((visible) => !visible)}>
            {mostrarTendencia ? 'Ocultar tendencia' : 'Ver tendencia'}
          </button>
        </div>
        <div className="metricas-leyenda">
          {series.map((serie) => <span key={serie.clave} style={{ color: colores[serie.clave] }}>
            <i style={{ background: colores[serie.clave] }} />{serie.etiqueta}
            {mostrarTendencia && <small>{!serie.tendencia || Math.abs(serie.tendencia.fin - serie.tendencia.inicio) < 0.25
              ? 'Estable' : serie.tendencia.fin > serie.tendencia.inicio ? 'En aumento' : 'En descenso'}</small>}
          </span>)}
        </div>
        {accionesPorDia.size > 0 && <p className="evolucion-referencia"><i />Acciones realizadas · referencia temporal</p>}
        <div className="metricas-diario-desplazamiento">
          <div ref={lienzo} className="metricas-diario-lienzo" style={{ minWidth: anchoMinimo }}>
          <svg className="metricas-diario-grafico" viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none"
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
            {[0.5, 1].map((fraccion) => <line key={fraccion} className="evolucion-grilla"
              x1={margenIzquierdo} x2={ancho - margenDerecho} y1={y(maximo * fraccion)} y2={y(maximo * fraccion)} />)}
            <text className="metricas-diario-eje" x={margenIzquierdo - 7} y={y(0) + 3} textAnchor="end">0</text>
            <text className="metricas-diario-eje" x={margenIzquierdo - 7} y={y(maximo) + 3} textAnchor="end">{maximo}</text>
            {series.map((serie) => <g key={serie.clave}>
              {mostrarTendencia && serie.tendencia && <line className="metricas-diario-regresion" style={{ stroke: colores[serie.clave] }}
                x1={x(0)} y1={y(serie.tendencia.inicio)} x2={x(dias.length - 1)} y2={y(serie.tendencia.fin)} />}
              <polyline className="metricas-diario-linea" style={{ stroke: colores[serie.clave] }}
                points={serie.valores.map((valor, indice) => `${x(indice)},${y(valor)}`).join(' ')} />
              <circle className="metricas-diario-punto-activo" style={{ fill: colores[serie.clave] }}
                cx={x(indiceSeleccionado)} cy={y(serie.valores[indiceSeleccionado])} r={3.5} />
            </g>)}
            <line className="metricas-diario-seleccion" x1={x(indiceSeleccionado)} x2={x(indiceSeleccionado)} y1={margenSuperior} y2={y(0)} />
            {[...accionesPorDia].map(([fecha]) => {
              const indice = indicesDias.get(fecha)
              return indice !== undefined && <line key={fecha} className="accion-marcador-linea"
                x1={x(indice)} x2={x(indice)} y1={margenSuperior} y2={y(0)} />
            })}
            <text className="metricas-diario-eje" x={x(0)} y={alto - 5} textAnchor={dias.length === 1 ? 'middle' : 'start'}>{fechaLegible(dias[0].dia)}</text>
            {dias.length > 1 && <text className="metricas-diario-eje" x={x(dias.length - 1)} y={alto - 5} textAnchor="end">{fechaLegible(dias[dias.length - 1].dia)}</text>}
          </svg>
          <div className="acciones-marcadores" aria-label="Acciones realizadas en el período">
            {[...accionesPorDia].map(([fecha, grupo]) => {
              const indice = indicesDias.get(fecha)
              return indice !== undefined && <button key={fecha} type="button" className="accion-marcador"
                style={{ left: `clamp(18px, ${x(indice) / ancho * 100}%, calc(100% - 18px))` }} aria-pressed={diaSeleccionado.dia === fecha}
                aria-label={`${grupo.length} ${grupo.length === 1 ? 'acción' : 'acciones'}: ${fechaAccionLegible(fecha)}`}
                title={grupo.map((accion) => accion.titulo).join('\n')} onClick={() => seleccionar(indice)}>
                <span aria-hidden="true">{grupo.length === 1 ? '•' : grupo.length}</span>
              </button>
            })}
          </div>
          </div>
        </div>
        {accionesPorDia.size > 0 && <details className="acciones-selector-periodo">
          <summary>Ver fechas con acciones ({accionesPorDia.size})</summary>
          <div>{[...accionesPorDia].map(([fecha, grupo]) => <button key={fecha} type="button"
            className="boton boton-secundario boton-chico" aria-pressed={diaSeleccionado.dia === fecha}
            onClick={() => seleccionar(indicesDias.get(fecha)!)}>
            {fechaAccionLegible(fecha)} · {grupo.length} {grupo.length === 1 ? 'acción' : 'acciones'}
          </button>)}</div>
        </details>}
        <p className="metricas-diario-ayuda">Seleccioná un día o una acción para explorar sus resultados. También podés usar las flechas del teclado.</p>
      </div>
      <div className="metricas-diario-detalle">
        <div className="evolucion-resumen-dia">
          <h3>{fechaLegible(diaSeleccionado.dia)}</h3>
          {gruposMetricas.map((grupo) => <div key={grupo.clave} className="evolucion-cifra-dia">
            <i style={{ background: colores[grupo.clave] }} /><span>{grupo.etiqueta}</span>
            <strong>{enteros.format(diaSeleccionado[grupo.clave]?.mencionesMarca ?? 0)}</strong>
            <small>{tasaLegible(diaSeleccionado[grupo.clave]?.tasaMencionMarca ?? null)}</small>
          </div>)}
        </div>
        {gestionAcciones && <details className="acciones-del-dia" aria-label="Acciones del día" open={accionesAbiertas}
          onToggle={(evento) => cambiarAccionesAbiertas(evento.currentTarget.open)}>
          <summary>Acciones del día{accionesDisponibles && accionesPorDia.has(diaSeleccionado.dia)
            ? ` (${accionesPorDia.get(diaSeleccionado.dia)!.length})` : ''}</summary>
          {!accionesDisponibles ? <p>Los marcadores todavía no están disponibles.</p>
            : accionesPorDia.has(diaSeleccionado.dia)
              ? <ListaAccionesCliente acciones={accionesPorDia.get(diaSeleccionado.dia)!} gestion={gestionAcciones} />
              : <p>No hay acciones registradas para este día.</p>}
        </details>}
        <details className="evolucion-detalle-dia">
          <summary>Ver detalle del día</summary>
          <div className="evolucion-grupos-dia">
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
        </details>
      </div>
    </div>
  )
}
