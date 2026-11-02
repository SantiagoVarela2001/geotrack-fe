import type { BloqueInformeSemanal, InformeSemanalSeparado } from './api/tipos'

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
}

function sonReferencias(valor: unknown): valor is string[] {
  return Array.isArray(valor) && valor.every((referencia) => typeof referencia === 'string')
}

export function esBloqueInforme(valor: unknown): valor is BloqueInformeSemanal {
  return esObjeto(valor) && typeof valor.resumen === 'string' &&
    Array.isArray(valor.hallazgos) && valor.hallazgos.every((hallazgo) =>
      esObjeto(hallazgo) && typeof hallazgo.descripcion === 'string' && sonReferencias(hallazgo.ejecuciones)) &&
    Array.isArray(valor.recomendaciones) && valor.recomendaciones.every((recomendacion) =>
      esObjeto(recomendacion) && typeof recomendacion.titulo === 'string' &&
      typeof recomendacion.accion === 'string' &&
      typeof recomendacion.prioridad === 'string' && ['ALTA', 'MEDIA', 'BAJA'].includes(recomendacion.prioridad) && sonReferencias(recomendacion.ejecuciones))
}

export function esInformeSeparado(valor: unknown): valor is InformeSemanalSeparado {
  return esObjeto(valor) && esBloqueInforme(valor.sinMarca) && esBloqueInforme(valor.conMarca)
}

/** Un formato parcialmente separado nunca se interpreta como un informe anterior. */
export function formatoInforme(valor: unknown): 'separado' | 'anterior' | 'ausente' | 'invalido' {
  if (valor === null) return 'ausente'
  if (esObjeto(valor) && ('sinMarca' in valor || 'conMarca' in valor)) {
    return esInformeSeparado(valor) ? 'separado' : 'invalido'
  }
  return esBloqueInforme(valor) ? 'anterior' : 'invalido'
}
