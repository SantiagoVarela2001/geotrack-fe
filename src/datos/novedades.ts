import type { DatosCuenta } from '../api/tipos'

export interface Novedad {
  id: string
  titulo: string
  descripcion: string
  publicadaEn: string
  expiraEn: string
  permisos?: string[]
  tiposCuenta?: DatosCuenta['tipoCuenta'][]
}

// Fechas con zona horaria explícita: estas novedades duran 48 horas desde su publicación.
export const novedades: Novedad[] = [
  {
    id: 'consultas-informes-con-sin-marca',
    titulo: 'Consultas e informes semanales con y sin marca',
    descripcion:
      'Ahora podés distinguir las consultas que nombran tu marca de las que no la incluyen. Los nuevos informes semanales también separan los resultados para diferenciar la presencia espontánea de las respuestas a preguntas que mencionan tu marca.',
    publicadaEn: '2026-11-02T00:00:00-03:00',
    expiraEn: '2026-11-04T00:00:00-03:00',
    permisos: ['CONSULTAS_VER', 'ANALISIS_SEMANALES_VER'],
  },
  {
    id: 'corregir-clasificacion-consulta',
    titulo: 'Corregí la clasificación de tus consultas',
    descripcion:
      'Podés indicar si una consulta es con marca o sin marca y corregir su clasificación, incluso después de aprobarla. El cambio se aplica a las próximas ejecuciones; las anteriores y las que ya están en cola conservan su clasificación original.',
    publicadaEn: '2026-11-02T00:00:00-03:00',
    expiraEn: '2026-11-04T00:00:00-03:00',
    permisos: ['CONSULTAS_EDITAR'],
    tiposCuenta: ['ORGANIZACION'],
  },
  {
    id: 'editar-consultas-borrador',
    titulo: 'Editá tus consultas en borrador',
    descripcion:
      'Antes de aprobar una consulta, podés modificar su texto, tema, prioridad, tipo y clasificación con o sin marca. Ajustá tus preguntas mientras estén en borrador.',
    publicadaEn: '2026-11-02T00:00:00-03:00',
    expiraEn: '2026-11-04T00:00:00-03:00',
    permisos: ['CONSULTAS_EDITAR'],
    tiposCuenta: ['ORGANIZACION'],
  },
]

/** Basta uno de los permisos indicados; fechas inválidas o intervalos vacíos ocultan el anuncio. */
export function obtenerNovedadesVigentes(
  cuenta: DatosCuenta,
  ahora = Date.now(),
  listado: readonly Novedad[] = novedades,
): Novedad[] {
  return listado
    .filter((novedad) => {
      const publicacion = Date.parse(novedad.publicadaEn)
      const expiracion = Date.parse(novedad.expiraEn)
      return (
        publicacion <= ahora && ahora < expiracion &&
        (!novedad.tiposCuenta || novedad.tiposCuenta.includes(cuenta.tipoCuenta)) &&
        (!novedad.permisos?.length || novedad.permisos.some((permiso) => cuenta.permisos.includes(permiso)))
      )
    })
    .sort((primera, segunda) => Date.parse(segunda.publicadaEn) - Date.parse(primera.publicadaEn))
}
