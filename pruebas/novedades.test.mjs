import { test } from 'node:test'
import assert from 'node:assert/strict'
import { novedades, obtenerNovedadesVigentes } from '../src/datos/novedades.ts'
import { cuenta } from './datos.mjs'

const publicacion = Date.parse('2026-11-04T00:00:00-03:00')
const expiracion = Date.parse('2026-11-11T00:00:00-03:00')
const lectora = { ...cuenta, permisos: ['CONSULTAS_VER'] }
const editora = { ...cuenta, permisos: ['CONSULTAS_VER', 'CONSULTAS_EDITAR', 'ANALISIS_SEMANALES_VER'] }

test('cada novedad está vigente una semana desde su publicación', () => {
  const nuevaPublicacion = Date.parse('2026-11-06T00:00:00-03:00')
  const nuevaExpiracion = Date.parse('2026-11-13T00:00:00-03:00')
  assert.equal(obtenerNovedadesVigentes(editora, publicacion - 1).length, 0)
  assert.equal(obtenerNovedadesVigentes(editora, publicacion).length, 5)
  assert.equal(obtenerNovedadesVigentes(editora, nuevaPublicacion).length, 6)
  assert.equal(obtenerNovedadesVigentes(editora, expiracion - 1).length, 6)
  assert.deepEqual(obtenerNovedadesVigentes(editora, expiracion).map((n) => n.id), ['contexto-agente-analisis-semanal'])
  assert.equal(obtenerNovedadesVigentes(editora, nuevaExpiracion).length, 0)
  for (const novedad of novedades) {
    assert.equal(Date.parse(novedad.expiraEn) - Date.parse(novedad.publicadaEn), 7 * 24 * 60 * 60 * 1000)
  }
})

test('las novedades respetan los permisos y el tipo de cuenta', () => {
  assert.equal(obtenerNovedadesVigentes({ ...cuenta, permisos: [] }, publicacion).length, 0)
  assert.deepEqual(obtenerNovedadesVigentes(lectora, publicacion).map((n) => n.id),
    ['reconocimiento-competidores-dominios-citas', 'consultas-informes-con-sin-marca'])
  assert.deepEqual(obtenerNovedadesVigentes({ ...cuenta, permisos: ['ANALISIS_SEMANALES_VER'] }, publicacion).map((n) => n.id),
    ['competidores-detectados-informe-semanal', 'consultas-informes-con-sin-marca'])
  assert.deepEqual(obtenerNovedadesVigentes({ ...cuenta, permisos: ['CONSULTAS_EDITAR'] }, publicacion).map((n) => n.id),
    ['corregir-clasificacion-consulta', 'editar-consultas-borrador'])
  assert.deepEqual(obtenerNovedadesVigentes({ ...editora, tipoCuenta: 'PLATAFORMA', organizacionUuid: null }, publicacion).map((n) => n.id),
    ['reconocimiento-competidores-dominios-citas', 'competidores-detectados-informe-semanal', 'consultas-informes-con-sin-marca'])
  assert.equal(obtenerNovedadesVigentes({ ...cuenta, permisos: ['CONSULTAS_CAMBIAR_TIPO'] }, publicacion).length, 0)
  const hoy = Date.parse('2026-11-06T12:00:00-03:00')
  assert.equal(obtenerNovedadesVigentes({ ...cuenta, permisos: ['ANALISIS_SEMANALES_VER'] }, hoy)[0].id,
    'contexto-agente-analisis-semanal')
  assert.equal(obtenerNovedadesVigentes(lectora, hoy).some((n) => n.id === 'contexto-agente-analisis-semanal'), false)
})

test('el catálogo agrega la mejora del agente semanal y conserva las novedades anteriores', () => {
  assert.deepEqual(novedades.map((n) => n.id), [
    'contexto-agente-analisis-semanal',
    'reconocimiento-competidores-dominios-citas',
    'competidores-detectados-informe-semanal',
    'consultas-informes-con-sin-marca',
    'corregir-clasificacion-consulta',
    'editar-consultas-borrador',
  ])
  const competidores = novedades.find((n) => n.id === 'reconocimiento-competidores-dominios-citas')
  assert.equal(competidores.titulo, 'Mejor reconocimiento de competidores')
  assert.match(competidores.descripcion, /nombre, dominio y subdominio/)
  assert.match(competidores.descripcion, /fuentes citadas también cuentan en sus métricas/)
  assert.match(competidores.descripcion, /resultados anteriores se conservan/)
  assert.equal(obtenerNovedadesVigentes(lectora, Date.parse('2026-11-02T12:00:00-03:00')).length, 0)
})

// Verifica orden y fechas inválidas con datos independientes de las publicaciones actuales.
test('admite anuncios generales, ordena los vigentes y descarta fechas inválidas o intervalos vacíos', () => {
  const anuncio = { id: 'general', titulo: 'Mejora', descripcion: 'Descripción',
    publicadaEn: '2026-11-02T00:00:00-03:00', expiraEn: '2026-11-04T00:00:00-03:00' }
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
