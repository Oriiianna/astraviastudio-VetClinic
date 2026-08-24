import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { destinoTrasLogin } from '../../auth/contexto'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'

/*
 * Acceso.
 *
 * Composicion partida: a la izquierda un panel de tinta con el nombre en
 * display grande y una marca de agua geometrica; a la derecha el formulario
 * sobre papel. En movil el panel se colapsa a una franja superior.
 *
 * La entrada es lo primero que ve alguien del producto, asi que se permite un
 * gesto: la marca de agua y el escalonado de aparicion. De la puerta para
 * adentro la interfaz vuelve a ser sobria.
 */
export function LoginPage() {
  const { login, autenticado, cargando, rol } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState(null)
  const [errores, setErrores] = useState({})
  const [enviando, setEnviando] = useState(false)

  // Mientras se restaura la sesion no se muestra el formulario: evita el
  // parpadeo del login a quien ya estaba autenticado.
  if (cargando) {
    return (
      <div className="grid min-h-dvh place-items-center bg-papel">
        <Spinner etiqueta="Cargando" />
      </div>
    )
  }

  if (autenticado) {
    return <Navigate to={destinoTrasLogin(rol, location.state?.from?.pathname)} replace />
  }

  const enviar = async (e) => {
    e.preventDefault()
    setError(null)
    setErrores({})
    setEnviando(true)

    try {
      const u = await login(email.trim(), password)

      // Se evalua con el rol RECIEN devuelto y no con `puede()` del contexto:
      // en este mismo tick el contexto todavia no refleja al usuario nuevo.
      navigate(destinoTrasLogin(u.rol, location.state?.from?.pathname), { replace: true })
    } catch (err) {
      // 422 trae el detalle campo a campo; el resto es un mensaje general.
      if (err.status === 422 && err.errors) {
        setErrores(err.errors)
      } else {
        setError(err.message)
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* ===================== Panel de marca ===================== */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-pino-900 px-8 py-10 lg:px-14 lg:py-14">
        {/* Fotografia de instrumental en penumbra. Va como capa de fondo y no
            como elemento: el panel sigue siendo tipografia sobre color, y la
            imagen aporta profundidad sin robarle la lectura. */}
        <img
          src="/consultorio.webp"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full object-cover object-right"
        />

        {/* Velo pino. Hace dos trabajos a la vez: devuelve al verde
            institucional el tono oliva de la foto, y garantiza el contraste
            del texto, que vive sobre el tercio izquierdo. Sin esto el blanco
            sobre la zona iluminada no llegaria a 4.5:1. */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(100deg, rgba(18,36,29,0.97) 0%, rgba(18,36,29,0.94) 40%, rgba(18,36,29,0.72) 68%, rgba(18,36,29,0.42) 100%)',
          }}
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center border border-laton-500/70">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="var(--color-laton-300)" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-laton-500">
              Gestion clinica veterinaria
            </span>
          </div>
        </div>

        <div className="relative my-10 max-w-md lg:my-0">
          <h1 className="font-display text-[clamp(2.6rem,6vw,4.2rem)] font-light leading-[0.95] tracking-[-0.03em] text-papel">
            VetClinic
          </h1>

          <div className="my-6 h-px w-24 bg-laton-500" aria-hidden="true" />

          <p className="max-w-sm text-[14.5px] leading-relaxed text-pino-200">
            Clientes, pacientes, historia clinica y agenda. Todo el consultorio
            en un solo registro, disponible tambien sin conexion.
          </p>
        </div>

        <ul className="relative hidden gap-8 lg:flex">
          {[
            ['05', 'Modulos'],
            ['3', 'Roles'],
            ['PWA', 'Instalable'],
          ].map(([valor, etiqueta]) => (
            <li key={etiqueta}>
              <p className="num font-display text-[26px] font-light leading-none text-laton-300">
                {valor}
              </p>
              <p className="mt-1.5 text-[9.5px] uppercase tracking-[0.16em] text-pino-300">
                {etiqueta}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ===================== Formulario ===================== */}
      <section className="flex items-center justify-center bg-papel px-6 py-12 lg:px-14">
        <div className="escalonar w-full max-w-[350px]">
          <div>
            <p className="rotulo">Acceso al sistema</p>
            <h2 className="mt-2 font-display text-[27px] font-medium leading-tight tracking-[-0.025em] text-tinta">
              Iniciar sesion
            </h2>
            <div className="filete mt-5" aria-hidden="true" />
          </div>

          <form onSubmit={enviar} className="mt-7 space-y-5" noValidate>
            {error && <Alert tono="error">{error}</Alert>}

            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              required
              requerido
              autoFocus
              placeholder="usuario@clinica.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errores.email}
            />

            <div className="relative">
              <Input
                label="Contrasena"
                type={verPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                required
                requerido
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errores.password}
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                aria-label={verPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                className="absolute right-2 top-[27px] rounded p-1.5 text-tinta-4 transition-colors hover:text-tinta-2"
              >
                <svg className="size-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  {verPassword ? (
                    <path strokeLinecap="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.24A9.1 9.1 0 0112 4c4.5 0 8.3 2.9 9.5 7a10.9 10.9 0 01-3.2 4.6M6.6 6.6A10.9 10.9 0 002.5 11c1.2 4.1 5 7 9.5 7 1.2 0 2.3-.2 3.4-.6" />
                  ) : (
                    <>
                      <path strokeLinecap="round" d="M2.5 11C3.7 6.9 7.5 4 12 4s8.3 2.9 9.5 7c-1.2 4.1-5 7-9.5 7s-8.3-2.9-9.5-7z" />
                      <circle cx="12" cy="11" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>

            <Button type="submit" cargando={enviando} className="w-full" tamanio="lg">
              {enviando ? 'Verificando...' : 'Ingresar'}
            </Button>
          </form>

          {/* Credenciales de desarrollo: no llegan al build de produccion,
              import.meta.env.DEV queda en false y el bloque se elimina. */}
          {import.meta.env.DEV && (
            <div className="mt-8 border-t border-linea pt-4">
              <p className="rotulo mb-2">Usuarios de prueba &mdash; solo desarrollo</p>
              <ul className="num space-y-0.5 text-[11.5px] text-tinta-3">
                <li>admin@vet.local &mdash; admin1234</li>
                <li>vet@vet.local &mdash; vet12345</li>
                <li>recepcion@vet.local &mdash; recep1234</li>
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
