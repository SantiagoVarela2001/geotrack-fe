import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api/clienteApi'
import type { DatosCliente, DatosCuenta, DatosMetricasCliente } from '../api/tipos'
import { Aviso } from './Comun'

interface BorradorInforme {
  clienteUuid: string
  organizacionUuid: string | null
  usuario: string
  texto: string
}

const enteros = new Intl.NumberFormat('es-AR')
const porcentajes = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const fechas = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
})
const fechaHoraArgentina = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires',
})

function fechaLegible(iso: string): string {
  const fecha = new Date(`${iso}T12:00:00Z`)
  return Number.isNaN(fecha.getTime()) ? iso : fechas.format(fecha)
}

function tasaLegible(valor: number | null): string {
  return valor === null ? 'Sin datos' : `${porcentajes.format(valor)} %`
}

function imagenComoDataUrl(archivo: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => typeof lector.result === 'string'
      ? resolver(lector.result) : rechazar(new Error('No se pudo leer el logo.'))
    lector.onerror = () => rechazar(new Error('No se pudo leer el logo.'))
    lector.readAsDataURL(archivo)
  })
}

function claveBorrador(clienteUuid: string, cuenta: DatosCuenta): string {
  return `gelaia:informe-metricas:v1:${cuenta.organizacionUuid ?? 'plataforma'}:${cuenta.usuario}:${clienteUuid}`
}

/** Verifica la identidad y el cliente antes de recuperar un borrador de este navegador. */
function leerBorrador(clave: string, clienteUuid: string, cuenta: DatosCuenta): string {
  try {
    const guardado = window.localStorage.getItem(clave)
    if (!guardado) return ''
    const datos: BorradorInforme = JSON.parse(guardado)
    return datos.clienteUuid === clienteUuid &&
      datos.organizacionUuid === cuenta.organizacionUuid &&
      datos.usuario === cuenta.usuario && typeof datos.texto === 'string'
      ? datos.texto : ''
  } catch {
    return ''
  }
}

function GraficoInforme({ metricas }: { metricas: DatosMetricasCliente }) {
  const dias = metricas.serieDiaria
  if (dias.length === 0) return <p className="informe-vacio">No hubo ejecuciones en el período.</p>

  const ancho = 720
  const alto = 155
  const margen = { izquierdo: 34, derecho: 12, superior: 12, inferior: 28 }
  const anchoDatos = ancho - margen.izquierdo - margen.derecho
  const altoDatos = alto - margen.superior - margen.inferior
  const maximo = dias.reduce((mayor, dia) => Math.max(mayor, dia.mencionesMarca), 1)
  const x = (indice: number) => margen.izquierdo +
    (dias.length === 1 ? anchoDatos / 2 : indice * anchoDatos / (dias.length - 1))
  const y = (valor: number) => margen.superior + altoDatos * (1 - valor / maximo)
  const puntos = dias.map((dia, indice) => `${x(indice)},${y(dia.mencionesMarca)}`).join(' ')

  return (
    <div className="informe-grafico">
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img"
        aria-label="Menciones de marca por día con ejecuciones">
        <line x1={margen.izquierdo} x2={ancho - margen.derecho}
          y1={y(0)} y2={y(0)} stroke="#cbd8df" />
        <text x={margen.izquierdo - 8} y={y(0) + 4} textAnchor="end">0</text>
        <text x={margen.izquierdo - 8} y={y(maximo) + 4} textAnchor="end">{maximo}</text>
        <polyline points={puntos} fill="none" stroke="#159cac" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
        {dias.map((dia, indice) => (
          <circle key={dia.dia} cx={x(indice)} cy={y(dia.mencionesMarca)}
            r={dias.length > 90 ? 1.5 : 2.5} fill="#159cac" />
        ))}
        <text x={x(0)} y={alto - 6} textAnchor={dias.length === 1 ? 'middle' : 'start'}>
          {fechaLegible(dias[0].dia)}
        </text>
        {dias.length > 1 && (
          <text x={x(dias.length - 1)} y={alto - 6} textAnchor="end">
            {fechaLegible(dias[dias.length - 1].dia)}
          </text>
        )}
      </svg>
      <p>Cada punto representa un día con ejecuciones. Los días sin ejecuciones no aparecen.</p>
    </div>
  )
}

function CifraInforme({ etiqueta, valor, detalle }: {
  etiqueta: string
  valor: string
  detalle?: string
}) {
  return (
    <div className="informe-cifra">
      <dt>{etiqueta}</dt>
      <dd>{valor}</dd>
      {detalle && <small>{detalle}</small>}
    </div>
  )
}

export function InformeMetricas({ metricas, cliente, cuenta, alCerrar }: {
  metricas: DatosMetricasCliente
  cliente: DatosCliente | null
  cuenta: DatosCuenta
  alCerrar: () => void
}) {
  const clave = claveBorrador(metricas.clienteUuid, cuenta)
  const [resumen, cambiarResumen] = useState(() => leerBorrador(clave, metricas.clienteUuid, cuenta))
  const [errorGuardado, cambiarErrorGuardado] = useState(false)
  const [fechaGeneracion, cambiarFechaGeneracion] = useState(() => new Date())
  const [resultadoLogo, cambiarResultadoLogo] = useState<{
    url: string
    intento: number
    estado: 'listo' | 'ausente' | 'error'
    imagen: string | null
  } | null>(null)
  const [reintentoLogo, cambiarReintentoLogo] = useState(0)
  const organizacionLogoUuid = cuenta.organizacionUuid ?? cliente?.organizacionUuid
  const urlLogo = cuenta.logoUrl ?? (organizacionLogoUuid
    ? api.organizaciones.urlLogo(organizacionLogoUuid) : null)
  const logoVigente = resultadoLogo?.url === urlLogo && resultadoLogo.intento === reintentoLogo
  const estadoLogo = !urlLogo ? 'ausente' : logoVigente ? resultadoLogo.estado : 'cargando'
  const logoInforme = estadoLogo === 'listo' ? resultadoLogo?.imagen : null
  const nombreCliente = cliente?.nombre ?? `Cliente ${metricas.clienteUuid}`
  const competidores = [...metricas.competidores]
    .sort((primero, segundo) => segundo.menciones - primero.menciones ||
      primero.nombre.localeCompare(segundo.nombre, 'es'))

  useEffect(() => {
    if (!urlLogo) return

    const direccionLogo = urlLogo
    const intento = reintentoLogo
    const controlador = new AbortController()
    let vigente = true

    async function cargarLogo() {
      try {
        const respuesta = await fetch(direccionLogo, { cache: 'no-store', signal: controlador.signal })
        if (respuesta.status === 404) {
          if (vigente) cambiarResultadoLogo({ url: direccionLogo, intento, estado: 'ausente', imagen: null })
          return
        }
        if (!respuesta.ok) throw new Error('No se pudo obtener el logo.')
        const archivo = await respuesta.blob()
        if (!['image/png', 'image/jpeg'].includes(archivo.type)) {
          throw new Error('El logo no es PNG ni JPEG.')
        }
        const imagen = await imagenComoDataUrl(archivo)
        const precarga = new Image()
        precarga.src = imagen
        await precarga.decode()
        if (vigente) cambiarResultadoLogo({ url: direccionLogo, intento, estado: 'listo', imagen })
      } catch {
        if (vigente) cambiarResultadoLogo({ url: direccionLogo, intento, estado: 'error', imagen: null })
      }
    }

    void cargarLogo()
    return () => {
      vigente = false
      controlador.abort()
    }
  }, [urlLogo, reintentoLogo])

  function guardarResumen(texto: string) {
    cambiarResumen(texto)
    const datos: BorradorInforme = {
      clienteUuid: metricas.clienteUuid,
      organizacionUuid: cuenta.organizacionUuid,
      usuario: cuenta.usuario,
      texto,
    }
    try {
      window.localStorage.setItem(clave, JSON.stringify(datos))
      cambiarErrorGuardado(false)
    } catch {
      cambiarErrorGuardado(true)
    }
  }

  async function imprimir() {
    if (estadoLogo === 'cargando' || estadoLogo === 'error') return
    cambiarFechaGeneracion(new Date())
    await new Promise<void>((resolver) => window.requestAnimationFrame(() => resolver()))
    const logo = document.querySelector<HTMLImageElement>('.informe-imprimible img[data-logo-organizacion]')
    if (logo) await logo.decode()
    window.print()
  }

  return (
    <>
      <section className="metricas-informe-editor tarjeta" id="metricas-informe-editor"
        aria-labelledby="metricas-informe-titulo">
        <div className="metricas-informe-editor-cabecera">
          <div>
            <span className="sobrelinea">INFORME DEL PERÍODO</span>
            <h2 id="metricas-informe-titulo">Preparar informe</h2>
            <p>Se imprimirán las métricas del {fechaLegible(metricas.desde)} al {fechaLegible(metricas.hasta)}.</p>
          </div>
          <button className="boton boton-secundario boton-chico" type="button" onClick={alCerrar}>
            Cerrar
          </button>
        </div>
        <label htmlFor="metricas-informe-resumen">Resumen ejecutivo</label>
        <textarea id="metricas-informe-resumen" value={resumen} rows={6}
          placeholder="Escribí las conclusiones y próximos pasos para este cliente…"
          onChange={(evento) => guardarResumen(evento.target.value)} />
        <p className="metricas-informe-ayuda">El borrador se guarda en este navegador para este cliente y tu cuenta.</p>
        {errorGuardado && (
          <Aviso>No se pudo guardar el borrador en este navegador. Conservá esta página abierta mientras editás.</Aviso>
        )}
        <div className="metricas-informe-logo">
          <span>Logo de la empresa en el PDF</span>
          {logoInforme && <img src={logoInforme} alt="Logo de la empresa" />}
          {estadoLogo === 'cargando' && <small>Cargando logo…</small>}
          {estadoLogo === 'ausente' && <small>Esta organización no tiene un logo cargado.</small>}
          {estadoLogo === 'error' && (
            <div className="metricas-informe-logo-error">
              <small>No se pudo cargar el logo. Reintentá antes de imprimir.</small>
              <button className="boton boton-secundario boton-chico" type="button"
                onClick={() => cambiarReintentoLogo((actual) => actual + 1)}>Reintentar</button>
            </div>
          )}
        </div>
        <div className="metricas-informe-acciones">
          <button className="boton boton-primario" type="button" onClick={imprimir}
            disabled={estadoLogo === 'cargando' || estadoLogo === 'error'}>
            Imprimir / Guardar PDF
          </button>
          {resumen && (
            <button className="boton boton-secundario" type="button" onClick={() => guardarResumen('')}>
              Borrar borrador
            </button>
          )}
        </div>
      </section>

      {createPortal(
        <article className="informe-imprimible" aria-label="Informe de métricas GEO">
          <header className="informe-encabezado">
            <div>
              <span className="informe-sobrelinea">INFORME DE MÉTRICAS GEO</span>
              <h1>{nombreCliente}</h1>
              {cliente?.nombreMarca && <p>Marca monitoreada: {cliente.nombreMarca}</p>}
            </div>
            {logoInforme && (
              <img data-logo-organizacion
                src={logoInforme}
                alt="Logo de la empresa" />
            )}
          </header>

          <div className="informe-periodo">
            <div><span>Período analizado</span><strong>{fechaLegible(metricas.desde)} — {fechaLegible(metricas.hasta)}</strong></div>
            <div><span>Generado</span><strong>{fechaHoraArgentina.format(fechaGeneracion)}</strong></div>
          </div>

          <section className="informe-bloque">
            <h2>Actividad del período</h2>
            <dl className="informe-cifras informe-cifras-cuatro">
              <CifraInforme etiqueta="Ejecuciones" valor={enteros.format(metricas.ejecuciones)} />
              <CifraInforme etiqueta="Analizadas" valor={enteros.format(metricas.analizadas)} />
              <CifraInforme etiqueta="Pendientes" valor={enteros.format(metricas.pendientes)} />
              <CifraInforme etiqueta="Fallidas" valor={enteros.format(metricas.fallidas)} />
            </dl>
          </section>

          <section className="informe-bloque">
            <h2>Visibilidad de marca y citas</h2>
            <dl className="informe-cifras informe-cifras-tres">
              <CifraInforme etiqueta="Mención de marca" valor={tasaLegible(metricas.tasaMencionMarca)}
                detalle={`${enteros.format(metricas.mencionesMarca)} de ${enteros.format(metricas.analizadas)} analizadas`} />
              <CifraInforme etiqueta="Respuestas con citas" valor={tasaLegible(metricas.tasaCitas)}
                detalle={`${enteros.format(metricas.conCitas)} de ${enteros.format(metricas.analizadas)} analizadas`} />
              <CifraInforme etiqueta="Citas al sitio propio" valor={tasaLegible(metricas.tasaCitasSitioCliente)}
                detalle={`${enteros.format(metricas.conCitasSitioCliente)} de ${enteros.format(metricas.analizadas)} analizadas`} />
            </dl>
            <p className="informe-nota">La mención de marca incluye consultas que nombran la marca; no mide presencia espontánea. Las citas al sitio propio se comparan con el dominio actual del cliente.</p>
          </section>

          <section className="informe-bloque">
            <h2>Evolución diaria de menciones</h2>
            <GraficoInforme metricas={metricas} />
          </section>

          <section className="informe-bloque">
            <h2>Competidores evaluados</h2>
            {competidores.length === 0 ? (
              <p className="informe-vacio">No hubo evaluaciones de competidores en este período.</p>
            ) : (
              <table className="informe-tabla">
                <thead><tr>
                  <th scope="col">Competidor</th>
                  <th scope="col">Evaluaciones</th>
                  <th scope="col">Menciones</th>
                  <th scope="col">Tasa de mención</th>
                </tr></thead>
                <tbody>{competidores.map((competidor) => (
                  <tr key={competidor.competidorUuid}>
                    <th scope="row">{competidor.nombre}</th>
                    <td>{enteros.format(competidor.evaluaciones)}</td>
                    <td>{enteros.format(competidor.menciones)}</td>
                    <td>{tasaLegible(competidor.tasaMencion)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            <p className="informe-nota">La tasa de cada competidor usa solo las respuestas donde fue evaluado.</p>
          </section>

          <section className="informe-bloque informe-resumen-ejecutivo">
            <h2>Resumen ejecutivo</h2>
            <p>{resumen.trim() || 'Sin comentarios adicionales.'}</p>
          </section>

          <footer className="informe-pie">
            {cuenta.nombreOrganizacion && <span>Creado por {cuenta.nombreOrganizacion}</span>}
            <span>Generado con Gelaia</span>
          </footer>
        </article>,
        document.body,
      )}
    </>
  )
}
