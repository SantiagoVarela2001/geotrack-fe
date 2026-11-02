import { test } from 'node:test'
import assert from 'node:assert/strict'
import { novedades, obtenerNovedadesVigentes } from '../src/datos/novedades.ts'
import { cuenta } from './datos.mjs'

const publicacion = Date.parse('2026-11-02T00:00:00-03:00')
const expiracion = Date.parse('2026-11-04T00:00:00-03:00')
const editora = { ...cuenta, permisos: ['CONSULTAS_VER', 'CONSULTAS_EDITAR', 'ANALISIS_SEMANALES_VER'] }

test('las novedades se publican en el instante indicado y desaparecen al cumplir 48 horas', () => {
  assert.equal(obtenerNovedadesVigentes(editora, publicacion - 1).length, 0)
  assert.equal(obtenerNovedadesVigentes(editora, publicacion).length, 4)
  assert.equal(obtenerNovedadesVigentes(editora, expiracion - 1).length, 4)
  assert.equal(obtenerNovedadesVigentes(editora, expiracion).length, 0)
  assert.equal(expiracion - publicacion, 48 * 60 * 60 * 1000)
})

test('las novedades de edición respetan permisos y tipo de cuenta', () => {
  assert.equal(obtenerNovedadesVigentes({ ...cuenta, permisos: [] }, publicacion).length, 0)
  assert.deepEqual(obtenerNovedadesVigentes({ ...cuenta, permisos: ['CONSULTAS_VER'] }, publicacion).map((n) => n.id),
    ['consultas-informes-con-sin-marca'])
  assert.deepEqual(obtenerNovedadesVigentes({ ...cuenta, permisos: ['ANALISIS_SEMANALES_VER'] }, publicacion).map((n) => n.id),
    ['competidores-detectados-informe-semanal', 'consultas-informes-con-sin-marca'])
  assert.equal(obtenerNovedadesVigentes({ ...editora, tipoCuenta: 'PLATAFORMA', organizacionUuid: null }, publicacion).length, 2)
  assert.equal(obtenerNovedadesVigentes({ ...cuenta, permisos: ['CONSULTAS_CAMBIAR_TIPO'] }, publicacion).length, 0)
})

test('admite anuncios generales, ordena los vigentes y descarta fechas inválidas o intervalos vacíos', () => {
  const anuncio = { id: 'general', titulo: 'Mejora', descripcion: 'Descripción',
    publicadaEn: novedades[0].publicadaEn, expiraEn: novedades[0].expiraEn }
  const recientes = { ...anuncio, id: 'reciente', publicadaEn: '2026-11-03T00:00:00-03:00' }
  const listado = [anuncio, recientes,
    { ...anuncio, id: 'sin-fecha', publicadaEn: 'incorrecta' },
    { ...anuncio, id: 'sin-vencimiento', expiraEn: 'incorrecta' },
    { ...anuncio, id: 'vacio', expiraEn: anuncio.publicadaEn },
    { ...anuncio, id: 'invertido', expiraEn: '2026-11-01T00:00:00-03:00' }]
  assert.deepEqual(obtenerNovedadesVigentes({ ...cuenta, permisos: [] }, Date.parse(recientes.publicadaEn), listado)
    .map((n) => n.id), ['reciente', 'general'])
  assert.equal(listado[0], anuncio)
})
