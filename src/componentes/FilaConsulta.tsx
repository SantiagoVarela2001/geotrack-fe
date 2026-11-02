import type { MouseEvent } from 'react'
import type { DatosConsulta, DatosConsultaConEjecucionHoy } from '../api/tipos'
import { EtiquetaEstado, Icono } from './Comun'
import { estadoEjecucionHoy } from '../consultas'
import { MenuAccionesConsulta, type AccionConsulta } from './MenuAccionesConsulta'

export function FilaConsulta({
  consulta,
  indice,
  seleccionada = false,
  deshabilitada = false,
  nombreTema,
  alAlternar,
  alCambiarTipo,
  alEditar,
  alCorregirMarca,
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
  alEditar?: () => void
  alCorregirMarca?: () => void
  alAbrirDetalle?: () => void
  alVerEjecucionHoy?: (ejecucionUuid: string) => void
  alEjecutar?: () => void
  accionesBloqueadas?: boolean
  cambioTipoBloqueado?: boolean
}) {
  const esReferencia = consulta.tipoConsulta === 'REFERENCIA'
  const puedeSeleccionar = Boolean(alAlternar) && !deshabilitada
  const ejecucionHoy = 'ejecucionHoy' in consulta ? consulta.ejecucionHoy : null
  const estadoHoy = ejecucionHoy ? estadoEjecucionHoy(ejecucionHoy) : null

  /** Hace seleccionable toda la fila sin activar también el checkbox, una acción o el menú. */
  function seleccionarDesdeFila(evento: MouseEvent<HTMLElement>) {
    if (!puedeSeleccionar) return
    const objetivo = evento.target
    if (objetivo instanceof Element && objetivo.closest('button, input, a, select, textarea, [role="menu"]')) {
      return
    }
    alAlternar?.()
  }

  const sufijo = `consulta ${indice + 1}${nombreTema ? ` de ${nombreTema}` : ''}`
  const acciones: AccionConsulta[] = []
  if (consulta.estadoConsulta === 'BORRADOR' && alEditar) acciones.push({
    clave: 'editar', texto: 'Editar', etiqueta: `Editar ${sufijo}`, ejecutar: alEditar,
  })
  if (ejecucionHoy && estadoHoy && alVerEjecucionHoy) acciones.push({
    clave: 'ejecucion',
    texto: estadoHoy.tono === 'fallo' ? 'Ver error' : estadoHoy.tono === 'curso' ? 'Ver progreso'
      : estadoHoy.tono === 'lista' ? 'Ver resultado' : 'Ver respuesta',
    etiqueta: `Ver ejecución de la ${sufijo}`,
    ejecutar: () => alVerEjecucionHoy(ejecucionHoy.uuid),
  })
  if (consulta.estadoConsulta === 'APROBADA' && alEjecutar) acciones.push({
    clave: 'ejecutar', texto: ejecucionHoy ? 'Repetir ejecución' : 'Ejecutar',
    etiqueta: `${ejecucionHoy ? 'Repetir hoy' : 'Ejecutar'} ${sufijo}`, ejecutar: alEjecutar,
  })
  if (alAbrirDetalle) acciones.push({ clave: 'detalle', texto: 'Ver detalle', etiqueta: `Ver detalle de la ${sufijo}`, ejecutar: alAbrirDetalle })
  const principal = acciones[0]
  const secundarias = acciones.slice(1)
  if (alCorregirMarca) secundarias.push({
    clave: 'marca', texto: 'Corregir clasificación', etiqueta: `Corregir clasificación de la ${sufijo}`, ejecutar: alCorregirMarca,
  })
  if (consulta.estadoConsulta === 'BORRADOR' && alCambiarTipo) secundarias.push({
    clave: 'tipo', texto: esReferencia ? 'Cambiar a descubrimiento' : 'Cambiar a referencia',
    etiqueta: esReferencia ? 'Cambiar consulta de referencia a descubrimiento' : 'Cambiar consulta de descubrimiento a referencia',
    ejecutar: alCambiarTipo, bloqueada: cambioTipoBloqueado,
  })

  return (
    <article
      className={`consulta-fila ${seleccionada ? 'consulta-fila-seleccionada' : ''} ${puedeSeleccionar ? 'consulta-fila-seleccionable' : ''}`}
      onClick={puedeSeleccionar ? seleccionarDesdeFila : undefined}>
      {alAlternar && (
        <div className="consulta-seleccion">
          <input type="checkbox" aria-label={`Seleccionar ${sufijo}`} checked={seleccionada}
            disabled={deshabilitada} onChange={alAlternar} />
        </div>
      )}
      <div className="consulta-contenido">
        <p>{consulta.texto}</p>
        <div className="consulta-etiquetas">
          <span className="consulta-clasificacion">{consulta.conMarca ? 'Con marca' : 'Sin marca'}</span>
          <span>{esReferencia ? 'Referencia' : 'Descubrimiento'}</span>
          <span>Prioridad {consulta.prioridad.toLowerCase()}</span>
        </div>
      </div>
      <div className="consulta-estados" aria-label={`Estados de la ${sufijo}`}>
        <EtiquetaEstado estado={consulta.estadoConsulta} />
        {estadoHoy ? (
          <span className={`consulta-ejecucion-hoy consulta-ejecucion-hoy-${estadoHoy.tono}`}>
            <Icono nombre={estadoHoy.tono === 'lista' ? 'check' : estadoHoy.tono === 'fallo' ? 'cerrar' : 'ver'} tamano={13} />
            {estadoHoy.texto}
          </span>
        ) : consulta.estadoConsulta === 'APROBADA' ? <span className="consulta-sin-ejecucion">Sin ejecución hoy</span> : null}
      </div>
      <div className="consulta-acciones">
        {principal && (
          <button className={`consulta-accion-principal ${principal.clave === 'ejecutar' ? 'consulta-accion-ejecutar' : ''}`}
            type="button" onClick={principal.ejecutar} disabled={accionesBloqueadas} aria-label={principal.etiqueta}>
            {principal.texto}
            <Icono nombre={principal.clave === 'editar' ? 'editar' : principal.clave === 'ejecutar' ? 'flecha' : 'ver'} tamano={14} />
          </button>
        )}
        {secundarias.length > 0 && <MenuAccionesConsulta acciones={secundarias}
          etiqueta={`Más acciones de la ${sufijo}`} bloqueado={accionesBloqueadas} />}
      </div>
    </article>
  )
}
