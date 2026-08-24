import { useState } from 'react'
import { clientesApi } from '../../api/clientes'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { Modal } from '../../components/ui/Modal'

const VACIO = {
  nombre: '',
  apellido: '',
  documento: '',
  telefono: '',
  telefono_alt: '',
  email: '',
  direccion: '',
  ciudad: '',
  codigo_postal: '',
  notas: '',
}

/**
 * Alta y edicion de clientes en un modal.
 *
 * La validacion del cliente es solo para dar respuesta inmediata: la que
 * cuenta es la del servidor, cuyos errores 422 se pintan campo a campo sobre
 * el mismo formulario.
 */
export function ClienteForm({ abierto, cliente = null, onCerrar, onGuardado }) {
  const esEdicion = cliente !== null

  const [datos, setDatos] = useState(() =>
    cliente ? { ...VACIO, ...limpiarNulos(cliente) } : VACIO
  )
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cambiar = (campo) => (e) => {
    setDatos((d) => ({ ...d, [campo]: e.target.value }))
    // Se borra el error del campo al primer cambio: dejarlo visible mientras
    // el usuario ya lo esta corrigiendo es ruido.
    setErrores((err) => (err[campo] ? { ...err, [campo]: undefined } : err))
  }

  const enviar = async (e) => {
    e.preventDefault()
    setError(null)
    setErrores({})
    setGuardando(true)

    try {
      const guardado = esEdicion
        ? await clientesApi.actualizar(cliente.id, datos)
        : await clientesApi.crear(datos)

      onGuardado?.(guardado)
      onCerrar?.()
    } catch (err) {
      if (err.status === 422 && err.errors) {
        setErrores(err.errors)
      } else {
        setError(err.message)
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={esEdicion ? 'Editar cliente' : 'Nuevo cliente'}
      ancho="max-w-2xl"
      pie={
        <>
          <Button variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-cliente" cargando={guardando}>
            {esEdicion ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </>
      }
    >
      <form id="form-cliente" onSubmit={enviar} className="space-y-4" noValidate>
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
            label="Documento"
            value={datos.documento}
            onChange={cambiar('documento')}
            error={errores.documento}
            ayuda="DNI, CUIT o equivalente"
            maxLength={30}
          />
          <Input
            label="Telefono"
            requerido
            type="tel"
            inputMode="tel"
            value={datos.telefono}
            onChange={cambiar('telefono')}
            error={errores.telefono}
            maxLength={30}
          />
          <Input
            label="Telefono alternativo"
            type="tel"
            inputMode="tel"
            value={datos.telefono_alt}
            onChange={cambiar('telefono_alt')}
            error={errores.telefono_alt}
            maxLength={30}
          />
          <Input
            label="Email"
            type="email"
            inputMode="email"
            value={datos.email}
            onChange={cambiar('email')}
            error={errores.email}
            maxLength={150}
          />
          <Input
            label="Direccion"
            className="sm:col-span-2"
            value={datos.direccion}
            onChange={cambiar('direccion')}
            error={errores.direccion}
            maxLength={200}
          />
          <Input
            label="Ciudad"
            value={datos.ciudad}
            onChange={cambiar('ciudad')}
            error={errores.ciudad}
            maxLength={80}
          />
          <Input
            label="Codigo postal"
            value={datos.codigo_postal}
            onChange={cambiar('codigo_postal')}
            error={errores.codigo_postal}
            maxLength={20}
          />
          <Input
            as="textarea"
            label="Notas"
            className="sm:col-span-2"
            value={datos.notas}
            onChange={cambiar('notas')}
            error={errores.notas}
            maxLength={2000}
            ayuda="Observaciones internas sobre el cliente"
          />
        </div>
      </form>
    </Modal>
  )
}

/**
 * La API devuelve null en los campos vacios, pero un <input> controlado con
 * value={null} pasa a no controlado y React emite un warning. Se normaliza
 * a cadena vacia.
 */
function limpiarNulos(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v ?? '']))
}
