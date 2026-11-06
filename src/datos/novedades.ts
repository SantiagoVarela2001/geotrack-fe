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

// Cada novedad permanece vigente una semana, con horario de Argentina.
export const novedades: Novedad[] = [
  {
    id: 'acciones-realizadas-evolucion-marca',
    titulo: 'Tus acciones, junto a la evolución de tu marca',
    descripcion:
      'Cada avance cuenta. Llegó un espacio para registrar publicaciones, mejoras en tu sitio y otras acciones de tu marca. Consultá el historial y encontrá cada acción marcada en el gráfico de evolución: una forma más clara de revisar qué hiciste y cómo cambió tu presencia en IA a lo largo del tiempo.',
    publicadaEn: '2026-11-06T00:00:00-03:00',
    expiraEn: '2026-11-13T00:00:00-03:00',
    permisos: ['ACCIONES_VER', 'ACCIONES_CREAR'],
  },
  {
    id: 'contexto-agente-analisis-semanal',
    titulo: 'Tu agente semanal, más enfocado en lo que importa',
    descripcion:
      'Mejoramos el contexto que recibe tu agente semanal para concentrar el análisis en la información relevante de tu marca. Una lectura más clara de tu presencia en IA, con hallazgos y recomendaciones mejor enfocados para ayudarte a decidir dónde poner el próximo esfuerzo.',
    publicadaEn: '2026-11-06T00:00:00-03:00',
    expiraEn: '2026-11-13T00:00:00-03:00',
    permisos: ['ANALISIS_SEMANALES_VER'],
  },
  {
    id: 'reconocimiento-competidores-dominios-citas',
    titulo: 'Mejor reconocimiento de competidores',
    descripcion:
      'Ahora reconocemos referencias a tus competidores por nombre, dominio y subdominio. Las apariciones en fuentes citadas también cuentan en sus métricas. Los resultados anteriores se conservan.',
    publicadaEn: '2026-11-04T00:00:00-03:00',
    expiraEn: '2026-11-11T00:00:00-03:00',
    permisos: ['CONSULTAS_VER'],
  },
  {
    id: 'competidores-detectados-informe-semanal',
    titulo: 'Descubrí competidores en tus informes semanales',
    descripcion:
      'Los nuevos informes semanales muestran los competidores detectados en las respuestas analizadas, incluso si no los cargaste en tu lista. Podés ver la pregunta en la que aparecieron y consultar la fuente cuando esté disponible.',
    publicadaEn: '2026-11-04T00:00:00-03:00',
    expiraEn: '2026-11-11T00:00:00-03:00',
    permisos: ['ANALISIS_SEMANALES_VER'],
  },
  {
    id: 'consultas-informes-con-sin-marca',
    titulo: 'Consultas e informes semanales con y sin marca',
    descripcion:
      'Ahora podés distinguir las consultas que nombran tu marca de las que no la incluyen. Los nuevos informes semanales también separan los resultados para diferenciar la presencia espontánea de las respuestas a preguntas que mencionan tu marca.',
    publicadaEn: '2026-11-04T00:00:00-03:00',
    expiraEn: '2026-11-11T00:00:00-03:00',
    permisos: ['CONSULTAS_VER', 'ANALISIS_SEMANALES_VER'],
  },
  {
    id: 'corregir-clasificacion-consulta',
    titulo: 'Corregí la clasificación de tus consultas',
    descripcion:
      'Podés indicar si una consulta es con marca o sin marca y corregir su clasificación, incluso después de aprobarla. El cambio se aplica a las próximas ejecuciones; las anteriores y las que ya están en cola conservan su clasificación original.',
    publicadaEn: '2026-11-04T00:00:00-03:00',
    expiraEn: '2026-11-11T00:00:00-03:00',
    permisos: ['CONSULTAS_EDITAR'],
    tiposCuenta: ['ORGANIZACION'],
  },
  {
    id: 'editar-consultas-borrador',
    titulo: 'Editá tus consultas en borrador',
    descripcion:
      'Antes de aprobar una consulta, podés modificar su texto, tema, prioridad, tipo y clasificación con o sin marca. Ajustá tus preguntas mientras estén en borrador.',
    publicadaEn: '2026-11-04T00:00:00-03:00',
    expiraEn: '2026-11-11T00:00:00-03:00',
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
