import { useEffect, useState } from 'react'
import { api } from '../api/clienteApi'
import type { DatosCliente, DatosCuenta } from '../api/tipos'
import { obtenerMensajeError, tienePermiso } from '../utilidades'
import { Aviso, Icono } from './Comun'
import { GestionAccionesCliente, VentanasAccionesCliente } from './GestionAccionesCliente'
import { PanelEvolucionCliente } from './PanelEvolucionCliente'
import { useGestionAccionesCliente } from './useGestionAccionesCliente'

export function PaginaAccionesCliente({ clienteUuid, cuenta, alVolver }: {
  clienteUuid: string
  cuenta: DatosCuenta
  alVolver: () => void
}) {
  const [cliente, cambiarCliente] = useState<DatosCliente | null>(null)
  const [error, cambiarError] = useState('')
  const [revisionCliente, cambiarRevisionCliente] = useState(0)
  const [revisionAcciones, cambiarRevisionAcciones] = useState(0)
  const puedeVerCliente = tienePermiso(cuenta.permisos, 'CLIENTES_VER')
  const puedeVerMetricas = tienePermiso(cuenta.permisos, 'CONSULTAS_VER')
  const actualizarAcciones = () => cambiarRevisionAcciones((actual) => actual + 1)
  const alta = useGestionAccionesCliente(cliente, cuenta, actualizarAcciones)
  useEffect(() => {
    const anterior = document.title
    document.title = 'Acciones realizadas · Gelaia'
    return () => { document.title = anterior }
  }, [])
  useEffect(() => {
    if (!puedeVerCliente) return
    let vigente = true
    api.clientes.obtener(clienteUuid)
      .then((datos) => { if (vigente) cambiarCliente(datos) })
      .catch((causa) => { if (vigente) cambiarError(obtenerMensajeError(causa)) })
    return () => { vigente = false }
  }, [clienteUuid, puedeVerCliente, revisionCliente])

  return <div className="pagina-acciones pagina-metricas">
    <button className="enlace-volver" type="button" onClick={alVolver}>
      <Icono nombre="volver" tamano={17} /> Volver al cliente
    </button>
    <header className="metricas-cabecera acciones-cabecera-pagina">
      <div>
      <span className="sobrelinea">{cliente?.nombre || 'CLIENTE MONITOREADO'}</span>
      <h1>Acciones realizadas</h1>
      <p>Registrá tus avances y mirá cómo evoluciona la presencia de tu marca.</p>
      </div>
      {alta.permisos.crear && <button className="boton boton-primario" type="button"
        disabled={alta.guardando} onClick={() => alta.abrir(null)}><Icono nombre="mas" tamano={17} /> Registrar acción</button>}
    </header>
    {alta.mensaje && <Aviso tipo="exito">{alta.mensaje}</Aviso>}
    {error && <div><Aviso>{error}</Aviso><button className="boton boton-secundario" type="button"
      onClick={() => { cambiarError(''); cambiarRevisionCliente((actual) => actual + 1) }}>Reintentar cliente</button></div>}
    {puedeVerMetricas && <PanelEvolucionCliente clienteUuid={clienteUuid} cliente={cliente} cuenta={cuenta}
      revisionExterna={revisionAcciones} alActualizarAcciones={actualizarAcciones} />}
    <GestionAccionesCliente cliente={cliente} clienteUuid={clienteUuid} cuenta={cuenta} revisionExterna={revisionAcciones} ocultarAlta
      alActualizar={actualizarAcciones} />
    <VentanasAccionesCliente gestion={alta} />
  </div>
}
