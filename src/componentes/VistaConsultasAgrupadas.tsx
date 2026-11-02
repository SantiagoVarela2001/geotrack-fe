import { useId, useState, type ReactNode } from 'react'
import type { DatosConsulta, DatosTemaConConsultas } from '../api/tipos'
import { Icono, Vacio } from './Comun'
import { FilaConsulta } from './FilaConsulta'
import { estadoEjecucionHoy } from '../consultas'

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
  puedeEditar,
  alEditar,
  puedeCorregirMarca,
  alCorregirMarca,
  alAbrirDetalle,
  alAbrirEjecucionHoy,
  puedeEjecutar,
  alEjecutar,
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
  puedeEditar: boolean
  alEditar: (consulta: DatosConsulta) => void
  puedeCorregirMarca: boolean
  alCorregirMarca: (consulta: DatosConsulta) => void
  alAbrirDetalle: (consulta: DatosConsulta, temaUuid: string) => void
  alAbrirEjecucionHoy: (consulta: DatosConsulta, temaUuid: string, ejecucionUuid: string) => void
  puedeEjecutar: boolean
  alEjecutar: (consulta: DatosConsulta, temaUuid: string) => void
  alAlternar: (uuid: string) => void
  avisos: ReactNode
  acciones: ReactNode
}) {
  const [temasPlegados, cambiarTemasPlegados] = useState<Set<string>>(() => new Set())
  const identificador = useId()
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
          {temas.map((tema) => {
            const plegado = temasPlegados.has(tema.uuid)
            const aprobadas = tema.consultas.filter((consulta) => consulta.estadoConsulta === 'APROBADA').length
            const borradores = tema.consultas.length - aprobadas
            const seleccionadasEnTema = tema.consultas.filter((consulta) => seleccionadas.includes(consulta.uuid)).length
            const fallos = tema.consultas.filter((consulta) => consulta.ejecucionHoy && estadoEjecucionHoy(consulta.ejecucionHoy).tono === 'fallo').length
            const contenidoId = `${identificador}-${tema.uuid}`
            return (
              <section className="grupo-consultas" key={tema.uuid}>
                <div className="grupo-consultas-cabecera">
                  <h3 className="grupo-consultas-titulo">
                    <button type="button" className="grupo-consultas-alternar"
                      aria-expanded={!plegado} aria-controls={contenidoId}
                      aria-label={`${plegado ? 'Expandir' : 'Contraer'} tema ${tema.nombre}`}
                      onClick={() => cambiarTemasPlegados((actuales) => {
                        const siguientes = new Set(actuales)
                        if (siguientes.has(tema.uuid)) siguientes.delete(tema.uuid)
                        else siguientes.add(tema.uuid)
                        return siguientes
                      })}>
                      <Icono nombre="desplegar" tamano={17} />
                      <span className="grupo-consultas-identidad">
                        <span className="grupo-consultas-nombre">{tema.nombre}</span>
                        <span className="grupo-consultas-resumen">
                          {tema.consultas.length} {tema.consultas.length === 1 ? 'consulta' : 'consultas'}
                          {aprobadas > 0 && ` · ${aprobadas} ${aprobadas === 1 ? 'aprobada' : 'aprobadas'}`}
                          {borradores > 0 && ` · ${borradores} ${borradores === 1 ? 'borrador' : 'borradores'}`}
                        </span>
                        {(fallos > 0 || seleccionadasEnTema > 0) && <span className="grupo-consultas-avisos">
                          {fallos > 0 && <span className="grupo-consultas-fallos">{fallos} {fallos === 1 ? 'con fallo hoy' : 'con fallos hoy'}</span>}
                          {seleccionadasEnTema > 0 && <span className="grupo-consultas-seleccionadas">{seleccionadasEnTema} {seleccionadasEnTema === 1 ? 'seleccionada' : 'seleccionadas'}</span>}
                        </span>}
                      </span>
                    </button>
                  </h3>
                  <button className="grupo-consultas-ver" type="button"
                    onClick={() => alAbrirTema(tema.uuid)} disabled={navegacionBloqueada}>
                    Ver tema <Icono nombre="flecha" tamano={14} />
                  </button>
                </div>
                <div id={contenidoId} hidden={plegado}>
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
                          alAbrirDetalle={() => alAbrirDetalle(consulta, tema.uuid)}
                          alEditar={puedeEditar ? () => alEditar(consulta) : undefined}
                          alCorregirMarca={puedeCorregirMarca ? () => alCorregirMarca(consulta) : undefined}
                          alVerEjecucionHoy={(ejecucionUuid) =>
                            alAbrirEjecucionHoy(consulta, tema.uuid, ejecucionUuid)
                          }
                          alEjecutar={
                            puedeEjecutar && consulta.estadoConsulta === 'APROBADA'
                              ? () => alEjecutar(consulta, tema.uuid)
                              : undefined
                          }
                          accionesBloqueadas={navegacionBloqueada}
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
                </div>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
