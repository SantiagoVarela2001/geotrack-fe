import { test } from 'node:test'
import assert from 'node:assert/strict'
import { abrirNavegador, buscarNavegador } from './navegador.mjs'
import * as datos from './datos.mjs'

function instalarApi(datos) {
  const nativo = window.fetch
  const estado = window.__prueba = {
    ...datos, consultas: datos.consultasIniciales ?? [datos.consulta], peticiones: [], errorMarca: 0, errorEdicion: 0,
    estadoGeneracion: datos.estadoGeneracion ?? 'FINALIZADO', sondeosGeneracion: 0, informeActual: datos.analisis,
    informeFinal: datos.analisis, sondeosAnalisis: 0, errorMetricas: 0,
  }
  if (datos.ahoraNovedades !== undefined) Date.now = () => estado.ahoraNovedades
  window.fetch = async (entrada, opciones = {}) => {
    const ruta = String(entrada)
    if (!ruta.startsWith('/api/')) return nativo(entrada, opciones)
    const metodo = opciones.method ?? 'GET'
    const cuerpo = opciones.body ? JSON.parse(opciones.body) : undefined
    estado.peticiones.push({ ruta, metodo, cuerpo })
    const responder = (valor, status = 200) => new Response(JSON.stringify(valor), { status, headers: { 'Content-Type': 'application/json' } })
    const problema = (status) => new Response(JSON.stringify({ detail: `Rechazo ${status} del servidor` }), { status, headers: { 'Content-Type': 'application/problem+json' } })
    if (ruta === '/api/autenticacion/renovar') return responder({ tokenAcceso: 'token-de-prueba', tipoToken: 'Bearer' })
    if (ruta === '/api/autenticacion/actual') return responder(estado.cuenta)
    if (ruta.endsWith('/logo')) return new Response(null, { status: 404 })
    if (ruta.endsWith('/consultas/generacion')) {
      estado.sondeosGeneracion++
      if (estado.demoraGeneracion) await new Promise((resolver) => setTimeout(resolver, estado.demoraGeneracion))
      return responder({ ...estado.generacion, estado: estado.estadoGeneracion, consultas: estado.consultas })
    }
    if (ruta.endsWith('/consultas/por-tema')) return responder(estado.temas.map((tema) => ({
      ...tema, consultas: estado.consultas.filter((consulta) => consulta.temaUuid === tema.uuid)
        .map((consulta) => ({ ...consulta, ejecucionHoy: consulta.ejecucionHoy ?? null })),
    })))
    if (ruta.endsWith('/temas')) return responder(estado.temas)
    if (ruta.includes('/metricas?')) return estado.errorMetricas ? problema(estado.errorMetricas) : responder(estado.metricas)
    if (ruta.endsWith('/marca') && metodo === 'PATCH') {
      if (estado.errorMarca) return problema(estado.errorMarca)
      const uuid = ruta.split('/').at(-2)
      const consulta = estado.consultas.find((consulta) => consulta.uuid === uuid)
      Object.assign(consulta, cuerpo)
      return responder(consulta)
    }
    if (ruta.endsWith('/consultas') && metodo === 'POST') {
      const nuevas = cuerpo.map((consulta, indice) => ({ ...estado.consulta, ...consulta,
        uuid: `88888888-8888-4888-8888-88888888888${indice}`, estadoConsulta: 'BORRADOR' }))
      estado.consultas.push(...nuevas)
      return responder(nuevas, 201)
    }
    if (ruta.includes('/consultas/') && metodo === 'PUT') {
      if (estado.errorEdicion) return problema(estado.errorEdicion)
      const consulta = estado.consultas.find((consulta) => consulta.uuid === ruta.split('/').at(-1))
      Object.assign(consulta, cuerpo)
      return responder(consulta)
    }
    if (ruta.includes('/analisis-semanales')) {
      if (metodo === 'POST') {
        estado.informeActual = { ...estado.informeFinal, estado: 'PENDIENTE', informe: null }
        return responder(estado.informeActual, 202)
      }
      if (ruta.includes('?pagina=')) return responder({ content: [estado.informeActual, {
        ...estado.analisis, uuid: '99999999-9999-4999-8999-999999999999', informe: estado.informeAnterior,
      }], number: 0, totalPages: 1, totalElements: 2 })
      if (ruta.endsWith('99999999-9999-4999-8999-999999999999')) return responder({ ...estado.analisis, informe: estado.informeAnterior })
      if (!ruta.endsWith('/ultimo') && estado.informeActual.estado === 'PENDIENTE') {
        estado.sondeosAnalisis++
        estado.informeActual = estado.informeFinal
      }
      return responder(estado.informeActual)
    }
    if (ruta.includes('/ejecuciones/')) return responder(estado.ejecucion)
    if (ruta.includes('/consultas/')) return responder(estado.consultas.find((consulta) => ruta.endsWith(consulta.uuid)))
    if (ruta === `/api/clientes-monitoreados/${estado.clienteUuid}`) return responder(estado.cliente)
    return problema(404)
  }
  // Conserva el comportamiento de polling, acelerando únicamente su espera en las pruebas.
  const intervalo = window.setInterval.bind(window)
  const temporizador = window.setTimeout.bind(window)
  window.setInterval = (accion, ms, ...argumentos) => intervalo(accion, ms === 3000 ? 100 : ms, ...argumentos)
  window.setTimeout = (accion, ms, ...argumentos) => temporizador(accion, ms === 3000 ? 100 : ms, ...argumentos)
}

const cargar = (navegador, ruta, cambios = {}) => navegador.preparar(
  `(${instalarApi.toString()})(${JSON.stringify({ ...datos, ...cambios })})`, ruta)
const pulsar = (texto) => `(() => { const boton = [...document.querySelectorAll('button')].find((boton) => boton.textContent.trim() === ${JSON.stringify(texto)}); if (!boton) throw Error('Falta el botón'); boton.click(); })()`
const cambiar = (selector, valor) => `(() => { const campo = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(Object.getPrototypeOf(campo), 'value').set.call(campo, ${JSON.stringify(valor)}); campo.dispatchEvent(new Event(campo.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`
const textoIncluye = (texto) => `document.body.innerText.includes(${JSON.stringify(texto)})`

const ejecutable = await buscarNavegador()
test('interacciones F02 en navegador real', { skip: !ejecutable && 'Configurar NAVEGADOR_PRUEBAS con Chrome, Edge o Chromium', timeout: 90000 }, async (t) => {
  const navegador = await abrirNavegador(ejecutable)
  t.after(() => navegador.cerrar())

  await t.test('novedades: lectura, foco, reapertura y vencimiento con la aplicación abierta', async () => {
    await cargar(navegador, `/clientes/${datos.clienteUuid}`, {
      ahoraNovedades: Date.parse('2026-11-02T12:00:00-03:00'),
      cuenta: { ...datos.cuenta, permisos: [...datos.cuenta.permisos, 'CONSULTAS_EDITAR'] },
    })
    await navegador.esperar(`document.querySelector('.novedades-flotante') !== null`)
    await navegador.evaluar(`document.querySelector('.novedades-flotante').focus(); document.querySelector('.novedades-flotante').click()`)
    await navegador.esperar(`document.querySelector('.dialogo-novedades[open]') !== null`)
    assert.equal(await navegador.evaluar(`document.querySelectorAll('.novedad').length`), 3)
    assert.equal(await navegador.evaluar(`document.activeElement.getAttribute('aria-label')`), 'Cerrar novedades')
    await navegador.evaluar(pulsar('Entendido'))
    await navegador.esperar(`document.querySelector('.dialogo-novedades') === null`)
    assert.equal(await navegador.evaluar(`document.activeElement.classList.contains('novedades-flotante')`), true)
    await navegador.evaluar(`document.querySelector('.novedades-flotante').click()`)
    await navegador.esperar(`document.querySelector('.dialogo-novedades[open]') !== null`)
    await navegador.evaluar(`document.querySelector('.dialogo-novedades').dispatchEvent(new Event('cancel', { cancelable: true }))`)
    await navegador.esperar(`document.querySelector('.dialogo-novedades') === null`)
    await navegador.evaluar(`document.querySelector('.novedades-flotante').click()`)
    await navegador.esperar(`document.querySelector('.dialogo-novedades[open]') !== null`)
    await navegador.ajustarPantalla(1440, 1000)
    await navegador.capturar('novedades-escritorio.png')
    await navegador.ajustarPantalla(390, 844)
    assert.equal(await navegador.evaluar(`document.documentElement.scrollWidth <= window.innerWidth`), true)
    assert.equal(await navegador.evaluar(`document.querySelector('.dialogo-novedades').getBoundingClientRect().height <= window.innerHeight`), true)
    await navegador.capturar('novedades-movil.png')
    // Acerca el vencimiento y deja avanzar el reloj: el temporizador debe cerrar sin recargar ni cambiar el foco.
    await navegador.evaluar(`(() => {
      const inicio = performance.now();
      Date.now = () => Date.parse('2026-11-04T00:00:00-03:00') - 300 + performance.now() - inicio;
      window.dispatchEvent(new Event('focus'));
    })()`)
    await navegador.esperar(`document.querySelector('.novedades-flotante') === null && document.querySelector('.dialogo-novedades') === null`)
  })

  await t.test('aprobada: PATCH, errores sin cambio visual y restricciones de edición', async () => {
    await cargar(navegador, `/clientes/${datos.clienteUuid}`, { consulta: { ...datos.consulta, estadoConsulta: 'APROBADA' } })
    await navegador.esperar(`document.querySelector('.consulta-fila') !== null`)
    assert.equal(await navegador.evaluar(`document.querySelector('.consulta-accion-principal')?.textContent.trim()`), 'Ver detalle')
    await navegador.evaluar(`document.querySelector('[aria-label^="Más acciones de la consulta"]').click()`)
    await navegador.evaluar(`document.querySelector('[aria-label^="Corregir clasificación"]').click()`)
    await navegador.esperar(`document.querySelector('dialog[open]') !== null`)
    await navegador.evaluar(cambiar('dialog[open] select', 'conMarca'))
    await navegador.evaluar('window.__prueba.errorMarca = 409')
    await navegador.evaluar(pulsar('Guardar clasificación'))
    await navegador.esperar(textoIncluye('Rechazo 409 del servidor'))
    assert.equal(await navegador.evaluar(`document.querySelector('.consulta-clasificacion').textContent`), 'Sin marca')
    await navegador.evaluar('window.__prueba.errorMarca = 0')
    await navegador.evaluar(pulsar('Guardar clasificación'))
    await navegador.esperar(`!document.querySelector('dialog[open]') && document.querySelector('.consulta-clasificacion').textContent === 'Con marca'`)
    const peticiones = await navegador.evaluar(`window.__prueba.peticiones.filter((p) => p.ruta.endsWith('/marca'))`)
    assert.equal(peticiones.length, 2)
    assert.ok(peticiones.every((p) => p.metodo === 'PATCH' && p.cuerpo.conMarca === true))
    assert.equal(await navegador.evaluar(`window.__prueba.peticiones.some((p) => p.metodo === 'PUT')`), false)
  })

  await t.test('consultas ordenadas: acciones contextuales, menú con teclado, temas plegables y selección por lote', async () => {
    const consultasIniciales = [
      { ...datos.consulta, texto: '¿Qué agencia recomendás para hacer crecer una pyme?', tipoConsulta: 'DESCUBRIMIENTO' },
      { ...datos.consulta, uuid: '88888888-8888-4888-8888-888888888881', texto: '¿Cuáles son las mejores agencias de marketing en Argentina?',
        estadoConsulta: 'APROBADA', prioridad: 'ALTA', ejecucionHoy: { uuid: datos.ejecucionUuid, estadoEjecucion: 'FINALIZADO', estadoNormalizacion: 'FINALIZADA' } },
      { ...datos.consulta, uuid: '88888888-8888-4888-8888-888888888882', texto: '¿Qué servicios ofrece FINMI para empresas?',
        estadoConsulta: 'APROBADA', conMarca: true, ejecucionHoy: { uuid: datos.ejecucionUuid, estadoEjecucion: 'FINALIZADO', estadoNormalizacion: 'FALLIDA' } },
      { ...datos.consulta, uuid: '88888888-8888-4888-8888-888888888883', temaUuid: datos.otroTemaUuid,
        texto: '¿Cómo elegir una agencia para una tienda online?', estadoConsulta: 'APROBADA', tipoConsulta: 'DESCUBRIMIENTO', prioridad: 'ALTA' },
      { ...datos.consulta, uuid: '88888888-8888-4888-8888-888888888884', temaUuid: datos.otroTemaUuid,
        texto: '¿Qué diferencia a FINMI de otras agencias?', conMarca: true, prioridad: 'BAJA' },
    ]
    await cargar(navegador, `/clientes/${datos.clienteUuid}`, {
      consultasIniciales,
      temas: [{ ...datos.temas[0], nombre: 'Recomendaciones y presencia de marca' }, { ...datos.temas[1], nombre: 'Decisiones de compra' }],
      cuenta: { ...datos.cuenta, permisos: [...datos.cuenta.permisos, 'CONSULTAS_EJECUTAR'] },
    })
    await navegador.esperar(`document.querySelectorAll('.consulta-fila').length === 5`)
    assert.deepEqual(await navegador.evaluar(`[...document.querySelectorAll('.consulta-accion-principal')].map((b) => b.textContent.trim())`),
      ['Editar', 'Ver resultado', 'Ver error', 'Ejecutar', 'Editar'])
    assert.equal(await navegador.evaluar(`document.querySelector('.acciones-lote') === null`), true)
    await navegador.evaluar(`document.querySelector('.consulta-menu-boton').click()`)
    await navegador.esperar(`document.querySelector('[role="menu"]') !== null`)
    assert.equal(await navegador.evaluar(`document.querySelectorAll('.consulta-seleccion input:checked').length`), 0)
    await navegador.evaluar(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))`)
    assert.equal(await navegador.evaluar(`document.activeElement.textContent`), 'Corregir clasificación')
    await navegador.evaluar(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
    await navegador.esperar(`!document.querySelector('[role="menu"]')`)
    assert.equal(await navegador.evaluar(`document.activeElement.classList.contains('consulta-menu-boton')`), true)
    await navegador.evaluar(`document.querySelector('.consulta-seleccion input').click()`)
    await navegador.esperar(`document.querySelector('.acciones-lote') !== null`)
    await navegador.evaluar(`document.querySelector('.grupo-consultas-alternar').click()`)
    await navegador.esperar(`document.querySelector('.grupo-consultas-alternar').getAttribute('aria-expanded') === 'false'`)
    assert.equal(await navegador.evaluar(`document.getElementById(document.querySelector('.grupo-consultas-alternar').getAttribute('aria-controls')).hidden`), true)
    assert.match(await navegador.evaluar(`document.querySelector('.grupo-consultas-cabecera').innerText`), /1 con fallo hoy/)
    assert.match(await navegador.evaluar(`document.querySelector('.grupo-consultas-cabecera').innerText`), /1 seleccionada/)
    await navegador.evaluar(`document.querySelector('.grupo-consultas-alternar').click()`)
    await navegador.evaluar(`document.querySelector('.consulta-seleccion input').click()`)
    await navegador.esperar(`document.querySelector('.acciones-lote') === null`)
    await navegador.ajustarPantalla(1440, 1100)
    await navegador.evaluar(`document.querySelector('.consultas-panel').scrollIntoView({ block: 'start' }); window.scrollBy(0, -20)`)
    await navegador.capturar('consultas-ordenadas-escritorio.png')
    await navegador.ajustarPantalla(390, 1000)
    await navegador.evaluar(`document.querySelector('.consultas-panel').scrollIntoView({ block: 'start' }); window.scrollBy(0, -20)`)
    await navegador.esperar(`document.documentElement.scrollWidth <= window.innerWidth`)
    await navegador.capturar('consultas-ordenadas-movil.png')
    await navegador.evaluar(`document.querySelector('.consulta-menu-boton').click()`)
    await navegador.esperar(`document.querySelector('[role="menu"]') !== null`)
    assert.equal(await navegador.evaluar(`(() => { const r = document.querySelector('[role="menu"]').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth })()`), true)
    await navegador.evaluar(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`)
    await navegador.esperar(`!document.querySelector('[role="menu"]')`)
    await navegador.ajustarPantalla(1280, 1000)
  })

  await t.test('alta sin valor inicial, false explícito y edición conservando clasificación con cambio de tema', async () => {
    await cargar(navegador, `/clientes/${datos.clienteUuid}/temas/${datos.temaUuid}`)
    await navegador.esperar(textoIncluye('Agregar consultas'))
    await navegador.evaluar(pulsar('Agregar consultas'))
    assert.equal(await navegador.evaluar(`document.querySelector('.fila-consulta-formulario select').value`), '')
    await navegador.evaluar(cambiar('.fila-consulta-formulario textarea', 'Consulta manual sin marca'))
    await navegador.evaluar(`document.querySelector('.formulario-consultas').requestSubmit()`)
    assert.equal(await navegador.evaluar(`window.__prueba.peticiones.filter((p) => p.metodo === 'POST' && p.ruta.endsWith('/consultas')).length`), 0)
    await navegador.evaluar(cambiar('.fila-consulta-formulario select', 'sinMarca'))
    await navegador.evaluar(pulsar('Guardar lote'))
    await navegador.esperar(`document.querySelectorAll('.consulta-fila').length === 2`)
    assert.equal(await navegador.evaluar(`window.__prueba.peticiones.find((p) => p.metodo === 'POST' && p.ruta.endsWith('/consultas')).cuerpo[0].conMarca`), false)
    await navegador.evaluar(`document.querySelector('[aria-label="Editar consulta 1"]').click()`)
    await navegador.esperar(`document.querySelector('dialog[open]') !== null`)
    assert.equal(await navegador.evaluar(`document.querySelector('dialog[open] select:last-of-type') !== null`), true)
    await navegador.evaluar(cambiar('dialog[open] textarea', 'Texto editado'))
    await navegador.evaluar(cambiar('dialog[open] select', datos.otroTemaUuid))
    await navegador.evaluar('window.__prueba.errorEdicion = 400')
    await navegador.evaluar(pulsar('Guardar cambios'))
    await navegador.esperar(textoIncluye('Rechazo 400 del servidor'))
    assert.equal(await navegador.evaluar(`document.querySelector('dialog[open] textarea').value`), 'Texto editado')
    await navegador.evaluar('window.__prueba.errorEdicion = 0')
    await navegador.evaluar(pulsar('Guardar cambios'))
    await navegador.esperar(`!document.querySelector('dialog[open]') && document.querySelectorAll('.consulta-fila').length === 1`)
    assert.equal(await navegador.evaluar(`window.__prueba.peticiones.findLast((p) => p.metodo === 'PUT').cuerpo.conMarca`), false)
    await navegador.evaluar(`location.hash = '/clientes/${datos.clienteUuid}'`)
    await navegador.esperar(textoIncluye('Texto editado'))
    assert.equal(await navegador.evaluar(`document.querySelectorAll('.consulta-fila').length`), 2)
  })

  await t.test('recuperación de generación y polling conservan la clasificación sin reclasificar texto', async () => {
    await cargar(navegador, `/clientes/${datos.clienteUuid}`, {
      estadoGeneracion: 'PROCESANDO', demoraGeneracion: 250,
      consulta: { ...datos.consulta, texto: 'Pregunta sobre FINMI recibida sin marca', conMarca: false },
    })
    await navegador.esperar(textoIncluye('Cargando cliente y estado de generación'))
    assert.equal(await navegador.evaluar(`document.querySelector('.consulta-fila') === null`), true)
    await navegador.esperar(textoIncluye('La IA está preparando las consultas'))
    await navegador.evaluar(`window.__prueba.estadoGeneracion = 'FINALIZADO'`)
    await navegador.esperar(`!document.querySelector('.generacion-panel') && document.querySelector('.consulta-clasificacion')?.textContent === 'Sin marca'`)
    assert.ok(await navegador.evaluar(`window.__prueba.sondeosGeneracion >= 2`))
    const sondeos = await navegador.evaluar(`window.__prueba.sondeosGeneracion`)
    await navegador.evaluar(`new Promise((resolver) => setTimeout(resolver, 350))`)
    assert.equal(await navegador.evaluar(`window.__prueba.sondeosGeneracion`), sondeos)
  })

  await t.test('SYSADMIN, permiso de tipo solo y cliente archivado no pueden corregir', async () => {
    for (const cambios of [
      { cuenta: { ...datos.cuenta, tipoCuenta: 'PLATAFORMA', roles: ['SYSADMIN'] } },
      { cuenta: { ...datos.cuenta, permisos: datos.cuenta.permisos.filter((p) => p !== 'CONSULTAS_EDITAR') } },
      { cliente: { ...datos.cliente, estado: 'ARCHIVADO' } },
    ]) {
      await cargar(navegador, `/clientes/${datos.clienteUuid}`, cambios)
      await navegador.esperar(`document.querySelector('.consulta-fila') !== null`)
      await navegador.evaluar(`document.querySelector('[aria-label^="Más acciones de la consulta"]')?.click()`)
      assert.equal(await navegador.evaluar(`document.querySelector('[aria-label^="Corregir clasificación"]') === null`), true)
    }
  })

  await t.test('métricas mixtas, una lectura inicial, competencia diaria compartida y PDF separado', async () => {
    await cargar(navegador, `/clientes/${datos.clienteUuid}/metricas`)
    await navegador.esperar(`document.querySelectorAll('.metricas-grupo').length === 2`)
    const grupos = await navegador.evaluar(`[...document.querySelectorAll('.metricas-grupo')].map((grupo) => grupo.innerText)`)
    assert.match(grupos[0], /25 %/)
    assert.match(grupos[1], /100 %/)
    assert.equal(await navegador.evaluar(`window.__prueba.peticiones.filter((p) => p.ruta.includes('/metricas?')).length`), 1)
    await navegador.ajustarPantalla(1280, 1000)
    await navegador.capturar('f02-metricas.png')
    await navegador.ajustarPantalla(390, 844)
    await navegador.esperar(`document.documentElement.scrollWidth <= window.innerWidth`)
    await navegador.capturar('f02-metricas-movil.png')
    await navegador.ajustarPantalla(1280, 1000)
    await navegador.evaluar(pulsar('Crear informe'))
    await navegador.esperar(`document.querySelectorAll('.informe-imprimible .informe-grupo').length === 2`)
    const pdf = await navegador.evaluar(`[...document.querySelectorAll('.informe-imprimible .informe-grupo')].map((g) => g.textContent)`)
    assert.match(pdf[0], /25 %/)
    assert.match(pdf[1], /100 %/)
    await navegador.evaluar(`document.querySelector('[role="slider"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))`)
    await navegador.esperar(`window.__prueba.peticiones.filter((p) => p.ruta.includes('/metricas?')).length === 2`)
    assert.equal(await navegador.evaluar(`window.__prueba.peticiones.filter((p) => p.ruta.includes('/metricas?')).at(-1).ruta.includes('desde=2026-11-01&hasta=2026-11-01')`), true)
  })

  await t.test('errores de métricas muestran detail y el reintento conserva los grupos', async () => {
    await cargar(navegador, `/clientes/${datos.clienteUuid}/metricas`)
    // El error se activa antes de solicitar otro período, conservando el flujo real del formulario.
    await navegador.esperar(`document.querySelectorAll('.metricas-grupo').length === 2`)
    await navegador.evaluar(`window.__prueba.errorMetricas = 409`)
    await navegador.evaluar(pulsar('Último año'))
    await navegador.esperar(textoIncluye('Rechazo 409 del servidor'))
    assert.equal(await navegador.evaluar(`document.querySelectorAll('.metricas-grupo').length`), 0)
    await navegador.evaluar(`window.__prueba.errorMetricas = 0`)
    await navegador.evaluar(pulsar('Reintentar'))
    await navegador.esperar(`document.querySelectorAll('.metricas-grupo').length === 2`)
  })

  await t.test('último separado, historial anterior y evidencia por ejecución', async () => {
    await cargar(navegador, `/clientes/${datos.clienteUuid}/analisis-semanales`)
    await navegador.esperar(textoIncluye('Resumen de presencia espontánea'))
    await navegador.evaluar(`document.querySelector('.analisis-alternar').click()`)
    await navegador.esperar(`document.querySelectorAll('.analisis-historial-lista button').length === 2`)
    await navegador.evaluar(`document.querySelectorAll('.analisis-historial-lista button')[1].click()`)
    await navegador.esperar(textoIncluye('Resumen anterior combinado'))
    assert.equal(await navegador.evaluar(`document.querySelector('.analisis-grupos') === null`), true)
    await navegador.evaluar(`document.querySelector('.analisis-referencias a').click()`)
    await navegador.esperar(textoIncluye('Respuesta conservada de la ejecución'))
    assert.equal(await navegador.evaluar(`window.__prueba.peticiones.filter((p) => p.ruta.endsWith('/ejecuciones/${datos.ejecucionUuid}')).length`), 1)
    await cargar(navegador, `/clientes/${datos.clienteUuid}/analisis-semanales`, {
      analisis: { ...datos.analisis, informe: '' },
    })
    await navegador.esperar(textoIncluye('formato incompleto o desconocido'))
  })

  await t.test('reintentar contexto anterior mantiene su formato después del polling', async () => {
    await cargar(navegador, `/clientes/${datos.clienteUuid}/analisis-semanales`, {
      analisis: { ...datos.analisis, estado: 'FALLIDO', informe: null, mensaje: 'Fallo conservado' },
    })
    await navegador.esperar(textoIncluye('Fallo conservado'))
    await navegador.evaluar(`window.__prueba.informeFinal = { ...window.__prueba.analisis, estado: 'FINALIZADO', informe: window.__prueba.informeAnterior, intentos: 2 }`)
    await navegador.evaluar(pulsar('Reintentar análisis'))
    await navegador.esperar(`document.querySelector('dialog[open]') !== null`)
    await navegador.evaluar(`document.querySelector('dialog[open] input[type="checkbox"]').click()`)
    await navegador.evaluar(`document.querySelector('dialog[open] .boton-primario').click()`)
    await navegador.esperar(textoIncluye('Resumen anterior combinado'))
    assert.equal(await navegador.evaluar(`document.querySelector('.analisis-grupos') === null`), true)
    assert.equal(await navegador.evaluar(`window.__prueba.sondeosAnalisis`), 1)
  })
})
