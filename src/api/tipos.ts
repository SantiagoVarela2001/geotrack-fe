export type Permiso =
  | 'PLANES_VER'
  | 'ORGANIZACIONES_CREAR'
  | 'ORGANIZACIONES_VER'
  | 'ORGANIZACIONES_LOGO_EDITAR'
  | 'GASTOS_IA_VER'
  | 'USUARIOS_CREAR'
  | 'USUARIOS_VER'
  | 'USUARIOS_ELIMINAR'
  | 'USUARIOS_REACTIVAR'
  | 'CLIENTES_CREAR'
  | 'CLIENTES_VER'
  | 'CLIENTES_CAMBIAR_ESTADO'
  | 'COMPETIDORES_CREAR'
  | 'COMPETIDORES_ELIMINAR'
  | 'TEMAS_CREAR'
  | 'TEMAS_VER'
  | 'TEMAS_EDITAR'
  | 'CONSULTAS_CREAR'
  | 'CONSULTAS_VER'
  | 'CONSULTAS_CAMBIAR_TIPO'
  | 'CONSULTAS_APROBAR'
  | 'CONSULTAS_ELIMINAR'
  | 'CONSULTAS_EJECUTAR'

export interface RespuestaAcceso {
  tokenAcceso: string
  tipoToken: 'Bearer'
  expiraEn: string
}

export interface DatosCuenta {
  usuario: string
  tipoCuenta: 'PLATAFORMA' | 'ORGANIZACION'
  organizacionUuid: string | null
  nombreOrganizacion: string | null
  logoUrl: string | null
  roles: string[]
  permisos: string[]
}

export interface DatosPerfil {
  uuid: string
  nombre: string
  correoElectronico: string | null
  tipoCuenta: DatosCuenta['tipoCuenta']
}

export interface Competidor {
  uuid: string
  nombre: string
  sitioWeb: string | null
}

export interface SolicitudCompetidor {
  nombre: string
  sitioWeb?: string
}

export interface DatosCliente {
  uuid: string
  organizacionUuid: string
  nombre: string
  nombreMarca: string
  sitioWeb: string
  descripcion: string | null
  rubro: string
  pais: string
  idioma: string
  estado: 'ACTIVO' | 'ARCHIVADO'
  competidores: Competidor[]
}

export interface SolicitudCrearCliente {
  nombre: string
  nombreMarca: string
  sitioWeb: string
  descripcion?: string
  rubro: string
  pais: string
  idioma: string
  competidores: SolicitudCompetidor[]
}

export interface DatosTema {
  uuid: string
  clienteUuid: string
  nombre: string
}

export interface DatosConsulta {
  uuid: string
  clienteUuid: string
  temaUuid: string
  texto: string
  tipoConsulta: 'REFERENCIA' | 'DESCUBRIMIENTO'
  estadoConsulta: 'BORRADOR' | 'APROBADA'
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA'
}

export interface DatosEjecucionHoy {
  uuid: string
  estadoEjecucion: 'PENDIENTE' | 'PROCESANDO' | 'FINALIZADO' | 'FALLIDO' | 'CANCELADA'
  estadoNormalizacion:
    | 'NO_REALIZADA' | 'PENDIENTE' | 'PROCESANDO' | 'FINALIZADA' | 'FALLIDA' | 'CANCELADA'
}

export interface DatosConsultaConEjecucionHoy extends DatosConsulta {
  ejecucionHoy: DatosEjecucionHoy | null
}

export interface DatosTemaConConsultas extends DatosTema {
  consultas: DatosConsultaConEjecucionHoy[]
}

export interface FuenteCitadaIA {
  url: string
  titulo: string | null
  indiceInicio: number | null
  indiceFin: number | null
}

export interface ResultadoNormalizadoConsulta {
  nombreMarca: string
  marcaMencionada: boolean
  posicionMarca: number | null
  evidenciaMarca: string | null
  modeloNormalizador: string
  competidores: {
    competidorUuid: string
    nombreCompetidor: string
    mencionado: boolean
    posicion: number | null
    evidencia: string | null
  }[]
  fuentes: (FuenteCitadaIA & { dominio: string })[]
}

export interface DatosEjecucionConsulta {
  uuid: string
  consultaUuid: string
  clienteUuid: string
  estado: 'PENDIENTE' | 'PROCESANDO' | 'FINALIZADO' | 'FALLIDO' | 'CANCELADA'
  textoConsulta: string
  tipoConsulta: DatosConsulta['tipoConsulta']
  nombreTema: string
  proveedor: string
  modelo: string
  fechaInicio: string | null
  fechaFin: string | null
  duracionMs: number | null
  mensaje: string | null
  respuestaTexto: string | null
  cantidadBusquedas: number | null
  cantidadLlamadasWeb: number | null
  tokensEntrada?: number | null
  tokensSalida?: number | null
  costoEstimadoUsd?: number | null
  citas: FuenteCitadaIA[]
  estadoNormalizacion: 'NO_REALIZADA' | 'PENDIENTE' | 'PROCESANDO' | 'FINALIZADA' | 'FALLIDA' | 'CANCELADA'
  mensajeNormalizacion: string | null
  resultadoNormalizado: ResultadoNormalizadoConsulta | null
}

export interface DatosMetricasDia {
  dia: string
  ejecuciones: number
  analizadas: number
  pendientes: number
  fallidas: number
  mencionesMarca: number
  tasaMencionMarca: number | null
  conCitas: number
  tasaCitas: number | null
  conCitasSitioCliente: number
  tasaCitasSitioCliente: number | null
  modelosAnalizados: Record<string, number>
}

export interface DatosMetricasCompetidor {
  competidorUuid: string
  nombre: string
  evaluaciones: number
  menciones: number
  tasaMencion: number | null
}

export interface DatosMetricasCliente {
  clienteUuid: string
  desde: string
  hasta: string
  ejecuciones: number
  analizadas: number
  pendientes: number
  fallidas: number
  mencionesMarca: number
  tasaMencionMarca: number | null
  conCitas: number
  tasaCitas: number | null
  conCitasSitioCliente: number
  tasaCitasSitioCliente: number | null
  serieDiaria: DatosMetricasDia[]
  competidores: DatosMetricasCompetidor[]
}

export interface DatosAnalisisSemanal {
  uuid: string
  clienteUuid: string
  desde: string
  hasta: string
  estado: 'PENDIENTE' | 'PROCESANDO' | 'FINALIZADO' | 'FALLIDO' | 'CANCELADO'
  fechaInicio: string | null
  fechaFin: string | null
  intentos: number
  mensaje: string | null
  informe: {
    resumen: string
    hallazgos: { descripcion: string; ejecuciones: string[] }[]
    recomendaciones: {
      titulo: string
      accion: string
      prioridad: 'ALTA' | 'MEDIA' | 'BAJA'
      ejecuciones: string[]
    }[]
  } | null
}

export interface Pagina<T> {
  content: T[]
  number: number
  totalPages: number
  totalElements: number
}

export type SolicitudCrearConsulta = Pick<DatosConsulta, 'texto' | 'tipoConsulta' | 'prioridad'>

export interface DatosGeneracionConsultas {
  procesoUuid: string
  estado: 'PENDIENTE' | 'PROCESANDO' | 'FINALIZADO' | 'FALLIDO'
  mensaje: string | null
  advertencia: string | null
  temas: DatosTema[]
  consultas: DatosConsulta[]
}

export interface DatosOrganizacion {
  uuid: string
  nombre: string
  logoUrl: string | null
}

export interface DatosGastoIaOrganizacion {
  uuid: string
  nombre: string
  activa: boolean
  costoEstimadoUsd: number
  llamadasSinCostoEstimado: number
}

export interface DatosPlan {
  uuid: string
  nombre: string
  limiteClientesActivos: number
}

export interface SolicitudCrearOrganizacion {
  nombre: string
  planUuid: string
}

export interface RespuestaUsuario {
  uuid: string
  nombre: string
  correoElectronico: string
  rol: 'PROPIETARIO' | 'MIEMBRO'
}

export interface DatosUsuarioOrganizacion {
  uuid: string
  nombre: string
  correoElectronico: string
  roles: string[]
  activo: boolean
  fechaEliminacion: string | null
}
