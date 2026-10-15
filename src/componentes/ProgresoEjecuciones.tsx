import { useEffect, useRef } from 'react'
import { Icono } from './Comun'

export interface EnvioConsulta {
  uuid: string
  texto: string
  estado: 'ESPERANDO' | 'ENVIANDO' | 'ENVIADA' | 'ERROR' | 'OMITIDA'
  detalle?: string
}

const etiquetasEstado: Record<EnvioConsulta['estado'], string> = {
  ESPERANDO: 'En espera',
  ENVIANDO: 'Enviando…',
  ENVIADA: 'Enviada',
  ERROR: 'Error',
  OMITIDA: 'Omitida',
}

export function ProgresoEjecuciones({
  envios,
  enCurso,
  alCerrar,
}: {
  envios: EnvioConsulta[]
  enCurso: boolean
  alCerrar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const enviadas = envios.filter((envio) => envio.estado === 'ENVIADA').length
  const errores = envios.filter((envio) => envio.estado === 'ERROR').length
  const omitidas = envios.filter((envio) => envio.estado === 'OMITIDA').length
  const procesadas = enviadas + errores + omitidas
  const porcentaje = envios.length > 0 ? (procesadas / envios.length) * 100 : 0
  const envioActual = envios.find((envio) => envio.estado === 'ENVIANDO')
  const resultados = envios.filter((envio) => envio.estado === 'ENVIADA' || envio.estado === 'ERROR')
  const ultimoResultado = resultados[resultados.length - 1]
  const envioVisible = envioActual ?? ultimoResultado
  const numeroVisible = envioVisible ? envios.indexOf(envioVisible) + 1 : 0

  /** Mantiene visible el progreso hasta terminar el lote y permite cerrarlo al finalizar. */
  useEffect(() => {
    const elemento = dialogo.current
    if (!elemento) return
    elemento.showModal()
    return () => {
      if (elemento.open) elemento.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogo}
      className="dialogo-tipo dialogo-ejecuciones"
      aria-labelledby="progreso-ejecuciones-titulo"
      aria-describedby="progreso-ejecuciones-descripcion"
      onCancel={(evento) => {
        evento.preventDefault()
        if (!enCurso) alCerrar()
      }}
    >
      <div className="progreso-ejecuciones">
        <div className="progreso-ejecuciones-cabecera">
          <div>
            <span className="sobrelinea">EJECUCIÓN POR LOTE</span>
            <h3 id="progreso-ejecuciones-titulo">
              {enCurso ? 'Enviando consultas…' : 'Envío terminado'}
            </h3>
            <p id="progreso-ejecuciones-descripcion">
              {enCurso
                ? 'Una solicitud a la vez. Mantené esta página abierta hasta terminar.'
                : 'Enviada significa que el servidor aceptó el intento. Abrí su detalle para ver la respuesta final.'}
            </p>
          </div>
          <strong
            className="progreso-ejecuciones-contador"
            role="status"
            aria-label={`${procesadas} de ${envios.length} consultas procesadas`}
          >
            {procesadas}/{envios.length}
          </strong>
        </div>
        {enCurso ? (
          <div className="progreso-ejecuciones-en-curso">
            <div
              key={`${numeroVisible}-${envioVisible?.estado ?? 'PREPARANDO'}`}
              className={`progreso-ejecuciones-indicador progreso-ejecuciones-indicador-${envioVisible?.estado.toLowerCase() ?? 'preparando'}`}
              role="status"
            >
              <span className="progreso-ejecuciones-simbolo" aria-hidden="true">
                {envioVisible?.estado === 'ENVIADA' ? <Icono nombre="check" tamano={30} /> :
                  envioVisible?.estado === 'ERROR' ? <Icono nombre="cerrar" tamano={27} /> : null}
              </span>
              <strong>
                {envioVisible?.estado === 'ENVIADA'
                  ? `Consulta ${numeroVisible} enviada`
                  : envioVisible?.estado === 'ERROR'
                    ? `Consulta ${numeroVisible} con error`
                    : envioVisible?.estado === 'ENVIANDO'
                      ? `Enviando consulta ${numeroVisible}`
                      : 'Preparando el envío'}
              </strong>
              <p>
                {envioVisible?.estado === 'ENVIADA'
                  ? 'El servidor aceptó la solicitud.'
                  : envioVisible?.estado === 'ERROR'
                    ? 'Hubo un error; seguimos con la siguiente.'
                    : 'Esperando la respuesta del servidor…'}
              </p>
            </div>
            <div
              className="progreso-ejecuciones-barra"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={envios.length}
              aria-valuenow={procesadas}
              aria-label="Consultas enviadas, con error u omitidas"
            >
              <span style={{ width: `${porcentaje}%` }} />
            </div>
          </div>
        ) : (
          <>
            <div className="progreso-ejecuciones-resultado" role="status">
              <div className="progreso-ejecuciones-resultado-enviadas">
                <strong>{enviadas}</strong>
                <span>{enviadas === 1 ? 'enviada' : 'enviadas'}</span>
              </div>
              <div className={errores > 0 ? 'progreso-ejecuciones-resultado-errores' : ''}>
                <strong>{errores}</strong>
                <span>con error</span>
              </div>
              {omitidas > 0 && (
                <div className="progreso-ejecuciones-resultado-omitidas">
                  <strong>{omitidas}</strong>
                  <span>{omitidas === 1 ? 'omitida' : 'omitidas'}</span>
                </div>
              )}
            </div>
            <ol className="progreso-ejecuciones-lista">
              {envios.map((envio) => (
                <li
                  key={envio.uuid}
                  className={`progreso-ejecuciones-fila progreso-ejecuciones-${envio.estado.toLowerCase()}`}
                >
                  <div>
                    <p>{envio.texto}</p>
                    {envio.detalle && <small>{envio.detalle}</small>}
                  </div>
                  <span className="progreso-ejecuciones-estado">
                    {etiquetasEstado[envio.estado]}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
        {!enCurso && (
          <div className="progreso-ejecuciones-acciones">
            <button className="boton boton-primario" type="button" onClick={alCerrar} autoFocus>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </dialog>
  )
}
