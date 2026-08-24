import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ROLES } from '../../lib/constants'
import { iniciales } from '../../lib/format'

/*
 * Armazon de la aplicacion.
 *
 * Barra lateral en pino profundo contra el contenido en papel marfil. Ese
 * contraste hace dos cosas: enmarca el area de trabajo como una hoja sobre un
 * escritorio, y le da al producto una identidad reconocible de un vistazo,
 * que es lo que no tiene un panel gris con acento de color.
 *
 * El item activo no se marca con un bloque de fondo sino con un filete de
 * laton a la izquierda. Mas discreto y mas caro.
 */

const ICONOS = {
  inicio: 'M3 11.5 12 4l9 7.5M5.5 10v9a1 1 0 001 1h3.5v-5.5h4V20H18a1 1 0 001-1v-9',
  clientes:
    'M16 20v-1.5a3.5 3.5 0 00-3.5-3.5h-5A3.5 3.5 0 004 18.5V20M10 11.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM20 20v-1.5a3.5 3.5 0 00-2.6-3.4M15.5 4.7a3.5 3.5 0 010 6.6',
  pacientes:
    'M6 11.5a2 2 0 100-4 2 2 0 000 4zm4.5-2.5a2 2 0 100-4 2 2 0 000 4zm5 0a2 2 0 100-4 2 2 0 000 4zm4.5 2.5a2 2 0 100-4 2 2 0 000 4zM13 21c-2.4 0-4.4-1.5-4.4-3.4 0-1.9 2-4.6 4.4-4.6s4.4 2.7 4.4 4.6S15.4 21 13 21z',
  historial:
    'M8 4h8.6a1 1 0 01.7.3l2.4 2.4a1 1 0 01.3.7V19a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1zM10 10h7M10 14h7M10 17h4',
  turnos:
    'M8 3v3m8-3v3M4 9h16M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z',
  usuarios:
    'M15 20v-1.5a3.5 3.5 0 00-3.5-3.5h-4A3.5 3.5 0 004 18.5V20M9.5 11.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM18 8v6M21 11h-6',
}

const NAVEGACION = [
  { a: '/', etiqueta: 'Inicio', icono: 'inicio', modulo: null, exacto: true },
  { a: '/clientes', etiqueta: 'Clientes', icono: 'clientes', modulo: 'clientes' },
  { a: '/pacientes', etiqueta: 'Pacientes', icono: 'pacientes', modulo: 'pacientes' },
  { a: '/historial', etiqueta: 'Historial', icono: 'historial', modulo: 'historial' },
  { a: '/turnos', etiqueta: 'Turnos', icono: 'turnos', modulo: 'turnos' },
  // Solo admin: 'usuarios' no esta en PERMISOS de los demas roles.
  { a: '/usuarios', etiqueta: 'Usuarios', icono: 'usuarios', modulo: 'usuarios' },
]

function Icono({ d, className = 'size-[18px]' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

/** Monograma: una cruz clinica dentro de un cuadro con filete de laton. */
function Monograma({ className = 'size-9' }) {
  return (
    <span
      className={`grid ${className} shrink-0 place-items-center border border-laton-500/70 bg-pino-800`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-[15px]" fill="none" stroke="var(--color-laton-300)" strokeWidth="2">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
    </span>
  )
}

export function AppShell() {
  const { usuario, logout, puede } = useAuth()
  const navigate = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)

  // El menu se filtra por permiso, pero eso es solo UX: quien impide el acceso
  // real a los datos es RoleMiddleware en la API.
  const enlaces = NAVEGACION.filter((n) => n.modulo === null || puede(n.modulo))

  const salir = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const claseEnlace = ({ isActive }) =>
    `group relative flex items-center gap-3 py-2 pl-4 pr-3 text-[13.5px] transition-colors duration-150 ${
      isActive ? 'bg-pino-800/70 text-papel' : 'text-pino-200 hover:bg-pino-800/40 hover:text-papel'
    }`

  return (
    <div className="min-h-dvh">
      <div className="flex">
        {/* ================= Barra lateral (escritorio) ================= */}
        <aside className="fixed inset-y-0 left-0 hidden w-[236px] flex-col bg-pino-900 lg:flex">
          <div className="flex items-center gap-3 px-5 py-6">
            <Monograma />
            <div>
              <p className="font-display text-[17px] font-medium leading-none tracking-[-0.02em] text-papel">
                VetClinic
              </p>
              <p className="mt-1 text-[9.5px] uppercase tracking-[0.18em] text-laton-500">
                Gestion clinica
              </p>
            </div>
          </div>

          <div className="mx-5 h-px bg-pino-700" aria-hidden="true" />

          <nav className="flex-1 py-4" aria-label="Navegacion principal">
            <p className="rotulo mb-2 px-5 !text-pino-400">Modulos</p>

            {enlaces.map((n) => (
              <NavLink key={n.a} to={n.a} end={n.exacto} className={claseEnlace}>
                {({ isActive }) => (
                  <>
                    {/* Filete de laton en el item activo. */}
                    <span
                      className={`absolute inset-y-0 left-0 w-[2px] transition-colors ${
                        isActive ? 'bg-laton-500' : 'bg-transparent'
                      }`}
                      aria-hidden="true"
                    />
                    <Icono d={ICONOS[n.icono]} />
                    {n.etiqueta}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-pino-700 p-4">
            {/* El bloque de identidad es el acceso natural al perfil propio:
                es donde uno mira para ver "quien soy" en el sistema. */}
            <NavLink
              to="/perfil"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded px-1 py-1.5 transition-colors ${
                  isActive ? 'bg-pino-800' : 'hover:bg-pino-800/60'
                }`
              }
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-pino-600 bg-pino-800 text-[11px] font-medium text-laton-300">
                {iniciales(usuario)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-papel">
                  {usuario?.nombre} {usuario?.apellido}
                </p>
                <p className="truncate text-[10px] uppercase tracking-[0.12em] text-pino-300">
                  {ROLES[usuario?.rol]}
                </p>
              </div>
              <span className="shrink-0 text-pino-400" aria-hidden="true">
                &rsaquo;
              </span>
            </NavLink>

            <button
              type="button"
              onClick={salir}
              className="mt-2 flex w-full items-center gap-3 rounded px-1 py-2 text-[13px] text-pino-200 transition-colors hover:bg-pino-800 hover:text-papel"
            >
              <Icono
                d="M15 16l4-4m0 0l-4-4m4 4H9m4 4v1a3 3 0 01-3 3H7a3 3 0 01-3-3V7a3 3 0 013-3h3a3 3 0 013 3v1"
                className="size-4"
              />
              Cerrar sesion
            </button>
          </div>
        </aside>

        {/* ======================== Contenido ======================== */}
        <div className="flex min-w-0 flex-1 flex-col lg:pl-[236px]">
          {/* Cabecera movil */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-linea bg-papel/95 px-4 py-3 backdrop-blur-sm lg:hidden">
            <div className="flex items-center gap-2.5">
              <Monograma className="size-8" />
              <span className="font-display text-[16px] font-medium tracking-[-0.02em] text-tinta">
                VetClinic
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-expanded={menuAbierto}
              aria-label="Menu de usuario"
              className="grid size-8 place-items-center rounded-full border border-linea-fuerte bg-papel-alto text-[11px] font-medium text-pino-700"
            >
              {iniciales(usuario)}
            </button>
          </header>

          {menuAbierto && (
            <div className="border-b border-linea bg-papel-alto px-4 py-3 lg:hidden">
              <p className="text-[13px] font-medium text-tinta">
                {usuario?.nombre} {usuario?.apellido}
              </p>
              <p className="rotulo mt-0.5">{ROLES[usuario?.rol]}</p>
              <NavLink
                to="/perfil"
                onClick={() => setMenuAbierto(false)}
                className="mt-2 block text-[13px] font-medium text-pino-700 underline decoration-laton-300 underline-offset-4"
              >
                Mis datos
              </NavLink>
              <button
                type="button"
                onClick={salir}
                className="mt-3 text-[13px] font-medium text-ladrillo-600 underline decoration-ladrillo-200 underline-offset-4"
              >
                Cerrar sesion
              </button>
            </div>
          )}

          <main className="flex-1 px-5 py-8 pb-28 sm:px-8 lg:px-12 lg:pb-10">
            <Outlet />
          </main>
        </div>
      </div>

      {/* ============ Barra inferior (movil) ============ */}
      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-20 flex border-t border-linea bg-papel/97 backdrop-blur-sm lg:hidden"
        aria-label="Navegacion principal"
      >
        {enlaces.map((n) => (
          <NavLink
            key={n.a}
            to={n.a}
            end={n.exacto}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-1 px-1 pt-2.5 text-[10px] font-medium tracking-[0.02em] ${
                isActive ? 'text-pino-700' : 'text-tinta-3'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`absolute inset-x-3 top-0 h-[2px] ${isActive ? 'bg-laton-500' : 'bg-transparent'}`}
                  aria-hidden="true"
                />
                <Icono d={ICONOS[n.icono]} className="size-[18px]" />
                {n.etiqueta}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
