import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { api } from '../src/api/clienteApi.ts'
import { alinearSeries, tasaLegible } from '../src/metricas.ts'
import { ResumenMetricasGrupo } from '../src/componentes/MetricasCliente.tsx'
import { BloquesInformeGrupo } from '../src/componentes/InformeMetricas.tsx'
import { GraficoEvolucionDiaria } from '../src/componentes/GraficoEvolucionDiaria.tsx'
import { acciones, metricas, grupo, consultaUuid } from './datos.mjs'

function resumen(clave, datos = metricas[clave]) {
  return renderToStaticMarkup(createElement(ResumenMetricasGrupo, { metricas: datos, clave, etiqueta: clave === 'sinMarca' ? 'Sin marca' : 'Con marca' }))
}

test('una sola solicitud de métricas con ambas fechas y ambos grupos', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (ruta) => {
    assert.equal(ruta, '/api/clientes-monitoreados/cliente/metricas?desde=2026-11-01&hasta=2026-11-03')
    return Response.json(metricas)
  })
  assert.deepEqual(await api.metricas.obtener('cliente', '2026-11-01', '2026-11-03'), metricas)
  assert.equal(fetch.mock.callCount(), 1)
})

test('25 % sin marca y 100 % con marca se muestran por separado, también en PDF', () => {
  const sinMarca = resumen('sinMarca')
  const conMarca = resumen('conMarca')
  assert.match(sinMarca, /25 %/)
  assert.match(sinMarca, /Presencia espontánea/)
  assert.doesNotMatch(sinMarca, /100 %/)
  assert.match(conMarca, /100 %/)
  assert.doesNotMatch(conMarca, /25 %/)
  for (const clave of ['sinMarca', 'conMarca']) {
    const html = renderToStaticMarkup(createElement(BloquesInformeGrupo, { clave, etiqueta: clave, metricas: metricas[clave] }))
    assert.match(html, clave === 'sinMarca' ? /25 %/ : /100 %/)
    assert.doesNotMatch(html, /2500|10000/)
  }
})

test('null y 0 se distinguen y los conteos pendientes, fallidos y cancelados se conservan sin muestra', () => {
  assert.equal(tasaLegible(null), 'Sin muestra')
  assert.equal(tasaLegible(0), '0 %')
  assert.match(resumen('sinMarca', grupo()), /No hubo ejecuciones en este grupo/)
  const html = resumen('sinMarca', grupo({ ejecuciones: 9, pendientes: 3, fallidas: 4, canceladas: 2 }))
  assert.match(html, /Sin muestra/)
  assert.match(html, /Pendientes<\/dt><dd>3/)
  assert.match(html, /Fallidas<\/dt><dd>4/)
  assert.match(html, /Canceladas<\/dt><dd>2/)
  assert.doesNotMatch(html, /No hubo ejecuciones en este grupo/)
  assert.match(resumen('sinMarca', grupo({ ejecuciones: 1, analizadas: 1, tasaMencionMarca: 0 })), /0 %/)
})

test('series con distintos días se alinean por fecha, sin rellenar tasas con cero', () => {
  const dias = alinearSeries(metricas)
  assert.deepEqual(dias.map((dia) => dia.dia), ['2026-11-01', '2026-11-02', '2026-11-03'])
  assert.equal(dias[0].sinMarca.tasaMencionMarca, 25)
  assert.equal(dias[0].conMarca, null)
  assert.equal(dias[1].sinMarca, null)
  assert.equal(dias[1].conMarca.tasaMencionMarca, 100)
  assert.equal(dias[2].sinMarca.pendientes, 1)
  assert.equal(dias[2].sinMarca.tasaMencionMarca, null)
  const vacios = alinearSeries({ ...metricas, sinMarca: grupo(), conMarca: grupo() })
  assert.ok(vacios.every((dia) => dia.sinMarca === null && dia.conMarca === null))
  const grafico = renderToStaticMarkup(createElement(GraficoEvolucionDiaria, { metricas }))
  assert.match(grafico, /Sin marca/)
  assert.match(grafico, /Con marca/)
  assert.match(grafico, /Sin muestra/)
})

test('la misma consulta histórica permanece en ambos rankings y los totales no se reconstruyen', () => {
  assert.equal(metricas.sinMarca.consultasMencionadas[0].consultaUuid, consultaUuid)
  assert.equal(metricas.conMarca.consultasMencionadas[0].consultaUuid, consultaUuid)
  assert.match(resumen('sinMarca'), /Pregunta histórica/)
  assert.match(resumen('conMarca'), /Pregunta histórica/)
  const html = resumen('sinMarca', { ...metricas.sinMarca, mencionesMarca: 20 })
  assert.match(html, /20 de 4 analizadas/)
  assert.match(html, /2 respuestas evaluadas · 50 %/)
})

test('marcadores agrupados e independientes: agregar, mover o eliminar no altera las curvas', () => {
  const dibujar = (listado, datos = metricas) => renderToStaticMarkup(createElement(GraficoEvolucionDiaria,
    { metricas: datos, acciones: listado }))
  const sinAcciones = dibujar([])
  const conAcciones = dibujar(acciones)
  const curvas = (html) => [...html.matchAll(/<polyline[^>]*points="([^"]+)"/g)].map((m) => m[1])
  assert.deepEqual(curvas(conAcciones), curvas(sinAcciones))
  assert.equal((conAcciones.match(/class="accion-marcador"/g) ?? []).length, 2)
  assert.match(conAcciones, /aria-label="2 acciones: 3 de noviembre de 2026"/)
  assert.doesNotMatch(conAcciones, /Primera publicación/)
  assert.doesNotMatch(dibujar(acciones.map((a) => ({ ...a, fecha: '2020-01-01' }))), /class="accion-marcador"/)
  assert.doesNotMatch(dibujar(acciones.map((a) => ({ ...a, clienteUuid: 'otro-cliente' }))), /class="accion-marcador"/)
  assert.doesNotMatch(dibujar([]), /class="accion-marcador"/)
  const vacias = { ...metricas, sinMarca: grupo(), conMarca: grupo() }
  assert.match(dibujar(acciones, vacias), /aria-label="2 acciones: 3 de noviembre de 2026"/)
  assert.deepEqual(vacias.sinMarca.serieDiaria, [])
  assert.deepEqual(metricas.sinMarca.serieDiaria.map((d) => d.tasaMencionMarca), [25, null])
})
