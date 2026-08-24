import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AppRoutes } from './routes'
import { ErrorBoundary } from './components/ErrorBoundary'
import { OfflineBanner } from './components/layout/OfflineBanner'
import { ReloadPrompt } from './pwa/ReloadPrompt'

export default function App() {
  return (
    <ErrorBoundary>
      {/*
        ReloadPrompt y OfflineBanner van al nivel de la app, FUERA del router
        y de cualquier ruta protegida.

        ReloadPrompt es quien llama a useRegisterSW(), o sea quien registra el
        service worker. Si viviera dentro del AppShell -que solo se monta con
        sesion iniciada- la PWA no se registraria hasta despues del login: el
        visitante no podria instalarla desde la pantalla de acceso ni tendria
        shell cacheado.

        OfflineBanner por lo mismo: sin red la sesion no puede restaurarse y
        el usuario cae en el login, que esta fuera del AppShell. Sin el banner
        se quedaria mirando un formulario que no funciona, sin explicacion.
      */}
      <ReloadPrompt />
      <OfflineBanner />

      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
