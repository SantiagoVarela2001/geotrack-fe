import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { api } from '../src/api/clienteApi.ts'
import { formatoInforme } from '../src/informesSemanales.ts'
import { InformeSemanal } from '../src/componentes/AnalisisSemanalesCliente.tsx'
import { analisis, informeAnterior, informeSeparado, clienteUuid, ejecucionUuid } from './datos.mjs'

function renderizar(informe) {
  return renderToStaticMarkup(createElement(InformeSemanal, { analisis: { ...analisis, informe } }))
}

test('informe separado, anterior y null tienen detección y presentación seguras', () => {
  assert.equal(formatoInforme(informeSeparado), 'separado')
  assert.equal(formatoInforme(informeAnterior), 'anterior')
  assert.equal(formatoInforme(null), 'ausente')
  assert.equal(renderizar(null), '')
  const separado = renderizar(informeSeparado)
  assert.match(separado, /Sin marca · Presencia espontánea/)
  assert.match(separado, /Con marca/)
  assert.match(separado, /No hay respuestas analizadas en este grupo/)
  assert.match(separado, /No se informaron hallazgos/)
  assert.match(separado, new RegExp(`#/clientes/${clienteUuid}/ejecuciones/${ejecucionUuid}`))
  const anterior = renderizar(informeAnterior)
  assert.match(anterior, /Resumen anterior combinado/)
  assert.doesNotMatch(anterior, /Sin marca|Con marca/)
})

test('formatos incompletos y campos anidados desconocidos muestran error sin inventar grupos', () => {
  for (const informe of [undefined, {}, [], 'informe', { sinMarca: informeAnterior },
    { conMarca: informeAnterior, ...informeAnterior }, { ...informeSeparado, conMarca: null },
    { ...informeAnterior, hallazgos: [null] },
    { ...informeAnterior, recomendaciones: [{ ...informeAnterior.recomendaciones[0], prioridad: 'URGENTE' }] }]) {
    assert.equal(formatoInforme(informe), 'invalido')
    assert.match(renderizar(informe), /formato incompleto o desconocido/)
  }
})

test('el informe completo no se trunca por grupo', () => {
  const informe = { sinMarca: {
    resumen: 'Muestra', hallazgos: Array.from({ length: 8 }, (_, indice) => ({ descripcion: `Hallazgo ${indice}`, ejecuciones: [] })),
    recomendaciones: Array.from({ length: 5 }, (_, indice) => ({ titulo: `Recomendación ${indice}`, accion: 'Acción', prioridad: 'BAJA', ejecuciones: [] })),
  }, conMarca: informeSeparado.conMarca }
  const html = renderizar(informe)
  assert.match(html, /Hallazgo 7/)
  assert.match(html, /Recomendación 4/)
})

test('último, detalle, historial y reintentos aceptan ambos formatos y conservan metadatos', async (t) => {
  for (const informe of [informeSeparado, informeAnterior]) {
    let pendiente = true
    const proceso = { ...analisis, intentos: 2, informe }
    t.mock.method(globalThis, 'fetch', async (ruta, opciones) => {
      if (opciones.method === 'POST') {
        assert.equal(opciones.body, undefined)
        return Response.json({ ...proceso, estado: 'PENDIENTE', informe: null }, { status: 202 })
      }
      if (ruta.includes('?pagina=')) return Response.json({ content: [proceso], number: 0, totalPages: 1, totalElements: 1 })
      if (ruta.endsWith('/ultimo')) return Response.json(proceso)
      if (pendiente) { pendiente = false; return Response.json({ ...proceso, estado: 'PROCESANDO', informe: null }) }
      return Response.json(proceso)
    })
    assert.equal((await api.analisisSemanales.iniciar(clienteUuid)).informe, null)
    assert.equal((await api.analisisSemanales.obtener(clienteUuid, analisis.uuid)).estado, 'PROCESANDO')
    for (const resultado of [await api.analisisSemanales.obtenerUltimo(clienteUuid),
      await api.analisisSemanales.obtener(clienteUuid, analisis.uuid),
      (await api.analisisSemanales.listar(clienteUuid, 0)).content[0]]) {
      assert.equal(resultado.intentos, 2)
      assert.equal(resultado.uuid, analisis.uuid)
      assert.equal(formatoInforme(resultado.informe), formatoInforme(informe))
      assert.match(renderizar(resultado.informe), new RegExp(informe === informeAnterior ? informeAnterior.resumen : informeSeparado.sinMarca.resumen))
    }
  }
})
