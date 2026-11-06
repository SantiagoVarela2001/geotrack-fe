import type { DatosAccionCliente, DatosCliente, DatosCuenta, SolicitudAccionCliente } from './api/tipos'
import { tienePermiso, urlWebSegura } from './utilidades'

const calendarioArgentina = new Intl.DateTimeFormat('es-AR', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
})
const fechaVisible = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
})

export function hoyArgentina(instante = new Date()): string {
  const partes = calendarioArgentina.formatToParts(instante)
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)!.value
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

/** Usa UTC únicamente para comprobar el calendario, sin trasladar el día a la zona del navegador. */
export function fechaCalendarioValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha.startsWith('0000')) return false
  const instante = new Date(`${fecha}T12:00:00Z`)
  return Number.isFinite(instante.getTime()) && instante.toISOString().slice(0, 10) === fecha
}

export function fechaAccionLegible(fecha: string): string {
  return fechaCalendarioValida(fecha) ? fechaVisible.format(new Date(`${fecha}T12:00:00Z`)) : fecha
}

export function permisosAcciones(cuenta: DatosCuenta, cliente: DatosCliente | null) {
  const escritura = cuenta.tipoCuenta === 'ORGANIZACION' && cliente?.estado === 'ACTIVO'
  return {
    ver: tienePermiso(cuenta.permisos, 'ACCIONES_VER'),
    crear: escritura && tienePermiso(cuenta.permisos, 'ACCIONES_CREAR'),
    editar: escritura && tienePermiso(cuenta.permisos, 'ACCIONES_EDITAR'),
    eliminar: escritura && tienePermiso(cuenta.permisos, 'ACCIONES_ELIMINAR'),
  }
}

export function validarAccion(datos: SolicitudAccionCliente, hoy = hoyArgentina()): string | null {
  if (!datos.titulo.trim()) return 'Ingresá el título de la acción.'
  if (datos.titulo.trim().length > 200) return 'El título admite hasta 200 caracteres.'
  if (!fechaCalendarioValida(datos.fecha)) return 'Ingresá una fecha válida.'
  if (datos.fecha > hoy) return 'La fecha debe ser hoy o anterior, según el horario de Argentina.'
  if ((datos.descripcion?.trim().length ?? 0) > 2000) return 'La descripción admite hasta 2000 caracteres.'
  const url = datos.url?.trim()
  if (url && (url.length > 2048 || !/^https?:\/\//i.test(url) || !urlWebSegura(url))) {
    return 'Ingresá una URL completa HTTP o HTTPS de hasta 2048 caracteres.'
  }
  return null
}

/** Agrupa sin alterar el orden recibido ni modificar las series de métricas. */
export function agruparAccionesPorDia(acciones: readonly DatosAccionCliente[]) {
  const grupos = new Map<string, DatosAccionCliente[]>()
  for (const accion of acciones) {
    const grupo = grupos.get(accion.fecha) ?? []
    grupo.push(accion)
    grupos.set(accion.fecha, grupo)
  }
  return grupos
}
