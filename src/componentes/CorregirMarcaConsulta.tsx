import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { DatosConsulta } from '../api/tipos'
import { clasificacionValida, leerClasificacion } from '../consultas'
import { Aviso } from './Comun'

export function CorregirMarcaConsulta({ consulta, enviando, error, alGuardar, alCancelar }: {
  consulta: DatosConsulta
  enviando: boolean
  error: string
  alGuardar: (conMarca: boolean) => void
  alCancelar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [conMarca, cambiarConMarca] = useState<boolean | null>(consulta.conMarca)
  useEffect(() => {
    const elemento = dialogo.current
    elemento?.showModal()
    return () => { if (elemento?.open) elemento.close() }
  }, [])

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!enviando && clasificacionValida(conMarca)) alGuardar(conMarca)
  }

  return (
    <dialog ref={dialogo} className="dialogo-tipo" aria-labelledby="corregir-marca-titulo"
      aria-describedby="corregir-marca-descripcion"
      onCancel={(evento) => { evento.preventDefault(); if (!enviando) alCancelar() }}>
      <div className="dialogo-tipo-contenido">
        <h2 id="corregir-marca-titulo">Corregir clasificación</h2>
        <p>{consulta.texto}</p>
        <p id="corregir-marca-descripcion">El cambio aplica a nuevas mediciones. Las anteriores y las que ya están en cola conservan su clasificación.</p>
        <form className="formulario" onSubmit={guardar} aria-busy={enviando}>
          <label>Clasificación de la pregunta
            <select required autoFocus disabled={enviando}
              value={clasificacionValida(conMarca) ? conMarca ? 'conMarca' : 'sinMarca' : ''}
              onChange={(evento) => cambiarConMarca(leerClasificacion(evento.target.value))}>
              <option value="" disabled>Elegí una clasificación</option>
              <option value="sinMarca">Sin marca</option>
              <option value="conMarca">Con marca</option>
            </select>
          </label>
          {error && <Aviso>{error}</Aviso>}
          <div className="dialogo-tipo-acciones">
            <button className="boton boton-secundario" type="button" disabled={enviando} onClick={alCancelar}>Cancelar</button>
            <button className="boton boton-primario" type="submit" disabled={enviando || !clasificacionValida(conMarca)}>
              {enviando ? 'Guardando…' : 'Guardar clasificación'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
