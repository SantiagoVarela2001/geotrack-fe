import { test } from 'node:test'
import assert from 'node:assert/strict'
import { abrirNavegador, buscarNavegador } from './navegador.mjs'
import * as datos from './datos.mjs'
import { novedades, obtenerNovedadesVigentes } from '../src/datos/novedades.ts'

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
    if (ruta === '/api/autenticacion/renovar') return estado.sesionIniciada === false
      ? problema(401) : responder({ tokenAcceso: 'token-de-prueba', tipoToken: 'Bearer' })
    if (ruta === '/api/autenticacion/ingresar') {
      estado.sesionIniciada = true
      return responder({ tokenAcceso: 'token-de-prueba', tipoToken: 'Bearer' })
    }
    if (ruta === '/api/autenticacion/actual') return responder(estado.cuenta)
    if (ruta === '/api/usuarios/yo') return responder({ uuid: 'usuario-de-prueba', nombre: 'Persona de prueba',
      correoElectronico: estado.cuenta.usuario, tipoCuenta: estado.cuenta.tipoCuenta })
    if (ruta === '/api/usuarios/yo/clave' && metodo === 'PUT') return new Response(null, { status: 204 })
    if (ruta.endsWith('/logo')) return new Response(null, { status: 404 })
    if (ruta === '/api/clientes-monitoreados') return responder(estado.clientes ?? [estado.cliente])
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
    if (ruta.includes('/acciones')) {
      const url = new URL(ruta, location.origin)
      const uuid = url.pathname.split('/acciones/')[1]
      if (metodo === 'GET') {
        const copia = structuredClone(estado.acciones)
        const error = estado.errorAcciones
        const desde = url.searchParams.get('desde')
        const hasta = url.searchParams.get('hasta')
        const demora = estado.demorasAcciones?.[desde] ?? 0
        if (demora) await new Promise((resolver) => setTimeout(resolver, demora))
        if (error) return problema(error)
        return responder(uuid ? copia.find((a) => a.uuid === uuid)
          : copia.filter((a) => !desde || a.fecha >= desde && a.fecha <= hasta))
      }
      if (estado.errorEscrituraAcciones) return problema(estado.errorEscrituraAcciones)
      if (estado.demoraEscrituraAcciones) await new Promise((resolver) => setTimeout(resolver, estado.demoraEscrituraAcciones))
      if (metodo === 'DELETE') {
        if (!estado.acciones.some((a) => a.uuid === uuid)) return problema(404)
        estado.acciones = estado.acciones.filter((a) => a.uuid !== uuid)
        return new Response(null, { status: 204 })
      }
      const normalizados = Object.fromEntries(Object.entries(cuerpo).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]))
      const accion = { ...normalizados, clienteUuid: estado.clienteUuid, uuid: uuid ?? 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }
      estado.acciones = [accion, ...estado.acciones.filter((a) => a.uuid !== accion.uuid)]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
      return responder(accion, metodo === 'POST' ? 201 : 200)
    }
    if (ruta.includes('/metricas?')) {
      const filtros = new URL(ruta, location.origin).searchParams
      const desde = filtros.get('desde')
      const hasta = filtros.get('hasta')
      const copia = structuredClone(estado.metricas)
      const demora = estado.demorasMetricas?.[desde] ?? 0
      if (demora) await new Promise((resolver) => setTimeout(resolver, demora))
      if (estado.errorMetricas) return problema(estado.errorMetricas)
      if (estado.metricasPorPeriodo) {
        copia.desde = desde
        copia.hasta = hasta
        for (const clave of ['sinMarca', 'conMarca']) copia[clave].serieDiaria = copia[clave].serieDiaria
          .filter((d) => d.dia >= desde && d.dia <= hasta)
      }
      return responder(copia)
    }
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
test('interacciones del frontend en navegador real', { skip: !ejecutable && 'Configurar NAVEGADOR_PRUEBAS con Chrome, Edge o Chromium', timeout: 150000 }, async (t) => {
  const navegador = await abrirNavegador(ejecutable)
  t.after(() => navegador.cerrar())

  await t.test('ojito en login y perfil: conserva valores, alterna cada campo y no envía formularios', async () => {
    await cargar(navegador, '/mi-perfil', { sesionIniciada: false })
    await navegador.esperar(`document.querySelector('.ingreso .campo-clave') !== null`)
    await navegador.evaluar(cambiar('.ingreso input[autocomplete="username"]', 'prueba@ejemplo.test'))
    await navegador.evaluar(cambiar('.ingreso .campo-clave input', 'ClaveDePrueba123'))
    assert.equal(await navegador.evaluar(`document.querySelector('.campo-clave input').type`), 'password')
    for (const tipo of ['text', 'password']) {
      await navegador.evaluar(`document.querySelector('.campo-clave-alternar').click()`)
      await navegador.esperar(`document.querySelector('.campo-clave input').type === '${tipo}'`)
      assert.equal(await navegador.evaluar(`document.querySelector('.campo-clave input').value`), 'ClaveDePrueba123')
      assert.equal(await navegador.evaluar(`document.querySelector('.campo-clave-alternar').getAttribute('aria-pressed')`), String(tipo === 'text'))
    }
    assert.equal(await navegador.evaluar(`window.__prueba.peticiones.some((p) => p.metodo === 'POST' && p.ruta.endsWith('/ingresar'))`), false)
    await navegador.ajustarPantalla(1440, 1000)
    await navegador.capturar('ojito-login.png')
    await navegador.evaluar(pulsar('Ingresar'))
    await navegador.esperar(`document.querySelectorAll('.pagina-perfil .campo-clave').length === 3`)
    const valores = ['ClaveDePrueba123', 'NuevaClaveDePrueba123', 'NuevaClaveDePrueba123']
    for (const [indice, valor] of valores.entries()) {
      await navegador.evaluar(cambiar(`.perfil-seccion-clave .campo-clave:nth-of-type(${indice + 1}) input`, valor))
    }
    for (const indice of [0, 1, 2]) {
      await navegador.evaluar(`document.querySelectorAll('.pagina-perfil .campo-clave-alternar')[${indice}].click()`)
      await navegador.esperar(`document.querySelectorAll('.pagina-perfil .campo-clave input')[${indice}].type === 'text'`)
      assert.deepEqual(await navegador.evaluar(`[...document.querySelectorAll('.pagina-perfil .campo-clave input')].map((campo) => campo.value)`), valores)
      assert.deepEqual(await navegador.evaluar(`[...document.querySelectorAll('.pagina-perfil .campo-clave input')].map((campo) => campo.type)`),
        valores.map((_, posicion) => posicion === indice ? 'text' : 'password'))
      await navegador.evaluar(`document.querySelectorAll('.pagina-perfil .campo-clave-alternar')[${indice}].click()`)
      await navegador.esperar(`document.querySelectorAll('.pagina-perfil .campo-clave input')[${indice}].type === 'password'`)
    }
    assert.equal(await navegador.evaluar(`window.__prueba.peticiones.some((p) => p.metodo === 'PUT')`), false)
    await navegador.capturar('ojito-perfil-escritorio.png')
    await navegador.ajustarPantalla(390, 844)
    await navegador.evaluar(`document.querySelector('.perfil-seccion-clave').scrollIntoView({ block: 'center' })`)
    assert.equal(await navegador.evaluar(`document.documentElement.scrollWidth <= window.innerWidth`), true)
    await navegador.capturar('ojito-perfil-movil.png')
    await navegador.evaluar(pulsar('Cambiar contraseña'))
    await navegador.esperar(textoIncluye('La contraseña cambió.'))
    assert.deepEqual(await navegador.evaluar(`window.__prueba.peticiones.find((p) => p.ruta === '/api/usuarios/yo/clave').cuerpo`),
      { claveActual: valores[0], claveNueva: valores[1] })
    assert.deepEqual(await navegador.evaluar(`[...document.querySelectorAll('.pagina-perfil .campo-clave input')].map((campo) => campo.value)`), ['', '', ''])
    await navegador.ajustarPantalla(1440, 1000)
  })

  // Verifica el nuevo anuncio y su vencimiento conservando foco, reapertura y presentación móvil.
  await t.test('novedades: lectura, foco, reapertura y vencimiento con la aplicación abierta', async () => {
    await cargar(navegador, `/clientes/${datos.clienteUuid}`, {
      ahoraNovedades: Date.parse(novedades[0].publicadaEn) + 1000,
      cuenta: datos.cuentaAcciones,
    })
    await navegador.esperar(`document.querySelector('.novedades-flotante') !== null`)
    await navegador.evaluar(`document.querySelector('.novedades-flotante').focus(); document.querySelector('.novedades-flotante').click()`)
    await navegador.esperar(`document.querySelector('.dialogo-novedades[open]') !== null`)
    assert.equal(await navegador.evaluar(`document.querySelectorAll('.novedad').length`),
      obtenerNovedadesVigentes(datos.cuentaAcciones, Date.parse(novedades[0].publicadaEn) + 1000).length)
    assert.equal(await navegador.evaluar(`document.querySelector('.novedad h3').textContent`), novedades[0].titulo)
    assert.equal(await navegador.evaluar(`document.querySelector('.novedad p').textContent`), novedades[0].descripcion)
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
      Date.now = () => ${Date.parse(novedades[0].expiraEn)} - 300 + performance.now() - inicio;
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
    assert.equal(await navegador.evaluar(`Boolean(document.querySelector('.panel-evolucion').compareDocumentPosition(document.querySelector('.metricas-grupo')) & Node.DOCUMENT_POSITION_FOLLOWING)`), true)
    assert.equal(await navegador.evaluar(`document.querySelector('.metricas-diario-grafico').getBoundingClientRect().height <= 220`), true)
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

  const cargarAcciones = (ruta, cambios = {}) => cargar(navegador, ruta,
    { cuenta: datos.cuentaAcciones, metricasPorPeriodo: true, ...cambios })
  async function periodoAcciones(desde, hasta) {
    await navegador.evaluar(cambiar('#metricas-desde', desde))
    await navegador.evaluar(cambiar('#metricas-hasta', hasta))
    await navegador.evaluar(`document.querySelector('.metricas-filtros').requestSubmit()`)
  }

  await t.test('F10: acceso junto a métricas, alta con errores, sin envíos duplicados y eliminación 204', async () => {
    await cargarAcciones('/clientes')
    await navegador.esperar(`document.querySelector('.cliente-accion-acciones') !== null`)
    await navegador.evaluar(`document.querySelector('.cliente-accion-acciones').click()`)
    await navegador.esperar(`location.hash.endsWith('/acciones') && document.querySelector('.pagina-acciones') !== null`)
    await cargarAcciones(`/clientes/${datos.clienteUuid}`)
    await navegador.esperar(`document.querySelector('.detalle-acciones .detalle-accion-acciones') !== null`)
    await navegador.evaluar(pulsar('Acciones realizadas'))
    await navegador.esperar(`document.querySelectorAll('#acciones-cliente .accion-fila').length === 4`)
    assert.equal(await navegador.evaluar(`location.hash.endsWith('/acciones') && document.querySelector('.detalle-ficha') === null`), true)
    await navegador.esperar(`document.querySelector('.pagina-acciones .metricas-diario-grafico') !== null`)
    assert.equal(await navegador.evaluar(`Boolean(document.querySelector('.panel-evolucion').compareDocumentPosition(document.querySelector('#acciones-cliente')) & Node.DOCUMENT_POSITION_FOLLOWING)`), true)
    await navegador.capturar('f10-acciones-pagina.png')
    await navegador.ajustarPantalla(390, 844)
    await navegador.esperar(`document.documentElement.scrollWidth <= window.innerWidth`)
    await navegador.capturar('f10-acciones-pagina-movil.png')
    await navegador.ajustarPantalla(1280, 1000)
    assert.deepEqual(await navegador.evaluar(`[...document.querySelectorAll('#acciones-cliente .accion-fila h4')].map((e) => e.textContent)`), datos.acciones.map((a) => a.titulo))
    await navegador.evaluar(pulsar('Registrar acción'))
    await navegador.esperar(`document.querySelector('.formulario-accion[open]') !== null`)
    await navegador.evaluar(cambiar('#accion-titulo', '  Nueva publicación  '))
    await navegador.evaluar(cambiar('#accion-fecha', '2020-01-02'))
    await navegador.evaluar(cambiar('#accion-descripcion', 'Detalles conservados'))
    for (const estado of [403, 409]) {
      await navegador.evaluar(`window.__prueba.errorEscrituraAcciones = ${estado}; document.querySelector('.formulario-accion form').requestSubmit()`)
      await navegador.esperar(textoIncluye(`Rechazo ${estado} del servidor`))
      assert.equal(await navegador.evaluar(`document.querySelector('#accion-descripcion').value`), 'Detalles conservados')
    }
    await navegador.evaluar(`window.__prueba.errorEscrituraAcciones = 0; window.__prueba.demoraEscrituraAcciones = 200;
      document.querySelector('.formulario-accion form').requestSubmit(); document.querySelector('.formulario-accion form').requestSubmit()`)
    await navegador.esperar(`document.querySelector('.formulario-accion') === null && document.querySelectorAll('#acciones-cliente .accion-fila').length === 5`)
    assert.equal(await navegador.evaluar(`window.__prueba.peticiones.filter((p) => p.metodo === 'POST' && p.ruta.endsWith('/acciones')).length`), 3)
    assert.match(await navegador.evaluar(`document.querySelector('#acciones-cliente').innerText`), /Nueva publicación/)
    await navegador.evaluar(`document.querySelector('[aria-label="Eliminar acción: Nueva publicación"]').click()`)
    await navegador.esperar(`document.querySelector('#accion-eliminar-titulo') !== null`)
    await navegador.evaluar(pulsar('Eliminar acción'))
    await navegador.esperar(`document.querySelectorAll('#acciones-cliente .accion-fila').length === 4 && document.querySelector('#accion-eliminar-titulo') === null`)
  })

  await t.test('F10: plataforma y archivados conservan lectura sin escrituras', async () => {
    for (const cambios of [
      { cuenta: { ...datos.cuentaAcciones, tipoCuenta: 'PLATAFORMA', roles: ['SYSADMIN'] } },
      { cliente: { ...datos.cliente, estado: 'ARCHIVADO' } },
      { cuenta: { ...datos.cuentaAcciones, permisos: ['CLIENTES_VER', 'ACCIONES_VER'] } },
    ]) {
      await cargarAcciones('/clientes', cambios)
      await navegador.esperar(`document.querySelector('.cliente-accion-acciones') !== null`)
      assert.equal(await navegador.evaluar(`document.querySelector('.cliente-accion-acciones').disabled`), false)
      await cargarAcciones(`/clientes/${datos.clienteUuid}`, cambios)
      await navegador.esperar(`document.querySelector('.detalle-accion-acciones') !== null`)
      await navegador.evaluar(pulsar('Acciones realizadas'))
      await navegador.esperar(`document.querySelectorAll('#acciones-cliente .accion-fila').length === 4`)
      assert.equal(await navegador.evaluar(`document.querySelector('#acciones-cliente button') === null`), true)
    }
    await cargar(navegador, '/clientes')
    await navegador.esperar(`document.querySelector('.cliente-fila') !== null`)
    assert.equal(await navegador.evaluar(`document.querySelector('.cliente-accion-acciones') === null`), true)
  })

  await t.test('acciones: recarga directa, gráfico compartido y actualización conjunta con el listado', async () => {
    await cargarAcciones(`/clientes/${datos.clienteUuid}/acciones`)
    await navegador.esperar(`document.querySelectorAll('#acciones-cliente .accion-fila').length === 4`)
    await periodoAcciones('2026-11-01', '2026-11-03')
    await navegador.esperar(`document.querySelectorAll('.accion-marcador').length === 2`)
    assert.equal(await navegador.evaluar(`document.querySelectorAll('#acciones-cliente .accion-fila').length`), 4)
    await navegador.evaluar(`document.querySelector('#acciones-cliente [aria-label="Editar acción: Publicamos casos de éxito"]').click()`)
    await navegador.esperar(`document.querySelector('#accion-titulo') !== null`)
    await navegador.evaluar(cambiar('#accion-fecha', '2020-01-01'))
    await navegador.evaluar(`document.querySelector('.formulario-accion form').requestSubmit()`)
    await navegador.esperar(`document.querySelector('.formulario-accion') === null && document.querySelector('.accion-marcador[aria-label^="1 acción: 3"]') !== null && document.querySelectorAll('#acciones-cliente .accion-fila').length === 4`)
    await navegador.evaluar(`document.querySelector('.accion-marcador[aria-label^="1 acción: 3"]').click()`)
    await navegador.evaluar(`document.querySelector('.acciones-del-dia [aria-label="Eliminar acción: Mejoramos preguntas frecuentes"]').click()`)
    await navegador.esperar(`document.querySelector('#accion-eliminar-titulo') !== null`)
    await navegador.evaluar(pulsar('Eliminar acción'))
    await navegador.esperar(`document.querySelectorAll('.accion-marcador').length === 1 && document.querySelectorAll('#acciones-cliente .accion-fila').length === 3`)
    await navegador.evaluar(pulsar('Ver tendencia'))
    await navegador.esperar(`document.querySelectorAll('.metricas-diario-regresion').length === 2`)
    await navegador.evaluar(pulsar('Ocultar tendencia'))
    assert.equal(await navegador.evaluar(`document.querySelectorAll('.metricas-diario-regresion').length`), 0)
  })

  await t.test('F10: consultas paralelas, agrupación, teclado y días sin mediciones', async () => {
    const sinMediciones = { ...datos.metricas, sinMarca: datos.grupo(), conMarca: datos.grupo() }
    await cargarAcciones(`/clientes/${datos.clienteUuid}/metricas`, { metricas: sinMediciones })
    await navegador.esperar(`document.querySelector('.metricas-filtros') !== null`)
    await periodoAcciones('2026-11-01', '2026-11-03')
    await navegador.esperar(`document.querySelectorAll('.accion-marcador').length === 2`)
    const solicitudes = await navegador.evaluar(`window.__prueba.peticiones.filter((p) => p.ruta.includes('?desde=2026-11-01&hasta=2026-11-03')).map((p) => p.ruta)`)
    assert.equal(solicitudes.some((ruta) => ruta.includes('/metricas?')), true)
    assert.equal(solicitudes.some((ruta) => ruta.includes('/acciones?')), true)
    await navegador.evaluar(`document.querySelector('.accion-marcador[aria-label^="2 acciones"]').focus()`)
    await navegador.tecla('Enter')
    await navegador.esperar(`document.querySelectorAll('.acciones-del-dia .accion-fila').length === 2`)
    assert.match(await navegador.evaluar(`document.querySelector('.acciones-del-dia').innerText`), /Publicamos casos de éxito/)
    await navegador.ajustarPantalla(1280, 1000)
    await navegador.evaluar(`document.querySelector('.metricas-diario').scrollIntoView({ block: 'center' })`)
    await navegador.capturar('f10-marcadores.png')
    await navegador.ajustarPantalla(390, 844)
    await navegador.evaluar(`document.querySelector('.metricas-diario').scrollIntoView({ block: 'start' })`)
    await navegador.esperar(`document.documentElement.scrollWidth <= window.innerWidth`)
    await navegador.capturar('f10-marcadores-movil.png')
    await navegador.ajustarPantalla(1280, 1000)
  })

  await t.test('F10: editar borra opcionales y retira el marcador al cambiar de período; eliminar actualiza el grupo', async () => {
    await cargarAcciones(`/clientes/${datos.clienteUuid}/metricas`)
    await navegador.esperar(`document.querySelector('.metricas-filtros') !== null`)
    await periodoAcciones('2026-11-01', '2026-11-03')
    await navegador.esperar(`document.querySelector('.accion-marcador[aria-label^="2 acciones"]') !== null`)
    await navegador.evaluar(`document.querySelector('.accion-marcador[aria-label^="2 acciones"]').click()`)
    await navegador.evaluar(`document.querySelector('[aria-label="Editar acción: Publicamos casos de éxito"]').click()`)
    await navegador.esperar(`document.querySelector('#accion-titulo') !== null`)
    assert.equal(await navegador.evaluar(`document.querySelector('#accion-url').value`), datos.acciones[0].url)
    await navegador.evaluar(cambiar('#accion-fecha', '2020-01-01'))
    await navegador.evaluar(cambiar('#accion-descripcion', ''))
    await navegador.evaluar(cambiar('#accion-url', ''))
    await navegador.evaluar(`document.querySelector('.formulario-accion form').requestSubmit()`)
    await navegador.esperar(`document.querySelector('.formulario-accion') === null && document.querySelector('.accion-marcador[aria-label^="1 acción: 3"]') !== null`)
    const cuerpo = await navegador.evaluar(`window.__prueba.peticiones.filter((p) => p.metodo === 'PUT').at(-1).cuerpo`)
    assert.deepEqual(cuerpo, { titulo: datos.acciones[0].titulo, fecha: '2020-01-01', descripcion: null, url: null })
    await navegador.evaluar(`document.querySelector('[aria-label="Eliminar acción: Mejoramos preguntas frecuentes"]').click()`)
    await navegador.esperar(`document.querySelector('#accion-eliminar-titulo') !== null`)
    await navegador.evaluar(pulsar('Eliminar acción'))
    await navegador.esperar(`document.querySelectorAll('.accion-marcador').length === 1 && document.querySelector('#accion-eliminar-titulo') === null`)
    await navegador.evaluar(pulsar('Volver al cliente'))
    await navegador.esperar(`document.querySelector('.detalle-accion-acciones') !== null`)
    await navegador.evaluar(pulsar('Acciones realizadas'))
    await navegador.esperar(`document.querySelectorAll('#acciones-cliente .accion-fila').length === 3`)
    assert.match(await navegador.evaluar(`document.querySelector('#acciones-cliente').innerText`), /Publicamos casos de éxito/)
  })

  await t.test('F10: error de acciones conserva curvas, permite reintentar y no se presenta como vacío', async () => {
    await cargarAcciones(`/clientes/${datos.clienteUuid}/metricas`, { errorAcciones: 404 })
    await navegador.esperar(`document.querySelector('.acciones-error') !== null && document.querySelectorAll('.metricas-diario-linea').length === 2`)
    assert.match(await navegador.evaluar(`document.querySelector('.acciones-error').innerText`), /Rechazo 404 del servidor/)
    assert.doesNotMatch(await navegador.evaluar(`document.querySelector('.acciones-del-dia').innerText`), /No hay acciones/)
    await navegador.evaluar(`window.__prueba.errorAcciones = 0`)
    await navegador.evaluar(pulsar('Reintentar marcadores'))
    await navegador.esperar(`document.querySelector('.acciones-error') === null`)
    await periodoAcciones('2026-11-01', '2026-11-03')
    await navegador.esperar(`document.querySelectorAll('.accion-marcador').length === 2`)
    await cargar(navegador, `/clientes/${datos.clienteUuid}/metricas`)
    await navegador.esperar(`document.querySelectorAll('.metricas-diario-linea').length === 2`)
    assert.equal(await navegador.evaluar(`window.__prueba.peticiones.some((p) => p.ruta.includes('/acciones'))`), false)
  })

  await t.test('F10: respuestas fuera de orden no reemplazan el período ni el cliente actual', async () => {
    await cargarAcciones(`/clientes/${datos.clienteUuid}/metricas`, {
      demorasAcciones: { '2026-10-01': 1000 }, demorasMetricas: { '2026-10-01': 900 },
    })
    await navegador.esperar(`document.querySelector('.metricas-filtros') !== null`)
    await periodoAcciones('2026-10-01', '2026-10-31')
    await navegador.esperar(`window.__prueba.peticiones.some((p) => p.ruta.includes('/acciones?desde=2026-10-01'))`)
    await periodoAcciones('2026-11-01', '2026-11-03')
    await navegador.esperar(`document.querySelectorAll('.accion-marcador').length === 2`)
    // Espera la respuesta vieja a través del mock para comprobar el estado final.
    await navegador.evaluar(`new Promise((resolver) => setTimeout(resolver, 1100))`)
    assert.equal(await navegador.evaluar(`document.querySelectorAll('.accion-marcador').length`), 2)
    assert.match(await navegador.evaluar(`document.querySelector('.metricas-periodo').innerText`), /3 de nov/)
    await navegador.evaluar(`window.__prueba.demorasAcciones['2026-11-01'] = 700`)
    await periodoAcciones('2026-11-01', '2026-11-04')
    await navegador.esperar(`window.__prueba.peticiones.some((p) => p.ruta.includes('/acciones?desde=2026-11-01&hasta=2026-11-04'))`)
    const otroCliente = '99999999-9999-4999-8999-999999999999'
    await navegador.evaluar(`window.__prueba.clienteUuid = '${otroCliente}';
      window.__prueba.cliente = { ...window.__prueba.cliente, uuid: '${otroCliente}', nombre: 'Otro cliente' };
      window.__prueba.acciones = window.__prueba.acciones.map((a) => ({ ...a, clienteUuid: '${otroCliente}', titulo: 'Otra marca: ' + a.titulo }));
      window.__prueba.metricas.clienteUuid = '${otroCliente}'; window.__prueba.demorasAcciones = {};
      location.hash = '/clientes/${otroCliente}/metricas'`)
    await navegador.esperar(`document.querySelector('.metricas-cabecera h1')?.textContent.includes('Otro cliente') && document.querySelectorAll('.accion-marcador').length === 2`)
    await navegador.evaluar(`new Promise((resolver) => setTimeout(resolver, 800))`)
    await navegador.evaluar(`document.querySelector('.accion-marcador[aria-label^="2 acciones"]').click()`)
    assert.match(await navegador.evaluar(`document.querySelector('.acciones-del-dia').innerText`), /Otra marca: Publicamos casos de éxito/)
    assert.match(await navegador.evaluar(`document.querySelector('.metricas-cabecera h1').textContent`), /Otro cliente/)
  })

  await t.test('F03: competidores del período en último análisis y detalle del historial, sin consultas adicionales', async () => {
    await cargar(navegador, `/clientes/${datos.clienteUuid}/analisis-semanales`, {
      analisis: { ...datos.analisis, informe: { ...datos.informeSeparado, competidoresDetectados: datos.competidoresDetectados } },
      informeAnterior: { ...datos.informeAnterior, competidoresDetectados: datos.competidoresDetectados },
    })
    await navegador.esperar(`document.querySelectorAll('.analisis-competidores-lista li').length === 2`)
    assert.equal(await navegador.evaluar(`document.querySelectorAll('.analisis-competidores').length`), 1)
    assert.equal(await navegador.evaluar(`document.querySelector('.analisis-grupos .analisis-competidores') === null`), true)
    assert.deepEqual(await navegador.evaluar(`[...document.querySelectorAll('.analisis-competidores-lista li')].map((li) => ({
      nombre: li.querySelector('strong').textContent, pregunta: li.querySelector('p').textContent,
      urlFuente: li.querySelector('a')?.href ?? null,
    }))`), datos.competidoresDetectados)
    assert.deepEqual(await navegador.evaluar(`(() => { const enlace = document.querySelector('.analisis-competidores a');
      return { texto: enlace.textContent, target: enlace.target, rel: enlace.rel }; })()`),
      { texto: 'Ver fuente', target: '_blank', rel: 'noopener noreferrer' })
    await navegador.ajustarPantalla(1440, 1000)
    await navegador.evaluar(`document.querySelector('.analisis-competidores').scrollIntoView({ block: 'center' })`)
    await navegador.capturar('competidores-detectados-escritorio.png')
    await navegador.ajustarPantalla(390, 844)
    await navegador.evaluar(`document.querySelector('.analisis-competidores').scrollIntoView({ block: 'center' })`)
    assert.equal(await navegador.evaluar(`document.documentElement.scrollWidth <= window.innerWidth`), true)
    await navegador.capturar('competidores-detectados-movil.png')
    await navegador.evaluar(`document.querySelector('.analisis-alternar').click()`)
    await navegador.esperar(`document.querySelectorAll('.analisis-historial-lista button').length === 2`)
    await navegador.evaluar(`document.querySelectorAll('.analisis-historial-lista button')[1].click()`)
    await navegador.esperar(textoIncluye('Resumen anterior combinado'))
    assert.equal(await navegador.evaluar(`document.querySelectorAll('.analisis-competidores-lista li').length`), 2)
    await navegador.evaluar(pulsar('Volver al último'))
    await navegador.esperar(textoIncluye('Resumen de presencia espontánea'))
    const rutaBase = `/api/clientes-monitoreados/${datos.clienteUuid}`
    assert.deepEqual(await navegador.evaluar(`window.__prueba.peticiones.map((p) => p.ruta).sort()`), [
      '/api/autenticacion/renovar', '/api/autenticacion/actual', rutaBase,
      `${rutaBase}/analisis-semanales/ultimo`, `${rutaBase}/analisis-semanales?pagina=0`,
      `${rutaBase}/analisis-semanales/99999999-9999-4999-8999-999999999999`,
    ].sort())
    await navegador.ajustarPantalla(1440, 1000)
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
