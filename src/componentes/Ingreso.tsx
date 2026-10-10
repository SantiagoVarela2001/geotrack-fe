import { useState, type FormEvent } from 'react'
import { api, ErrorApi } from '../api/clienteApi'
import type { DatosCuenta } from '../api/tipos'
import { obtenerMensajeError } from '../utilidades'
import { Aviso, Icono, Marca } from './Comun'

export function Ingreso({ alIngresar }: { alIngresar: (cuenta: DatosCuenta) => void }) {
  const [usuario, cambiarUsuario] = useState('')
  const [clave, cambiarClave] = useState('')
  const [cargando, cambiarCargando] = useState(false)
  const [error, cambiarError] = useState('')

  /** Consulta la cuenta después del ingreso para dibujar solo acciones autorizadas. */
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    cambiarError('')
    cambiarCargando(true)
    try {
      alIngresar(await api.ingresar(usuario.trim(), clave))
    } catch (causa) {
      cambiarError(
        causa instanceof ErrorApi && causa.estado === 401
          ? 'Usuario o contraseña incorrectos.'
          : obtenerMensajeError(causa),
      )
    } finally {
      cambiarCargando(false)
    }
  }

  return (
    <main className="ingreso">
      <section className="ingreso-presentacion">
        <Marca />
        <div className="ingreso-relato">
          <div className="sobrelinea sobrelinea-clara">ESPACIO DE TRABAJO GEO</div>
          <h1>Entendé cómo se construye la presencia de cada marca.</h1>
          <p>
            Organizá clientes, temas y consultas desde un solo lugar. Cada paso queda bajo el
            control de tu equipo.
          </p>
          <div className="ingreso-pasos" aria-label="Flujo disponible">
            <span>
              <b>01</b> Clientes
            </span>
            <i />
            <span>
              <b>02</b> Temas
            </span>
            <i />
            <span>
              <b>03</b> Consultas
            </span>
          </div>
        </div>
        <div className="ingreso-pie">
          GELAIA <span>·</span> PLATAFORMA PARA AGENCIAS
        </div>
      </section>
      <section className="ingreso-panel">
        <div className="ingreso-formulario">
          <span className="sello">
            <Icono nombre="escudo" tamano={16} /> Acceso seguro
          </span>
          <h2>Bienvenido de nuevo</h2>
          <p className="texto-secundario">
            Ingresá con las credenciales de tu organización o de plataforma.
          </p>
          <form onSubmit={enviar} className="formulario apilado">
            <label>
              Correo o usuario
              <input
                autoComplete="username"
                value={usuario}
                onChange={(evento) => cambiarUsuario(evento.target.value)}
                required
                autoFocus
                placeholder="tu@organizacion.com"
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                autoComplete="current-password"
                value={clave}
                onChange={(evento) => cambiarClave(evento.target.value)}
                required
                placeholder="Ingresá tu contraseña"
              />
            </label>
            {error && <Aviso>{error}</Aviso>}
            <button className="boton boton-primario boton-ancho" disabled={cargando} type="submit">
              {cargando ? 'Ingresando…' : 'Ingresar'} <Icono nombre="flecha" tamano={18} />
            </button>
          </form>
          <p className="ingreso-ayuda">
            Si no tenés acceso, contactá al administrador de tu organización.
          </p>
        </div>
      </section>
    </main>
  )
}
