import { useContext } from 'react'
import { AuthContext } from './contexto'

export function useAuth() {
  const ctx = useContext(AuthContext)

  if (ctx === null) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.')
  }

  return ctx
}
