import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { perfilApi } from '../../api/usuarios'
import { useAuth } from '../../auth/useAuth'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/layout/PageHeader'
import { Input } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { ROLES } from '../../lib/constants'
import { formatearFechaHora } from '../../lib/format'

/**
 * Datos propios del usuario. Accesible para cualquier rol.
 *
 * Rol y estado NO se editan aca: son atribuciones del administrador, y la API
 * los ignora si llegan en este formulario. Se muestran como informacion.
 */
export function PerfilPage() {
  // Los datos se piden a /auth/me y no se toman del contexto: el contexto
  // guarda la foto del momento del login, y aca se editan justamente esos
  // campos, asi que hay que leer el estado real del servidor.
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(null)
  const [guardando, setGuardando] = useState(false)

  // Cambio de contrasena: bloque aparte porque cierra todas las sesiones.
  const [pass, setPass] = useState({ actual: '', nueva: '', repetir: '' })
  const [erroresPass, setErroresPass] = useState({})
  const [errorPass, setErrorPass] = useState(null)
  const [cambiando, setCambiando] = useState(false)

  useEffect(() => {
    perfilApi
      .obtener()
      .then((p) =>
        setDatos({
          nombre: p.nombre ?? '',
          apellido: p.apellido ?? '',
          email: p.email ?? '',
          telefono: p.telefono ?? '',
          matricula: p.matricula ?? '',
          rol: p.rol,
          ultimo_acceso: p.ultimo_acceso,
        })
      )
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  const cambiar = (campo) => (e) => {
    setDatos((d) => ({ ...d, [campo]: e.target.value }))
    setErrores((err) => (err[campo] ? { ...err, [campo]: undefined } : err))
    setOk(null)
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError(null)
    setErrores({})
    setOk(null)
    setGuardando(true)

    try {
      await perfilApi.actualizar({
        nombre: datos.nombre,
        apellido: datos.apellido,
        email: datos.email,
        telefono: datos.telefono || null,
        matricula: datos.matricula || null,
      })

      setOk('Tus datos se actualizaron correctamente.')
    } catch (err) {
      if (err.status === 422 && err.errors) setErrores(err.errors)
      else setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const cambiarPassword = async (e) => {
    e.preventDefault()
    setErrorPass(null)
    setErroresPass({})

    if (pass.nueva !== pass.repetir) {
      setErroresPass({ repetir: 'Las contrasenas no coinciden.' })

      return
    }

    setCambiando(true)

    try {
      await perfilApi.cambiarPassword(pass.actual, pass.nueva)

      // El servidor revoca todas las sesiones al cambiar la clave, incluida
      // la actual: hay que volver a entrar.
      await logout()
      navigate('/login', { replace: true })
    } catch (err) {
      if (err.status === 422 && err.errors) setErroresPass(err.errors)
      else setErrorPass(err.message)
    } finally {
      setCambiando(false)
    }
  }

  if (cargando) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner etiqueta="Cargando perfil..." />
      </div>
    )
  }

  if (!datos) {
    return (
      <div className="mx-auto max-w-xl">
        <Alert tono="error">{error ?? 'No se pudo cargar el perfil.'}</Alert>
      </div>
    )
  }

  return (
    <div className="escalonar mx-auto max-w-2xl">
      <PageHeader
        rotulo="Cuenta"
        titulo="Mis datos"
        bajada={
          <>
            Ingresaste como <strong className="font-medium text-tinta-2">{ROLES[datos.rol]}</strong>.
            {datos.ultimo_acceso && ` Ultimo acceso: ${formatearFechaHora(datos.ultimo_acceso)}.`}
          </>
        }
      />

      {/* ===================== Datos personales ===================== */}
      <form onSubmit={guardar} className="mb-12" noValidate>
        <h2 className="rotulo mb-4 border-b border-linea pb-2.5">Datos personales</h2>

        {error && (
          <Alert tono="error" className="mb-4">
            {error}
          </Alert>
        )}
        {ok && (
          <Alert tono="ok" className="mb-4">
            {ok}
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nombre"
            requerido
            value={datos.nombre}
            onChange={cambiar('nombre')}
            error={errores.nombre}
            maxLength={80}
          />
          <Input
            label="Apellido"
            requerido
            value={datos.apellido}
            onChange={cambiar('apellido')}
            error={errores.apellido}
            maxLength={80}
          />
          <Input
            label="Email"
            type="email"
            requerido
            className="sm:col-span-2"
            value={datos.email}
            onChange={cambiar('email')}
            error={errores.email}
            maxLength={150}
            ayuda="Es tu usuario para iniciar sesion"
          />
          <Input
            label="Telefono"
            type="tel"
            value={datos.telefono}
            onChange={cambiar('telefono')}
            error={errores.telefono}
            maxLength={30}
          />
          {datos.rol === 'veterinario' && (
            <Input
              label="Matricula"
              value={datos.matricula}
              onChange={cambiar('matricula')}
              error={errores.matricula}
              maxLength={50}
              ayuda="Figura en las consultas que firmes"
            />
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <Button type="submit" cargando={guardando}>
            Guardar cambios
          </Button>
        </div>
      </form>

      {/* ===================== Contrasena ===================== */}
      <form onSubmit={cambiarPassword} noValidate>
        <h2 className="rotulo mb-4 border-b border-linea pb-2.5">Cambiar contrasena</h2>

        {errorPass && (
          <Alert tono="error" className="mb-4">
            {errorPass}
          </Alert>
        )}

        <Alert tono="aviso" className="mb-4">
          Al cambiarla se cierran todas tus sesiones, incluida esta, y vas a tener que
          volver a ingresar.
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Contrasena actual"
            type="password"
            autoComplete="current-password"
            className="sm:col-span-2"
            value={pass.actual}
            onChange={(e) => setPass((p) => ({ ...p, actual: e.target.value }))}
            error={erroresPass.password_actual}
          />
          <Input
            label="Contrasena nueva"
            type="password"
            autoComplete="new-password"
            value={pass.nueva}
            onChange={(e) => setPass((p) => ({ ...p, nueva: e.target.value }))}
            error={erroresPass.password_nueva}
            ayuda="Minimo 8 caracteres"
          />
          <Input
            label="Repetir la nueva"
            type="password"
            autoComplete="new-password"
            value={pass.repetir}
            onChange={(e) => setPass((p) => ({ ...p, repetir: e.target.value }))}
            error={erroresPass.repetir}
          />
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            type="submit"
            variante="secundario"
            cargando={cambiando}
            disabled={!pass.actual || !pass.nueva}
          >
            Cambiar contrasena
          </Button>
        </div>
      </form>
    </div>
  )
}
