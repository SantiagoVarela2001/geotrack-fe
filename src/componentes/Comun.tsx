import type { ReactNode } from 'react'
import type { DatosCliente, DatosConsulta } from '../api/tipos'

type NombreIcono =
  | 'clientes'
  | 'ajustes'
  | 'salir'
  | 'mas'
  | 'flecha'
  | 'buscar'
  | 'volver'
  | 'cerrar'
  | 'check'
  | 'editar'
  | 'documento'
  | 'capas'
  | 'estrella'
  | 'escudo'

export function Icono({
  nombre,
  tamano = 20,
  relleno = false,
}: {
  nombre: NombreIcono
  tamano?: number
  relleno?: boolean
}) {
  const trazos: Record<NombreIcono, ReactNode> = {
    clientes: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M8 4V2m8 2V2M3 9h18M7 13h4m-4 4h7" />
      </>
    ),
    ajustes: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M8 8h8m-8 4h8m-8 4h5" />
      </>
    ),
    salir: (
      <>
        <path d="M10 17l5-5-5-5m5 5H3" />
        <path d="M12 3h5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-5" />
      </>
    ),
    mas: <path d="M12 5v14M5 12h14" />,
    flecha: <path d="M5 12h14m-6-6 6 6-6 6" />,
    buscar: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    volver: <path d="M19 12H5m6 6-6-6 6-6" />,
    cerrar: <path d="M5 5 19 19M19 5 5 19" />,
    check: <path d="m4 12 5 5L20 6" />,
    editar: (
      <>
        <path d="m4 16-.5 4.5L8 20l11-11-4-4L4 16Z" />
        <path d="m13 7 4 4" />
      </>
    ),
    documento: (
      <>
        <path d="M6 2h8l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
        <path d="M14 2v6h5M8 13h8m-8 4h8" />
      </>
    ),
    capas: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    estrella: (
      <path d="m12 2.5 2.95 6.1 6.7.96-4.85 4.73 1.14 6.68L12 17.82l-5.94 3.15 1.14-6.68-4.85-4.73 6.7-.96L12 2.5Z" />
    ),
    escudo: (
      <>
        <path d="M12 2 4 5v6c0 5 3.4 8.8 8 11 4.6-2.2 8-6 8-11V5l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  }
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill={relleno ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {trazos[nombre]}
    </svg>
  )
}

export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className={`marca ${compacta ? 'marca-compacta' : ''}`}>
      <img src="/logo.svg" alt="" />
      <span>gelaia</span>
    </div>
  )
}

export function Aviso({
  tipo = 'error',
  children,
}: {
  tipo?: 'error' | 'exito' | 'informacion'
  children: ReactNode
}) {
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

export function EtiquetaEstado({
  estado,
}: {
  estado: DatosCliente['estado'] | DatosConsulta['estadoConsulta']
}) {
  return (
    <span className={`etiqueta etiqueta-${estado.toLowerCase()}`}>
      {estado === 'BORRADOR'
        ? 'Borrador'
        : estado === 'APROBADA'
          ? 'Aprobada'
          : estado === 'ACTIVO'
            ? 'Activo'
            : 'Archivado'}
    </span>
  )
}

export function Vacio({
  icono,
  titulo,
  descripcion,
  accion,
}: {
  icono: NombreIcono
  titulo: string
  descripcion: string
  accion?: ReactNode
}) {
  return (
    <div className="vacio">
      <div className="vacio-icono">
        <Icono nombre={icono} tamano={26} />
      </div>
      <h3>{titulo}</h3>
      <p>{descripcion}</p>
      {accion}
    </div>
  )
}
