export const clienteUuid = '11111111-1111-4111-8111-111111111111'
export const temaUuid = '22222222-2222-4222-8222-222222222222'
export const otroTemaUuid = '33333333-3333-4333-8333-333333333333'
export const consultaUuid = '44444444-4444-4444-8444-444444444444'
export const ejecucionUuid = '55555555-5555-4555-8555-555555555555'
export const analisisUuid = '66666666-6666-4666-8666-666666666666'
export const cuenta = {
  usuario: 'miembro@ejemplo.test', tipoCuenta: 'ORGANIZACION', organizacionUuid: 'organizacion',
  nombreOrganizacion: 'Agencia', logoUrl: null, roles: ['MIEMBRO'],
  permisos: ['CLIENTES_VER', 'TEMAS_VER', 'CONSULTAS_VER', 'CONSULTAS_CREAR', 'CONSULTAS_EDITAR',
    'CONSULTAS_CAMBIAR_TIPO', 'CONSULTAS_APROBAR', 'ANALISIS_SEMANALES_VER', 'ANALISIS_SEMANALES_CREAR'],
}
export const cliente = {
  uuid: clienteUuid, organizacionUuid: 'organizacion', nombre: 'Cliente FINMI', nombreMarca: 'FINMI',
  sitioWeb: 'https://finmi.example', descripcion: null, rubro: 'Agencia', pais: 'AR', idioma: 'es-AR',
  estado: 'ACTIVO', competidores: [],
}
export const consulta = {
  uuid: consultaUuid, clienteUuid, temaUuid, texto: 'Pregunta histórica', tipoConsulta: 'REFERENCIA',
  estadoConsulta: 'BORRADOR', prioridad: 'MEDIA', conMarca: false,
}
export const temas = [
  { uuid: temaUuid, clienteUuid, nombre: 'Tema original' },
  { uuid: otroTemaUuid, clienteUuid, nombre: 'Otro tema' },
]
export const generacion = {
  procesoUuid: '77777777-7777-4777-8777-777777777777', estado: 'FINALIZADO', mensaje: null,
  advertencia: null, temas, consultas: [consulta],
}
export function grupo(cambios = {}) {
  return {
    ejecuciones: 0, analizadas: 0, pendientes: 0, fallidas: 0, canceladas: 0,
    mencionesMarca: 0, tasaMencionMarca: null, conCitas: 0, tasaCitas: null,
    conCitasSitioCliente: 0, tasaCitasSitioCliente: null, serieDiaria: [], competidores: [],
    consultasMencionadas: [], ...cambios,
  }
}
export function dia(fecha, cambios = {}) {
  const { serieDiaria: _serie, competidores: _competidores, consultasMencionadas: _consultas, ...conteos } = grupo(cambios)
  return { ...conteos, dia: fecha, modelosAnalizados: {} }
}
const ranking = [{ consultaUuid, textoConsulta: 'Pregunta histórica', mencionesMarca: 1 }]
export const metricas = {
  clienteUuid, desde: '2026-11-01', hasta: '2026-11-03',
  sinMarca: grupo({ ejecuciones: 7, analizadas: 4, pendientes: 1, fallidas: 1, canceladas: 1,
    mencionesMarca: 1, tasaMencionMarca: 25, consultasMencionadas: ranking,
    serieDiaria: [dia('2026-11-01', { ejecuciones: 4, analizadas: 4, mencionesMarca: 1, tasaMencionMarca: 25 }),
      dia('2026-11-03', { ejecuciones: 3, pendientes: 1, fallidas: 1, canceladas: 1 })],
    competidores: [{ competidorUuid: 'competidor', nombre: 'Competidor', evaluaciones: 2, menciones: 1, tasaMencion: 50 }],
  }),
  conMarca: grupo({ ejecuciones: 1, analizadas: 1, mencionesMarca: 1, tasaMencionMarca: 100,
    consultasMencionadas: ranking, serieDiaria: [dia('2026-11-02', {
      ejecuciones: 1, analizadas: 1, mencionesMarca: 1, tasaMencionMarca: 100,
    })],
  }),
}
export const informeAnterior = {
  resumen: 'Resumen anterior combinado',
  hallazgos: [{ descripcion: 'Hallazgo anterior', ejecuciones: [ejecucionUuid] }],
  recomendaciones: [{ titulo: 'Acción anterior', accion: 'Publicar contenido', prioridad: 'MEDIA', ejecuciones: [ejecucionUuid] }],
}
export const informeSeparado = {
  sinMarca: { ...informeAnterior, resumen: 'Resumen de presencia espontánea' },
  conMarca: { resumen: 'No hay respuestas analizadas en este grupo durante el período.', hallazgos: [], recomendaciones: [] },
}
export const analisis = {
  uuid: analisisUuid, clienteUuid, desde: '2026-11-01', hasta: '2026-11-07', estado: 'FINALIZADO',
  fechaInicio: '2026-11-07T18:00:00Z', fechaFin: '2026-11-07T18:01:00Z', intentos: 1,
  mensaje: null, informe: informeSeparado,
}
export const ejecucion = {
  uuid: ejecucionUuid, consultaUuid, clienteUuid, estado: 'FINALIZADO', textoConsulta: 'Texto histórico de evidencia',
  tipoConsulta: 'REFERENCIA', nombreTema: 'Tema histórico', proveedor: 'OpenAI', modelo: 'modelo',
  fechaInicio: '2026-11-01T18:00:00Z', fechaFin: '2026-11-01T18:00:01Z', duracionMs: 1000,
  respuestaTexto: 'Respuesta conservada de la ejecución', cantidadBusquedas: 0, cantidadLlamadasWeb: 0,
  mensaje: null, citas: [], estadoNormalizacion: 'NO_REALIZADA', mensajeNormalizacion: null,
  resultadoNormalizado: null,
}
