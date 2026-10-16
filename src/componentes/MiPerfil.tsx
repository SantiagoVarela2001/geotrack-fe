import { useEffect, useState, type FormEvent } from 'react'
import { ErrorApi, api } from '../api/clienteApi'
import type { DatosCuenta, DatosPerfil } from '../api/tipos'
import { obtenerMensajeError } from '../utilidades'
import { Aviso, Icono } from './Comun'

function mensajeErrorPerfil(causa: unknown): string {
  if (causa instanceof ErrorApi) {
    if (causa.estado === 400) return causa.detalle ?? 'Revisá el nombre y el correo electrónico ingresados.'
    if (causa.estado === 403) return 'Tu cuenta no tiene permiso para actualizar el perfil.'
    if (causa.estado === 409) return causa.detalle ?? 'Ese correo electrónico ya está registrado.'
  }
  return obtenerMensajeError(causa)
}

function mensajeErrorClave(causa: unknown): string {
  if (causa instanceof ErrorApi) {
    if (causa.estado === 400) return causa.detalle ?? 'La contraseña actual es incorrecta o la nueva no es válida.'
    if (causa.estado === 403) return 'Tu cuenta no tiene permiso para cambiar la contraseña.'
  }
  return obtenerMensajeError(causa)
}

export function MiPerfil({ alActualizarCuenta }: { alActualizarCuenta: (cuenta: DatosCuenta) => void }) {
  const [perfil, cambiarPerfil] = useState<DatosPerfil | null>(null)
  const [nombre, cambiarNombre] = useState('')
  const [correo, cambiarCorreo] = useState('')
  const [cargandoPerfil, cambiarCargandoPerfil] = useState(true)
  const [revisionPerfil, cambiarRevisionPerfil] = useState(0)
  const [errorCarga, cambiarErrorCarga] = useState('')
  const [errorPerfil, cambiarErrorPerfil] = useState('')
  const [exitoPerfil, cambiarExitoPerfil] = useState('')
  const [guardandoPerfil, cambiarGuardandoPerfil] = useState(false)
  const [cuentaPendiente, cambiarCuentaPendiente] = useState(false)
  const [claveActual, cambiarClaveActual] = useState('')
  const [claveNueva, cambiarClaveNueva] = useState('')
  const [confirmacionClave, cambiarConfirmacionClave] = useState('')
  const [errorClave, cambiarErrorClave] = useState('')
  const [exitoClave, cambiarExitoClave] = useState('')
  const [guardandoClave, cambiarGuardandoClave] = useState(false)

  useEffect(() => {
    let vigente = true
    api.perfil
      .obtener()
      .then((datos) => {
        if (!vigente) return
        cambiarPerfil(datos)
        cambiarNombre(datos.nombre)
        cambiarCorreo(datos.correoElectronico ?? '')
        cambiarErrorCarga('')
      })
      .catch((causa) => {
        if (vigente) cambiarErrorCarga(obtenerMensajeError(causa))
      })
      .finally(() => {
        if (vigente) cambiarCargandoPerfil(false)
      })
    return () => {
      vigente = false
    }
  }, [revisionPerfil])

  async function actualizarCuenta() {
    try {
      alActualizarCuenta(await api.obtenerCuentaActual())
      cambiarCuentaPendiente(false)
      cambiarErrorPerfil('')
      cambiarExitoPerfil('Perfil actualizado.')
    } catch (causa) {
      cambiarCuentaPendiente(true)
      cambiarErrorPerfil(
        `El perfil se guardó, pero no se pudo actualizar el usuario mostrado: ${obtenerMensajeError(causa)}`,
      )
    }
  }

  async function guardarPerfil(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!perfil) return
    cambiarErrorPerfil('')
    cambiarExitoPerfil('')
    cambiarGuardandoPerfil(true)
    try {
      const datos = perfil.tipoCuenta === 'PLATAFORMA'
        ? { nombre: nombre.trim() }
        : { nombre: nombre.trim(), correoElectronico: correo.trim() }
      const actualizado = await api.perfil.actualizar(datos)
      cambiarPerfil(actualizado)
      cambiarNombre(actualizado.nombre)
      cambiarCorreo(actualizado.correoElectronico ?? '')
      if (perfil.tipoCuenta === 'ORGANIZACION' &&
          (actualizado.correoElectronico !== perfil.correoElectronico || cuentaPendiente)) {
        await actualizarCuenta()
      } else {
        cambiarExitoPerfil('Perfil actualizado.')
      }
    } catch (causa) {
      cambiarErrorPerfil(mensajeErrorPerfil(causa))
    } finally {
      cambiarGuardandoPerfil(false)
    }
  }

  async function guardarClave(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    cambiarErrorClave('')
    cambiarExitoClave('')
    if (claveNueva !== confirmacionClave) {
      cambiarErrorClave('La nueva contraseña y su confirmación no coinciden.')
      return
    }
    cambiarGuardandoClave(true)
    try {
      await api.perfil.cambiarClave(claveActual, claveNueva)
      cambiarClaveActual('')
      cambiarClaveNueva('')
      cambiarConfirmacionClave('')
      cambiarExitoClave('La contraseña cambió. Las demás sesiones se cerraron; esta sesión sigue abierta.')
    } catch (causa) {
      cambiarErrorClave(mensajeErrorClave(causa))
    } finally {
      cambiarGuardandoClave(false)
    }
  }

  return (
    <div className="contenido-limitado pagina-perfil">
      <div className="encabezado-pagina">
        <div>
          <span className="sobrelinea">TU CUENTA</span>
          <h1>Mi perfil</h1>
          <p>Actualizá tus datos y tu contraseña.</p>
        </div>
      </div>
      <div className="admin-grilla">
        <section className="tarjeta admin-tarjeta">
          <div className="admin-tarjeta-icono"><Icono nombre="clientes" /></div>
          <h2>Datos personales</h2>
          <p className="texto-secundario">Estos datos identifican tu cuenta en Gelaia.</p>
          {cargandoPerfil ? (
            <div role="status">Cargando perfil…</div>
          ) : errorCarga ? (
            <div>
              <Aviso>{errorCarga}</Aviso>
              <button className="boton boton-secundario reintentar" type="button"
                onClick={() => {
                  cambiarErrorCarga('')
                  cambiarCargandoPerfil(true)
                  cambiarRevisionPerfil((actual) => actual + 1)
                }}>
                Reintentar
              </button>
            </div>
          ) : perfil && (
            <form className="formulario apilado" onSubmit={guardarPerfil}>
              <label>
                Nombre
                <input required autoComplete="name" value={nombre} disabled={guardandoPerfil}
                  onChange={(evento) => {
                    cambiarNombre(evento.target.value)
                    cambiarExitoPerfil('')
                  }} />
              </label>
              {perfil.tipoCuenta === 'ORGANIZACION' ? (
                <label>
                  Correo electrónico
                  <input required type="email" autoComplete="email" value={correo}
                    disabled={guardandoPerfil}
                    onChange={(evento) => {
                      cambiarCorreo(evento.target.value)
                      cambiarExitoPerfil('')
                    }} />
                </label>
              ) : (
                <p className="perfil-nota">Tu identificador de ingreso permanece fijo.</p>
              )}
              {errorPerfil && <Aviso>{errorPerfil}</Aviso>}
              {exitoPerfil && <Aviso tipo="exito">{exitoPerfil}</Aviso>}
              {cuentaPendiente && (
                <button className="boton boton-secundario" type="button"
                  onClick={actualizarCuenta} disabled={guardandoPerfil}>
                  Reintentar actualización de la cuenta
                </button>
              )}
              <button className="boton boton-primario" type="submit" disabled={guardandoPerfil}>
                {guardandoPerfil ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          )}
        </section>

        <section className="tarjeta admin-tarjeta">
          <div className="admin-tarjeta-icono"><Icono nombre="escudo" /></div>
          <h2>Cambiar mi contraseña</h2>
          <p className="texto-secundario">Las demás sesiones se cerrarán al confirmar el cambio.</p>
          <form className="formulario apilado" onSubmit={guardarClave}>
            <label>
              Contraseña actual
              <input required type="password" autoComplete="current-password"
                value={claveActual} disabled={guardandoClave}
                onChange={(evento) => cambiarClaveActual(evento.target.value)} />
            </label>
            <label>
              Nueva contraseña
              <input required type="password" autoComplete="new-password"
                value={claveNueva} disabled={guardandoClave}
                onChange={(evento) => cambiarClaveNueva(evento.target.value)} />
            </label>
            <label>
              Confirmar nueva contraseña
              <input required type="password" autoComplete="new-password"
                value={confirmacionClave} disabled={guardandoClave}
                onChange={(evento) => cambiarConfirmacionClave(evento.target.value)} />
            </label>
            {errorClave && <Aviso>{errorClave}</Aviso>}
            {exitoClave && <Aviso tipo="exito">{exitoClave}</Aviso>}
            <button className="boton boton-primario" type="submit" disabled={guardandoClave}>
              {guardandoClave ? 'Cambiando…' : 'Cambiar contraseña'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
