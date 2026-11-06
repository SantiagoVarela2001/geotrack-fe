import { useEffect, useState } from 'react'
import { api } from '../api/clienteApi'
import type { DatosAccionCliente, DatosCliente, DatosCuenta } from '../api/tipos'
import { fechaAccionLegible } from '../accionesCliente'
import { obtenerMensajeError, urlWebSegura } from '../utilidades'
import { Aviso, Icono } from './Comun'
import { FormularioAccionCliente } from './FormularioAccionCliente'
import { ConfirmarEliminarAccion } from './ConfirmarEliminarAccion'
import { useGestionAccionesCliente } from './useGestionAccionesCliente'

type Gestion = ReturnType<typeof useGestionAccionesCliente>

export function VentanasAccionesCliente({ gestion }: { gestion: Gestion }) {
  return <>
    {gestion.formulario && <FormularioAccionCliente accion={gestion.formulario.accion} guardando={gestion.guardando}
      permitido={gestion.formulario.accion ? gestion.permisos.editar : gestion.permisos.crear}
      error={gestion.error} alCerrar={gestion.cerrar} alGuardar={gestion.guardar} />}
    {gestion.baja && <ConfirmarEliminarAccion accion={gestion.baja} guardando={gestion.guardando}
      permitido={gestion.permisos.eliminar} error={gestion.error} alCerrar={gestion.cerrar} alConfirmar={gestion.eliminar} />}
  </>
}

export function ListaAccionesCliente({ acciones, gestion, resumida = false }: {
  acciones: DatosAccionCliente[]; gestion: Gestion; resumida?: boolean
}) {
  return <ul className="acciones-lista">
    {acciones.map((accion) => {
      const url = urlWebSegura(accion.url)
      return <li key={accion.uuid} className="accion-fila">
        <div>
          <time dateTime={accion.fecha}>{fechaAccionLegible(accion.fecha)}</time>
          <h4>{accion.titulo}</h4>
          {resumida ? (accion.descripcion || url) && <details className="accion-detalles">
            <summary>Ver detalles</summary>
            {accion.descripcion && <p className="accion-descripcion">{accion.descripcion}</p>}
            {url && <a href={url} target="_blank" rel="noopener noreferrer">Ver enlace ↗</a>}
          </details> : <>
            {accion.descripcion && <p className="accion-descripcion">{accion.descripcion}</p>}
            {url && <a href={url} target="_blank" rel="noopener noreferrer">Ver enlace ↗</a>}
          </>}
        </div>
        <div className="accion-botones">
          {gestion.permisos.editar && <button type="button" className="boton boton-secundario boton-chico"
            disabled={gestion.guardando} aria-label={`Editar acción: ${accion.titulo}`} onClick={() => gestion.abrir(accion)}>
            <Icono nombre="editar" tamano={15} /> Editar
          </button>}
          {gestion.permisos.eliminar && <button type="button" className="boton boton-secundario boton-chico"
            disabled={gestion.guardando} aria-label={`Eliminar acción: ${accion.titulo}`} onClick={() => gestion.pedirBaja(accion)}>
            <Icono nombre="eliminar" tamano={15} /> Eliminar
          </button>}
        </div>
      </li>
    })}
  </ul>
}

export function GestionAccionesCliente({ cliente, clienteUuid, cuenta, revisionExterna = 0, alActualizar, ocultarAlta = false }: {
  cliente: DatosCliente | null; clienteUuid?: string; cuenta: DatosCuenta; revisionExterna?: number; alActualizar?: () => void; ocultarAlta?: boolean
}) {
  const [resultado, cambiarResultado] = useState<{
    clave: string; acciones: DatosAccionCliente[]; error: string
  } | null>(null)
  const [revision, cambiarRevision] = useState(0)
  const uuid = cliente?.uuid ?? clienteUuid
  const clave = `${uuid}:${revision + revisionExterna}`
  const cargando = resultado?.clave !== clave
  const acciones = cargando ? [] : resultado.acciones
  const error = cargando ? '' : resultado.error
  const gestion = useGestionAccionesCliente(cliente, cuenta, () => {
    cambiarRevision((actual) => actual + 1)
    alActualizar?.()
  })
  useEffect(() => {
    if (!gestion.permisos.ver || !uuid) return
    let vigente = true
    api.acciones.listar(uuid)
      .then((datos) => { if (vigente) cambiarResultado({ clave, acciones: datos, error: '' }) })
      .catch((causa) => { if (vigente) cambiarResultado({ clave, acciones: [], error: obtenerMensajeError(causa) }) })
    return () => { vigente = false }
  }, [uuid, gestion.permisos.ver, clave])

  return <section id="acciones-cliente" className="tarjeta gestion-acciones" aria-labelledby="acciones-cliente-titulo">
    <div className="seccion-cabecera">
      <div><span className="sobrelinea">HISTORIAL DE TU MARCA</span><h2 id="acciones-cliente-titulo">Todas las acciones</h2></div>
      {gestion.permisos.crear && !ocultarAlta && <button className="boton boton-primario boton-chico" type="button"
        disabled={gestion.guardando} onClick={() => gestion.abrir(null)}><Icono nombre="mas" tamano={16} /> Registrar acción</button>}
    </div>
    <p>Tu historial completo, independientemente del período elegido en el gráfico.</p>
    {cliente?.estado === 'ARCHIVADO' && <Aviso tipo="informacion">Este cliente está archivado. Podés consultar sus acciones.</Aviso>}
    {gestion.mensaje && <Aviso tipo="exito">{gestion.mensaje}</Aviso>}
    {!gestion.permisos.ver ? <Aviso tipo="informacion">Tu cuenta no tiene permiso para consultar acciones.</Aviso>
      : cargando ? <p role="status">Cargando acciones…</p>
        : error ? <div><Aviso>{error}</Aviso><button className="boton boton-secundario" type="button"
          onClick={() => cambiarRevision((actual) => actual + 1)}>Reintentar acciones</button></div>
          : acciones.length ? <><p className="acciones-total">{acciones.length} {acciones.length === 1 ? 'acción registrada' : 'acciones registradas'}</p>
            <ListaAccionesCliente acciones={acciones} gestion={gestion} resumida /></>
            : <p className="metricas-vacio">Todavía no hay acciones registradas para este cliente.</p>}
    <VentanasAccionesCliente gestion={gestion} />
  </section>
}
