import type { DatosCliente, DatosConsulta, DatosCuenta, DatosEjecucionHoy, DatosTemaConConsultas, SolicitudCrearConsulta } from './api/tipos'

export type BorradorConsulta = Omit<SolicitudCrearConsulta, 'conMarca'> & { conMarca: boolean | null }

/** La ausencia de elección es distinta de false; nunca se clasifica a partir del texto. */
export function clasificacionValida(valor: unknown): valor is boolean {
  return typeof valor === 'boolean'
}

export function leerClasificacion(valor: string): boolean | null {
  return valor === 'conMarca' ? true : valor === 'sinMarca' ? false : null
}

export function prepararConsultas(filas: BorradorConsulta[]): SolicitudCrearConsulta[] {
  return filas.map((fila) => {
    if (!clasificacionValida(fila.conMarca)) throw new Error('Elegí Con marca o Sin marca para cada consulta.')
    return { ...fila, texto: fila.texto.trim(), conMarca: fila.conMarca }
  })
}

export function puedeCorregirMarca(cuenta: DatosCuenta, cliente: DatosCliente | null): boolean {
  return cuenta.tipoCuenta === 'ORGANIZACION' && !cuenta.roles.includes('SYSADMIN') &&
    cliente?.estado === 'ACTIVO' && cuenta.permisos.includes('CONSULTAS_EDITAR')
}

/** Conserva campos de la vista, como ejecucionHoy, al aplicar el DTO de escritura. */
export function reemplazarConsultas<T extends DatosConsulta>(actuales: T[], nuevas: DatosConsulta[]): T[] {
  const porUuid = new Map(nuevas.map((consulta) => [consulta.uuid, consulta]))
  return actuales.map((consulta) => ({ ...consulta, ...porUuid.get(consulta.uuid) }))
}

/** Mueve por UUID la consulta a su tema destino sin duplicarla ni perder su ejecución de hoy. */
export function actualizarAgrupados(temas: DatosTemaConConsultas[], actualizada: DatosConsulta): DatosTemaConConsultas[] {
  const anterior = temas.flatMap((tema) => tema.consultas).find((consulta) => consulta.uuid === actualizada.uuid)
  return temas.map((tema) => ({
    ...tema,
    consultas: tema.uuid === actualizada.temaUuid
      ? tema.consultas.some((consulta) => consulta.uuid === actualizada.uuid)
        ? reemplazarConsultas(tema.consultas, [actualizada])
        : [...tema.consultas, { ejecucionHoy: null, ...anterior, ...actualizada }]
      : tema.consultas.filter((consulta) => consulta.uuid !== actualizada.uuid),
  }))
}

/** Solo dos estados finales juntos significan que la consulta quedó analizada hoy. */
export function estadoEjecucionHoy(datos: DatosEjecucionHoy) {
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

