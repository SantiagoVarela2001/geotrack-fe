import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { api, ErrorApi, limpiarSesion, configurarExpiracionSesion } from '../src/api/clienteApi.ts'
import { clasificacionValida, leerClasificacion, prepararConsultas, puedeCorregirMarca, reemplazarConsultas, actualizarAgrupados } from '../src/consultas.ts'
import { FilaConsulta } from '../src/componentes/FilaConsulta.tsx'
import { EditarConsulta } from '../src/componentes/EditarConsulta.tsx'
import { CorregirMarcaConsulta } from '../src/componentes/CorregirMarcaConsulta.tsx'
import { consulta, cuenta, cliente, temas, generacion, temaUuid, otroTemaUuid } from './datos.mjs'

for (const conMarca of [true, false]) {
  test(`alta, edición y PATCH serializan el booleano ${conMarca}`, async (t) => {
    const peticiones = []
    t.mock.method(globalThis, 'fetch', async (ruta, opciones) => {
      peticiones.push({ ruta, ...opciones, datos: JSON.parse(opciones.body) })
      return Response.json({ ...consulta, conMarca })
    })
    const datos = { texto: 'Pregunta', tipoConsulta: 'REFERENCIA', prioridad: 'MEDIA', conMarca }
    assert.equal(prepararConsultas([datos])[0].conMarca, conMarca)
    await api.consultas.crear('cliente', 'tema', [datos])
    await api.consultas.editar('cliente', consulta.uuid, { ...datos, temaUuid })
    const aprobada = await api.consultas.cambiarMarca('cliente', consulta.uuid, conMarca)
    assert.equal(aprobada.conMarca, conMarca)
    assert.deepEqual(peticiones.map((p) => p.method), ['POST', 'PUT', 'PATCH'])
    assert.deepEqual(peticiones[0].datos, [datos])
    assert.deepEqual(peticiones[1].datos, { ...datos, temaUuid })
    assert.deepEqual(peticiones[2].datos, { conMarca })
    assert.match(peticiones[2].ruta, /\/marca$/)
    assert.equal(peticiones[2].headers.get('Content-Type'), 'application/json')
  })
}

test('clasificación explícita: false es válido; ausencia, null, strings y números se rechazan sin HTTP', (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('No debe solicitar') })
  assert.equal(clasificacionValida(false), true)
  assert.equal(leerClasificacion('sinMarca'), false)
  assert.equal(leerClasificacion('conMarca'), true)
  assert.equal(leerClasificacion(''), null)
  for (const valor of [undefined, null, 'false', 'true', 0, 1]) {
    assert.equal(clasificacionValida(valor), false)
    const datos = { ...consulta, conMarca: valor }
    assert.throws(() => prepararConsultas([datos]))
    assert.throws(() => api.consultas.crear('cliente', 'tema', [datos]))
    assert.throws(() => api.consultas.editar('cliente', consulta.uuid, datos))
    assert.throws(() => api.consultas.cambiarMarca('cliente', consulta.uuid, valor))
  }
  assert.equal(fetch.mock.callCount(), 0)
})

test('permisos de corrección: miembro/propietario, SYSADMIN, tipo solo y archivado', () => {
  assert.equal(puedeCorregirMarca(cuenta, cliente), true)
  assert.equal(puedeCorregirMarca({ ...cuenta, roles: ['PROPIETARIO'] }, cliente), true)
  assert.equal(puedeCorregirMarca({ ...cuenta, tipoCuenta: 'PLATAFORMA', roles: ['SYSADMIN'] }, cliente), false)
  assert.equal(puedeCorregirMarca({ ...cuenta, roles: ['SYSADMIN'] }, cliente), false)
  assert.equal(puedeCorregirMarca({ ...cuenta, permisos: ['CONSULTAS_CAMBIAR_TIPO'] }, cliente), false)
  assert.equal(puedeCorregirMarca(cuenta, { ...cliente, estado: 'ARCHIVADO' }), false)
  assert.equal(puedeCorregirMarca(cuenta, null), false)
})

test('actualiza por UUID las lecturas, mueve el tema y conserva ejecucionHoy', () => {
  const hoy = { uuid: 'ejecucion', estadoEjecucion: 'FALLIDO', estadoNormalizacion: 'NO_REALIZADA' }
  const actual = { ...consulta, ejecucionHoy: hoy }
  const otra = { ...consulta, uuid: 'otra' }
  const nueva = { ...consulta, temaUuid: otroTemaUuid, conMarca: true }
  assert.deepEqual(reemplazarConsultas([actual, otra], [nueva]), [{ ...nueva, ejecucionHoy: hoy }, otra])
  const agrupados = actualizarAgrupados(temas.map((tema) => ({ ...tema, consultas: tema.uuid === temaUuid ? [actual] : [] })), nueva)
  assert.equal(agrupados[0].consultas.length, 0)
  assert.deepEqual(agrupados[1].consultas, [{ ...nueva, ejecucionHoy: hoy }])
  assert.equal(reemplazarConsultas(generacion.consultas, [nueva])[0].conMarca, true)
  assert.equal(consulta.conMarca, false)
})

test('generación, aprobación, cambio de tipo y detalle preservan la clasificación recibida', async (t) => {
  t.mock.method(globalThis, 'fetch', async (ruta, opciones) => {
    if (ruta.endsWith('/generacion')) {
      if (opciones.method === 'POST') assert.equal(opciones.body, undefined)
      return Response.json(generacion)
    }
    return Response.json(ruta.endsWith('/aprobaciones') ? [consulta] : consulta)
  })
  assert.equal((await api.consultas.obtenerGeneracion('cliente')).consultas[0].conMarca, false)
  assert.equal((await api.consultas.iniciarGeneracion('cliente')).consultas[0].conMarca, false)
  assert.equal((await api.consultas.aprobar('cliente', [consulta.uuid]))[0].conMarca, false)
  assert.equal((await api.consultas.cambiarTipo('cliente', consulta.uuid, 'DESCUBRIMIENTO')).conMarca, false)
  assert.equal((await api.consultas.obtener('cliente', 'tema', consulta.uuid)).conMarca, false)
})

for (const estado of [400, 403, 404, 409]) {
  test(`PATCH fallido ${estado} conserva datos previos y expone detail`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ detail: 'Motivo del servidor' }, {
      status: estado, headers: { 'Content-Type': 'application/problem+json' },
    }))
    let visible = consulta
    await assert.rejects(async () => { visible = await api.consultas.cambiarMarca('cliente', consulta.uuid, true) },
      (error) => error instanceof ErrorApi && error.estado === estado && error.message === 'Motivo del servidor')
    assert.equal(visible, consulta)
  })
}

test('401 intenta renovar una vez y notifica la sesión inválida', async (t) => {
  limpiarSesion()
  let expiraciones = 0
  configurarExpiracionSesion(() => expiraciones++)
  const rutas = []
  t.mock.method(globalThis, 'fetch', async (ruta) => { rutas.push(ruta); return new Response(null, { status: 401 }) })
  await assert.rejects(api.consultas.cambiarMarca('cliente', consulta.uuid, false), (error) => error.estado === 401)
  assert.equal(rutas.length, 2)
  assert.equal(rutas[1], '/api/autenticacion/renovar')
  assert.equal(expiraciones, 1)
  configurarExpiracionSesion(() => {})
})

test('aprobadas muestran clasificación y corrección, y no muestran edición completa', () => {
  const html = renderToStaticMarkup(createElement(FilaConsulta, {
    consulta: { ...consulta, estadoConsulta: 'APROBADA' }, indice: 0, alEditar() {}, alCorregirMarca() {},
  }))
  assert.match(html, /Sin marca/)
  assert.match(html, /Más acciones de la consulta/)
  assert.doesNotMatch(html, />Editar</)
  const formulario = renderToStaticMarkup(createElement(EditarConsulta, { consulta, temas, enviando: false, error: '', alCancelar() {}, alGuardar() {} }))
  assert.match(formulario, /value="sinMarca" selected=""/)
  const correccion = renderToStaticMarkup(createElement(CorregirMarcaConsulta, { consulta, enviando: false, error: 'Error conservado', alCancelar() {}, alGuardar() {} }))
  assert.match(correccion, /Error conservado/)
  assert.match(correccion, /Las anteriores y las que ya están en cola conservan su clasificación/)
})
