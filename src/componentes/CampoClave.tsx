import { useId, useState, type InputHTMLAttributes } from 'react'
import { Icono } from './Comun'

export function CampoClave({ etiqueta, id, ...propiedades }: {
  etiqueta: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const idAutomatico = useId()
  const idCampo = id ?? idAutomatico
  const [visible, cambiarVisible] = useState(false)
  const accion = `${visible ? 'Ocultar' : 'Mostrar'}: ${etiqueta.toLocaleLowerCase('es')}`

  return (
    <div className="campo-clave">
      <label htmlFor={idCampo}>{etiqueta}</label>
      <div className="campo-clave-control">
        <input {...propiedades} id={idCampo} type={visible ? 'text' : 'password'} />
        <button type="button" className="campo-clave-alternar" disabled={propiedades.disabled}
          aria-label={accion} title={accion} aria-controls={idCampo} aria-pressed={visible}
          onClick={() => cambiarVisible((actual) => !actual)}>
          <Icono nombre={visible ? 'ocultar' : 'ver'} tamano={20} />
        </button>
      </div>
    </div>
  )
}
