import { useEffect, useRef, useState } from 'react'
import { api, ErrorApi } from '../api/clienteApi'
import type { DatosAccionCliente, DatosCliente, DatosCuenta, SolicitudAccionCliente } from '../api/tipos'
import { permisosAcciones } from '../accionesCliente'
import { obtenerMensajeError } from '../utilidades'

/** Comparte escrituras y diálogos; ignora sus respuestas al abandonar el cliente. */
export function useGestionAccionesCliente(cliente: DatosCliente | null, cuenta: DatosCuenta, alActualizar: () => void) {
  const permisos = permisosAcciones(cuenta, cliente)
  const [formulario, cambiarFormulario] = useState<{ accion: DatosAccionCliente | null } | null>(null)
  const [baja, cambiarBaja] = useState<DatosAccionCliente | null>(null)
  const [guardando, cambiarGuardando] = useState(false)
  const [error, cambiarError] = useState('')
  const [mensaje, cambiarMensaje] = useState('')
  const ocupado = useRef(false)
  const contexto = useRef({ vigente: true })
  useEffect(() => {
    const version = { vigente: true }
    contexto.current = version
    return () => { version.vigente = false }
  }, [cliente?.uuid])

  function abrir(accion: DatosAccionCliente | null) {
    if (ocupado.current || !(accion ? permisos.editar : permisos.crear)) return
    cambiarError('')
    cambiarMensaje('')
    cambiarFormulario({ accion })
  }

  function pedirBaja(accion: DatosAccionCliente) {
    if (ocupado.current || !permisos.eliminar) return
    cambiarError('')
    cambiarMensaje('')
    cambiarBaja(accion)
  }

  function cerrar() {
    if (ocupado.current) return
    cambiarFormulario(null)
    cambiarBaja(null)
    cambiarError('')
  }

  async function ejecutar(operacion: () => Promise<unknown>, mensajeExito: string) {
    if (ocupado.current) return
    ocupado.current = true
    cambiarGuardando(true)
    cambiarError('')
    const version = contexto.current
    try {
      await operacion()
      if (!version.vigente) return
      cambiarFormulario(null)
      cambiarBaja(null)
      cambiarMensaje(mensajeExito)
      // Se relee el servidor para conservar su orden, también ante títulos o fechas repetidos.
      alActualizar()
    } catch (causa) {
      if (!version.vigente) return
      cambiarError(obtenerMensajeError(causa))
      // Una acción puede haber desaparecido desde otra sesión; el formulario conserva sus datos.
      if (causa instanceof ErrorApi && causa.estado === 404) alActualizar()
    } finally {
      ocupado.current = false
      if (version.vigente) cambiarGuardando(false)
    }
  }

  async function guardar(datos: SolicitudAccionCliente) {
    if (!cliente || !formulario || !(formulario.accion ? permisos.editar : permisos.crear)) {
      cambiarError('Ya no podés guardar acciones para este cliente. Revisá sus permisos y estado.')
      return
    }
    const accion = formulario.accion
    await ejecutar(() => accion ? api.acciones.editar(cliente.uuid, accion.uuid, datos)
      : api.acciones.crear(cliente.uuid, datos), accion ? 'Acción actualizada.' : 'Acción registrada.')
  }

  async function eliminar() {
    if (!cliente || !baja || !permisos.eliminar) {
      cambiarError('Ya no podés eliminar acciones para este cliente. Revisá sus permisos y estado.')
      return
    }
    await ejecutar(() => api.acciones.eliminar(cliente.uuid, baja.uuid), 'Acción eliminada.')
  }

  return { permisos, formulario, baja, guardando, error, mensaje, abrir, pedirBaja, cerrar, guardar, eliminar }
}
