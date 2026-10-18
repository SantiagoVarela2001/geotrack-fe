import { useEffect, useRef, useState, type FormEvent } from 'react'
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

function mensajeErrorLogo(causa: unknown): string {
  if (causa instanceof ErrorApi) {
    if (causa.estado === 400 || causa.estado === 413 || causa.estado === 415) {
      return causa.detalle ?? 'Elegí una imagen PNG o JPG de hasta 5 MB.'
    }
    if (causa.estado === 403) return 'No tenés permiso para cambiar el logo de la organización.'
    if (causa.estado === 404) return 'La organización ya no está disponible.'
  }
  return obtenerMensajeError(causa)
}

const TAMANO_MAXIMO_LOGO = 5 * 1024 * 1024

export function MiPerfil({ cuenta, alActualizarCuenta }: {
  cuenta: DatosCuenta
  alActualizarCuenta: (cuenta: DatosCuenta) => void
}) {
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
  const [archivoLogo, cambiarArchivoLogo] = useState<File | null>(null)
  const [urlVistaPrevia, cambiarUrlVistaPrevia] = useState<string | null>(null)
  const [guardandoLogo, cambiarGuardandoLogo] = useState(false)
  const [errorLogo, cambiarErrorLogo] = useState('')
  const [exitoLogo, cambiarExitoLogo] = useState('')
  const [logoSubido, cambiarLogoSubido] = useState(false)
  const [errorImagenLogo, cambiarErrorImagenLogo] = useState(false)
  const [revisionLogo, cambiarRevisionLogo] = useState(0)
  const entradaLogo = useRef<HTMLInputElement>(null)
  const urlVistaPreviaActual = useRef<string | null>(null)
  const organizacionUuid = cuenta.tipoCuenta === 'ORGANIZACION' ? cuenta.organizacionUuid : null
  const puedeEditarLogo = Boolean(organizacionUuid) && cuenta.roles.includes('PROPIETARIO') &&
    cuenta.permisos.includes('ORGANIZACIONES_LOGO_EDITAR')
  const mostrarLogo = Boolean(cuenta.logoUrl || logoSubido) && !errorImagenLogo

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

  useEffect(() => () => {
    if (urlVistaPreviaActual.current) URL.revokeObjectURL(urlVistaPreviaActual.current)
  }, [])

  function seleccionarArchivoLogo(archivo: File | null) {
    if (urlVistaPreviaActual.current) URL.revokeObjectURL(urlVistaPreviaActual.current)
    const url = archivo ? URL.createObjectURL(archivo) : null
    urlVistaPreviaActual.current = url
    cambiarArchivoLogo(archivo)
    cambiarUrlVistaPrevia(url)
  }

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

  async function guardarLogo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!organizacionUuid || !puedeEditarLogo || !archivoLogo) return
    cambiarErrorLogo('')
    cambiarExitoLogo('')
    cambiarGuardandoLogo(true)
    try {
      await api.organizaciones.subirLogo(organizacionUuid, archivoLogo)
      cambiarLogoSubido(true)
      cambiarErrorImagenLogo(false)
      cambiarRevisionLogo((actual) => actual + 1)
      seleccionarArchivoLogo(null)
      if (entradaLogo.current) entradaLogo.current.value = ''
      try {
        alActualizarCuenta(await api.obtenerCuentaActual())
        cambiarExitoLogo('Logo actualizado.')
      } catch (causa) {
        cambiarExitoLogo('Logo actualizado.')
        cambiarErrorLogo(`No se pudo actualizar la cuenta mostrada: ${obtenerMensajeError(causa)}`)
      }
    } catch (causa) {
      cambiarErrorLogo(mensajeErrorLogo(causa))
    } finally {
      cambiarGuardandoLogo(false)
    }
  }

  return (
    <div className="contenido-limitado pagina-perfil">
      <div className="encabezado-pagina">
        <div>
          <span className="sobrelinea">TU CUENTA</span>
          <h1>Mi perfil</h1>
          <p>{puedeEditarLogo
            ? 'Actualizá tus datos, tu contraseña y el logo de tu organización.'
            : 'Actualizá tus datos y tu contraseña.'}</p>
        </div>
      </div>
      <div className="tarjeta perfil-panel">
        <section className="perfil-seccion perfil-seccion-principal">
          <div className="perfil-seccion-cabecera">
            <span className="perfil-seccion-icono"><Icono nombre="clientes" /></span>
            <div>
              <h2>Datos personales</h2>
              <p>Estos datos identifican tu cuenta en Gelaia.</p>
            </div>
          </div>
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

        <section className="perfil-seccion perfil-seccion-principal perfil-seccion-clave">
          <div className="perfil-seccion-cabecera">
            <span className="perfil-seccion-icono"><Icono nombre="escudo" /></span>
            <div>
              <h2>Contraseña</h2>
              <p>Las demás sesiones se cerrarán al confirmar el cambio.</p>
            </div>
          </div>
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

        {organizacionUuid && (
          <section className="perfil-seccion perfil-seccion-logo">
            <div className="perfil-seccion-cabecera">
              <span className="perfil-seccion-icono"><Icono nombre="clientes" /></span>
              <div>
                <h2>Logo de la organización</h2>
                <p>{urlVistaPrevia ? (
                  <>
                    Vista previa sin guardar.{' '}
                    <button className="perfil-logo-descartar" type="button" disabled={guardandoLogo}
                      onClick={() => {
                        seleccionarArchivoLogo(null)
                        cambiarErrorLogo('')
                        if (entradaLogo.current) entradaLogo.current.value = ''
                      }}>
                      Descartar selección
                    </button>
                  </>
                ) : 'La imagen actual de tu organización.'}</p>
              </div>
            </div>
            <div className="perfil-logo-contenido">
              <div className="perfil-logo-vista">
                {urlVistaPrevia || mostrarLogo ? (
                  <img
                    src={urlVistaPrevia ?? `${api.organizaciones.urlLogo(organizacionUuid)}?v=${revisionLogo}`}
                    alt={urlVistaPrevia ? 'Vista previa del logo seleccionado' : 'Logo de la organización'}
                    onError={() => {
                      if (urlVistaPrevia) {
                        seleccionarArchivoLogo(null)
                        cambiarErrorLogo('No se pudo mostrar la imagen seleccionada. Elegí otro PNG o JPG.')
                        if (entradaLogo.current) entradaLogo.current.value = ''
                      } else {
                        cambiarErrorImagenLogo(true)
                      }
                    }}
                  />
                ) : (
                  <span>Sin logo</span>
                )}
              </div>
              {puedeEditarLogo && (
                <form className="formulario apilado perfil-logo-formulario" onSubmit={guardarLogo}>
                  <label>
                    Elegir imagen
                    <input
                      ref={entradaLogo}
                      type="file"
                      accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                      disabled={guardandoLogo}
                      onChange={(evento) => {
                        const archivo = evento.target.files?.[0] ?? null
                        cambiarErrorLogo('')
                        cambiarExitoLogo('')
                        if (!archivo) {
                          seleccionarArchivoLogo(null)
                          return
                        }
                        if (!['image/png', 'image/jpeg'].includes(archivo.type) ||
                            !/\.(png|jpe?g)$/i.test(archivo.name)) {
                          seleccionarArchivoLogo(null)
                          cambiarErrorLogo('Elegí un archivo PNG o JPG.')
                          evento.target.value = ''
                        } else if (archivo.size > TAMANO_MAXIMO_LOGO) {
                          seleccionarArchivoLogo(null)
                          cambiarErrorLogo('La imagen no puede pesar más de 5 MB.')
                          evento.target.value = ''
                        } else {
                          seleccionarArchivoLogo(archivo)
                        }
                      }}
                    />
                  </label>
                  <p className="perfil-nota">Formatos PNG o JPG. Tamaño máximo: 5 MB.</p>
                  {errorLogo && <Aviso>{errorLogo}</Aviso>}
                  {exitoLogo && <Aviso tipo="exito">{exitoLogo}</Aviso>}
                  <button className="boton boton-primario" type="submit"
                    disabled={!archivoLogo || guardandoLogo}>
                    {guardandoLogo ? 'Subiendo…' : 'Guardar logo'}
                  </button>
                </form>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
