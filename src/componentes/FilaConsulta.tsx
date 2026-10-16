import type { MouseEvent } from 'react'
import type { DatosConsulta, DatosConsultaConEjecucionHoy, DatosEjecucionHoy } from '../api/tipos'
import { EtiquetaEstado, Icono } from './Comun'

/** Solo dos estados finales juntos significan que la consulta quedó analizada hoy. */
function estadoEjecucionHoy(datos: DatosEjecucionHoy) {
  if (datos.estadoEjecucion === 'PENDIENTE') return { texto: 'En espera hoy', tono: 'curso' }
  if (datos.estadoEjecucion === 'PROCESANDO') return { texto: 'En curso hoy', tono: 'curso' }
  if (datos.estadoEjecucion === 'FALLIDO') return { texto: 'Falló hoy', tono: 'fallo' }
  if (datos.estadoEjecucion === 'CANCELADA') return { texto: 'Cancelada hoy', tono: 'fallo' }
  if (datos.estadoNormalizacion === 'FINALIZADA') return { texto: 'Analizada hoy', tono: 'lista' }
  if (datos.estadoNormalizacion === 'PENDIENTE' || datos.estadoNormalizacion === 'PROCESANDO') {
    return { texto: 'Analizando hoy', tono: 'curso' }
  }
  if (datos.estadoNormalizacion === 'FALLIDA') return { texto: 'Análisis fallido hoy', tono: 'fallo' }
  if (datos.estadoNormalizacion === 'CANCELADA') return { texto: 'Análisis cancelado hoy', tono: 'fallo' }
  return { texto: 'Respondida hoy', tono: 'parcial' }
}

export function FilaConsulta({
  consulta,
  indice,
  seleccionada = false,
  deshabilitada = false,
  nombreTema,
  alAlternar,
  alCambiarTipo,
  alAbrirDetalle,
  alVerEjecucionHoy,
  alEjecutar,
  accionesBloqueadas = false,
  cambioTipoBloqueado = false,
}: {
  consulta: DatosConsulta | DatosConsultaConEjecucionHoy
  indice: number
  seleccionada?: boolean
  deshabilitada?: boolean
  nombreTema?: string
  alAlternar?: () => void
  alCambiarTipo?: () => void
  alAbrirDetalle?: () => void
  alVerEjecucionHoy?: (ejecucionUuid: string) => void
  alEjecutar?: () => void
  accionesBloqueadas?: boolean
  cambioTipoBloqueado?: boolean
}) {
  const esReferencia = consulta.tipoConsulta === 'REFERENCIA'
  const puedeCambiarTipo = Boolean(alCambiarTipo) && !cambioTipoBloqueado
  const puedeSeleccionar = Boolean(alAlternar) && !deshabilitada
  const ejecucionHoy = 'ejecucionHoy' in consulta ? consulta.ejecucionHoy : null
  const estadoHoy = ejecucionHoy ? estadoEjecucionHoy(ejecucionHoy) : null

  /** Hace seleccionable toda la fila sin activar también el checkbox o la estrella. */
  function seleccionarDesdeFila(evento: MouseEvent<HTMLElement>) {
    if (!puedeSeleccionar) return
    const objetivo = evento.target
    if (objetivo instanceof Element && objetivo.closest('button, input, a, select, textarea')) {
      return
    }
    alAlternar?.()
  }

  return (
    <article
      className={`consulta-fila ${esReferencia ? 'consulta-fila-referencia' : ''} ${seleccionada ? 'consulta-fila-seleccionada' : ''} ${puedeSeleccionar ? 'consulta-fila-seleccionable' : ''}`}
      onClick={puedeSeleccionar ? seleccionarDesdeFila : undefined}
    >
      {alAlternar && (
        <div className="consulta-seleccion">
          <input
            type="checkbox"
            aria-label={`Seleccionar consulta ${indice + 1}${nombreTema ? ` de ${nombreTema}` : ''}`}
            checked={seleccionada}
            disabled={deshabilitada}
            onChange={alAlternar}
          />
        </div>
      )}
      <div className="consulta-contenido">
        <div className="consulta-etiquetas">
          <span className="consulta-numero">{String(indice + 1).padStart(2, '0')}</span>
          <span>{esReferencia ? 'Referencia' : 'Descubrimiento'}</span>
          <span className="punto-separador">·</span>
          <span>Prioridad {consulta.prioridad.toLowerCase()}</span>
          {ejecucionHoy && estadoHoy && alVerEjecucionHoy && (
            <button
              className={`consulta-ejecucion-hoy consulta-ejecucion-hoy-${estadoHoy.tono}`}
              type="button"
              onClick={() => alVerEjecucionHoy(ejecucionHoy.uuid)}
              disabled={accionesBloqueadas}
              title={`${estadoHoy.texto}. Ver el detalle de esta ejecución.`}
              aria-label={`${estadoHoy.texto}. Ver ejecución de la consulta ${indice + 1}${nombreTema ? ` de ${nombreTema}` : ''}`}
            >
              <Icono nombre={estadoHoy.tono === 'lista' ? 'check' : 'ver'} tamano={13} />
              {estadoHoy.texto}
            </button>
          )}
        </div>
        <p>{consulta.texto}</p>
      </div>
      <div className="consulta-acciones">
        {consulta.estadoConsulta === 'APROBADA' && alEjecutar && (
          <button
            className="consulta-ejecutar-boton"
            type="button"
            onClick={alEjecutar}
            disabled={accionesBloqueadas}
            aria-label={`${ejecucionHoy ? 'Repetir hoy' : 'Ejecutar'} consulta ${indice + 1}${nombreTema ? ` de ${nombreTema}` : ''}`}
            title={ejecucionHoy
              ? 'Esta consulta ya tiene una ejecución hoy. Revisá el indicador antes de repetirla.'
              : undefined}
          >
            {ejecucionHoy ? 'Repetir hoy' : 'Ejecutar'}
          </button>
        )}
        {alAbrirDetalle && (
          <button
            className="consulta-detalle-boton"
            type="button"
            onClick={alAbrirDetalle}
            disabled={accionesBloqueadas}
            aria-label={`Ver detalle de la consulta ${indice + 1}${nombreTema ? ` de ${nombreTema}` : ''}`}
          >
            Ver detalle
          </button>
        )}
      </div>
      <button
        className={`consulta-tipo-boton ${esReferencia ? 'consulta-tipo-boton-referencia' : ''}`}
        type="button"
        onClick={alCambiarTipo}
        disabled={!puedeCambiarTipo}
        aria-label={
          puedeCambiarTipo
            ? esReferencia
              ? 'Cambiar consulta de referencia a descubrimiento'
              : 'Cambiar consulta de descubrimiento a referencia'
            : esReferencia
              ? 'Consulta de referencia; tipo no editable'
              : 'Consulta de descubrimiento; tipo no editable'
        }
        title={
          consulta.estadoConsulta === 'APROBADA'
            ? 'Las consultas aprobadas no pueden cambiar de tipo'
            : puedeCambiarTipo
              ? esReferencia
                ? 'Quitar de referencias'
                : 'Marcar como referencia'
              : 'No se puede cambiar el tipo de esta consulta'
        }
      >
        <Icono nombre="estrella" tamano={18} relleno={esReferencia} />
      </button>
      <EtiquetaEstado estado={consulta.estadoConsulta} />
    </article>
  )
}
