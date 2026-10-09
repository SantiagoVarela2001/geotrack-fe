export function obtenerMensajeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
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
