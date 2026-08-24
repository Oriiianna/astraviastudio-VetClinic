import { Component } from 'react'

/**
 * Red de contencion para errores de renderizado.
 *
 * Sin esto, una excepcion en cualquier componente deja la pantalla en blanco
 * y el usuario no tiene forma de saber que paso ni como salir. Tiene que ser
 * una clase: React todavia no ofrece equivalente en hooks.
 */
export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Punto natural para enviar el error a un servicio de monitoreo.
    console.error('Error no controlado en la UI:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="grid min-h-dvh place-items-center bg-papel-hondo px-4">
        <div className="w-full max-w-md rounded border border-linea bg-papel-alto p-6 text-center">
          <h1 className="text-[16px] font-medium text-tinta">Algo salio mal</h1>
          <p className="mt-2 text-[13px] text-tinta-3">
            Ocurrio un error inesperado en la aplicacion. Recarga la pagina para continuar.
          </p>

          {import.meta.env.DEV && (
            <pre className="mt-4 overflow-x-auto rounded bg-papel-hondo p-3 text-left text-[11.5px] text-ladrillo-700">
              {this.state.error.message}
            </pre>
          )}

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded bg-pino-800 px-4 py-2 text-[13px] font-medium text-papel hover:bg-pino-700"
          >
            Recargar
          </button>
        </div>
      </div>
    )
  }
}
