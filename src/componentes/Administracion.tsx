import { useEffect, useState, type FormEvent } from 'react'
import { ErrorApi, api } from '../api/clienteApi'
import type { DatosCuenta, DatosOrganizacion, DatosPlan, RespuestaUsuario } from '../api/tipos'
import { obtenerMensajeError, tienePermiso } from '../utilidades'
import { Aviso, Icono } from './Comun'

function mensajeErrorAltaUsuario(causa: unknown): string {
  if (causa instanceof ErrorApi) {
    if (causa.estado === 400) return causa.detalle ?? 'Revisá el nombre, correo, contraseña y rol ingresados.'
    if (causa.estado === 403) return 'Tu cuenta no tiene permiso para crear usuarios.'
    if (causa.estado === 404) return 'La organización no está disponible.'
    if (causa.estado === 409) return causa.detalle ?? 'Ese correo electrónico ya está registrado.'
  }
  return obtenerMensajeError(causa)
}

export function Administracion({ cuenta }: { cuenta: DatosCuenta }) {
  const esSysadmin = cuenta.roles.includes('SYSADMIN')
  const esPropietario = cuenta.roles.includes('PROPIETARIO')
  const puedeVerOrganizaciones =
    esSysadmin && tienePermiso(cuenta.permisos, 'ORGANIZACIONES_VER')
  const puedeCrearOrganizacion =
    esSysadmin && tienePermiso(cuenta.permisos, 'ORGANIZACIONES_CREAR')
  const puedeVerPlanes =
    esSysadmin && tienePermiso(cuenta.permisos, 'PLANES_VER')
  const puedeCrearUsuario =
    (esSysadmin || esPropietario) && tienePermiso(cuenta.permisos, 'USUARIOS_CREAR')
  const [nombreOrganizacion, cambiarNombreOrganizacion] = useState('')
  const [planes, cambiarPlanes] = useState<DatosPlan[]>([])
  const [planUuid, cambiarPlanUuid] = useState('')
  const [cargandoPlanes, cambiarCargandoPlanes] = useState(puedeCrearOrganizacion && puedeVerPlanes)
  const [errorPlanes, cambiarErrorPlanes] = useState('')
  const [revisionPlanes, cambiarRevisionPlanes] = useState(0)
  const [organizaciones, cambiarOrganizaciones] = useState<DatosOrganizacion[]>([])
  const [organizacionCreada, cambiarOrganizacionCreada] = useState<DatosOrganizacion | null>(null)
  const [organizacionUuid, cambiarOrganizacionUuid] = useState('')
  const [cargandoOrganizaciones, cambiarCargandoOrganizaciones] = useState(puedeVerOrganizaciones)
  const [errorOrganizaciones, cambiarErrorOrganizaciones] = useState('')
  const [revisionOrganizaciones, cambiarRevisionOrganizaciones] = useState(0)
  const [nombreUsuario, cambiarNombreUsuario] = useState('')
  const [correo, cambiarCorreo] = useState('')
  const [clave, cambiarClave] = useState('')
  const [rol, cambiarRol] = useState<'PROPIETARIO' | 'MIEMBRO'>(
    esSysadmin ? 'PROPIETARIO' : 'MIEMBRO',
  )
  const [usuarioCreado, cambiarUsuarioCreado] = useState<RespuestaUsuario | null>(null)
  const [errorOrganizacion, cambiarErrorOrganizacion] = useState('')
  const [errorUsuario, cambiarErrorUsuario] = useState('')
  const [guardandoOrganizacion, cambiarGuardandoOrganizacion] = useState(false)
  const [guardandoUsuario, cambiarGuardandoUsuario] = useState(false)
  const organizacionAltaUuid = esSysadmin ? organizacionUuid : cuenta.organizacionUuid

  useEffect(() => {
    if (!puedeCrearOrganizacion || !puedeVerPlanes) return
    let vigente = true
    api.administracion
      .listarPlanes()
      .then((datos) => {
        if (!vigente) return
        cambiarPlanes(datos)
        cambiarPlanUuid((actual) => (datos.some((plan) => plan.uuid === actual) ? actual : ''))
      })
      .catch((causa) => {
        if (vigente) cambiarErrorPlanes(obtenerMensajeError(causa))
      })
      .finally(() => {
        if (vigente) cambiarCargandoPlanes(false)
      })
    return () => {
      vigente = false
    }
  }, [puedeCrearOrganizacion, puedeVerPlanes, revisionPlanes])

  useEffect(() => {
    if (!puedeVerOrganizaciones) return
    let vigente = true
    api.administracion
      .listarOrganizaciones()
      .then((datos) => {
        if (vigente) cambiarOrganizaciones(datos)
      })
      .catch((causa) => {
        if (vigente) cambiarErrorOrganizaciones(obtenerMensajeError(causa))
      })
      .finally(() => {
        if (vigente) cambiarCargandoOrganizaciones(false)
      })
    return () => {
      vigente = false
    }
  }, [puedeVerOrganizaciones, revisionOrganizaciones])

  /** Envía el plan elegido e incorpora el alta al selector de organizaciones. */
  async function crearOrganizacion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    cambiarErrorOrganizacion('')
    cambiarOrganizacionCreada(null)
    if (!planes.some((plan) => plan.uuid === planUuid)) {
      cambiarErrorOrganizacion('Seleccioná un plan disponible.')
      return
    }
    cambiarGuardandoOrganizacion(true)
    try {
      const creada = await api.administracion.crearOrganizacion({
        nombre: nombreOrganizacion.trim(),
        planUuid,
      })
      cambiarOrganizacionCreada(creada)
      cambiarOrganizaciones((actuales) =>
        [...actuales, creada].sort((primera, segunda) =>
          primera.nombre.localeCompare(segunda.nombre, 'es'),
        ),
      )
      cambiarOrganizacionUuid(creada.uuid)
      if (cargandoOrganizaciones) cambiarRevisionOrganizaciones((actual) => actual + 1)
      cambiarNombreOrganizacion('')
      cambiarPlanUuid('')
    } catch (causa) {
      cambiarErrorOrganizacion(obtenerMensajeError(causa))
    } finally {
      cambiarGuardandoOrganizacion(false)
    }
  }

  async function crearUsuario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    cambiarErrorUsuario('')
    cambiarUsuarioCreado(null)
    if (
      !organizacionAltaUuid ||
      (esSysadmin && !organizaciones.some((organizacion) => organizacion.uuid === organizacionAltaUuid))
    ) {
      cambiarErrorUsuario(
        esSysadmin
          ? 'Seleccioná una organización activa.'
          : 'Tu cuenta no tiene una organización disponible para crear usuarios.',
      )
      return
    }
    cambiarGuardandoUsuario(true)
    try {
      const creado = await api.administracion.crearUsuario(organizacionAltaUuid, {
        nombre: nombreUsuario.trim(),
        correoElectronico: correo.trim(),
        clave,
        rol,
      })
      cambiarUsuarioCreado(creado)
      cambiarNombreUsuario('')
      cambiarCorreo('')
      cambiarClave('')
      cambiarRol(esSysadmin ? 'PROPIETARIO' : 'MIEMBRO')
    } catch (causa) {
      cambiarErrorUsuario(mensajeErrorAltaUsuario(causa))
    } finally {
      cambiarGuardandoUsuario(false)
    }
  }

  return (
    <div className="contenido-limitado">
      <div className="encabezado-pagina">
        <div>
          <span className="sobrelinea">{esSysadmin ? 'PLATAFORMA' : 'TU ORGANIZACIÓN'}</span>
          <h1>Administración</h1>
          <p>{esSysadmin ? 'Altas de organizaciones y usuarios.' : 'Alta de usuarios de tu organización.'}</p>
        </div>
      </div>
      {!puedeCrearOrganizacion && !puedeCrearUsuario && (
        <Aviso tipo="informacion">
          Tu cuenta no tiene permisos de alta de organizaciones ni usuarios.
        </Aviso>
      )}
      <div className="admin-grilla">
        {puedeCrearOrganizacion && (
          <section className="tarjeta admin-tarjeta">
            <div className="admin-tarjeta-icono">
              <Icono nombre="capas" />
            </div>
            <span className="sobrelinea">PASO 01</span>
            <h2>Crear organización</h2>
            <p className="texto-secundario">
              La organización se crea vacía. Luego podés dar de alta su primer usuario.
            </p>
            <form className="formulario apilado" onSubmit={crearOrganizacion}>
              <label>
                Nombre de la organización
                <input
                  required
                  maxLength={200}
                  value={nombreOrganizacion}
                  onChange={(evento) => cambiarNombreOrganizacion(evento.target.value)}
                  placeholder="Ej. Agencia Norte"
                />
              </label>
              <label>
                Plan
                <select
                  required
                  value={planUuid}
                  disabled={!puedeVerPlanes || cargandoPlanes || planes.length === 0}
                  onChange={(evento) => cambiarPlanUuid(evento.target.value)}
                >
                  <option value="" disabled>
                    {!puedeVerPlanes
                      ? 'Sin permiso para ver planes'
                      : cargandoPlanes
                        ? 'Cargando planes…'
                        : planes.length === 0
                          ? 'No hay planes disponibles'
                          : 'Seleccioná un plan'}
                  </option>
                  {planes.map((plan) => (
                    <option key={plan.uuid} value={plan.uuid}>
                      {plan.nombre} · Hasta {plan.limiteClientesActivos}{' '}
                      {plan.limiteClientesActivos === 1 ? 'cliente activo' : 'clientes activos'}
                    </option>
                  ))}
                </select>
              </label>
              {!puedeVerPlanes && (
                <Aviso tipo="informacion">
                  Tu cuenta necesita el permiso PLANES_VER para elegir un plan.
                </Aviso>
              )}
              {errorPlanes && (
                <div>
                  <Aviso>{errorPlanes}</Aviso>
                  <button
                    type="button"
                    className="boton boton-secundario reintentar"
                    onClick={() => {
                      cambiarErrorPlanes('')
                      cambiarCargandoPlanes(true)
                      cambiarRevisionPlanes((actual) => actual + 1)
                    }}
                  >
                    Reintentar carga
                  </button>
                </div>
              )}
              {errorOrganizacion && <Aviso>{errorOrganizacion}</Aviso>}
              {organizacionCreada && (
                <Aviso tipo="exito">
                  Organización creada: <strong>{organizacionCreada.nombre}</strong>
                </Aviso>
              )}
              <button
                type="submit"
                className="boton boton-primario"
                disabled={guardandoOrganizacion || !puedeVerPlanes || cargandoPlanes || planes.length === 0}
              >
                {guardandoOrganizacion ? 'Creando…' : 'Crear organización'}{' '}
                <Icono nombre="flecha" tamano={17} />
              </button>
            </form>
          </section>
        )}
        {puedeCrearUsuario && (
          <section className="tarjeta admin-tarjeta">
            <div className="admin-tarjeta-icono">
              <Icono nombre="clientes" />
            </div>
            <span className="sobrelinea">{esSysadmin ? 'PASO 02' : 'CUENTAS'}</span>
            <h2>Crear usuario</h2>
            <p className="texto-secundario">
              {esSysadmin
                ? 'El primer usuario de una organización debe tener el rol Propietario.'
                : 'El nuevo usuario tendrá acceso a tu organización.'}
            </p>
            {!esSysadmin && !cuenta.organizacionUuid && (
              <Aviso>Tu cuenta no tiene una organización disponible para crear usuarios.</Aviso>
            )}
            <form className="formulario apilado" onSubmit={crearUsuario}>
              {esSysadmin && (
                <label>
                  Organización
                  <select
                    required
                    value={organizacionUuid}
                    onChange={(evento) => cambiarOrganizacionUuid(evento.target.value)}
                  >
                    <option value="" disabled>
                      {cargandoOrganizaciones
                        ? 'Cargando organizaciones…'
                        : organizaciones.length === 0
                          ? 'No hay organizaciones activas'
                          : 'Seleccioná una organización'}
                    </option>
                    {organizaciones.map((organizacion) => (
                      <option key={organizacion.uuid} value={organizacion.uuid}>
                        {organizacion.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {esSysadmin && errorOrganizaciones && (
                <div>
                  <Aviso>{errorOrganizaciones}</Aviso>
                  {puedeVerOrganizaciones && (
                    <button
                      type="button"
                      className="boton boton-secundario reintentar"
                      onClick={() => {
                        cambiarErrorOrganizaciones('')
                        cambiarCargandoOrganizaciones(true)
                        cambiarRevisionOrganizaciones((actual) => actual + 1)
                      }}
                    >
                      Reintentar carga
                    </button>
                  )}
                </div>
              )}
              {esSysadmin && !puedeVerOrganizaciones && organizaciones.length === 0 && (
                <Aviso tipo="informacion">
                  Tu cuenta necesita el permiso ORGANIZACIONES_VER para elegir una organización
                  existente.
                </Aviso>
              )}
              <label>
                Nombre
                <input
                  required
                  value={nombreUsuario}
                  onChange={(evento) => cambiarNombreUsuario(evento.target.value)}
                  placeholder="Nombre y apellido"
                />
              </label>
              <label>
                Correo electrónico
                <input
                  required
                  type="email"
                  autoComplete="off"
                  value={correo}
                  onChange={(evento) => cambiarCorreo(evento.target.value)}
                  placeholder="persona@agencia.com"
                />
              </label>
              <label>
                Contraseña inicial
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  value={clave}
                  onChange={(evento) => cambiarClave(evento.target.value)}
                  placeholder="Contraseña elegida"
                />
              </label>
              <label>
                Rol
                <select
                  value={rol}
                  onChange={(evento) =>
                    cambiarRol(evento.target.value as 'PROPIETARIO' | 'MIEMBRO')
                  }
                >
                  <option value="PROPIETARIO">Propietario</option>
                  <option value="MIEMBRO">Miembro</option>
                </select>
              </label>
              {errorUsuario && <Aviso>{errorUsuario}</Aviso>}
              {usuarioCreado && (
                <Aviso tipo="exito">
                  Usuario creado: <strong>{usuarioCreado.nombre}</strong> ({usuarioCreado.correoElectronico})
                  {' · '}{usuarioCreado.rol === 'PROPIETARIO' ? 'Propietario' : 'Miembro'}.
                </Aviso>
              )}
              <button
                type="submit"
                className="boton boton-primario"
                disabled={guardandoUsuario || !organizacionAltaUuid || (esSysadmin && organizaciones.length === 0)}
              >
                {guardandoUsuario ? 'Creando…' : 'Crear usuario'}{' '}
                <Icono nombre="flecha" tamano={17} />
              </button>
            </form>
          </section>
        )}
      </div>
      {esSysadmin && (
        <div className="nota-disponibilidad">
          <Icono nombre="escudo" tamano={17} />
          <p>
            El selector muestra organizaciones activas. La API todavía no permite listar ni editar
            usuarios.
          </p>
        </div>
      )}
    </div>
  )
}
