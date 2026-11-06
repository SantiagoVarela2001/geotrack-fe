const fechaHoraArgentina = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'long', timeStyle: 'short', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires',
})

/** Presenta los instantes ISO del servidor en hora argentina y conserva los valores inválidos. */
export function obtenerMensajeError(error: unknown): string {
  const mensaje = error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
  return mensaje.replace(
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\b/g,
    (valor) => {
      const fecha = new Date(valor)
      return Number.isNaN(fecha.getTime()) ? valor : fechaHoraArgentina.format(fecha)
    },
  )
}

export function tienePermiso(permisos: string[], permiso: string): boolean {
  return permisos.includes(permiso)
}

/** Evita que enlaces recibidos de la API ejecuten esquemas distintos de HTTP(S). */
export function urlWebSegura(valor: string | null): string | null {
  if (!valor) return null
  try {
    const url = new URL(valor)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
