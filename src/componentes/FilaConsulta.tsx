import type { MouseEvent } from 'react'
import type { DatosConsulta } from '../api/tipos'
import { EtiquetaEstado, Icono } from './Comun'

export function FilaConsulta({
  consulta,
  indice,
  seleccionada = false,
  deshabilitada = false,
  nombreTema,
  alAlternar,
  alCambiarTipo,
  alAbrirDetalle,
  alEjecutar,
  accionesBloqueadas = false,
  cambioTipoBloqueado = false,
}: {
  consulta: DatosConsulta
  indice: number
  seleccionada?: boolean
  deshabilitada?: boolean
  nombreTema?: string
  alAlternar?: () => void
  alCambiarTipo?: () => void
  alAbrirDetalle?: () => void
  alEjecutar?: () => void
  accionesBloqueadas?: boolean
  cambioTipoBloqueado?: boolean
}) {
  const esReferencia = consulta.tipoConsulta === 'REFERENCIA'
  const puedeCambiarTipo = Boolean(alCambiarTipo) && !cambioTipoBloqueado
  const puedeSeleccionar = Boolean(alAlternar) && !deshabilitada

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
            aria-label={`Ejecutar consulta ${indice + 1}${nombreTema ? ` de ${nombreTema}` : ''}`}
          >
            Ejecutar
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
