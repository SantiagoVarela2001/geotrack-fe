import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Icono } from './Comun'

export interface AccionConsulta {
  clave: string
  texto: string
  etiqueta: string
  ejecutar: () => void
  bloqueada?: boolean
}

export function MenuAccionesConsulta({ acciones, etiqueta, bloqueado }: {
  acciones: AccionConsulta[]
  etiqueta: string
  bloqueado: boolean
}) {
  const [abierto, cambiarAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const identificador = useId()

  /** El menú cierra al salir y devuelve el foco al disparador al usar Escape. */
  useEffect(() => {
    if (!abierto || bloqueado) return
    contenedor.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    function cerrarDesdeFuera(evento: PointerEvent) {
      if (evento.target instanceof Node && !contenedor.current?.contains(evento.target)) cambiarAbierto(false)
    }
    document.addEventListener('pointerdown', cerrarDesdeFuera)
    return () => document.removeEventListener('pointerdown', cerrarDesdeFuera)
  }, [abierto, bloqueado])

  function manejarTeclado(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape' && abierto) {
      evento.preventDefault()
      evento.stopPropagation()
      cambiarAbierto(false)
      boton.current?.focus()
      return
    }
    if (!abierto || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(evento.key)) return
    evento.preventDefault()
    const opciones = [...(contenedor.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
    if (!opciones.length) return
    const indice = opciones.findIndex((opcion) => opcion === document.activeElement)
    const siguiente = evento.key === 'Home' ? 0 : evento.key === 'End' ? opciones.length - 1
      : (indice + (evento.key === 'ArrowDown' ? 1 : -1) + opciones.length) % opciones.length
    opciones[siguiente]?.focus()
  }

  return (
    <div className="consulta-menu" ref={contenedor} onKeyDown={manejarTeclado}
      onBlur={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget)) cambiarAbierto(false)
      }}>
      <button ref={boton} className="consulta-menu-boton" type="button" disabled={bloqueado}
        aria-label={etiqueta} aria-haspopup="menu" aria-expanded={abierto && !bloqueado} aria-controls={abierto ? identificador : undefined}
        onKeyDown={(evento) => {
          if (!abierto && ['ArrowDown', 'ArrowUp'].includes(evento.key)) { evento.preventDefault(); cambiarAbierto(true) }
        }}
        onClick={() => cambiarAbierto((actual) => !actual)}>
        <Icono nombre="puntos" tamano={19} />
      </button>
      {abierto && !bloqueado && (
        <div className="consulta-menu-opciones" role="menu" id={identificador} aria-label={etiqueta}>
          {acciones.map((accion) => (
            <button key={accion.clave} type="button" role="menuitem" disabled={accion.bloqueada}
              aria-label={accion.etiqueta} onClick={() => { cambiarAbierto(false); accion.ejecutar() }}>
              {accion.texto}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
