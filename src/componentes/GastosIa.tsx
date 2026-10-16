import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/clienteApi'
import type { DatosGastoIaOrganizacion } from '../api/tipos'
import { obtenerMensajeError } from '../utilidades'
import { Aviso } from './Comun'

type Periodo = { desde: string; hasta: string }

const importes = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'code',
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
})
const enteros = new Intl.NumberFormat('es-AR')

function fechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const fecha = new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor
}

export function GastosIa() {
  const [borrador, cambiarBorrador] = useState<Periodo>({ desde: '', hasta: '' })
  const [periodo, cambiarPeriodo] = useState<Periodo>({ desde: '', hasta: '' })
  const [gastos, cambiarGastos] = useState<DatosGastoIaOrganizacion[]>([])
  const [cargando, cambiarCargando] = useState(true)
  const [error, cambiarError] = useState('')
  const [errorFechas, cambiarErrorFechas] = useState('')

  useEffect(() => {
    let vigente = true
    api.administracion
      .listarGastosIa(periodo.desde || undefined, periodo.hasta || undefined)
      .then((datos) => {
        if (vigente) cambiarGastos(datos)
      })
      .catch((causa) => {
        if (vigente) cambiarError(obtenerMensajeError(causa))
      })
      .finally(() => {
        if (vigente) cambiarCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [periodo])

  function cargarPeriodo(siguiente: Periodo) {
    cambiarErrorFechas('')
    cambiarError('')
    cambiarGastos([])
    cambiarCargando(true)
    cambiarPeriodo(siguiente)
  }

  function aplicarFiltros(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if ((borrador.desde && !fechaValida(borrador.desde)) ||
        (borrador.hasta && !fechaValida(borrador.hasta))) {
      cambiarErrorFechas('Ingresá fechas válidas en formato AAAA-MM-DD.')
      return
    }
    if (borrador.desde && borrador.hasta && borrador.desde > borrador.hasta) {
      cambiarErrorFechas('La fecha desde no puede ser posterior a la fecha hasta.')
      return
    }
    cargarPeriodo({ ...borrador })
  }

  function verTodo() {
    const historial = { desde: '', hasta: '' }
    cambiarBorrador(historial)
    cargarPeriodo(historial)
  }

  const descripcionPeriodo = periodo.desde && periodo.hasta
    ? `Del ${periodo.desde} al ${periodo.hasta}, inclusive`
    : periodo.desde
      ? `Desde el ${periodo.desde}, inclusive`
      : periodo.hasta
        ? `Hasta el ${periodo.hasta}, inclusive`
        : 'Todo el historial'

  return (
    <div className="contenido-limitado pagina-gastos-ia">
      <div className="encabezado-pagina">
        <div>
          <span className="sobrelinea">PLATAFORMA</span>
          <h1>Gastos IA</h1>
          <p>Costo estimado de IA por organización.</p>
        </div>
      </div>

      <section className="tarjeta gastos-ia-panel" aria-label="Filtrar gastos de IA">
        <form className="formulario gastos-ia-filtros" onSubmit={aplicarFiltros}>
          <label htmlFor="gastos-ia-desde">
            Desde (opcional)
            <input
              id="gastos-ia-desde"
              type="date"
              value={borrador.desde}
              onChange={(evento) => {
                cambiarBorrador((actual) => ({ ...actual, desde: evento.target.value }))
                cambiarErrorFechas('')
              }}
            />
          </label>
          <label htmlFor="gastos-ia-hasta">
            Hasta (opcional)
            <input
              id="gastos-ia-hasta"
              type="date"
              value={borrador.hasta}
              onChange={(evento) => {
                cambiarBorrador((actual) => ({ ...actual, hasta: evento.target.value }))
                cambiarErrorFechas('')
              }}
            />
          </label>
          <button className="boton boton-primario" type="submit">Aplicar filtros</button>
          <button className="boton boton-secundario" type="button" onClick={verTodo}>
            Todo el historial
          </button>
          {errorFechas && <div className="gastos-ia-error-fechas"><Aviso>{errorFechas}</Aviso></div>}
        </form>
        <p className="gastos-ia-ayuda">
          Cada fecha incluye el día completo en Argentina. Podés usar una sola fecha o dejar ambas vacías.
        </p>
      </section>

      <div className="gastos-ia-resultados-cabecera">
        <h2>Gasto por organización</h2>
        <span>{descripcionPeriodo}</span>
      </div>

      {cargando ? (
        <div className="cargando-bloque" role="status">Cargando gastos de IA…</div>
      ) : error ? (
        <div className="gastos-ia-error">
          <Aviso>{error}</Aviso>
          <button className="boton boton-secundario reintentar" type="button"
            onClick={() => cargarPeriodo({ ...periodo })}>
            Reintentar
          </button>
        </div>
      ) : gastos.length === 0 ? (
        <div className="tarjeta gastos-ia-vacio">No hay organizaciones para mostrar.</div>
      ) : (
        <div className="gastos-ia-tabla-contenedor">
          <table className="gastos-ia-tabla">
            <caption>{enteros.format(gastos.length)} organizaciones, incluidas las inactivas</caption>
            <thead>
              <tr>
                <th scope="col">Organización</th>
                <th scope="col">Estado</th>
                <th scope="col">Costo estimado</th>
                <th scope="col">Llamadas sin costo estimado</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((gasto) => (
                <tr key={gasto.uuid}>
                  <th scope="row">{gasto.nombre}</th>
                  <td>
                    <span className={`gastos-ia-estado ${gasto.activa ? 'gastos-ia-activa' : 'gastos-ia-inactiva'}`}>
                      {gasto.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="gastos-ia-numero">{importes.format(gasto.costoEstimadoUsd)}</td>
                  <td className="gastos-ia-numero">{enteros.format(gasto.llamadasSinCostoEstimado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="gastos-ia-nota">
        Son estimaciones según las tarifas configuradas, no una factura del proveedor. Se incluyen
        operaciones y reintentos, también los fallidos con costo conocido; el costo web ya está
        incluido. El período usa la fecha de creación de cada consumo. Un importe de USD 0 puede
        coexistir con llamadas sin costo estimado.
      </p>
    </div>
  )
}
