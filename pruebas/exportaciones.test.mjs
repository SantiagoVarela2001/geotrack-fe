import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { api, ErrorApi, limpiarSesion } from '../src/api/clienteApi.ts'
import { hoyArgentina } from '../src/accionesCliente.ts'
import { archivoExportacionVigente, exportacionEnCurso, guardarExcel, seguirExportacion,
  validarPeriodoExportacion } from '../src/exportaciones.ts'
import { DialogoExportarConsultas, ExportarConsultas } from '../src/componentes/ExportarConsultas.tsx'
import { clienteUuid, cuenta } from './datos.mjs'

const archivoUuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const base = '/api/clientes-monitoreados/' + clienteUuid + '/consultas/exportacion'
const proceso = {
  clienteUuid, procesoUuid: archivoUuid, estado: 'FINALIZADO', desde: '2026-11-01', hasta: '2026-11-15',
  mensaje: null, archivoUuid, archivoDesde: '2026-11-01', archivoHasta: '2026-11-15',
  fechaGeneracion: '2026-11-15T15:00:00Z', venceEn: '2026-11-16T03:00:00Z',
  cantidadFilas: 12, urlDescarga: base + '/archivos/' + archivoUuid,
}

test('exportación: rutas privadas, fechas explícitas, 204 y bytes del Excel', async (t) => {
  const peticiones = []
  const controlador = new AbortController()
  t.mock.method(globalThis, 'fetch', async (ruta, opciones) => {
    peticiones.push({ ruta, opciones })
    if (opciones.method === 'POST') return Response.json(proceso, { status: 202 })
    if (ruta.endsWith('/archivos/' + archivoUuid)) return new Response(new Uint8Array([80, 75, 3, 4]),
      { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } })
    return new Response(null, { status: 204 })
  })
  assert.deepEqual(await api.exportaciones.iniciar(clienteUuid, { desde: proceso.desde, hasta: proceso.hasta }, controlador.signal), proceso)
  assert.equal(await api.exportaciones.obtener(clienteUuid, controlador.signal), null)
  const archivo = await api.exportaciones.descargar(clienteUuid, archivoUuid, controlador.signal)
  assert.ok(archivo instanceof Blob)
  assert.deepEqual([...new Uint8Array(await archivo.arrayBuffer())], [80, 75, 3, 4])
  assert.deepEqual(peticiones.map((p) => p.ruta), [base, base, base + '/archivos/' + archivoUuid])
  assert.deepEqual(JSON.parse(peticiones[0].opciones.body), { desde: proceso.desde, hasta: proceso.hasta })
  for (const peticion of peticiones) {
    assert.equal(peticion.opciones.credentials, 'include')
    assert.equal(peticion.opciones.signal, controlador.signal)
  }
})

test('la descarga binaria renueva el JWT una vez y conserva el formato binario al reintentar', async (t) => {
  limpiarSesion()
  t.after(limpiarSesion)
  const descargas = []
  let renovaciones = 0
  t.mock.method(globalThis, 'fetch', async (ruta, opciones) => {
    if (ruta.endsWith('/ingresar')) return Response.json({ tokenAcceso: 'token-inicial', tipoToken: 'Bearer' })
    if (ruta.endsWith('/actual')) return Response.json(cuenta)
    if (ruta.endsWith('/renovar')) { renovaciones++; return Response.json({ tokenAcceso: 'token-renovado', tipoToken: 'Bearer' }) }
    descargas.push(opciones.headers.get('Authorization'))
    return descargas.length === 1 ? new Response(null, { status: 401 }) : new Response('Excel autenticado')
  })
  await api.ingresar('cuenta-prueba', 'clave-prueba')
  const archivo = await api.exportaciones.descargar(clienteUuid, archivoUuid)
  assert.equal(await archivo.text(), 'Excel autenticado')
  assert.deepEqual(descargas, ['Bearer token-inicial', 'Bearer token-renovado'])
  assert.equal(renovaciones, 1)
})

for (const estado of [403, 404, 409, 410, 503]) {
  test('exportación: conserva el error HTTP ' + estado + ' y su detalle', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ detail: 'Motivo del servidor' },
      { status: estado, headers: { 'Content-Type': 'application/problem+json' } }))
    await assert.rejects(api.exportaciones.descargar(clienteUuid, archivoUuid),
      (error) => error instanceof ErrorApi && error.estado === estado && error.message === 'Motivo del servidor')
  })
}

test('el período respeta días reales y el cambio de día de Argentina', () => {
  assert.equal(validarPeriodoExportacion('2026-11-01', '2026-11-15'), null)
  assert.equal(validarPeriodoExportacion('2026-11-15', '2026-11-15'), null)
  for (const desde of ['', '2026-02-30', '15/11/2026', '0000-01-01', '2026-11-16']) {
    assert.equal(typeof validarPeriodoExportacion(desde, '2026-11-15'), 'string')
  }
  assert.equal(hoyArgentina(new Date('2026-11-16T02:59:59Z')), '2026-11-15')
  assert.equal(hoyArgentina(new Date('2026-11-16T03:00:00Z')), '2026-11-16')
  assert.equal(archivoExportacionVigente(proceso, Date.parse('2026-11-16T02:59:59Z')), true)
  assert.equal(archivoExportacionVigente(proceso, Date.parse('2026-11-16T03:00:00Z')), false)
  assert.equal(archivoExportacionVigente(null), false)
})

test('el seguimiento no superpone peticiones y termina al completar la exportación', async () => {
  const estados = ['PENDIENTE', 'PROCESANDO', 'FINALIZADO']
  const recibidos = []
  let enSolicitud = false
  await seguirExportacion(async () => {
    assert.equal(enSolicitud, false)
    enSolicitud = true
    await Promise.resolve()
    enSolicitud = false
    return { ...proceso, estado: estados.shift() }
  }, (actual) => recibidos.push(actual.estado), new AbortController().signal, 0)
  assert.deepEqual(recibidos, ['PENDIENTE', 'PROCESANDO', 'FINALIZADO'])
  assert.equal(estados.length, 0)
})

test('cerrar cancela la espera y descarta respuestas que llegan después', async () => {
  const controlador = new AbortController()
  let consultas = 0
  const esperando = seguirExportacion(async () => { consultas++; return proceso }, () => {}, controlador.signal, 10000)
  controlador.abort()
  await esperando
  assert.equal(consultas, 0)

  const segundo = new AbortController()
  let responder
  let entro
  const entrada = new Promise((resolver) => { entro = resolver })
  const recibidos = []
  const seguimiento = seguirExportacion(() => {
    entro()
    return new Promise((resolver) => { responder = resolver })
  }, (actual) => recibidos.push(actual), segundo.signal, 0)
  await entrada
  segundo.abort()
  responder(proceso)
  await seguimiento
  assert.deepEqual(recibidos, [])
})

test('los estados terminales y los errores detienen el seguimiento', async () => {
  for (const estado of ['FINALIZADO', 'FALLIDO', 'SIN_DATOS', 'VENCIDO']) {
    assert.equal(exportacionEnCurso({ ...proceso, estado }), false)
    let consultas = 0
    await seguirExportacion(async () => { consultas++; return { ...proceso, estado } }, () => {},
      new AbortController().signal, 0)
    assert.equal(consultas, 1)
  }
  assert.equal(exportacionEnCurso({ ...proceso, estado: 'PROCESANDO' }), true)
  await assert.rejects(seguirExportacion(async () => null, () => {}, new AbortController().signal, 0),
    /No se pudo recuperar/)
  await assert.rejects(seguirExportacion(async () => { throw new Error('Sin conexión') }, () => {},
    new AbortController().signal, 0), /Sin conexión/)
})

test('el botón conserva las clases de la barra y el diálogo ofrece desde hasta hoy sin modelo', () => {
  assert.equal(renderToStaticMarkup(createElement(ExportarConsultas, { clienteUuid, permitido: false })), '')
  const boton = renderToStaticMarkup(createElement(ExportarConsultas, { clienteUuid, permitido: true }))
  assert.match(boton, /Exportar histórico/)
  assert.match(boton, /detalle-accion detalle-accion-exportar/)
  const dialogo = renderToStaticMarkup(createElement(DialogoExportarConsultas, { clienteUuid, alCerrar() {} }))
  assert.match(dialogo, /aria-labelledby="exportacion-titulo"/)
  assert.match(dialogo, /id="exportacion-desde"/)
  assert.match(dialogo, /id="exportacion-hasta"[^>]*readOnly=""/)
  assert.ok(dialogo.includes('value="' + hoyArgentina() + '"'))
  assert.match(dialogo, /Preparar Excel/)
  assert.doesNotMatch(dialogo, /modelo|tokens|costos/)
})

test('la descarga usa un Blob y libera el enlace y la URL temporal', (t) => {
  const acciones = []
  const enlace = { href: '', download: '', click() { acciones.push('click') }, remove() { acciones.push('retirado') } }
  const anterior = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => enlace, body: { appendChild() { acciones.push('agregado') } },
  } })
  t.after(() => {
    if (anterior) Object.defineProperty(globalThis, 'document', anterior)
    else delete globalThis.document
  })
  t.mock.method(URL, 'createObjectURL', () => 'blob:excel-prueba')
  t.mock.method(URL, 'revokeObjectURL', (url) => acciones.push(url))
  let liberar
  t.mock.method(globalThis, 'setTimeout', (accion) => { liberar = accion; return 1 })
  guardarExcel(new Blob(['Excel']), 'historico.xlsx')
  assert.equal(enlace.href, 'blob:excel-prueba')
  assert.equal(enlace.download, 'historico.xlsx')
  assert.deepEqual(acciones, ['agregado', 'click', 'retirado'])
  liberar()
  assert.equal(acciones.at(-1), 'blob:excel-prueba')
})
