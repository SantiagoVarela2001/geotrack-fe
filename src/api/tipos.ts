export type Permiso =
  | 'ORGANIZACIONES_CREAR'
  | 'ORGANIZACIONES_VER'
  | 'USUARIOS_CREAR'
  | 'CLIENTES_CREAR'
  | 'CLIENTES_VER'
  | 'TEMAS_CREAR'
  | 'TEMAS_VER'
  | 'TEMAS_EDITAR'
  | 'CONSULTAS_CREAR'
  | 'CONSULTAS_VER'
  | 'CONSULTAS_APROBAR'
  | 'CONSULTAS_ELIMINAR'

export interface RespuestaAcceso {
  tokenAcceso: string
  tipoToken: 'Bearer'
  expiraEn: string
}

export interface DatosCuenta {
  usuario: string
  tipoCuenta: 'PLATAFORMA' | 'ORGANIZACION'
  organizacionUuid: string | null
  roles: string[]
  permisos: string[]
}

export interface Competidor {
  uuid: string
  nombre: string
  sitioWeb: string | null
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
  competidores: Array<{ nombre: string; sitioWeb?: string }>
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

export type SolicitudCrearConsulta = Pick<DatosConsulta, 'texto' | 'tipoConsulta' | 'prioridad'>

export interface DatosOrganizacion {
  uuid: string
  nombre: string
}

export interface RespuestaUsuario {
  uuid: string
  nombre: string
  correoElectronico: string
  rol: 'PROPIETARIO' | 'MIEMBRO'
}
