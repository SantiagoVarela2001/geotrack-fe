import { useEffect, useState } from 'react'
import { api } from '../api/clienteApi'
import type { DatosCliente, DatosCuenta } from '../api/tipos'
import { obtenerMensajeError, tienePermiso } from '../utilidades'
import { AnalisisSemanalesCliente } from './AnalisisSemanalesCliente'
import { Aviso, Icono } from './Comun'

export function PaginaAnalisisSemanales({
  clienteUuid,
  cuenta,
  confirmarAlAbrir,
  alVolver,
}: {
  clienteUuid: string
  cuenta: DatosCuenta
  confirmarAlAbrir: boolean
  alVolver: () => void
}) {
  const puedeVerCliente = tienePermiso(cuenta.permisos, 'CLIENTES_VER')
  const [cliente, cambiarCliente] = useState<DatosCliente | null>(null)
  const [errorCliente, cambiarErrorCliente] = useState('')
  const [revisionCliente, cambiarRevisionCliente] = useState(0)

  useEffect(() => {
    if (!puedeVerCliente) return
    let vigente = true
    api.clientes.obtener(clienteUuid)
      .then((datos) => { if (vigente) cambiarCliente(datos) })
      .catch((error: unknown) => {
        if (vigente) cambiarErrorCliente(obtenerMensajeError(error))
      })
    return () => { vigente = false }
  }, [clienteUuid, puedeVerCliente, revisionCliente])

  /** La ruta /nuevo solo abre la confirmación; una recarga posterior vuelve a la lectura. */
  useEffect(() => {
    if (!confirmarAlAbrir) return
    const rutaBase = `/clientes/${clienteUuid}/analisis-semanales`
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}#${rutaBase}`,
    )
  }, [clienteUuid, confirmarAlAbrir])

  return (
    <div className="contenido-limitado pagina-analisis">
      <button className="enlace-volver" type="button" onClick={alVolver}>
        <Icono nombre="volver" tamano={17} /> Volver al cliente
      </button>
      {errorCliente && (
        <div className="pagina-analisis-error-cliente">
          <Aviso>El nombre del cliente no se pudo cargar: {errorCliente}</Aviso>
          <button type="button" className="boton boton-secundario boton-chico"
            onClick={() => {
              cambiarErrorCliente('')
              cambiarRevisionCliente((actual) => actual + 1)
            }}>Reintentar datos del cliente</button>
        </div>
      )}
      <AnalisisSemanalesCliente
        clienteUuid={clienteUuid}
        cliente={cliente}
        cuenta={cuenta}
        confirmarAlAbrir={confirmarAlAbrir}
      />
    </div>
  )
}
