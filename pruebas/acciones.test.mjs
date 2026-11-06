import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { api, ErrorApi } from '../src/api/clienteApi.ts'
import { agruparAccionesPorDia, fechaAccionLegible, fechaCalendarioValida, hoyArgentina,
  permisosAcciones, validarAccion } from '../src/accionesCliente.ts'
import { ListaAccionesCliente } from '../src/componentes/GestionAccionesCliente.tsx'
import { acciones, cliente, clienteUuid, cuentaAcciones } from './datos.mjs'

const datos = { titulo: 'Publicamos servicios', fecha: '2020-01-01', descripcion: null, url: null }
const base = `/api/clientes-monitoreados/${clienteUuid}/acciones`

test('acciones: alta, detalle, reemplazo completo de opcionales y DELETE 204', async (t) => {
  const peticiones = []
  t.mock.method(globalThis, 'fetch', async (ruta, opciones) => {
    peticiones.push({ ruta, metodo: opciones.method ?? 'GET', cuerpo: opciones.body && JSON.parse(opciones.body) })
    if (opciones.method === 'DELETE') return new Response(null, { status: 204 })
    return Response.json({ ...acciones[0], ...(opciones.body ? JSON.parse(opciones.body) : {}) },
      { status: opciones.method === 'POST' ? 201 : 200 })
  })
  assert.equal((await api.acciones.crear(clienteUuid, datos)).titulo, datos.titulo)
  assert.deepEqual(await api.acciones.obtener(clienteUuid, acciones[0].uuid), acciones[0])
  const editada = await api.acciones.editar(clienteUuid, acciones[0].uuid, datos)
  assert.equal(editada.descripcion, null)
  assert.equal(editada.url, null)
  assert.equal(await api.acciones.eliminar(clienteUuid, acciones[0].uuid), undefined)
  assert.deepEqual(peticiones.map((p) => p.metodo), ['POST', 'GET', 'PUT', 'DELETE'])
  assert.deepEqual(peticiones[0].cuerpo, datos)
  assert.deepEqual(peticiones[2].cuerpo, datos)
  assert.equal(peticiones[0].ruta, base)
  assert.equal(peticiones[3].ruta, `${base}/${acciones[0].uuid}`)
})

test('listado sin filtros conserva orden; métricas y marcadores usan el mismo período', async (t) => {
  const peticiones = []
  t.mock.method(globalThis, 'fetch', async (ruta) => { peticiones.push(ruta); return Response.json(acciones) })
  assert.deepEqual(await api.acciones.listar(clienteUuid), acciones)
  await Promise.all([api.metricas.obtener(clienteUuid, '2026-11-01', '2026-11-30'),
    api.acciones.listar(clienteUuid, { desde: '2026-11-01', hasta: '2026-11-30' })])
  assert.equal(peticiones[0], base)
  assert.deepEqual(peticiones.slice(1).map((p) => p.split('?')[1]),
    ['desde=2026-11-01&hasta=2026-11-30', 'desde=2026-11-01&hasta=2026-11-30'])
})

test('validación de campos, límites, calendario y fecha futura argentina', () => {
  const validar = (cambios) => validarAccion({ ...datos, ...cambios }, '2026-11-06')
  assert.equal(validar({}), null)
  for (const cambios of [{ titulo: '  ' }, { titulo: 'a'.repeat(201) }, { fecha: '' },
    { fecha: '2026-02-30' }, { fecha: '2026-11-07' }, { fecha: '06/11/2026' },
    { descripcion: 'a'.repeat(2001) }, { url: 'https://example.com/' + 'a'.repeat(2048) },
    { url: 'javascript:alert(1)' }, { url: 'ftp://example.com' }, { url: 'https:example.com' }, { url: 'example.com' }]) {
    assert.equal(typeof validar(cambios), 'string', JSON.stringify(cambios))
  }
  assert.equal(validar({ titulo: 'a'.repeat(200), descripcion: 'a'.repeat(2000), fecha: '2026-11-06',
    url: 'https://example.com/' + 'a'.repeat(2028) }), null)
  assert.equal(validar({ fecha: '1900-01-01', descripcion: '', url: '' }), null)
  assert.equal(fechaCalendarioValida('2024-02-29'), true)
  assert.equal(fechaCalendarioValida('2026-02-29'), false)
  assert.equal(fechaCalendarioValida('0000-01-01'), false)
})

test('los días calendario no se desplazan; hoy se calcula en Argentina', () => {
  assert.equal(fechaAccionLegible('2026-11-06'), '6 de noviembre de 2026')
  assert.equal(hoyArgentina(new Date('2026-11-07T02:59:59Z')), '2026-11-06')
  assert.equal(hoyArgentina(new Date('2026-11-07T03:00:00Z')), '2026-11-07')
})

test('permisos independientes, plataforma de solo lectura y clientes archivados', () => {
  assert.deepEqual(permisosAcciones(cuentaAcciones, cliente), { ver: true, crear: true, editar: true, eliminar: true })
  for (const cuenta of [cuentaAcciones, { ...cuentaAcciones, roles: ['PROPIETARIO'] },
    { ...cuentaAcciones, roles: [] }]) assert.equal(permisosAcciones(cuenta, cliente).crear, true)
  assert.deepEqual(permisosAcciones({ ...cuentaAcciones, permisos: ['ACCIONES_EDITAR'] }, cliente),
    { ver: false, crear: false, editar: true, eliminar: false })
  for (const [cuenta, recurso] of [
    [{ ...cuentaAcciones, tipoCuenta: 'PLATAFORMA', roles: ['SYSADMIN'] }, cliente],
    [cuentaAcciones, { ...cliente, estado: 'ARCHIVADO' }], [cuentaAcciones, null],
  ]) assert.deepEqual(permisosAcciones(cuenta, recurso), { ver: true, crear: false, editar: false, eliminar: false })
})

test('agrupación estable y enlaces externos protegidos', () => {
  const grupos = agruparAccionesPorDia(acciones)
  assert.deepEqual(grupos.get('2026-11-03'), acciones.slice(0, 2))
  const gestion = { permisos: { editar: false, eliminar: false }, guardando: false }
  const html = renderToStaticMarkup(createElement(ListaAccionesCliente, { acciones: [acciones[0],
    { ...acciones[1], url: 'javascript:alert(1)' }], gestion }))
  assert.match(html, /target="_blank" rel="noopener noreferrer"/)
  assert.doesNotMatch(html, /javascript:|Editar|Eliminar/)
})

for (const estado of [400, 403, 404, 409]) {
  test(`acciones: rechazo ${estado} muestra detail y conserva el estado HTTP`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ detail: 'Motivo del servidor' },
      { status: estado, headers: { 'Content-Type': 'application/problem+json' } }))
    await assert.rejects(api.acciones.editar(clienteUuid, acciones[0].uuid, datos),
      (error) => error instanceof ErrorApi && error.estado === estado && error.message === 'Motivo del servidor')
  })
}
