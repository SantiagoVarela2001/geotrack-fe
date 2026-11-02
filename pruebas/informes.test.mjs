import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { api } from '../src/api/clienteApi.ts'
import { formatoInforme } from '../src/informesSemanales.ts'
import { InformeSemanal } from '../src/componentes/AnalisisSemanalesCliente.tsx'
import { analisis, informeAnterior, informeSeparado, competidoresDetectados, clienteUuid, ejecucionUuid } from './datos.mjs'

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
  assert.doesNotMatch(anterior + separado, /Competidores detectados/)
})

for (const [nombre, base] of [['separado', informeSeparado], ['plano', informeAnterior]]) {
  test(`informe ${nombre}: competidores y preguntas históricas visibles una sola vez, con y sin fuente`, () => {
    const html = renderizar({ ...base, competidoresDetectados })
    assert.equal([...html.matchAll(/aria-label="Competidores detectados"/g)].length, 1)
    for (const competidor of competidoresDetectados) {
      assert.ok(html.includes(competidor.nombre))
      assert.ok(html.includes(competidor.pregunta))
    }
    assert.match(html, /href="https:\/\/rival\.example\/comparacion" target="_blank" rel="noopener noreferrer">Ver fuente<\/a>/)
    assert.equal([...html.matchAll(/>Ver fuente<\/a>/g)].length, 1)
    assert.doesNotMatch(html.match(/<li[^>]*><strong>Otra Agencia<\/strong>[\s\S]*?<\/li>/)?.[0] ?? '', /<a\b/)
    assert.match(html, new RegExp(base === informeAnterior ? base.resumen : base.sinMarca.resumen))
  })

  test(`informe ${nombre}: lista vacía muestra el mensaje y propiedad ausente o null oculta la sección`, () => {
    const vacio = renderizar({ ...base, competidoresDetectados: [] })
    assert.match(vacio, /Competidores detectados/)
    assert.match(vacio, /No se identificaron competidores en las respuestas analizadas/)
    assert.doesNotMatch(vacio, /analisis-competidores-lista/)
    for (const informe of [base, { ...base, competidoresDetectados: null }]) {
      const html = renderizar(informe)
      assert.doesNotMatch(html, /Competidores detectados|No se identificaron competidores/)
      assert.match(html, new RegExp(base === informeAnterior ? base.resumen : base.sinMarca.resumen))
    }
  })
}

test('fuentes no web o inválidas conservan el competidor y su pregunta sin crear enlaces', () => {
  for (const urlFuente of ['javascript:alert(1)', 'data:text/html,contenido', 'URL inválida', '']) {
    const html = renderizar({ ...informeSeparado, competidoresDetectados: [{ ...competidoresDetectados[0], urlFuente }] })
    assert.ok(html.includes(competidoresDetectados[0].nombre))
    assert.ok(html.includes(competidoresDetectados[0].pregunta))
    assert.doesNotMatch(html, />Ver fuente<\/a>/)
  }
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
  const informes = [informeSeparado, informeAnterior].flatMap((base) => [base,
    { ...base, competidoresDetectados }, { ...base, competidoresDetectados: [] }, { ...base, competidoresDetectados: null }])
  for (const informe of informes) {
    let pendiente = true
    const peticiones = []
    const proceso = { ...analisis, intentos: 2, informe }
    t.mock.method(globalThis, 'fetch', async (ruta, opciones) => {
      peticiones.push(ruta)
      if (opciones.method === 'POST') {
        assert.equal(opciones.body, undefined)
        return Response.json({ ...proceso, estado: 'PENDIENTE', informe: null }, { status: 202 })
      }
      if (ruta.includes('?pagina=')) return Response.json({ content: [proceso], number: 0, totalPages: 1, totalElements: 1 })
      if (ruta.endsWith('/ultimo')) return Response.json(proceso)
      if (pendiente) { pendiente = false; return Response.json({ ...proceso, estado: 'PROCESANDO', informe: null }) }
      return Response.json(proceso)
    })
    const iniciado = await api.analisisSemanales.iniciar(clienteUuid)
    assert.equal(iniciado.informe, null)
    assert.equal(renderizar(iniciado.informe), '')
    const enProceso = await api.analisisSemanales.obtener(clienteUuid, analisis.uuid)
    assert.equal(enProceso.estado, 'PROCESANDO')
    assert.equal(enProceso.informe, null)
    assert.equal(renderizar(enProceso.informe), '')
    for (const resultado of [await api.analisisSemanales.obtenerUltimo(clienteUuid),
      await api.analisisSemanales.obtener(clienteUuid, analisis.uuid),
      (await api.analisisSemanales.listar(clienteUuid, 0)).content[0]]) {
      assert.equal(resultado.intentos, 2)
      assert.equal(resultado.uuid, analisis.uuid)
      assert.equal(formatoInforme(resultado.informe), formatoInforme(informe))
      assert.deepEqual(resultado.informe, informe)
      assert.match(renderizar(resultado.informe), new RegExp('sinMarca' in informe ? informeSeparado.sinMarca.resumen : informeAnterior.resumen))
    }
    const rutaBase = `/api/clientes-monitoreados/${clienteUuid}/analisis-semanales`
    assert.deepEqual(peticiones, [rutaBase, `${rutaBase}/${analisis.uuid}`, `${rutaBase}/ultimo`, `${rutaBase}/${analisis.uuid}`, `${rutaBase}?pagina=0`])
  }
})
