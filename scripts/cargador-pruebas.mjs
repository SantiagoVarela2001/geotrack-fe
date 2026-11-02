import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Compila los módulos de la aplicación en memoria, sin dependencias ni archivos generados.
export async function resolve(especificador, contexto, siguiente) {
  if (especificador.startsWith('.') && !/\.[a-z]+$/i.test(especificador)) {
    for (const extension of ['.ts', '.tsx']) {
      try { return await siguiente(especificador + extension, contexto) } catch (error) {
        if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
      }
    }
  }
  return siguiente(especificador, contexto)
}

export async function load(url, contexto, siguiente) {
  if (/\.tsx?$/.test(url)) {
    const fuente = await readFile(fileURLToPath(url), 'utf8')
    const { outputText } = ts.transpileModule(fuente, {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      fileName: fileURLToPath(url),
    })
    return { format: 'module', source: outputText, shortCircuit: true }
  }
  return siguiente(url, contexto)
}
