import { useCallback, useEffect, useState } from 'react'
import { usuariosApi } from '../../api/usuarios'
import { useAuth } from '../../auth/useAuth'
import { UsuarioForm } from './UsuarioForm'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { ROLES } from '../../lib/constants'
import { formatearFechaHora } from '../../lib/format'

const COLOR_ROL = {
  admin: 'bg-pino-50 text-pino-700 ring-pino-200',
  veterinario: 'bg-laton-100 text-laton-700 ring-laton-300',
  recepcionista: 'bg-papel-hondo text-tinta-2 ring-linea-fuerte',
}

/**
 * Administracion de usuarios. Solo admin (la API devuelve 403 al resto).
 *
 * No hay borrado: un usuario se desactiva. Sus consultas firmadas, turnos y
 * documentos subidos siguen apuntandolo, y un registro medico no puede quedar
 * sin autor.
 */
export function UsuariosPage() {
  const { usuario: yo } = useAuth()

  const [usuarios, setUsuarios] = useState([])
  const [incluirInactivos, setIncluirInactivos] = useState(true)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [reseteando, setReseteando] = useState(null)
  const [passwordNueva, setPasswordNueva] = useState('')
  const [errorAccion, setErrorAccion] = useState(null)
  const [procesando, setProcesando] = useState(false)

  const cargar = useCallback(() => {
    setCargando(true)
    setError(null)

    usuariosApi
      .listar({ incluirInactivos })
      .then((u) => setUsuarios(u ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [incluirInactivos])

  useEffect(cargar, [cargar])

  const alternarEstado = async (u) => {
    setErrorAccion(null)

    try {
      await usuariosApi.cambiarEstado(u.id, Number(u.activo) !== 1)
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const resetear = async () => {
    setProcesando(true)
    setErrorAccion(null)

    try {
      await usuariosApi.resetearPassword(reseteando.id, passwordNueva)
      setReseteando(null)
      setPasswordNueva('')
    } catch (err) {
      setErrorAccion(err.errors?.password ?? err.message)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="escalonar mx-auto max-w-5xl">
      <PageHeader
        rotulo="Administracion"
        titulo="Usuarios"
        bajada={`${usuarios.length} ${usuarios.length === 1 ? 'cuenta' : 'cuentas'} en el sistema`}
        acciones={
          <Button
            onClick={() => {
              setEditando(null)
              setFormAbierto(true)
            }}
          >
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 4a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 0110 4z" />
            </svg>
            Nuevo usuario
          </Button>
        }
      />

      <label className="mb-4 flex items-center gap-2 text-[13px] text-tinta-2">
        <input
          type="checkbox"
          checked={incluirInactivos}
          onChange={(e) => setIncluirInactivos(e.target.checked)}
          className="size-4 rounded-sm border-linea-fuerte text-pino-700"
        />
        Mostrar cuentas desactivadas
      </label>

      {error && (
        <Alert tono="error" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="hoja overflow-hidden">
        {cargando ? (
          <div className="grid place-items-center py-16">
            <Spinner etiqueta="Cargando usuarios..." />
          </div>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-linea bg-papel-hondo/70">
              <tr>
                <th scope="col" className="rotulo px-4 py-3">Usuario</th>
                <th scope="col" className="rotulo px-4 py-3">Rol</th>
                <th scope="col" className="rotulo px-4 py-3">Contacto</th>
                <th scope="col" className="rotulo px-4 py-3">Ultimo acceso</th>
                <th scope="col" className="rotulo px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {usuarios.map((u) => {
                const activo = Number(u.activo) === 1
                const soyYo = u.id === yo?.id

                return (
                  <tr key={u.id} className={`hover:bg-papel-hondo/50 ${activo ? '' : 'opacity-55'}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-tinta">
                        {u.apellido}, {u.nombre}
                        {soyYo && (
                          <span className="ml-2 text-[10px] uppercase tracking-[0.1em] text-laton-700">
                            vos
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] text-tinta-3">{u.email}</p>
                      {!activo && (
                        <p className="text-[11px] uppercase tracking-[0.08em] text-ladrillo-600">
                          Desactivado
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ring-1 ring-inset ${COLOR_ROL[u.rol]}`}
                      >
                        {ROLES[u.rol]}
                      </span>
                      {u.matricula && (
                        <p className="num mt-1 text-[11.5px] text-tinta-3">MP {u.matricula}</p>
                      )}
                    </td>

                    <td className="num px-4 py-3 text-tinta-2">{u.telefono ?? '-'}</td>

                    <td className="num px-4 py-3 text-[12px] text-tinta-3">
                      {u.ultimo_acceso ? formatearFechaHora(u.ultimo_acceso) : 'Nunca ingreso'}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variante="fantasma"
                          tamanio="sm"
                          onClick={() => {
                            setEditando(u)
                            setFormAbierto(true)
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variante="fantasma"
                          tamanio="sm"
                          onClick={() => {
                            setReseteando(u)
                            setPasswordNueva('')
                          }}
                        >
                          Clave
                        </Button>
                        {/* Desactivarse a uno mismo lo bloquea la API; se
                            oculta tambien aca para no ofrecer un callejon. */}
                        {!soyYo && (
                          <Button
                            variante="fantasma"
                            tamanio="sm"
                            className={activo ? 'text-ladrillo-600' : 'text-musgo-600'}
                            onClick={() => alternarEstado(u)}
                          >
                            {activo ? 'Desactivar' : 'Activar'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {formAbierto && (
        <UsuarioForm
          abierto={formAbierto}
          usuario={editando}
          onCerrar={() => setFormAbierto(false)}
          onGuardado={cargar}
        />
      )}

      <Modal
        abierto={reseteando !== null}
        onCerrar={() => setReseteando(null)}
        rotulo="Administracion"
        titulo="Restablecer contrasena"
        pie={
          <>
            <Button variante="secundario" onClick={() => setReseteando(null)} disabled={procesando}>
              Cancelar
            </Button>
            <Button onClick={resetear} cargando={procesando} disabled={passwordNueva.length < 8}>
              Restablecer
            </Button>
          </>
        }
      >
        {errorAccion && (
          <Alert tono="error" className="mb-4">
            {errorAccion}
          </Alert>
        )}

        <p className="mb-4 text-[13px] leading-relaxed text-tinta-2">
          Se asignara una contrasena nueva a{' '}
          <strong className="text-tinta">
            {reseteando?.apellido}, {reseteando?.nombre}
          </strong>{' '}
          y se cerraran todas sus sesiones. Comunicasela por un canal seguro y pedile que
          la cambie al ingresar.
        </p>

        <Input
          label="Contrasena nueva"
          type="text"
          value={passwordNueva}
          onChange={(e) => setPasswordNueva(e.target.value)}
          ayuda="Minimo 8 caracteres. Se muestra en claro para que puedas copiarla."
          maxLength={200}
        />
      </Modal>
    </div>
  )
}
