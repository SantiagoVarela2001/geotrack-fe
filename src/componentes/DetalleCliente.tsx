import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../api/clienteApi'
import type {
  DatosCliente,
  DatosConsulta,
  DatosCuenta,
  DatosGeneracionConsultas,
  DatosTema,
  DatosTemaConConsultas,
  SolicitudCrearConsulta,
} from '../api/tipos'
import { obtenerMensajeError, tienePermiso, urlWebSegura } from '../utilidades'
import { AccionesConsultas } from './AccionesConsultas'
import { Aviso, EtiquetaEstado, Icono, Vacio } from './Comun'
import { ConfirmarEstadoCliente } from './ConfirmarEstadoCliente'
import { GestionCompetidores } from './GestionCompetidores'
import { ConfirmarTipoConsulta } from './ConfirmarTipoConsulta'
import { FilaConsulta } from './FilaConsulta'
import { GeneracionConsultas } from './GeneracionConsultas'
import { VistaConsultasAgrupadas } from './VistaConsultasAgrupadas'

const consultaInicial: SolicitudCrearConsulta = {
  texto: '',
  tipoConsulta: 'REFERENCIA',
  prioridad: 'MEDIA',
}

export function DetalleCliente({
  clienteUuid,
  cuenta,
  temaInicialUuid = '',
  alAbrirEjecucion,
  alVerMetricas,
  alVolver,
}: {
  clienteUuid: string
  cuenta: DatosCuenta
  temaInicialUuid?: string
  alAbrirEjecucion: (consulta: DatosConsulta, temaUuid: string, iniciarAlAbrir: boolean) => void
  alVerMetricas: () => void
  alVolver: () => void
}) {
  const vistaGeneralInicial =
    !temaInicialUuid &&
    tienePermiso(cuenta.permisos, 'TEMAS_VER') &&
    tienePermiso(cuenta.permisos, 'CONSULTAS_VER')
  const [cliente, cambiarCliente] = useState<DatosCliente | null>(null)
  const [temas, cambiarTemas] = useState<DatosTema[]>([])
  const [temaUuid, cambiarTemaUuid] = useState(temaInicialUuid)
  const temaUuidActual = useRef(temaInicialUuid)
  const [consultas, cambiarConsultas] = useState<DatosConsulta[]>([])
  const [vistaAgrupada, cambiarVistaAgrupada] = useState(vistaGeneralInicial)
  const [temasDesplegados, cambiarTemasDesplegados] = useState(
    Boolean(temaInicialUuid) || !vistaGeneralInicial,
  )
  const [temasAgrupados, cambiarTemasAgrupados] = useState<DatosTemaConConsultas[] | null>(null)
  const [errorAgrupados, cambiarErrorAgrupados] = useState('')
  const [revisionAgrupados, cambiarRevisionAgrupados] = useState(0)
  const [generacion, cambiarGeneracion] = useState<DatosGeneracionConsultas | null>(null)
  const [cargandoInicial, cambiarCargandoInicial] = useState(true)
  const [cargandoTemas, cambiarCargandoTemas] = useState(true)
  const [cargandoConsultas, cambiarCargandoConsultas] = useState(Boolean(temaInicialUuid))
  const [erroresIniciales, cambiarErroresIniciales] = useState<string[]>([])
  const [errorGeneracion, cambiarErrorGeneracion] = useState('')
  const [errorTemas, cambiarErrorTemas] = useState('')
  const [errorConsultas, cambiarErrorConsultas] = useState('')
  const [errorAccion, cambiarErrorAccion] = useState('')
  const [mensajeAccion, cambiarMensajeAccion] = useState('')
  const [errorEstadoCliente, cambiarErrorEstadoCliente] = useState('')
  const [mensajeEstadoCliente, cambiarMensajeEstadoCliente] = useState('')
  const [cambiandoEstadoCliente, definirCambiandoEstadoCliente] = useState(false)
  const [confirmandoEstadoCliente, cambiarConfirmandoEstadoCliente] = useState(false)
  const [nuevoTema, cambiarNuevoTema] = useState('')
  const [creandoTema, cambiarCreandoTema] = useState(false)
  const [renombrando, cambiarRenombrando] = useState(false)
  const [nombreEditado, cambiarNombreEditado] = useState('')
  const [mostrarConsultas, cambiarMostrarConsultas] = useState(false)
  const [filasConsulta, cambiarFilasConsulta] = useState<SolicitudCrearConsulta[]>([
    { ...consultaInicial },
  ])
  const [seleccionadas, cambiarSeleccionadas] = useState<string[]>([])
  const [confirmarBaja, cambiarConfirmarBaja] = useState(false)
  const [guardando, cambiarGuardando] = useState(false)
  const [consultaParaCambiarTipo, definirConsultaParaCambiarTipo] = useState<DatosConsulta | null>(
    null,
  )
  const [cambiandoTipo, cambiarCambiandoTipo] = useState(false)
  const [generando, cambiarGenerando] = useState(false)
  const [revisionInicial, cambiarRevisionInicial] = useState(0)
  const [revisionTemas, cambiarRevisionTemas] = useState(0)
  const [revisionConsultas, cambiarRevisionConsultas] = useState(0)

  const puedeVerTemas = tienePermiso(cuenta.permisos, 'TEMAS_VER')
  const puedeVerConsultas = tienePermiso(cuenta.permisos, 'CONSULTAS_VER')
  const puedeCambiarEstadoCliente =
    cuenta.tipoCuenta === 'ORGANIZACION' &&
    tienePermiso(cuenta.permisos, 'CLIENTES_CAMBIAR_ESTADO')
  const activo = cliente?.estado === 'ACTIVO' && cuenta.tipoCuenta === 'ORGANIZACION'
  const puedeCrearCompetidor = activo && tienePermiso(cuenta.permisos, 'COMPETIDORES_CREAR')
  const puedeEliminarCompetidor = activo && tienePermiso(cuenta.permisos, 'COMPETIDORES_ELIMINAR')
  const puedeCrearTema = activo && tienePermiso(cuenta.permisos, 'TEMAS_CREAR')
  const puedeEditarTema = activo && tienePermiso(cuenta.permisos, 'TEMAS_EDITAR')
  const puedeCrearConsulta = activo && tienePermiso(cuenta.permisos, 'CONSULTAS_CREAR')
  const puedeGenerar =
    puedeCrearConsulta && puedeVerConsultas && (!generacion || generacion.estado === 'FALLIDO')
  const mostrarPanelGeneracion =
    puedeVerConsultas &&
    generacion?.estado !== 'FINALIZADO' &&
    (generacion !== null || puedeGenerar || generando)
  const puedeAprobar = activo && tienePermiso(cuenta.permisos, 'CONSULTAS_APROBAR')
  const puedeDarDeBaja = activo && tienePermiso(cuenta.permisos, 'CONSULTAS_ELIMINAR')
  const puedeCambiarTipo =
    cliente?.estado === 'ACTIVO' && tienePermiso(cuenta.permisos, 'CONSULTAS_CAMBIAR_TIPO')
  const puedeEjecutar =
    cliente?.estado === 'ACTIVO' && tienePermiso(cuenta.permisos, 'CONSULTAS_EJECUTAR')
  const clienteCargadoUuid = cliente?.uuid
  const temaActual = temas.find((tema) => tema.uuid === temaUuid)
  const sitioWebCliente = urlWebSegura(cliente?.sitioWeb ?? null)
  const descripcionExpandible = (cliente?.descripcion?.length ?? 0) > 100
  const consultasVisibles = vistaAgrupada
    ? (temasAgrupados?.flatMap((tema) => tema.consultas) ?? [])
    : consultas
  const todosSeleccionados =
    consultasVisibles.length > 0 &&
    consultasVisibles.every((consulta) => seleccionadas.includes(consulta.uuid))
  const consultasElegidas = consultasVisibles.filter((consulta) =>
    seleccionadas.includes(consulta.uuid),
  )
  const todasBorrador =
    consultasElegidas.length > 0 &&
    consultasElegidas.length === seleccionadas.length &&
    consultasElegidas.every((consulta) => consulta.estadoConsulta === 'BORRADOR')
  const etiquetaBajaAgrupada =
    seleccionadas.length === 0 || todasBorrador ? 'Rechazar' : 'Dar de baja'

  /** Ante un conflicto, vuelve a leer la vista desde el servidor. */
  function recargarConsultasVisibles() {
    cambiarSeleccionadas([])
    cambiarConfirmarBaja(false)
    if (vistaAgrupada) {
      cambiarTemasAgrupados(null)
      cambiarErrorAgrupados('')
      cambiarRevisionAgrupados((actual) => actual + 1)
      return
    }
    cambiarCargandoConsultas(true)
    cambiarRevisionConsultas((actual) => actual + 1)
  }

  function seleccionarTema(uuid: string) {
    if (guardando || cambiandoTipo) return
    cambiarTemasDesplegados(true)
    cambiarVistaAgrupada(false)
    cambiarTemasAgrupados(null)
    cambiarSeleccionadas([])
    cambiarConfirmarBaja(false)
    if (uuid === temaUuid) return
    temaUuidActual.current = uuid
    cambiarTemaUuid(uuid)
    cambiarConsultas([])
    cambiarSeleccionadas([])
    cambiarErrorConsultas('')
    cambiarMensajeAccion('')
    cambiarCargandoConsultas(Boolean(uuid))
  }

  /** La vista general siempre se obtiene de una respuesta nueva del servidor. */
  function verTodo() {
    if (vistaAgrupada || guardando || cambiandoTipo) return
    cambiarVistaAgrupada(true)
    cambiarTemasAgrupados(null)
    cambiarErrorAgrupados('')
    cambiarRenombrando(false)
    cambiarMostrarConsultas(false)
    cambiarSeleccionadas([])
    cambiarConfirmarBaja(false)
    cambiarErrorAccion('')
    cambiarMensajeAccion('')
  }

  function abrirDetalleConsulta(consulta: DatosConsulta, temaDeConsultaUuid: string) {
    if (guardando || cambiandoTipo || confirmarBaja) return
    alAbrirEjecucion(consulta, temaDeConsultaUuid, false)
  }

  /** La acción de la tarjeta abre la página e inicia un único intento allí. */
  function ejecutarConsulta(consulta: DatosConsulta, temaDeConsultaUuid: string) {
    if (
      !puedeEjecutar ||
      consulta.estadoConsulta !== 'APROBADA' ||
      guardando ||
      cambiandoTipo ||
      confirmarBaja
    ) {
      return
    }
    alAbrirEjecucion(consulta, temaDeConsultaUuid, true)
  }

  /** Espera cliente y proceso antes de presentar cualquier dato de la página. */
  useEffect(() => {
    let vigente = true
    const peticionGeneracion = puedeVerConsultas
      ? api.consultas.obtenerGeneracion(clienteUuid)
      : Promise.resolve(null)

    Promise.allSettled([api.clientes.obtener(clienteUuid), peticionGeneracion])
      .then(([resultadoCliente, resultadoGeneracion]) => {
        if (!vigente) return
        const errores: string[] = []
        if (resultadoCliente.status === 'rejected') {
          errores.push(`Cliente: ${obtenerMensajeError(resultadoCliente.reason)}`)
        }
        if (resultadoGeneracion.status === 'rejected') {
          errores.push(`Generación: ${obtenerMensajeError(resultadoGeneracion.reason)}`)
        }
        if (errores.length > 0) {
          cambiarErroresIniciales(errores)
          return
        }
        if (resultadoCliente.status === 'fulfilled' && resultadoGeneracion.status === 'fulfilled') {
          cambiarCliente(resultadoCliente.value)
          cambiarGeneracion(resultadoGeneracion.value)
        }
      })
      .finally(() => {
        if (vigente) cambiarCargandoInicial(false)
      })
    return () => {
      vigente = false
    }
  }, [clienteUuid, puedeVerConsultas, revisionInicial])

  useEffect(() => {
    if (!clienteCargadoUuid || !puedeVerTemas) return
    let vigente = true
    api.temas
      .listar(clienteUuid)
      .then((datos) => {
        if (!vigente) return
        cambiarTemas(datos)
        if (!datos.some((tema) => tema.uuid === temaUuidActual.current)) {
          const siguienteTemaUuid =
            !temaUuidActual.current && vistaGeneralInicial ? '' : (datos[0]?.uuid ?? '')
          temaUuidActual.current = siguienteTemaUuid
          cambiarTemaUuid(siguienteTemaUuid)
          cambiarCargandoConsultas(Boolean(siguienteTemaUuid))
        }
      })
      .catch((causa) => {
        if (vigente) cambiarErrorTemas(obtenerMensajeError(causa))
      })
      .finally(() => {
        if (vigente) cambiarCargandoTemas(false)
      })
    return () => {
      vigente = false
    }
  }, [clienteCargadoUuid, clienteUuid, puedeVerTemas, revisionTemas, vistaGeneralInicial])

  useEffect(() => {
    if (!temaUuid || !puedeVerConsultas || vistaAgrupada) return
    let vigente = true
    api.consultas
      .listar(clienteUuid, temaUuid)
      .then((datos) => {
        if (vigente) cambiarConsultas(datos)
      })
      .catch((causa) => {
        if (vigente) cambiarErrorConsultas(obtenerMensajeError(causa))
      })
      .finally(() => {
        if (vigente) cambiarCargandoConsultas(false)
      })
    return () => {
      vigente = false
    }
  }, [clienteUuid, temaUuid, puedeVerConsultas, revisionConsultas, vistaAgrupada])

  /** Carga todos los temas y sus consultas solo mientras la vista general está abierta. */
  useEffect(() => {
    if (!clienteCargadoUuid || !vistaAgrupada || !puedeVerTemas || !puedeVerConsultas) return
    let vigente = true
    api.consultas
      .listarPorTema(clienteUuid)
      .then((datos) => {
        if (vigente) cambiarTemasAgrupados(datos)
      })
      .catch((causa) => {
        if (vigente) cambiarErrorAgrupados(obtenerMensajeError(causa))
      })
    return () => {
      vigente = false
    }
  }, [clienteCargadoUuid, clienteUuid, vistaAgrupada, puedeVerTemas, puedeVerConsultas, revisionAgrupados])

  /** Consulta un solo proceso a la vez y detiene el intervalo al terminar o salir de la página. */
  useEffect(() => {
    if (
      !puedeVerConsultas ||
      (generacion?.estado !== 'PENDIENTE' && generacion?.estado !== 'PROCESANDO')
    ) {
      return
    }

    let vigente = true
    let solicitudPendiente = false
    const intervalo = window.setInterval(async () => {
      if (solicitudPendiente) return
      solicitudPendiente = true
      try {
        const actualizada = await api.consultas.obtenerGeneracion(clienteUuid)
        if (!vigente) return
        if (!actualizada) {
          cambiarErrorGeneracion('No se encontró el proceso de generación.')
          return
        }
        cambiarGeneracion(actualizada)
        cambiarErrorGeneracion('')
        if (actualizada.estado === 'FINALIZADO') {
          cambiarTemasAgrupados(null)
          cambiarErrorAgrupados('')
          cambiarSeleccionadas([])
          cambiarRevisionAgrupados((actual) => actual + 1)
          if (puedeVerTemas) {
            cambiarCargandoTemas(true)
            cambiarRevisionTemas((actual) => actual + 1)
          }
          if (temaUuid) {
            cambiarCargandoConsultas(true)
            cambiarRevisionConsultas((actual) => actual + 1)
          }
        }
      } catch (causa) {
        if (vigente) cambiarErrorGeneracion(obtenerMensajeError(causa))
      } finally {
        solicitudPendiente = false
      }
    }, 3000)

    return () => {
      vigente = false
      window.clearInterval(intervalo)
    }
  }, [clienteUuid, generacion?.estado, puedeVerConsultas, puedeVerTemas, temaUuid])

  async function iniciarGeneracion() {
    if (!puedeGenerar || generando) return
    cambiarGenerando(true)
    cambiarErrorGeneracion('')
    try {
      const iniciada = await api.consultas.iniciarGeneracion(clienteUuid)
      cambiarGeneracion(iniciada)
      if (iniciada.estado === 'FINALIZADO') {
        cambiarTemasAgrupados(null)
        cambiarErrorAgrupados('')
        cambiarSeleccionadas([])
        cambiarRevisionAgrupados((actual) => actual + 1)
        if (puedeVerTemas) {
          cambiarCargandoTemas(true)
          cambiarRevisionTemas((actual) => actual + 1)
        }
        if (temaUuid) {
          cambiarCargandoConsultas(true)
          cambiarRevisionConsultas((actual) => actual + 1)
        }
      }
    } catch (causa) {
      cambiarErrorGeneracion(obtenerMensajeError(causa))
    } finally {
      cambiarGenerando(false)
    }
  }

  /** Reemplaza el cliente con la respuesta de la API solo cuando confirma el cambio. */
  async function cambiarEstadoDelCliente() {
    if (
      !cliente ||
      !puedeCambiarEstadoCliente ||
      !confirmandoEstadoCliente ||
      cambiandoEstadoCliente ||
      guardando ||
      creandoTema ||
      cambiandoTipo ||
      generando
    ) {
      return
    }
    const estado = cliente.estado === 'ACTIVO' ? 'ARCHIVADO' : 'ACTIVO'
    cambiarErrorEstadoCliente('')
    cambiarMensajeEstadoCliente('')
    definirCambiandoEstadoCliente(true)
    try {
      const actualizado = await api.clientes.cambiarEstado(clienteUuid, estado)
      cambiarCliente(actualizado)
      if (actualizado.estado === 'ARCHIVADO') {
        cambiarRenombrando(false)
        cambiarMostrarConsultas(false)
        cambiarSeleccionadas([])
        cambiarConfirmarBaja(false)
      }
      cambiarMensajeEstadoCliente(
        actualizado.estado === 'ARCHIVADO'
          ? 'El cliente quedó archivado.'
          : 'El cliente volvió a estar activo.',
      )
    } catch (causa) {
      cambiarErrorEstadoCliente(obtenerMensajeError(causa))
    } finally {
      definirCambiandoEstadoCliente(false)
      cambiarConfirmandoEstadoCliente(false)
    }
  }

  async function crearTema(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando || creandoTema) return
    cambiarErrorAccion('')
    cambiarMensajeAccion('')
    cambiarCreandoTema(true)
    try {
      const creado = await api.temas.crear(clienteUuid, nuevoTema.trim())
      cambiarTemas((actuales) => [...actuales, creado])
      seleccionarTema(creado.uuid)
      cambiarNuevoTema('')
      cambiarMensajeAccion('Tema creado.')
    } catch (causa) {
      cambiarErrorAccion(obtenerMensajeError(causa))
    } finally {
      cambiarCreandoTema(false)
    }
  }

  async function renombrarTema(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!temaActual) return
    cambiarErrorAccion('')
    cambiarGuardando(true)
    try {
      const actualizado = await api.temas.renombrar(
        clienteUuid,
        temaActual.uuid,
        nombreEditado.trim(),
      )
      cambiarTemas((actuales) =>
        actuales.map((tema) => (tema.uuid === actualizado.uuid ? actualizado : tema)),
      )
      cambiarRenombrando(false)
      cambiarMensajeAccion('Nombre del tema actualizado.')
    } catch (causa) {
      cambiarErrorAccion(obtenerMensajeError(causa))
    } finally {
      cambiarGuardando(false)
    }
  }

  /** El endpoint recibe un array JSON directo y valida el lote de forma atómica. */
  async function crearConsultas(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!temaActual) return
    cambiarErrorAccion('')
    cambiarMensajeAccion('')
    cambiarGuardando(true)
    try {
      const creadas = await api.consultas.crear(
        clienteUuid,
        temaActual.uuid,
        filasConsulta.map((fila) => ({ ...fila, texto: fila.texto.trim() })),
      )
      cambiarConsultas((actuales) => [...actuales, ...creadas])
      cambiarFilasConsulta([{ ...consultaInicial }])
      cambiarMostrarConsultas(false)
      cambiarMensajeAccion(
        `${creadas.length} ${creadas.length === 1 ? 'consulta creada' : 'consultas creadas'} en borrador.`,
      )
    } catch (causa) {
      cambiarErrorAccion(obtenerMensajeError(causa))
    } finally {
      cambiarGuardando(false)
    }
  }

  async function aprobarSeleccionadas() {
    if (!puedeAprobar || !todasBorrador) return
    cambiarGuardando(true)
    cambiarErrorAccion('')
    cambiarMensajeAccion('')
    try {
      const aprobadas = await api.consultas.aprobar(clienteUuid, seleccionadas)
      const porUuid = new Map(aprobadas.map((consulta) => [consulta.uuid, consulta]))
      cambiarConsultas((actuales) =>
        actuales.map((consulta) => porUuid.get(consulta.uuid) ?? consulta),
      )
      cambiarTemasAgrupados(
        (actuales) =>
          actuales?.map((tema) => ({
            ...tema,
            consultas: tema.consultas.map((consulta) => porUuid.get(consulta.uuid) ?? consulta),
          })) ?? null,
      )
      cambiarSeleccionadas([])
      cambiarMensajeAccion(
        `${aprobadas.length} ${aprobadas.length === 1 ? 'consulta aprobada' : 'consultas aprobadas'}.`,
      )
    } catch (causa) {
      cambiarErrorAccion(obtenerMensajeError(causa))
      recargarConsultasVisibles()
    } finally {
      cambiarGuardando(false)
    }
  }

  /** Solo retira la selección si el backend confirmó la baja completa con 204. */
  async function darDeBajaSeleccionadas() {
    if (
      !puedeDarDeBaja ||
      seleccionadas.length === 0 ||
      consultasElegidas.length !== seleccionadas.length
    ) {
      return
    }
    cambiarGuardando(true)
    cambiarErrorAccion('')
    cambiarMensajeAccion('')
    const esRechazo = vistaAgrupada && todasBorrador
    try {
      await api.consultas.darDeBaja(clienteUuid, seleccionadas)
      const cantidad = seleccionadas.length
      cambiarConsultas((actuales) =>
        actuales.filter((consulta) => !seleccionadas.includes(consulta.uuid)),
      )
      cambiarTemasAgrupados(
        (actuales) =>
          actuales?.map((tema) => ({
            ...tema,
            consultas: tema.consultas.filter((consulta) => !seleccionadas.includes(consulta.uuid)),
          })) ?? null,
      )
      cambiarSeleccionadas([])
      cambiarConfirmarBaja(false)
      cambiarMensajeAccion(
        esRechazo
          ? `${cantidad} ${cantidad === 1 ? 'consulta rechazada' : 'consultas rechazadas'}.`
          : `${cantidad} ${cantidad === 1 ? 'consulta dada' : 'consultas dadas'} de baja.`,
      )
    } catch (causa) {
      cambiarErrorAccion(obtenerMensajeError(causa))
      recargarConsultasVisibles()
    } finally {
      cambiarGuardando(false)
    }
  }

  function solicitarCambioTipo(consulta: DatosConsulta) {
    if (
      !puedeCambiarTipo ||
      consulta.estadoConsulta !== 'BORRADOR' ||
      guardando ||
      cambiandoTipo ||
      confirmarBaja
    ) {
      return
    }
    definirConsultaParaCambiarTipo(consulta)
    cambiarErrorAccion('')
    cambiarMensajeAccion('')
  }

  /** Confirma el cambio con el backend antes de reflejarlo en ambas vistas. */
  async function confirmarCambioTipo() {
    const consulta = consultaParaCambiarTipo
    if (!consulta || !puedeCambiarTipo || consulta.estadoConsulta !== 'BORRADOR' || cambiandoTipo) {
      return
    }

    const nuevoTipo = consulta.tipoConsulta === 'REFERENCIA' ? 'DESCUBRIMIENTO' : 'REFERENCIA'
    cambiarCambiandoTipo(true)
    try {
      const actualizada = await api.consultas.cambiarTipo(clienteUuid, consulta.uuid, nuevoTipo)
      cambiarConsultas((actuales) =>
        actuales.map((item) => (item.uuid === actualizada.uuid ? actualizada : item)),
      )
      cambiarTemasAgrupados(
        (actuales) =>
          actuales?.map((tema) => ({
            ...tema,
            consultas: tema.consultas.map((item) =>
              item.uuid === actualizada.uuid ? actualizada : item,
            ),
          })) ?? null,
      )
      cambiarMensajeAccion(
        actualizada.tipoConsulta === 'REFERENCIA'
          ? 'Consulta marcada como referencia.'
          : 'Consulta cambiada a descubrimiento.',
      )
      definirConsultaParaCambiarTipo(null)
    } catch (causa) {
      definirConsultaParaCambiarTipo(null)
      cambiarErrorAccion(obtenerMensajeError(causa))
      recargarConsultasVisibles()
    } finally {
      cambiarCambiandoTipo(false)
    }
  }

  function cambiarFila(indice: number, campo: keyof SolicitudCrearConsulta, valor: string) {
    cambiarFilasConsulta((actuales) =>
      actuales.map((fila, posicion) => (posicion === indice ? { ...fila, [campo]: valor } : fila)),
    )
  }

  function alternarSeleccion(uuid: string) {
    if (guardando || cambiandoTipo || confirmarBaja) return
    cambiarSeleccionadas((actuales) =>
      actuales.includes(uuid) ? actuales.filter((item) => item !== uuid) : [...actuales, uuid],
    )
  }

  /** Selecciona solo las consultas que se ven en el tema o en la vista general. */
  function alternarSeleccionTotal() {
    if (guardando || cambiandoTipo || confirmarBaja || consultasVisibles.length === 0) return
    const uuidsVisibles = consultasVisibles.map((consulta) => consulta.uuid)
    cambiarSeleccionadas((actuales) =>
      uuidsVisibles.every((uuid) => actuales.includes(uuid)) ? [] : uuidsVisibles,
    )
  }

  if (cargandoInicial) {
    return (
      <div className="contenido-limitado">
        <div className="cargando-bloque" role="status">
          Cargando cliente y estado de generación…
        </div>
      </div>
    )
  }

  if (erroresIniciales.length > 0 || !cliente) {
    return (
      <div className="contenido-limitado">
        <button className="enlace-volver" type="button" onClick={alVolver}>
          <Icono nombre="volver" tamano={17} /> Todos los clientes
        </button>
        {erroresIniciales.map((error) => (
          <Aviso key={error}>{error}</Aviso>
        ))}
        {!cliente && erroresIniciales.length === 0 && <Aviso>No se pudo cargar el cliente.</Aviso>}
        <button
          className="boton boton-secundario reintentar"
          type="button"
          onClick={() => {
            cambiarErroresIniciales([])
            cambiarCargandoInicial(true)
            cambiarRevisionInicial((actual) => actual + 1)
          }}
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="contenido-limitado">
      {cliente && (
        <>
          <button className="enlace-volver detalle-volver" type="button" onClick={alVolver}>
            <Icono nombre="volver" tamano={17} /> Todos los clientes
          </button>
          <section className="detalle-ficha" aria-label="Resumen del cliente">
            <div className="detalle-cabecera">
              <div className="encabezado-pagina encabezado-detalle">
                <div>
                  <span className="sobrelinea">CLIENTE MONITOREADO</span>
                  <div className="titulo-con-etiqueta">
                    <h1>{cliente.nombre}</h1>
                    <EtiquetaEstado estado={cliente.estado} />
                  </div>
                  <p>Configuración de marca y consultas de seguimiento.</p>
                </div>
              </div>
              {(puedeCambiarEstadoCliente || (puedeVerConsultas && cliente.estado === 'ACTIVO')) && (
                <div className="detalle-acciones">
                  {puedeVerConsultas && cliente.estado === 'ACTIVO' && (
                    <button
                      className="boton boton-secundario boton-chico detalle-accion detalle-accion-metricas"
                      type="button"
                      onClick={alVerMetricas}
                    >
                      <Icono nombre="grafico" tamano={18} />
                      <span>Ver métricas GEO</span>
                    </button>
                  )}
                  {puedeCambiarEstadoCliente && (
                    <button
                      className={`boton boton-secundario boton-chico detalle-accion detalle-accion-${cliente.estado === 'ACTIVO' ? 'archivar' : 'reactivar'}`}
                      type="button"
                      disabled={
                        cambiandoEstadoCliente || guardando || creandoTema || cambiandoTipo || generando
                      }
                      onClick={() => {
                        cambiarErrorEstadoCliente('')
                        cambiarMensajeEstadoCliente('')
                        cambiarConfirmandoEstadoCliente(true)
                      }}
                    >
                      <Icono
                        nombre={cliente.estado === 'ACTIVO' ? 'archivar' : 'reactivar'}
                        tamano={18}
                      />
                      <span>
                        {cambiandoEstadoCliente
                          ? 'Guardando…'
                          : cliente.estado === 'ACTIVO'
                            ? 'Archivar cliente'
                            : 'Reactivar cliente'}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="resumen-cliente">
              <div className="dato-resumen">
                <span>MARCA</span>
                <strong title={cliente.nombreMarca}>{cliente.nombreMarca}</strong>
                <small title={cliente.rubro}>{cliente.rubro}</small>
              </div>
              <div className="dato-resumen">
                <span>SITIO WEB</span>
                {sitioWebCliente ? (
                  <a
                    href={sitioWebCliente}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={cliente.sitioWeb}
                  >
                    {cliente.sitioWeb}
                  </a>
                ) : (
                  <strong title={cliente.sitioWeb}>{cliente.sitioWeb}</strong>
                )}
              </div>
              <div className="dato-resumen">
                <span>MERCADO</span>
                <strong>
                  {cliente.pais} <span className="dato-divisor">/</span> {cliente.idioma}
                </strong>
              </div>
              <div className="dato-resumen">
                <span>COMPETIDORES</span>
                <strong>
                  {cliente.competidores.length}{' '}
                  {cliente.competidores.length === 1 ? 'registrado' : 'registrados'}
                </strong>
              </div>
            </div>
            {(descripcionExpandible || cliente.competidores.length > 0 || puedeCrearCompetidor) ? (
              <details className="detalle-extras">
                <summary>
                  <span className="detalle-descripcion-resumen">
                    <span className="sobrelinea">DESCRIPCIÓN</span>
                    <span className="detalle-descripcion-texto">
                      {cliente.descripcion || 'Sin descripción'}
                    </span>
                  </span>
                  <span className="detalle-extras-indicador">
                    <span className="detalle-extras-cerrado">
                      {cliente.competidores.length > 0
                        ? puedeCrearCompetidor || puedeEliminarCompetidor
                          ? 'Gestionar competidores'
                          : 'Ver competidores'
                        : puedeCrearCompetidor
                          ? 'Agregar competidor'
                          : 'Leer descripción'}
                    </span>
                    <span className="detalle-extras-abierto">Mostrar menos</span>
                    <Icono nombre="flecha" tamano={16} />
                  </span>
                </summary>
                {(cliente.competidores.length > 0 || puedeCrearCompetidor) && (
                  <div className="detalle-extras-contenido">
                    <GestionCompetidores
                      key={`${cliente.uuid}:${cliente.estado}`}
                      cliente={cliente}
                      puedeCrear={puedeCrearCompetidor}
                      puedeEliminar={puedeEliminarCompetidor}
                      alActualizar={cambiarCliente}
                    />
                  </div>
                )}
              </details>
            ) : (
              <div className="detalle-descripcion-estatica">
                <span className="sobrelinea">DESCRIPCIÓN</span>
                <p>{cliente.descripcion || 'Sin descripción'}</p>
              </div>
            )}
          </section>
          {errorEstadoCliente && (
            <div className="detalle-aviso">
              <Aviso>{errorEstadoCliente}</Aviso>
            </div>
          )}
          {mensajeEstadoCliente && (
            <div className="detalle-aviso">
              <Aviso tipo="exito">{mensajeEstadoCliente}</Aviso>
            </div>
          )}
          {cliente.estado === 'ARCHIVADO' && !mensajeEstadoCliente && (
            <div className="detalle-aviso">
              <Aviso tipo="informacion">
                Este cliente está archivado. Sus datos siguen disponibles para lectura.
              </Aviso>
            </div>
          )}
          {puedeVerConsultas && generacion?.estado === 'FINALIZADO' && generacion.advertencia && (
            <div className="detalle-aviso">
              <Aviso tipo="informacion">{generacion.advertencia}</Aviso>
            </div>
          )}
          {mostrarPanelGeneracion && (
            <GeneracionConsultas
              proceso={generacion}
              puedeGenerar={puedeGenerar}
              generando={generando}
              error={errorGeneracion}
              alGenerar={iniciarGeneracion}
            />
          )}
          <div className="trabajo-grilla">
            <section className="tarjeta temas-panel">
              <div className="seccion-cabecera">
                <div>
                  <span className="sobrelinea">ORGANIZACIÓN</span>
                  <h2>Temas</h2>
                </div>
                <span className="contador">{temas.length}</span>
              </div>
              {!puedeVerTemas ? (
                <Aviso tipo="informacion">Tu cuenta no tiene permiso para ver temas.</Aviso>
              ) : (
                <>
                  {cargandoTemas ? (
                    <p className="texto-secundario">Cargando temas…</p>
                  ) : errorTemas ? (
                    <div>
                      <Aviso>{errorTemas}</Aviso>
                      <button
                        type="button"
                        className="boton boton-secundario reintentar"
                        onClick={() => {
                          cambiarErrorTemas('')
                          cambiarCargandoTemas(true)
                          cambiarRevisionTemas((actual) => actual + 1)
                        }}
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : (
                    <div className="lista-temas">
                      {puedeVerConsultas && (
                        <button
                          type="button"
                          className={`item-tema item-tema-general ${vistaAgrupada ? 'item-tema-activo' : ''}`}
                          onClick={verTodo}
                          aria-pressed={vistaAgrupada}
                          disabled={guardando || cambiandoTipo}
                        >
                          <Icono nombre="capas" tamano={17} />
                          <span>Ver todo</span>
                          <Icono nombre="flecha" tamano={16} />
                        </button>
                      )}
                      {(temas.length > 0 || puedeCrearTema) ? (
                        <>
                          <button
                            type="button"
                            className="alternar-temas"
                            aria-expanded={temasDesplegados}
                            aria-controls="lista-temas-cliente"
                            onClick={() => cambiarTemasDesplegados((actual) => !actual)}
                          >
                            <span>
                              {temasDesplegados
                                ? 'Ocultar temas'
                                : temas.length > 0
                                  ? 'Mostrar temas'
                                  : 'Crear primer tema'}
                            </span>
                            <Icono nombre="flecha" tamano={16} />
                          </button>
                          <div
                            id="lista-temas-cliente"
                            className="temas-desplegados"
                            hidden={!temasDesplegados}
                          >
                            {temas.length === 0 && (
                              <p className="texto-secundario sin-temas">
                                Todavía no hay temas para este cliente.
                              </p>
                            )}
                            {temas.map((tema, indice) => (
                              <button
                                type="button"
                                className={`item-tema ${!vistaAgrupada && tema.uuid === temaUuid ? 'item-tema-activo' : ''}`}
                                key={tema.uuid}
                                aria-pressed={!vistaAgrupada && tema.uuid === temaUuid}
                                disabled={guardando || cambiandoTipo}
                                onClick={() => {
                                  seleccionarTema(tema.uuid)
                                  cambiarRenombrando(false)
                                  cambiarErrorAccion('')
                                }}
                              >
                                <span className="numero-tema">
                                  {String(indice + 1).padStart(2, '0')}
                                </span>
                                <span>{tema.nombre}</span>
                                <Icono nombre="flecha" tamano={16} />
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="texto-secundario sin-temas">
                          Todavía no hay temas para este cliente.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
              {puedeCrearTema && (!puedeVerTemas || temasDesplegados) && (
                <form className="crear-tema" onSubmit={crearTema}>
                  <label htmlFor="nuevo-tema">Nuevo tema</label>
                  <div className="entrada-con-boton">
                    <input
                      id="nuevo-tema"
                      required
                      maxLength={200}
                      value={nuevoTema}
                      disabled={guardando}
                      onChange={(evento) => cambiarNuevoTema(evento.target.value)}
                      placeholder="Ej. Software de gestión"
                    />
                    <button
                      className="boton-icono boton-agregar"
                      type="submit"
                      disabled={creandoTema || guardando}
                      aria-label="Crear tema"
                    >
                      <Icono nombre="mas" tamano={18} />
                    </button>
                  </div>
                </form>
              )}
            </section>
            <section className="tarjeta consultas-panel">
              {vistaAgrupada && puedeVerTemas && puedeVerConsultas ? (
                errorAgrupados ? (
                  <div>
                    <Aviso>{errorAgrupados}</Aviso>
                    <button
                      type="button"
                      className="boton boton-secundario reintentar"
                      onClick={() => {
                        cambiarTemasAgrupados(null)
                        cambiarErrorAgrupados('')
                        cambiarRevisionAgrupados((actual) => actual + 1)
                      }}
                    >
                      Reintentar
                    </button>
                  </div>
                ) : temasAgrupados === null ? (
                  <div className="cargando-bloque" role="status">
                    Cargando temas y consultas…
                  </div>
                ) : (
                  <VistaConsultasAgrupadas
                    temas={temasAgrupados}
                    alAbrirTema={seleccionarTema}
                    seleccionadas={seleccionadas}
                    puedeSeleccionar={puedeAprobar || puedeDarDeBaja}
                    seleccionBloqueada={guardando || cambiandoTipo || confirmarBaja}
                    navegacionBloqueada={guardando || cambiandoTipo || confirmarBaja}
                    puedeCambiarTipo={puedeCambiarTipo}
                    cambioTipoBloqueado={guardando || cambiandoTipo || confirmarBaja}
                    alSolicitarCambioTipo={solicitarCambioTipo}
                    alAbrirDetalle={abrirDetalleConsulta}
                    puedeEjecutar={puedeEjecutar}
                    alEjecutar={ejecutarConsulta}
                    alAlternar={alternarSeleccion}
                    avisos={
                      <>
                        {errorAccion && <Aviso>{errorAccion}</Aviso>}
                        {mensajeAccion && <Aviso tipo="exito">{mensajeAccion}</Aviso>}
                      </>
                    }
                    acciones={
                      (puedeAprobar || puedeDarDeBaja) && (
                        <AccionesConsultas
                          cantidadSeleccionadas={seleccionadas.length}
                          cantidadVisibles={consultasVisibles.length}
                          todosSeleccionados={todosSeleccionados}
                          todasBorrador={todasBorrador}
                          puedeAprobar={puedeAprobar}
                          puedeDarDeBaja={puedeDarDeBaja}
                          guardando={guardando || cambiandoTipo}
                          confirmarBaja={confirmarBaja}
                          etiquetaBaja={etiquetaBajaAgrupada}
                          alAprobar={aprobarSeleccionadas}
                          alAlternarTodos={alternarSeleccionTotal}
                          alSolicitarBaja={() => cambiarConfirmarBaja(true)}
                          alCancelarBaja={() => cambiarConfirmarBaja(false)}
                          alConfirmarBaja={darDeBajaSeleccionadas}
                        />
                      )
                    }
                  />
                )
              ) : !temaActual ? (
                <Vacio
                  icono="capas"
                  titulo="Elegí un tema"
                  descripcion={
                    temas.length
                      ? 'Seleccioná un tema para revisar sus consultas.'
                      : 'Creá un tema para organizar las primeras consultas de este cliente.'
                  }
                />
              ) : (
                <>
                  <div className="seccion-cabecera consultas-cabecera">
                    <div>
                      <span className="sobrelinea">TEMA SELECCIONADO</span>
                      {renombrando ? (
                        <form className="formulario renombrar-formulario" onSubmit={renombrarTema}>
                          <input
                            required
                            maxLength={200}
                            aria-label="Nuevo nombre del tema"
                            value={nombreEditado}
                            onChange={(evento) => cambiarNombreEditado(evento.target.value)}
                          />
                          <button
                            className="boton boton-primario boton-chico"
                            disabled={guardando}
                            type="submit"
                          >
                            Guardar
                          </button>
                          <button
                            className="boton boton-secundario boton-chico"
                            type="button"
                            onClick={() => cambiarRenombrando(false)}
                          >
                            Cancelar
                          </button>
                        </form>
                      ) : (
                        <h2>{temaActual.nombre}</h2>
                      )}
                    </div>
                    {puedeEditarTema && !renombrando && (
                      <button
                        className="boton-icono"
                        type="button"
                        onClick={() => {
                          cambiarNombreEditado(temaActual.nombre)
                          cambiarRenombrando(true)
                        }}
                        aria-label="Renombrar tema"
                      >
                        <Icono nombre="editar" tamano={18} />
                      </button>
                    )}
                  </div>
                  <div className="consultas-meta">
                    <span>
                      {consultas.length} {consultas.length === 1 ? 'consulta' : 'consultas'} en este
                      tema
                    </span>
                    <span>Máximo 15 activas por cliente</span>
                  </div>
                  {errorAccion && <Aviso>{errorAccion}</Aviso>}
                  {mensajeAccion && <Aviso tipo="exito">{mensajeAccion}</Aviso>}
                  {puedeVerConsultas ? (
                    <>
                      {cargandoConsultas ? (
                        <div className="cargando-bloque">Cargando consultas…</div>
                      ) : errorConsultas ? (
                        <div>
                          <Aviso>{errorConsultas}</Aviso>
                          <button
                            type="button"
                            className="boton boton-secundario reintentar"
                            onClick={() => {
                              cambiarErrorConsultas('')
                              cambiarCargandoConsultas(true)
                              cambiarRevisionConsultas((actual) => actual + 1)
                            }}
                          >
                            Reintentar
                          </button>
                        </div>
                      ) : consultas.length === 0 ? (
                        <Vacio
                          icono="documento"
                          titulo="Todavía no hay consultas"
                          descripcion="Escribí consultas de referencia o descubrimiento para este tema."
                          accion={
                            puedeCrearConsulta && (
                              <button
                                className="boton boton-primario"
                                type="button"
                                onClick={() => cambiarMostrarConsultas(true)}
                              >
                                <Icono nombre="mas" tamano={17} /> Crear consultas
                              </button>
                            )
                          }
                        />
                      ) : (
                        <>
                          {(puedeAprobar || puedeDarDeBaja) && (
                            <AccionesConsultas
                              cantidadSeleccionadas={seleccionadas.length}
                              cantidadVisibles={consultasVisibles.length}
                              todosSeleccionados={todosSeleccionados}
                              todasBorrador={todasBorrador}
                              puedeAprobar={puedeAprobar}
                              puedeDarDeBaja={puedeDarDeBaja}
                              guardando={guardando || cambiandoTipo}
                              confirmarBaja={confirmarBaja}
                              etiquetaBaja="Dar de baja"
                              alAprobar={aprobarSeleccionadas}
                              alAlternarTodos={alternarSeleccionTotal}
                              alSolicitarBaja={() => cambiarConfirmarBaja(true)}
                              alCancelarBaja={() => cambiarConfirmarBaja(false)}
                              alConfirmarBaja={darDeBajaSeleccionadas}
                            />
                          )}
                          <div className="lista-consultas">
                            {consultas.map((consulta, indice) => (
                              <FilaConsulta
                                key={consulta.uuid}
                                consulta={consulta}
                                indice={indice}
                                seleccionada={seleccionadas.includes(consulta.uuid)}
                                deshabilitada={guardando || cambiandoTipo || confirmarBaja}
                                alCambiarTipo={
                                  puedeCambiarTipo && consulta.estadoConsulta === 'BORRADOR'
                                    ? () => solicitarCambioTipo(consulta)
                                    : undefined
                                }
                                cambioTipoBloqueado={guardando || cambiandoTipo || confirmarBaja}
                                alAbrirDetalle={() => abrirDetalleConsulta(consulta, temaUuid)}
                                alEjecutar={
                                  puedeEjecutar && consulta.estadoConsulta === 'APROBADA'
                                    ? () => ejecutarConsulta(consulta, temaUuid)
                                    : undefined
                                }
                                accionesBloqueadas={guardando || cambiandoTipo || confirmarBaja}
                                alAlternar={
                                  puedeAprobar || puedeDarDeBaja
                                    ? () => alternarSeleccion(consulta.uuid)
                                    : undefined
                                }
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <Aviso tipo="informacion">Tu cuenta no tiene permiso para ver consultas.</Aviso>
                  )}
                  {puedeCrearConsulta && !mostrarConsultas && consultas.length > 0 && (
                    <button
                      className="boton boton-secundario agregar-consulta"
                      type="button"
                      onClick={() => cambiarMostrarConsultas(true)}
                    >
                      <Icono nombre="mas" tamano={17} /> Agregar consultas
                    </button>
                  )}
                  {puedeCrearConsulta && mostrarConsultas && (
                    <form className="formulario formulario-consultas" onSubmit={crearConsultas}>
                      <div className="formulario-consultas-titulo">
                        <div>
                          <span className="sobrelinea">NUEVO LOTE</span>
                          <h3>Crear consultas</h3>
                        </div>
                        <button
                          className="boton-icono"
                          type="button"
                          onClick={() => cambiarMostrarConsultas(false)}
                          aria-label="Cerrar formulario de consultas"
                        >
                          <Icono nombre="cerrar" tamano={18} />
                        </button>
                      </div>
                      <p className="texto-secundario">
                        El lote se guarda completo o no se guarda. Las nuevas consultas quedan en
                        borrador.
                      </p>
                      {filasConsulta.map((fila, indice) => (
                        <div className="fila-consulta-formulario" key={indice}>
                          <div className="fila-consulta-encabezado">
                            <strong>Consulta {indice + 1}</strong>
                            {filasConsulta.length > 1 && (
                              <button
                                className="boton-texto"
                                type="button"
                                onClick={() =>
                                  cambiarFilasConsulta((actuales) =>
                                    actuales.filter((_, posicion) => posicion !== indice),
                                  )
                                }
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                          <label>
                            Texto
                            <textarea
                              required
                              maxLength={2000}
                              rows={3}
                              value={fila.texto}
                              onChange={(evento) =>
                                cambiarFila(indice, 'texto', evento.target.value)
                              }
                              placeholder="¿Qué preguntaría una persona sobre este tema?"
                            />
                          </label>
                          <div className="grilla-formulario">
                            <label>
                              Tipo
                              <select
                                value={fila.tipoConsulta}
                                onChange={(evento) =>
                                  cambiarFila(indice, 'tipoConsulta', evento.target.value)
                                }
                              >
                                <option value="REFERENCIA">Referencia</option>
                                <option value="DESCUBRIMIENTO">Descubrimiento</option>
                              </select>
                            </label>
                            <label>
                              Prioridad
                              <select
                                value={fila.prioridad}
                                onChange={(evento) =>
                                  cambiarFila(indice, 'prioridad', evento.target.value)
                                }
                              >
                                <option value="ALTA">Alta</option>
                                <option value="MEDIA">Media</option>
                                <option value="BAJA">Baja</option>
                              </select>
                            </label>
                          </div>
                        </div>
                      ))}
                      <div className="acciones-formulario">
                        <button
                          className="boton boton-secundario"
                          type="button"
                          onClick={() =>
                            cambiarFilasConsulta((actuales) => [
                              ...actuales,
                              { ...consultaInicial },
                            ])
                          }
                          disabled={filasConsulta.length >= 15}
                        >
                          <Icono nombre="mas" tamano={16} /> Otra consulta
                        </button>
                        <button className="boton boton-primario" type="submit" disabled={guardando}>
                          {guardando ? 'Guardando…' : 'Guardar lote'}{' '}
                          <Icono nombre="flecha" tamano={17} />
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </section>
          </div>
          {consultaParaCambiarTipo && (
            <ConfirmarTipoConsulta
              consulta={consultaParaCambiarTipo}
              enviando={cambiandoTipo}
              alCancelar={() => definirConsultaParaCambiarTipo(null)}
              alConfirmar={confirmarCambioTipo}
            />
          )}
          {confirmandoEstadoCliente && (
            <ConfirmarEstadoCliente
              cliente={cliente}
              enviando={cambiandoEstadoCliente}
              alCancelar={() => cambiarConfirmandoEstadoCliente(false)}
              alConfirmar={() => void cambiarEstadoDelCliente()}
            />
          )}
        </>
      )}
    </div>
  )
}
