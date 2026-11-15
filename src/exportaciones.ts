import type { DatosExportacionConsultas } from './api/tipos'
import { fechaCalendarioValida, hoyArgentina } from './accionesCliente'

/** Incluye hoy dentro de los días elegidos y resta días calendario sin depender de la zona del navegador. */
export function fechaDesdeExportacion(dias: 15 | 30, hasta = hoyArgentina()): string {
  const fecha = new Date(`${hasta}T12:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() - (dias - 1))
  return fecha.toISOString().slice(0, 10)
}

/** Valida el inicio elegido contra el día argentino que limita la exportación. */
export function validarPeriodoExportacion(desde: string, hasta = hoyArgentina()): string | null {
  if (!fechaCalendarioValida(desde) || !fechaCalendarioValida(hasta)) return 'Elegí una fecha desde válida.'
  if (desde > hasta) return 'La fecha desde debe ser hoy o anterior.'
  return null
}

/** Reconoce los únicos estados que necesitan seguimiento periódico. */
export function exportacionEnCurso(proceso: DatosExportacionConsultas | null): boolean {
  return proceso?.estado === 'PENDIENTE' || proceso?.estado === 'PROCESANDO'
}

/** Descarta descargas vencidas sin depender de la hora local del navegador. */
export function archivoExportacionVigente(proceso: DatosExportacionConsultas | null, ahora = Date.now()): boolean {
  return Boolean(proceso?.archivoUuid && proceso.venceEn && Date.parse(proceso.venceEn) > ahora)
}

/** Detiene la espera inmediatamente al cerrar la ventana, sin dejar temporizadores activos. */
function esperarConsulta(senal: AbortSignal, demoraMs: number): Promise<void> {
  return new Promise((resolver) => {
    if (senal.aborted) { resolver(); return }
    const temporizador = setTimeout(() => {
      senal.removeEventListener('abort', cancelar)
      resolver()
    }, demoraMs)
    function cancelar() {
      clearTimeout(temporizador)
      resolver()
    }
    senal.addEventListener('abort', cancelar, { once: true })
  })
}

/** Consulta sin superponer peticiones y termina al cerrar el diálogo o completar el proceso. */
export async function seguirExportacion(
  consultar: () => Promise<DatosExportacionConsultas | null>,
  alActualizar: (proceso: DatosExportacionConsultas) => void,
  senal: AbortSignal,
  demoraMs = 3000,
): Promise<void> {
  while (!senal.aborted) {
    await esperarConsulta(senal, demoraMs)
    if (senal.aborted) return
    const proceso = await consultar()
    if (senal.aborted) return
    if (!proceso) throw new Error('No se pudo recuperar la exportación. Volvé a abrir esta ventana.')
    alActualizar(proceso)
    if (!exportacionEnCurso(proceso)) return
  }
}

/** Descarga únicamente los bytes autenticados y libera el recurso creado en el navegador. */
export function guardarExcel(archivo: Blob, nombre: string): void {
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  try {
    document.body.appendChild(enlace)
    enlace.click()
  } finally {
    enlace.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
