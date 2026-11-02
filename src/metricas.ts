import type { DatosMetricasCliente, DatosMetricasDia } from './api/tipos'

export const gruposMetricas = [
  { clave: 'sinMarca', etiqueta: 'Sin marca', descripcion: 'Presencia espontánea' },
  { clave: 'conMarca', etiqueta: 'Con marca', descripcion: 'Preguntas que hacen referencia a la marca' },
] as const

const porcentajes = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

export function tasaLegible(valor: number | null): string {
  return valor === null ? 'Sin muestra' : `${porcentajes.format(valor)} %`
}

/** Alinea por fecha; null conserva la ausencia de un día o de una muestra, sin inventar tasas. */
export function alinearSeries(metricas: DatosMetricasCliente) {
  const sinMarca = new Map(metricas.sinMarca.serieDiaria.map((dia) => [dia.dia, dia]))
  const conMarca = new Map(metricas.conMarca.serieDiaria.map((dia) => [dia.dia, dia]))
  const fechas = new Set([...sinMarca.keys(), ...conMarca.keys()])
  const inicio = Date.parse(`${metricas.desde}T00:00:00Z`)
  const fin = Date.parse(`${metricas.hasta}T00:00:00Z`)
  for (let instante = inicio; instante <= fin; instante += 86_400_000) {
    fechas.add(new Date(instante).toISOString().slice(0, 10))
  }
  return [...fechas].sort().map((dia): {
    dia: string; sinMarca: DatosMetricasDia | null; conMarca: DatosMetricasDia | null
  } => ({ dia, sinMarca: sinMarca.get(dia) ?? null, conMarca: conMarca.get(dia) ?? null }))
}
