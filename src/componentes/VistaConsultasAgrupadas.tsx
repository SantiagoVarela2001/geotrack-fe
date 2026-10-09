import type { ReactNode } from 'react'
import type { DatosConsulta, DatosTemaConConsultas } from '../api/tipos'
import { Icono, Vacio } from './Comun'
import { FilaConsulta } from './FilaConsulta'

export function VistaConsultasAgrupadas({
  temas,
  alAbrirTema,
  seleccionadas,
  puedeSeleccionar,
  seleccionBloqueada,
  navegacionBloqueada,
  puedeCambiarTipo,
  cambioTipoBloqueado,
  alSolicitarCambioTipo,
  alAlternar,
  avisos,
  acciones,
}: {
  temas: DatosTemaConConsultas[]
  alAbrirTema: (uuid: string) => void
  seleccionadas: string[]
  puedeSeleccionar: boolean
  seleccionBloqueada: boolean
  navegacionBloqueada: boolean
  puedeCambiarTipo: boolean
  cambioTipoBloqueado: boolean
  alSolicitarCambioTipo: (consulta: DatosConsulta) => void
  alAlternar: (uuid: string) => void
  avisos: ReactNode
  acciones: ReactNode
}) {
  const totalConsultas = temas.reduce((total, tema) => total + tema.consultas.length, 0)

  return (
    <>
      <div className="seccion-cabecera vista-agrupada-cabecera">
        <div>
          <span className="sobrelinea">VISTA GENERAL</span>
          <h2>Todos los temas</h2>
        </div>
        <span className="vista-agrupada-total">
          {totalConsultas} {totalConsultas === 1 ? 'consulta' : 'consultas'}
        </span>
      </div>
      {avisos}
      {totalConsultas > 0 && acciones}
      {temas.length === 0 ? (
        <Vacio
          icono="capas"
          titulo="Todavía no hay temas"
          descripcion="Cuando agregues temas, aparecerán aquí junto con sus consultas."
        />
      ) : (
        <div className="grupos-consultas">
          {temas.map((tema) => (
            <section className="grupo-consultas" key={tema.uuid}>
              <div className="grupo-consultas-cabecera">
                <div>
                  <h3>{tema.nombre}</h3>
                  <span>
                    {tema.consultas.length}{' '}
                    {tema.consultas.length === 1 ? 'consulta activa' : 'consultas activas'}
                  </span>
                </div>
                <button
                  className="boton boton-secundario boton-chico"
                  type="button"
                  onClick={() => alAbrirTema(tema.uuid)}
                  disabled={navegacionBloqueada}
                >
                  Ver tema <Icono nombre="flecha" tamano={15} />
                </button>
              </div>
              {tema.consultas.length === 0 ? (
                <p className="grupo-consultas-vacio">Sin consultas activas en este tema.</p>
              ) : (
                <div className="lista-consultas">
                  {tema.consultas.map((consulta, indice) => (
                    <FilaConsulta
                      key={consulta.uuid}
                      consulta={consulta}
                      indice={indice}
                      nombreTema={tema.nombre}
                      seleccionada={seleccionadas.includes(consulta.uuid)}
                      deshabilitada={seleccionBloqueada}
                      alAlternar={puedeSeleccionar ? () => alAlternar(consulta.uuid) : undefined}
                      alCambiarTipo={
                        puedeCambiarTipo && consulta.estadoConsulta === 'BORRADOR'
                          ? () => alSolicitarCambioTipo(consulta)
                          : undefined
                      }
                      cambioTipoBloqueado={cambioTipoBloqueado}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  )
}
