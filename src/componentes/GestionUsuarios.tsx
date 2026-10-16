import { useEffect, useRef, useState } from 'react'
import { ErrorApi, api } from '../api/clienteApi'
import type { DatosUsuarioOrganizacion } from '../api/tipos'
import { obtenerMensajeError } from '../utilidades'
import { Aviso, Icono } from './Comun'

const fechaBaja = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
})

function ordenarUsuarios(usuarios: DatosUsuarioOrganizacion[]): DatosUsuarioOrganizacion[] {
  return [...usuarios].sort((a, b) =>
    Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, 'es'),
  )
}

function rolesLegibles(roles: string[]): string {
  return roles.map((rol) => rol === 'PROPIETARIO' ? 'Propietario' : rol === 'MIEMBRO' ? 'Miembro' : rol)
    .join(', ') || 'Sin rol'
}

function fechaBajaLegible(valor: string | null): string {
  if (!valor) return '—'
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? valor : fechaBaja.format(fecha)
}

function mensajeErrorListado(causa: unknown): string {
  if (causa instanceof ErrorApi) {
    if (causa.estado === 403) return 'Tu cuenta no tiene permiso para ver los usuarios de esta organización.'
    if (causa.estado === 404) return 'La organización no está disponible para tu cuenta.'
  }
  return obtenerMensajeError(causa)
}

function mensajeErrorBaja(causa: unknown): string {
  if (causa instanceof ErrorApi) {
    if (causa.estado === 403) return 'Tu cuenta no tiene permiso para dar de baja usuarios.'
    if (causa.estado === 404) return 'La cuenta ya no está activa en esta organización. Actualizá el listado.'
    if (causa.estado === 409) {
      return causa.detalle ?? 'No podés dar de baja tu propia cuenta ni al último propietario activo.'
    }
  }
  return obtenerMensajeError(causa)
}

function mensajeErrorReactivacion(causa: unknown): string {
  if (causa instanceof ErrorApi) {
    if (causa.estado === 403) return 'Tu cuenta no tiene permiso para reactivar usuarios.'
    if (causa.estado === 404) return 'La cuenta o la organización no están disponibles. Actualizá el listado.'
    if (causa.estado === 409) return causa.detalle ?? 'La cuenta ya está activa. Actualizá el listado.'
  }
  return obtenerMensajeError(causa)
}

type AccionUsuario = 'baja' | 'reactivar'

function ConfirmarCambioEstadoUsuario({
  usuario,
  accion,
  enviando,
  error,
  alCancelar,
  alConfirmar,
}: {
  usuario: DatosUsuarioOrganizacion
  accion: AccionUsuario
  enviando: boolean
  error: string
  alCancelar: () => void
  alConfirmar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const elemento = dialogo.current
    if (!elemento) return
    elemento.showModal()
    return () => {
      if (elemento.open) elemento.close()
    }
  }, [])

  return (
    <dialog ref={dialogo} className={`dialogo-tipo dialogo-${accion}-usuario`}
      aria-labelledby="dialogo-usuario-titulo"
      aria-describedby="dialogo-usuario-descripcion"
      onCancel={(evento) => {
        evento.preventDefault()
        if (!enviando) alCancelar()
      }}>
      <div className="dialogo-tipo-contenido">
        <div className="dialogo-tipo-icono">
          <Icono nombre={accion === 'baja' ? 'eliminar' : 'reactivar'} tamano={23} />
        </div>
        <span className="sobrelinea">USUARIO</span>
        <h2 id="dialogo-usuario-titulo">
          {accion === 'baja' ? '¿Dar de baja esta cuenta?' : '¿Reactivar esta cuenta?'}
        </h2>
        <p id="dialogo-usuario-descripcion">
          {accion === 'baja'
            ? 'Se cerrarán sus sesiones y no podrá volver a ingresar. El correo seguirá reservado.'
            : 'Podrá volver a ingresar con su contraseña habitual. Las sesiones anteriores seguirán cerradas.'}
        </p>
        <div className="dialogo-estado-nombre">
          <span>CUENTA</span>
          <strong>{usuario.nombre}</strong>
          <small>{usuario.correoElectronico}</small>
        </div>
        {error && <Aviso>{error}</Aviso>}
        <div className="dialogo-tipo-acciones">
          <button className="boton boton-secundario" type="button" onClick={alCancelar}
            disabled={enviando} autoFocus>Cancelar</button>
          <button className={`boton ${accion === 'baja' ? 'boton-peligro' : 'boton-primario'}`}
            type="button" onClick={alConfirmar} disabled={enviando}>
            {enviando
              ? accion === 'baja' ? 'Dando de baja…' : 'Reactivando…'
              : accion === 'baja' ? 'Dar de baja' : 'Reactivar'}
          </button>
        </div>
      </div>
    </dialog>
  )
}

export function GestionUsuarios({
  organizacionUuid,
  puedeEliminar,
  puedeReactivar,
  revisionAlta,
}: {
  organizacionUuid: string
  puedeEliminar: boolean
  puedeReactivar: boolean
  revisionAlta: number
}) {
  const [revision, cambiarRevision] = useState(0)
  const claveConsulta = `${organizacionUuid}:${revision}:${revisionAlta}`
  const [resultado, cambiarResultado] = useState<{
    clave: string
    usuarios: DatosUsuarioOrganizacion[]
    error: string
  }>({ clave: '', usuarios: [], error: '' })
  const cargando = resultado.clave !== claveConsulta
  const usuarios = resultado.usuarios
  const errorListado = resultado.error
  const [perfilUuid, cambiarPerfilUuid] = useState<string | null>(null)
  const [seleccion, cambiarSeleccion] = useState<{
    usuario: DatosUsuarioOrganizacion
    accion: AccionUsuario
  } | null>(null)
  const [enviando, cambiarEnviando] = useState(false)
  const [errorAccion, cambiarErrorAccion] = useState('')
  const [confirmacion, cambiarConfirmacion] = useState('')

  useEffect(() => {
    let vigente = true
    api.administracion.listarUsuarios(organizacionUuid)
      .then((datos) => {
        if (vigente) cambiarResultado({
          clave: claveConsulta, usuarios: ordenarUsuarios(datos), error: '',
        })
      })
      .catch((causa) => {
        if (vigente) cambiarResultado({
          clave: claveConsulta, usuarios: [], error: mensajeErrorListado(causa),
        })
      })
    return () => { vigente = false }
  }, [organizacionUuid, claveConsulta])

  useEffect(() => {
    if (!puedeEliminar) return
    let vigente = true
    api.perfil.obtener()
      .then((perfil) => {
        if (vigente) cambiarPerfilUuid(perfil.uuid)
      })
      .catch(() => {
        // El backend impide de todas formas la baja de la propia cuenta.
      })
    return () => { vigente = false }
  }, [puedeEliminar])

  /** Sustituye la fila con la respuesta del cambio de estado y conserva el orden del listado. */
  async function aplicarCambioEstado() {
    if (!seleccion || enviando) return
    cambiarErrorAccion('')
    cambiarEnviando(true)
    try {
      const actualizado = seleccion.accion === 'baja'
        ? await api.administracion.darDeBajaUsuario(organizacionUuid, seleccion.usuario.uuid)
        : await api.administracion.reactivarUsuario(organizacionUuid, seleccion.usuario.uuid)
      cambiarResultado((actual) => ({
        ...actual,
        usuarios: ordenarUsuarios(actual.usuarios.map((usuario) =>
          usuario.uuid === actualizado.uuid ? actualizado : usuario,
        )),
      }))
      cambiarSeleccion(null)
      cambiarConfirmacion(`La cuenta de ${actualizado.nombre} fue ${
        seleccion.accion === 'baja' ? 'dada de baja' : 'reactivada'
      }.`)
    } catch (causa) {
      cambiarErrorAccion(seleccion.accion === 'baja'
        ? mensajeErrorBaja(causa) : mensajeErrorReactivacion(causa))
    } finally {
      cambiarEnviando(false)
    }
  }

  return (
    <div className="admin-usuarios">
      <div className="admin-lista-cabecera">
        <p>Las activas aparecen primero. La fecha de última baja se conserva al reactivar.</p>
        <button className="boton boton-secundario boton-chico" type="button"
          onClick={() => {
            cambiarConfirmacion('')
            cambiarRevision((actual) => actual + 1)
          }} disabled={cargando}>Actualizar</button>
      </div>
      {confirmacion && <Aviso tipo="exito">{confirmacion}</Aviso>}
      {errorListado && (
        <div className="admin-lista-error">
          <Aviso>{errorListado}</Aviso>
          <button className="boton boton-secundario boton-chico" type="button"
            onClick={() => cambiarRevision((actual) => actual + 1)}>Reintentar</button>
        </div>
      )}
      {cargando ? (
        <p className="admin-lista-vacio" role="status">Cargando usuarios…</p>
      ) : !errorListado && usuarios.length === 0 ? (
        <p className="admin-lista-vacio">Todavía no hay usuarios en esta organización.</p>
      ) : !errorListado && (
        <div className="admin-tabla-contenedor">
          <table className="admin-tabla-usuarios">
            <thead><tr>
              <th scope="col">Usuario</th>
              <th scope="col">Rol</th>
              <th scope="col">Estado</th>
              <th scope="col">Última baja</th>
              {(puedeEliminar || puedeReactivar) && <th scope="col">Acción</th>}
            </tr></thead>
            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.uuid}>
                  <th scope="row"><strong>{usuario.nombre}</strong><small>{usuario.correoElectronico}</small></th>
                  <td>{rolesLegibles(usuario.roles)}</td>
                  <td><span className={`admin-estado-usuario ${usuario.activo ? 'activo' : 'inactivo'}`}>
                    {usuario.activo ? 'Activo' : 'Inactivo'}
                  </span></td>
                  <td>{fechaBajaLegible(usuario.fechaEliminacion)}</td>
                  {(puedeEliminar || puedeReactivar) && <td>
                    {usuario.activo && puedeEliminar && usuario.uuid !== perfilUuid ? (
                      <button className="boton boton-peligro boton-chico" type="button"
                        onClick={() => {
                          cambiarSeleccion({ usuario, accion: 'baja' })
                          cambiarErrorAccion('')
                          cambiarConfirmacion('')
                        }}>Dar de baja</button>
                    ) : !usuario.activo && puedeReactivar ? (
                      <button className="boton boton-secundario boton-chico" type="button"
                        onClick={() => {
                          cambiarSeleccion({ usuario, accion: 'reactivar' })
                          cambiarErrorAccion('')
                          cambiarConfirmacion('')
                        }}>Reactivar</button>
                    ) : usuario.activo && usuario.uuid === perfilUuid ? 'Tu cuenta' : '—'}
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {seleccion && (
        <ConfirmarCambioEstadoUsuario usuario={seleccion.usuario} accion={seleccion.accion}
          enviando={enviando} error={errorAccion}
          alCancelar={() => cambiarSeleccion(null)} alConfirmar={aplicarCambioEstado} />
      )}
    </div>
  )
}
