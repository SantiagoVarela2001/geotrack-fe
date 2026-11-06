import { useEffect, useState } from 'react'
import { api } from '../api/clienteApi'
import type { DatosCliente, DatosCuenta, DatosMetricasGrupo, DatosMetricasConsultaMencionada } from '../api/tipos'
import { tienePermiso } from '../utilidades'
import { Icono } from './Comun'
import { InformeMetricas } from './InformeMetricas'
import { PanelEvolucionCliente } from './PanelEvolucionCliente'
import { gruposMetricas, tasaLegible } from '../metricas'

const enteros = new Intl.NumberFormat('es-AR')

function Indicador({
  etiqueta,
  valor,
  descripcion,
}: {
  etiqueta: string
  valor: string
  descripcion?: string
}) {
  return (
    <div className="metricas-indicador">
      <dt>{etiqueta}</dt>
      <dd>{valor}</dd>
      {descripcion && <small>{descripcion}</small>}
    </div>
  )
}

function ListaConsultasMencionadas({ consultas }: { consultas: DatosMetricasConsultaMencionada[] }) {
  return (
    <ul className="metricas-competidores metricas-consultas-mencionadas">
      {consultas.map((consulta) => (
        <li key={consulta.consultaUuid}>
          <strong>{consulta.textoConsulta}</strong>
          <span><b>{enteros.format(consulta.mencionesMarca)}</b> {consulta.mencionesMarca === 1 ? 'mención' : 'menciones'}</span>
        </li>
      ))}
    </ul>
  )
}

export function ResumenMetricasGrupo({ metricas, clave, etiqueta }: {
  metricas: DatosMetricasGrupo
  clave: 'sinMarca' | 'conMarca'
  etiqueta: string
}) {
  const consultasMencionadas = [...metricas.consultasMencionadas]
    .sort((a, b) => b.mencionesMarca - a.mencionesMarca ||
      a.textoConsulta.localeCompare(b.textoConsulta, 'es'))
  const restantes = consultasMencionadas.length - 5

  return (
    <section className="metricas-grupo" aria-label={etiqueta}>
      <h2>{etiqueta}</h2>
      {metricas.ejecuciones === 0 && <p className="metricas-vacio">No hubo ejecuciones en este grupo durante el período.</p>}
      <section className="metricas-seccion" aria-labelledby={`metricas-resumen-titulo-${clave}`}>
        <h2 id={`metricas-resumen-titulo-${clave}`}>Resumen del período</h2>
        <dl className="metricas-resumen">
          <Indicador etiqueta="Ejecuciones" valor={enteros.format(metricas.ejecuciones)} />
          <Indicador etiqueta="Analizadas" valor={enteros.format(metricas.analizadas)} descripcion="Mediciones completas" />
          <Indicador etiqueta="Pendientes" valor={enteros.format(metricas.pendientes)} />
          <Indicador etiqueta="Fallidas" valor={enteros.format(metricas.fallidas)} />
          <Indicador etiqueta="Canceladas" valor={enteros.format(metricas.canceladas)} />
        </dl>
      </section>

      <section className="metricas-seccion" aria-labelledby={`metricas-tasas-titulo-${clave}`}>
        <h2 id={`metricas-tasas-titulo-${clave}`}>Marca y citas</h2>
        <dl className="metricas-tasas">
          <Indicador etiqueta={clave === 'sinMarca' ? 'Presencia espontánea' : 'Mención de marca'} valor={tasaLegible(metricas.tasaMencionMarca)}
            descripcion={`${enteros.format(metricas.mencionesMarca)} de ${enteros.format(metricas.analizadas)} analizadas`} />
          <Indicador etiqueta="Respuestas con citas" valor={tasaLegible(metricas.tasaCitas)}
            descripcion={`${enteros.format(metricas.conCitas)} de ${enteros.format(metricas.analizadas)} analizadas`} />
          <Indicador etiqueta="Citas al sitio del cliente" valor={tasaLegible(metricas.tasaCitasSitioCliente)}
            descripcion={`${enteros.format(metricas.conCitasSitioCliente)} de ${enteros.format(metricas.analizadas)} analizadas`} />
        </dl>
        <p className="metricas-nota">
          Las tasas corresponden a este grupo y a su clasificación al crear cada ejecución.
          Las citas propias se comparan con el sitio web actual del cliente.
        </p>
      </section>

      <section className="metricas-seccion" aria-labelledby={`metricas-consultas-titulo-${clave}`}>
        <h2 id={`metricas-consultas-titulo-${clave}`}>Consultas que mencionaron la marca</h2>
        {consultasMencionadas.length === 0 ? (
          <p className="metricas-vacio">No hubo consultas con menciones de marca en este período.</p>
        ) : (
          <>
            <ListaConsultasMencionadas consultas={consultasMencionadas.slice(0, 5)} />
            {restantes > 0 && (
              <details className="metricas-consultas-restantes">
                <summary>
                  <span className="metricas-consultas-cerrado">Ver {enteros.format(restantes)} {restantes === 1 ? 'consulta restante' : 'consultas restantes'}</span>
                  <span className="metricas-consultas-abierto">Ocultar {enteros.format(restantes)} {restantes === 1 ? 'consulta restante' : 'consultas restantes'}</span>
                </summary>
                <ListaConsultasMencionadas consultas={consultasMencionadas.slice(5)} />
              </details>
            )}
          </>
        )}
        <p className="metricas-nota">Se muestran hasta 15 consultas con menciones de este grupo, incluidas consultas dadas de baja. Una consulta puede aparecer en ambos grupos por su historia. El total del grupo puede superar la suma de este listado.</p>
      </section>

      <section className="metricas-seccion" aria-labelledby={`metricas-competidores-titulo-${clave}`}>
        <h2 id={`metricas-competidores-titulo-${clave}`}>Competidores en el período</h2>
        {metricas.competidores.length === 0 ? (
          <p className="metricas-vacio">No hay evaluaciones de competidores en este período.</p>
        ) : (
          <ul className="metricas-competidores">
            {[...metricas.competidores]
              .sort((a, b) => b.menciones - a.menciones || a.nombre.localeCompare(b.nombre))
              .map((competidor) => (
                <li key={competidor.competidorUuid}>
                  <strong>{competidor.nombre}</strong>
                  <span><b>{enteros.format(competidor.menciones)}</b> {competidor.menciones === 1 ? 'mención' : 'menciones'}</span>
                  <small>en {enteros.format(competidor.evaluaciones)} respuestas evaluadas · {tasaLegible(competidor.tasaMencion)}</small>
                </li>
              ))}
          </ul>
        )}
        <p className="metricas-nota">Cada tasa usa las respuestas donde se evaluó a ese competidor; el denominador puede diferir del total del cliente.</p>
      </section>
    </section>
  )
}

export function MetricasCliente({ clienteUuid, cuenta, alVolver }: {
  clienteUuid: string
  cuenta: DatosCuenta
  alVolver: () => void
}) {
  const [cliente, cambiarCliente] = useState<DatosCliente | null>(null)
  const [informeAbierto, cambiarInformeAbierto] = useState(false)
  const puedeVerCliente = tienePermiso(cuenta.permisos, 'CLIENTES_VER')
  useEffect(() => {
    const anterior = document.title
    document.title = 'Métricas GEO · Gelaia'
    return () => { document.title = anterior }
  }, [])
  useEffect(() => {
    if (!puedeVerCliente) return
    let vigente = true
    api.clientes.obtener(clienteUuid).then((datos) => { if (vigente) cambiarCliente(datos) })
      .catch(() => { if (vigente) cambiarCliente(null) })
    return () => { vigente = false }
  }, [clienteUuid, puedeVerCliente])
  return <div className="pagina-metricas">
    {puedeVerCliente && <button className="enlace-volver" type="button" onClick={alVolver}>
      <Icono nombre="volver" tamano={17} /> Volver al cliente
    </button>}
    <header className="metricas-cabecera">
      <span className="sobrelinea">MEDICIÓN POR CLIENTE</span>
      <h1>Métricas GEO{cliente ? ` de ${cliente.nombre}` : ''}</h1>
      <p>Seguí la presencia de tu marca y explorá sus resultados.</p>
    </header>
    <PanelEvolucionCliente clienteUuid={clienteUuid} cliente={cliente} cuenta={cuenta} accionesCabecera={
      <button className="boton boton-secundario boton-chico metricas-informe-accion" type="button"
        aria-expanded={informeAbierto} aria-controls="metricas-informe-editor"
        onClick={() => cambiarInformeAbierto((abierto) => !abierto)}>
        <Icono nombre="documento" tamano={16} /> {informeAbierto ? 'Cerrar informe' : 'Crear informe'}
      </button>
    }>
      {(metricas) => <div className="metricas-contenido">
        {informeAbierto && <InformeMetricas key={`${cuenta.usuario}:${clienteUuid}`} metricas={metricas}
          cliente={cliente} cuenta={cuenta} alCerrar={() => cambiarInformeAbierto(false)} />}
        {gruposMetricas.map((grupo) => <ResumenMetricasGrupo key={grupo.clave} clave={grupo.clave}
          etiqueta={`${grupo.etiqueta} · ${grupo.descripcion}`} metricas={metricas[grupo.clave]} />)}
      </div>}
    </PanelEvolucionCliente>
  </div>
}
