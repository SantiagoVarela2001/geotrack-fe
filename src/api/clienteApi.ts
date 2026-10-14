import type {
  DatosCliente,
  DatosConsulta,
  DatosCuenta,
  DatosEjecucionConsulta,
  DatosGeneracionConsultas,
  DatosMetricasCliente,
  DatosOrganizacion,
  DatosPlan,
  DatosTema,
  DatosTemaConConsultas,
  RespuestaAcceso,
  RespuestaUsuario,
  SolicitudCrearCliente,
  SolicitudCrearConsulta,
  SolicitudCrearOrganizacion,
} from './tipos'

let tokenAcceso: string | null = null
let renovacionPendiente: Promise<RespuestaAcceso> | null = null
let alExpirarSesion: (() => void) | null = null

export class ErrorApi extends Error {
  readonly estado: number

  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.estado = estado
  }
}

export function configurarExpiracionSesion(accion: () => void): void {
  alExpirarSesion = accion
}

export function limpiarSesion(): void {
  tokenAcceso = null
}

/** Usa detail cuando existe, sin depender del formato de error de cada endpoint. */
async function crearError(respuesta: Response): Promise<ErrorApi> {
  let detalle: string | undefined
  if (respuesta.headers.get('content-type')?.includes('json')) {
    try {
      const cuerpo: unknown = await respuesta.json()
      if (cuerpo && typeof cuerpo === 'object' && 'detail' in cuerpo) {
        const valor = cuerpo.detail
        if (typeof valor === 'string' && valor.trim()) detalle = valor
      }
    } catch {
      // El estado HTTP sigue siendo válido aunque el body sea ilegible.
    }
  }

  const mensajes: Record<number, string> = {
    400: 'Revisá los datos ingresados.',
    401: 'La sesión no es válida. Ingresá nuevamente.',
    403: 'Tu cuenta no tiene permiso para esta acción.',
    404: 'El recurso no existe o no está disponible para tu cuenta.',
    409: 'La operación entra en conflicto con el estado actual.',
    503: 'La generación no está disponible en este momento.',
  }
  return new ErrorApi(
    respuesta.status,
    detalle ?? mensajes[respuesta.status] ?? 'No se pudo completar la solicitud.',
  )
}

/** Rota la cookie una sola vez cuando varias peticiones encuentran el acceso vencido. */
async function renovarAcceso(): Promise<RespuestaAcceso> {
  if (!renovacionPendiente) {
    renovacionPendiente = (async () => {
      const respuesta = await fetch('/api/autenticacion/renovar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Solicitud-API': '1' },
      })
      if (!respuesta.ok) throw await crearError(respuesta)
      const acceso = (await respuesta.json()) as RespuestaAcceso
      tokenAcceso = acceso.tokenAcceso
      return acceso
    })().finally(() => {
      renovacionPendiente = null
    })
  }
  return renovacionPendiente
}

/** Conserva el JWT solo en memoria y reintenta una petición protegida una vez. */
async function solicitar<T>(
  ruta: string,
  opciones: RequestInit = {},
  protegida = true,
  reintento = true,
): Promise<T> {
  const tokenDeSolicitud = tokenAcceso
  const encabezados = new Headers(opciones.headers)
  if (opciones.body !== undefined) encabezados.set('Content-Type', 'application/json')
  if (protegida && tokenDeSolicitud) encabezados.set('Authorization', `Bearer ${tokenDeSolicitud}`)

  let respuesta: Response
  try {
    respuesta = await fetch(ruta, {
      ...opciones,
      headers: encabezados,
      credentials: 'include',
    })
  } catch {
    throw new ErrorApi(
      0,
      'No se pudo conectar con la API. Revisá la conexión e intentá nuevamente.',
    )
  }

  if (respuesta.status === 401 && protegida && reintento) {
    try {
      if (!tokenAcceso || tokenAcceso === tokenDeSolicitud) await renovarAcceso()
      return solicitar<T>(ruta, opciones, true, false)
    } catch {
      limpiarSesion()
      alExpirarSesion?.()
      throw new ErrorApi(401, 'La sesión venció. Ingresá nuevamente.')
    }
  }
  if (respuesta.status === 401 && protegida) {
    limpiarSesion()
    alExpirarSesion?.()
  }
  if (!respuesta.ok) throw await crearError(respuesta)
  if (respuesta.status === 204) return undefined as T
  return (await respuesta.json()) as T
}

export const api = {
  /** Restaura la sesión exclusivamente a partir de la cookie HttpOnly. */
  async restaurarSesion(): Promise<DatosCuenta> {
    await renovarAcceso()
    return solicitar<DatosCuenta>('/api/autenticacion/actual')
  },
  async ingresar(usuario: string, clave: string): Promise<DatosCuenta> {
    const acceso = await solicitar<RespuestaAcceso>(
      '/api/autenticacion/ingresar',
      {
        method: 'POST',
        body: JSON.stringify({ usuario, clave }),
      },
      false,
    )
    tokenAcceso = acceso.tokenAcceso
    try {
      return await solicitar<DatosCuenta>('/api/autenticacion/actual')
    } catch (causa) {
      limpiarSesion()
      throw causa
    }
  },
  async salir(): Promise<void> {
    try {
      await solicitar<void>(
        '/api/autenticacion/salir',
        {
          method: 'POST',
          headers: { 'X-Solicitud-API': '1' },
        },
        false,
      )
    } finally {
      limpiarSesion()
    }
  },
  clientes: {
    listar: () => solicitar<DatosCliente[]>('/api/clientes-monitoreados'),
    obtener: (uuid: string) =>
      solicitar<DatosCliente>(`/api/clientes-monitoreados/${encodeURIComponent(uuid)}`),
    cambiarEstado: (uuid: string, estado: DatosCliente['estado']) =>
      solicitar<DatosCliente>(`/api/clientes-monitoreados/${encodeURIComponent(uuid)}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      }),
    crear: (datos: SolicitudCrearCliente) =>
      solicitar<DatosCliente>('/api/clientes-monitoreados', {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
  },
  metricas: {
    obtener: (clienteUuid: string, desde: string, hasta: string) =>
      solicitar<DatosMetricasCliente>(
        `/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/metricas?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
      ),
  },
  temas: {
    listar: (clienteUuid: string) =>
      solicitar<DatosTema[]>(`/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/temas`),
    crear: (clienteUuid: string, nombre: string) =>
      solicitar<DatosTema>(`/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/temas`, {
        method: 'POST',
        body: JSON.stringify({ nombre }),
      }),
    renombrar: (clienteUuid: string, temaUuid: string, nombre: string) =>
      solicitar<DatosTema>(
        `/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/temas/${encodeURIComponent(temaUuid)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ nombre }),
        },
      ),
  },
  consultas: {
    listarPorTema: (clienteUuid: string) =>
      solicitar<DatosTemaConConsultas[]>(
        `/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/consultas/por-tema`,
      ),
    /** Un 204 indica que el cliente aún no tiene un proceso de generación. */
    async obtenerGeneracion(clienteUuid: string): Promise<DatosGeneracionConsultas | null> {
      const datos = await solicitar<DatosGeneracionConsultas | undefined>(
        `/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/consultas/generacion`,
      )
      return datos ?? null
    },
    iniciarGeneracion: (clienteUuid: string) =>
      solicitar<DatosGeneracionConsultas>(
        `/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/consultas/generacion`,
        { method: 'POST' },
      ),
    listar: (clienteUuid: string, temaUuid: string) =>
      solicitar<DatosConsulta[]>(
        `/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/temas/${encodeURIComponent(temaUuid)}/consultas`,
      ),
    obtener: (clienteUuid: string, temaUuid: string, consultaUuid: string) =>
      solicitar<DatosConsulta>(
        `/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/temas/${encodeURIComponent(temaUuid)}/consultas/${encodeURIComponent(consultaUuid)}`,
      ),
    cambiarTipo: (
      clienteUuid: string,
      consultaUuid: string,
      tipoConsulta: DatosConsulta['tipoConsulta'],
    ) =>
      solicitar<DatosConsulta>(
        `/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/consultas/${encodeURIComponent(consultaUuid)}/tipo`,
        {
          method: 'PATCH',
          body: JSON.stringify({ tipoConsulta }),
        },
      ),
    crear: (clienteUuid: string, temaUuid: string, datos: SolicitudCrearConsulta[]) =>
      solicitar<DatosConsulta[]>(
        `/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/temas/${encodeURIComponent(temaUuid)}/consultas`,
        {
          method: 'POST',
          body: JSON.stringify(datos),
        },
      ),
    aprobar: (clienteUuid: string, uuids: string[]) =>
      solicitar<DatosConsulta[]>(
        `/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/consultas/aprobaciones`,
        {
          method: 'POST',
          body: JSON.stringify(uuids),
        },
      ),
    darDeBaja: (clienteUuid: string, uuids: string[]) =>
      solicitar<void>(
        `/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/consultas/bajas`,
        {
          method: 'POST',
          body: JSON.stringify(uuids),
        },
      ),
  },
  ejecuciones: {
    /** Un 204 indica que la consulta todavía no tiene intentos. */
    async obtenerUltima(
      clienteUuid: string,
      consultaUuid: string,
    ): Promise<DatosEjecucionConsulta | null> {
      const datos = await solicitar<DatosEjecucionConsulta | undefined>(
        `/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/consultas/${encodeURIComponent(consultaUuid)}/ejecuciones/ultima`,
      )
      return datos ?? null
    },
    iniciar: (clienteUuid: string, consultaUuid: string) =>
      solicitar<DatosEjecucionConsulta>(
        `/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/consultas/${encodeURIComponent(consultaUuid)}/ejecuciones`,
        { method: 'POST' },
      ),
    obtener: (clienteUuid: string, ejecucionUuid: string) =>
      solicitar<DatosEjecucionConsulta>(
        `/api/clientes-monitoreados/${encodeURIComponent(clienteUuid)}/ejecuciones/${encodeURIComponent(ejecucionUuid)}`,
      ),
  },
  administracion: {
    listarPlanes: () => solicitar<DatosPlan[]>('/api/planes'),
    listarOrganizaciones: () => solicitar<DatosOrganizacion[]>('/api/organizaciones'),
    crearOrganizacion: (datos: SolicitudCrearOrganizacion) =>
      solicitar<DatosOrganizacion>('/api/organizaciones', {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
    crearUsuario: (
      organizacionUuid: string,
      datos: {
        nombre: string
        correoElectronico: string
        clave: string
        rol: 'PROPIETARIO' | 'MIEMBRO'
      },
    ) =>
      solicitar<RespuestaUsuario>(
        `/api/organizaciones/${encodeURIComponent(organizacionUuid)}/usuarios`,
        {
          method: 'POST',
          body: JSON.stringify(datos),
        },
      ),
  },
}
