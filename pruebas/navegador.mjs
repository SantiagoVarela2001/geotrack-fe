import { spawn } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
import { build, preview } from 'vite'

export async function buscarNavegador() {
  const candidatos = [process.env.NAVEGADOR_PRUEBAS,
    process.env['PROGRAMFILES(X86)'] && join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean)
  for (const candidato of candidatos) { try { await access(candidato); return candidato } catch {} }
  return null
}

/** CDP nativo mantiene las pruebas de interacción sin instalar un runner de navegador. */
export async function abrirNavegador(ejecutable) {
  const configuracion = { build: { outDir: 'node_modules/.tmp/f02-interfaz', emptyOutDir: true }, logLevel: 'silent' }
  await build(configuracion)
  const servidor = await preview({ ...configuracion, preview: { host: '127.0.0.1', port: 0 } })
  const direccion = servidor.httpServer.address()
  const raizTemporal = resolve('node_modules/.tmp')
  await mkdir(raizTemporal, { recursive: true })
  const perfil = await mkdtemp(join(raizTemporal, 'f02-navegador-'))
  const proceso = spawn(ejecutable, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--remote-debugging-port=0',
    `--user-data-dir=${perfil}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
  let diagnostico = ''
  proceso.stderr.on('data', (datos) => { diagnostico = (diagnostico + datos.toString()).slice(-3000) })
  proceso.on('error', (error) => { diagnostico += error.message })
  let socket
  let secuencia = 0
  const pendientes = new Map()
  const cerrar = async () => {
    try { if (socket?.readyState === 1) await Promise.race([enviar('Browser.close'), esperar(2000)]) } catch {}
    socket?.close()
    proceso.kill()
    await new Promise((resolver) => servidor.httpServer.close(resolver))
    // Solo se elimina el perfil temporal creado por esta prueba dentro del workspace.
    if (resolve(perfil).startsWith(raizTemporal + sep)) {
      await rm(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {})
    }
  }
  function enviar(method, params = {}, sessionId) {
    if (socket?.readyState !== 1) return Promise.reject(new Error(`El navegador se cerró antes de ${method}.`))
    const id = ++secuencia
    return new Promise((resolver, rechazar) => {
      const limite = setTimeout(() => { pendientes.delete(id); rechazar(new Error(`CDP sin respuesta: ${method}`)) }, 10000)
      pendientes.set(id, { resolver, rechazar, limite })
      socket.send(JSON.stringify({ id, method, params, sessionId }))
    })
  }
  try {
    let datos
    for (let intento = 0; intento < 100; intento++) {
      try { datos = await readFile(join(perfil, 'DevToolsActivePort'), 'utf8'); break } catch {}
      await esperar(100)
    }
    if (!datos) throw new Error('El navegador no habilitó CDP en diez segundos.')
    const [puerto, ruta] = datos.trim().split(/\r?\n/)
    socket = new WebSocket(`ws://127.0.0.1:${puerto}${ruta}`)
    await new Promise((resolver, rechazar) => { socket.addEventListener('open', resolver, { once: true }); socket.addEventListener('error', rechazar, { once: true }) })
    socket.addEventListener('message', (evento) => {
      const mensaje = JSON.parse(evento.data)
      const pendiente = pendientes.get(mensaje.id)
      if (!pendiente) return
      clearTimeout(pendiente.limite)
      pendientes.delete(mensaje.id)
      if (mensaje.error) pendiente.rechazar(new Error(JSON.stringify(mensaje.error)))
      else pendiente.resolver(mensaje.result)
    })
    socket.addEventListener('close', () => {
      for (const pendiente of pendientes.values()) {
        clearTimeout(pendiente.limite)
        pendiente.rechazar(new Error(`Se cerró la conexión con el navegador de pruebas. Salida: ${proceso.exitCode}. ${diagnostico}`))
      }
      pendientes.clear()
    })
    const { targetId } = await enviar('Target.createTarget', { url: 'about:blank' })
    await enviar('Target.activateTarget', { targetId })
    const { sessionId } = await enviar('Target.attachToTarget', { targetId, flatten: true })
    const pagina = (method, params) => enviar(method, params, sessionId)
    await pagina('Page.enable')
    await pagina('Runtime.enable')
    let scriptAnterior
    return {
      cerrar,
      async ajustarPantalla(width, height) {
        await pagina('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
      },
      async capturar(nombre) {
        const { data } = await pagina('Page.captureScreenshot', { format: 'png' })
        await writeFile(join(raizTemporal, nombre), Buffer.from(data, 'base64'))
      },
      async preparar(codigo, ruta) {
        if (scriptAnterior) await pagina('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptAnterior })
        const marcador = String(Date.now()) + Math.random()
        const { identifier } = await pagina('Page.addScriptToEvaluateOnNewDocument', { source: codigo + `;window.__cargaPrueba = ${JSON.stringify(marcador)}` })
        scriptAnterior = identifier
        await pagina('Page.navigate', { url: 'about:blank' })
        const url = `http://127.0.0.1:${direccion.port}/#${ruta}`
        await pagina('Page.navigate', { url })
        await this.esperar(`location.href === ${JSON.stringify(url)} && window.__cargaPrueba === ${JSON.stringify(marcador)} && document.readyState === 'complete'`)
      },
      async evaluar(codigo) {
        const resultado = await pagina('Runtime.evaluate', { expression: codigo, returnByValue: true, awaitPromise: true })
        if (resultado.exceptionDetails) throw new Error(resultado.exceptionDetails.text + ': ' + resultado.exceptionDetails.exception?.description)
        return resultado.result.value
      },
      async esperar(codigo) {
        for (let intento = 0; intento < 150; intento++) {
          if (await this.evaluar(codigo)) return
          await esperar(50)
        }
        throw new Error(`La interfaz no alcanzó el estado esperado: ${codigo}\n${await this.evaluar('document.body.innerText')}`)
      },
    }
  } catch (error) { await cerrar(); throw error }
}
