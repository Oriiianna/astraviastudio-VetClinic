import { useCallback, useEffect, useMemo, useState } from 'react'
import { authApi } from '../api/auth'
import { onSesionExpirada } from '../api/client'
import { AuthContext, PERMISOS } from './contexto'

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  // `cargando` arranca en true: hasta que el refresh inicial no responde no
  // se sabe si hay sesion. Sin este estado, la app parpadearia mostrando el
  // login a alguien que ya estaba autenticado.
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true

    authApi.restaurarSesion().then((u) => {
      if (!vigente) return
      setUsuario(u)
      setCargando(false)
    })

    return () => {
      vigente = false
    }
  }, [])

  // El cliente HTTP avisa cuando un refresh fallo definitivamente, para que
  // el arbol de React reaccione en lugar de quedar mostrando datos viejos.
  useEffect(() => {
    onSesionExpirada(() => setUsuario(null))
  }, [])

  const login = useCallback(async (email, password) => {
    const u = await authApi.login(email, password)
    setUsuario(u)

    return u
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUsuario(null)
  }, [])

  const puede = useCallback(
    (modulo) => (usuario ? (PERMISOS[usuario.rol] ?? []).includes(modulo) : false),
    [usuario]
  )

  const valor = useMemo(
    () => ({
      usuario,
      cargando,
      autenticado: usuario !== null,
      rol: usuario?.rol ?? null,
      login,
      logout,
      puede,
    }),
    [usuario, cargando, login, logout, puede]
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
