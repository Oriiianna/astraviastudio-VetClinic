import { Link, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../auth/ProtectedRoute'
import { AppShell } from '../components/layout/AppShell'
import { LoginPage } from '../features/auth/LoginPage'
import { InicioPage } from '../features/inicio/InicioPage'
import { ClientesPage } from '../features/clientes/ClientesPage'
import { ClienteDetalle } from '../features/clientes/ClienteDetalle'
import { PerfilPage } from '../features/perfil/PerfilPage'
import { UsuariosPage } from '../features/usuarios/UsuariosPage'
import { PacientesPage } from '../features/pacientes/PacientesPage'
import { PacienteDetalle } from '../features/pacientes/PacienteDetalle'
import { HistorialPage } from '../features/historial/HistorialPage'
import { HistorialPaciente } from '../features/historial/HistorialPaciente'
import { TurnosPage } from '../features/turnos/TurnosPage'

/**
 * Arbol de rutas.
 *
 * Cada modulo se protege con el permiso que le corresponde. Recordar que es
 * una barrera de UX: la autorizacion real la aplica RoleMiddleware en la API.
 * Todo permiso definido aca tiene que tener su equivalente en routes/api.php.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/sin-permiso" element={<SinPermiso />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<InicioPage />} />

          {/* El perfil no lleva `modulo`: cualquier rol edita sus datos. */}
          <Route path="/perfil" element={<PerfilPage />} />

          <Route element={<ProtectedRoute modulo="clientes" />}>
            <Route path="/clientes" element={<ClientesPage />} />
            <Route path="/clientes/:id" element={<ClienteDetalle />} />
          </Route>

          <Route element={<ProtectedRoute modulo="usuarios" />}>
            <Route path="/usuarios" element={<UsuariosPage />} />
          </Route>

          <Route element={<ProtectedRoute modulo="pacientes" />}>
            <Route path="/pacientes" element={<PacientesPage />} />
            <Route path="/pacientes/:id" element={<PacienteDetalle />} />
          </Route>

          <Route element={<ProtectedRoute modulo="historial" />}>
            <Route path="/historial" element={<HistorialPage />} />
            <Route path="/historial/:pacienteId" element={<HistorialPaciente />} />
          </Route>

          <Route element={<ProtectedRoute modulo="turnos" />}>
            <Route path="/turnos" element={<TurnosPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  )
}

function SinPermiso() {
  return (
    <Mensaje
      codigo="403"
      titulo="No tenes permiso"
      detalle="Tu rol no tiene acceso a esta seccion. Si creess que es un error, consulta con un administrador."
    />
  )
}

function NoEncontrado() {
  return <Mensaje codigo="404" titulo="Pagina no encontrada" detalle="La direccion que abriste no existe." />
}

function Mensaje({ codigo, titulo, detalle }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-papel-hondo px-4">
      <div className="text-center">
        <p className="text-[13px] font-medium text-pino-700">{codigo}</p>
        <h1 className="mt-2 text-[27px] font-medium tracking-[-0.02em] text-tinta">{titulo}</h1>
        <p className="mt-2 max-w-sm text-[13px] text-tinta-3">{detalle}</p>
        <Link
          to="/"
          className="mt-6 inline-block rounded bg-pino-800 px-4 py-2 text-[13px] font-medium text-papel hover:bg-pino-700"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
