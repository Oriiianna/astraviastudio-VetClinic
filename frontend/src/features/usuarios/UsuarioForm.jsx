import { useState } from 'react'
import { usuariosApi } from '../../api/usuarios'
import { useAuth } from '../../auth/useAuth'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { Modal } from '../../components/ui/Modal'
import { ROLES } from '../../lib/constants'

const VACIO = {
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  matricula: '',
  rol: 'recepcionista',
  password: '',
}

/** Alta y edicion de usuarios por parte de un administrador. */
export function UsuarioForm({ abierto, usuario = null, onCerrar, onGuardado }) {
  const esEdicion = usuario !== null
  const { usuario: yo } = useAuth()

  const [datos, setDatos] = useState(() =>
    usuario
      ? {
          ...VACIO,
          nombre: usuario.nombre ?? '',
          apellido: usuario.apellido ?? '',
          email: usuario.email ?? '',
          telefono: usuario.telefono ?? '',
          matricula: usuario.matricula ?? '',
          rol: usuario.rol,
        }
      : VACIO
  )

  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cambiar = (campo) => (e) => {
    setDatos((d) => ({ ...d, [campo]: e.target.value }))
    setErrores((err) => (err[campo] ? { ...err, [campo]: undefined } : err))
  }

  const enviar = async (e) => {
    e.preventDefault()
    setError(null)
    setErrores({})
    setGuardando(true)

    try {
      const base = {
        nombre: datos.nombre,
        apellido: datos.apellido,
        email: datos.email,
        telefono: datos.telefono || null,
        matricula: datos.matricula || null,
        rol: datos.rol,
      }

      if (esEdicion) {
        await usuariosApi.actualizar(usuario.id, base)
      } else {
        await usuariosApi.crear({ ...base, password: datos.password })
      }

      onGuardado?.()
      onCerrar?.()
    } catch (err) {
      if (err.status === 422 && err.errors) setErrores(err.errors)
      else setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  // Un admin no puede quitarse a si mismo el rol: la API lo rechaza con 409 y
  // aca directamente se bloquea el selector, para no ofrecer un camino muerto.
  const esMiPropioAdmin = esEdicion && usuario.id === yo?.id

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      rotulo="Administracion"
      titulo={esEdicion ? `Editar a ${usuario.nombre} ${usuario.apellido}` : 'Nuevo usuario'}
      pie={
        <>
          <Button variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-usuario" cargando={guardando}>
            {esEdicion ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <form id="form-usuario" onSubmit={enviar} className="space-y-4" noValidate>
        {error && <Alert tono="error">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nombre"
            requerido
            value={datos.nombre}
            onChange={cambiar('nombre')}
            error={errores.nombre}
            maxLength={80}
            autoFocus
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
            ayuda="Sera su usuario para iniciar sesion"
          />

          <Select
            label="Rol"
            requerido
            value={datos.rol}
            onChange={cambiar('rol')}
            error={errores.rol}
            disabled={esMiPropioAdmin}
          >
            {Object.entries(ROLES).map(([v, etiqueta]) => (
              <option key={v} value={v}>
                {etiqueta}
              </option>
            ))}
          </Select>

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
              requerido
              className="sm:col-span-2"
              value={datos.matricula}
              onChange={cambiar('matricula')}
              error={errores.matricula}
              maxLength={50}
              ayuda="Figura en las consultas que firme"
            />
          )}

          {!esEdicion && (
            <Input
              label="Contrasena inicial"
              type="text"
              requerido
              className="sm:col-span-2"
              value={datos.password}
              onChange={cambiar('password')}
              error={errores.password}
              maxLength={200}
              ayuda="Minimo 8 caracteres. Se muestra en claro para que puedas comunicarsela."
            />
          )}
        </div>

        {esMiPropioAdmin && (
          <Alert tono="info">
            No podes cambiar tu propio rol. Pedile a otro administrador que lo haga.
          </Alert>
        )}

        {esEdicion && datos.rol !== usuario.rol && (
          <Alert tono="aviso">
            Al cambiar el rol se cerraran las sesiones abiertas de este usuario, porque sus
            permisos viajan dentro del token.
          </Alert>
        )}
      </form>
    </Modal>
  )
}
