import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DatosCuenta } from '../api/tipos'
import { novedades, obtenerNovedadesVigentes, type Novedad } from '../datos/novedades'
import { Icono } from './Comun'

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires',
})

function VentanaNovedades({ vigentes, alCerrar }: { vigentes: Novedad[]; alCerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null)

  // Cierra antes de retirar el nodo del DOM para que el diálogo nativo pueda devolver el foco.
  useLayoutEffect(() => {
    const elemento = dialogo.current
    if (!elemento) return
    elemento.showModal()
    return () => {
      if (elemento.open) elemento.close()
    }
  }, [])

  return (
    <dialog ref={dialogo} id="ventana-novedades" className="dialogo-tipo dialogo-novedades"
      aria-labelledby="novedades-titulo" aria-describedby="novedades-descripcion"
      onCancel={(evento) => { evento.preventDefault(); alCerrar() }}>
      <div className="dialogo-tipo-contenido">
        <div className="novedades-cabecera">
          <span className="novedades-simbolo"><Icono nombre="megafono" tamano={26} /></span>
          <button type="button" className="novedades-cerrar" aria-label="Cerrar novedades" onClick={alCerrar} autoFocus>
            <Icono nombre="cerrar" tamano={20} />
          </button>
        </div>
        <span className="sobrelinea">SEGUIMOS MEJORANDO</span>
        <h2 id="novedades-titulo">Novedades de Gelaia</h2>
        <p id="novedades-descripcion">Conocé las últimas mejoras para tu espacio de trabajo.</p>
        <div className="novedades-lista">
          {vigentes.map((novedad) => (
            <article className="novedad" key={novedad.id}>
              <time dateTime={novedad.publicadaEn}>{formatoFecha.format(new Date(novedad.publicadaEn))}</time>
              <h3>{novedad.titulo}</h3>
              <p>{novedad.descripcion}</p>
            </article>
          ))}
        </div>
        <div className="dialogo-tipo-acciones">
          <button type="button" className="boton boton-primario" onClick={alCerrar}>Entendido</button>
        </div>
      </div>
    </dialog>
  )
}

export function Novedades({ cuenta }: { cuenta: DatosCuenta }) {
  const [ahora, cambiarAhora] = useState(Date.now)
  const [abierta, cambiarAbierta] = useState(false)
  const vigentes = obtenerNovedadesVigentes(cuenta, ahora)

  /** Actualiza en cada publicación/vencimiento y al volver a la pestaña; no consulta la API. */
  useEffect(() => {
    let temporizador: number | undefined
    const limites = novedades.flatMap((novedad) => [Date.parse(novedad.publicadaEn), Date.parse(novedad.expiraEn)])
    function actualizar() {
      window.clearTimeout(temporizador)
      const instante = Date.now()
      cambiarAhora(instante)
      if (obtenerNovedadesVigentes(cuenta, instante).length === 0) cambiarAbierta(false)
      const siguiente = Math.min(...limites.filter((limite) => limite > instante))
      // El límite de un minuto permite detectar cambios del reloj y evita desbordar setTimeout.
      if (Number.isFinite(siguiente)) temporizador = window.setTimeout(actualizar, Math.min(siguiente - instante, 60_000))
    }
    actualizar()
    window.addEventListener('focus', actualizar)
    document.addEventListener('visibilitychange', actualizar)
    return () => {
      window.clearTimeout(temporizador)
      window.removeEventListener('focus', actualizar)
      document.removeEventListener('visibilitychange', actualizar)
    }
  }, [cuenta])

  if (vigentes.length === 0) return null

  return (
    <>
      <button type="button" className="novedades-flotante" aria-haspopup="dialog" aria-expanded={abierta}
        aria-controls={abierta ? 'ventana-novedades' : undefined}
        onClick={() => { cambiarAhora(Date.now()); cambiarAbierta(true) }}>
        <span className="novedades-flotante-icono">
          <Icono nombre="megafono" tamano={25} />
        </span>
        <span>¡Hay novedades!</span>
      </button>
      {abierta && <VentanaNovedades vigentes={vigentes} alCerrar={() => cambiarAbierta(false)} />}
    </>
  )
}
