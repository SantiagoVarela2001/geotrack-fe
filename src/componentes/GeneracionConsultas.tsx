import type { DatosGeneracionConsultas } from '../api/tipos'
import { Aviso, Icono } from './Comun'

interface PropiedadesGeneracion {
  proceso: DatosGeneracionConsultas | null
  puedeGenerar: boolean
  generando: boolean
  error: string
  alGenerar: () => void
}

export function GeneracionConsultas({
  proceso,
  puedeGenerar,
  generando,
  error,
  alGenerar,
}: PropiedadesGeneracion) {
  const enCurso = proceso?.estado === 'PENDIENTE' || proceso?.estado === 'PROCESANDO'
  const mostrandoActividad = enCurso || generando
  const finalizado = proceso?.estado === 'FINALIZADO'
  const fallido = proceso?.estado === 'FALLIDO'

  const titulo = generando
    ? 'Iniciando generación'
    : finalizado
      ? 'Consultas generadas'
      : fallido
        ? 'La generación no se completó'
        : proceso?.estado === 'PENDIENTE'
          ? 'Generación en espera'
          : proceso?.estado === 'PROCESANDO'
            ? 'La IA está preparando las consultas'
            : 'Generación asistida'

  return (
    <section
      className={`tarjeta generacion-panel ${mostrandoActividad ? 'generacion-panel-activa' : ''}`}
      aria-live="polite"
    >
      <div className={`generacion-icono ${mostrandoActividad ? 'generacion-icono-activo' : ''}`}>
        <Icono nombre={finalizado ? 'check' : 'capas'} tamano={21} />
      </div>
      <div className="generacion-contenido">
        <span className="sobrelinea">CONSULTAS CON IA</span>
        <h2>{titulo}</h2>
        {generando ? (
          <p>Estamos enviando la solicitud de generación al servidor.</p>
        ) : finalizado ? (
          <p>
            Se crearon {proceso?.consultas.length ?? 0} borradores en {proceso?.temas.length ?? 0}{' '}
            {proceso?.temas.length === 1 ? 'tema' : 'temas'}. Revisá las consultas y aprobá las que
            quieras usar.
          </p>
        ) : fallido ? (
          <p>{proceso?.mensaje || 'Podés volver a intentar la generación.'}</p>
        ) : enCurso ? (
          <p>
            {proceso?.mensaje ||
              (proceso?.estado === 'PENDIENTE'
                ? 'La solicitud fue recibida y está pendiente de ejecución.'
                : 'El proceso está en marcha y prepara las consultas para este cliente.')}
          </p>
        ) : (
          <p>
            {puedeGenerar
              ? 'Generá 15 consultas en borrador. Solo se puede iniciar si no hay consultas activas ni una generación finalizada previamente.'
              : 'Todavía no hay un proceso de generación para este cliente.'}
          </p>
        )}
        {enCurso && !generando && (
          <span className="generacion-ritmo">Verificamos el estado cada 3 segundos</span>
        )}
        {!generando && proceso?.advertencia && (
          <Aviso tipo="informacion">{proceso.advertencia}</Aviso>
        )}
        {error && <Aviso>{error}</Aviso>}
      </div>
      {mostrandoActividad && (
        <span className="generacion-estado">
          <span className="generacion-estado-punto" />
          {generando ? 'INICIANDO' : proceso?.estado === 'PENDIENTE' ? 'PENDIENTE' : 'EN PROCESO'}
        </span>
      )}
      {puedeGenerar && (
        <button
          className="boton boton-primario"
          type="button"
          onClick={alGenerar}
          disabled={generando}
        >
          {generando ? 'Iniciando…' : fallido ? 'Reintentar generación' : 'Generar consultas'}
          {!generando && <Icono nombre="flecha" tamano={17} />}
        </button>
      )}
      {mostrandoActividad && (
        <div className="generacion-actividad" aria-hidden="true">
          <span />
        </div>
      )}
    </section>
  )
}
