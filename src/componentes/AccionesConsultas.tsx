import { Icono } from './Comun'

export function AccionesConsultas({
  cantidadSeleccionadas,
  cantidadVisibles,
  todosSeleccionados,
  todasBorrador,
  puedeAprobar,
  puedeDarDeBaja,
  guardando,
  confirmarBaja,
  etiquetaBaja,
  alAprobar,
  alAlternarTodos,
  alSolicitarBaja,
  alCancelarBaja,
  alConfirmarBaja,
}: {
  cantidadSeleccionadas: number
  cantidadVisibles: number
  todosSeleccionados: boolean
  todasBorrador: boolean
  puedeAprobar: boolean
  puedeDarDeBaja: boolean
  guardando: boolean
  confirmarBaja: boolean
  etiquetaBaja: 'Rechazar' | 'Dar de baja'
  alAprobar: () => void
  alAlternarTodos: () => void
  alSolicitarBaja: () => void
  alCancelarBaja: () => void
  alConfirmarBaja: () => void
}) {
  return (
    <>
      <div className="consultas-herramientas">
        <div className="consultas-seleccion-resumen">
          <span className="texto-secundario">
            {cantidadSeleccionadas
              ? `${cantidadSeleccionadas} seleccionadas`
              : 'Seleccioná consultas para actuar por lote'}
          </span>
          <button
            className={`boton boton-secundario boton-chico selector-todos ${todosSeleccionados ? 'selector-todos-activo' : ''}`}
            type="button"
            onClick={alAlternarTodos}
            disabled={cantidadVisibles === 0 || guardando || confirmarBaja}
            aria-pressed={todosSeleccionados}
          >
            {todosSeleccionados ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>
        </div>
        <div className="acciones-lote">
          {puedeAprobar && (
            <button
              className="boton boton-secundario boton-chico"
              type="button"
              onClick={alAprobar}
              disabled={!todasBorrador || guardando || confirmarBaja}
            >
              <Icono nombre="check" tamano={15} /> Aprobar
            </button>
          )}
          {puedeDarDeBaja && (
            <button
              className="boton boton-peligro boton-chico"
              type="button"
              onClick={alSolicitarBaja}
              disabled={cantidadSeleccionadas === 0 || guardando || confirmarBaja}
            >
              {etiquetaBaja}
            </button>
          )}
        </div>
      </div>
      {confirmarBaja && (
        <div
          className="confirmacion-baja"
          role="alertdialog"
          aria-label={etiquetaBaja === 'Rechazar' ? 'Confirmar rechazo' : 'Confirmar baja'}
        >
          <strong>
            ¿{etiquetaBaja} {cantidadSeleccionadas}{' '}
            {cantidadSeleccionadas === 1 ? 'consulta' : 'consultas'}?
          </strong>
          <p>
            Se darán de baja: desaparecerán de las lecturas y liberarán cupo. Esta acción no se
            puede deshacer desde la interfaz.
          </p>
          <div>
            <button
              className="boton boton-secundario boton-chico"
              type="button"
              onClick={alCancelarBaja}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button
              className="boton boton-peligro boton-chico"
              type="button"
              disabled={guardando}
              onClick={alConfirmarBaja}
            >
              {etiquetaBaja === 'Rechazar' ? 'Confirmar rechazo' : 'Confirmar baja'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
