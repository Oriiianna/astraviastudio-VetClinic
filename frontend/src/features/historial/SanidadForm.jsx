import { useState } from 'react'
import { vacunasApi, desparasitacionesApi } from '../../api/historial'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { Modal } from '../../components/ui/Modal'
import { TIPOS_DESPARASITACION, VIAS_DESPARASITACION } from '../../lib/constants'
import { hoyISO } from '../../lib/format'

/**
 * Alta y edicion de vacunas y desparasitaciones.
 *
 * Un solo formulario para ambas, igual que en el backend: comparten
 * estructura y solo cambian dos o tres campos.
 */
export function SanidadForm({ abierto, tipo, pacienteId, registro = null, onCerrar, onGuardado }) {
  const esVacuna = tipo === 'vacuna'
  const esEdicion = registro !== null
  const clienteApi = esVacuna ? vacunasApi : desparasitacionesApi

  const [datos, setDatos] = useState(() => ({
    paciente_id: pacienteId,
    fecha_aplicacion: hoyISO(),
    fecha_proxima: '',
    observaciones: '',
    ...(esVacuna
      ? { tipo_vacuna: '', marca: '', lote: '' }
      : { producto: '', tipo: 'interna', via: 'oral', dosis: '' }),
    ...(registro ? limpiarNulos(registro) : {}),
  }))

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
      const payload = Object.fromEntries(
        Object.entries(datos).map(([k, v]) => [k, v === '' ? null : v])
      )
      payload.paciente_id = pacienteId

      const guardado = esEdicion
        ? await clienteApi.actualizar(registro.id, payload)
        : await clienteApi.crear(payload)

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

  const titulo = esVacuna
    ? esEdicion
      ? 'Editar vacuna'
      : 'Registrar vacuna'
    : esEdicion
      ? 'Editar desparasitacion'
      : 'Registrar desparasitacion'

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      pie={
        <>
          <Button variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-sanidad" cargando={guardando}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="form-sanidad" onSubmit={enviar} className="space-y-4" noValidate>
        {error && <Alert tono="error">{error}</Alert>}

        {esVacuna ? (
          <>
            <Input
              label="Vacuna"
              requerido
              value={datos.tipo_vacuna}
              onChange={cambiar('tipo_vacuna')}
              error={errores.tipo_vacuna}
              maxLength={120}
              ayuda="ej: Quintuple, Antirrabica"
              autoFocus
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Marca"
                value={datos.marca}
                onChange={cambiar('marca')}
                error={errores.marca}
                maxLength={100}
              />
              <Input
                label="Lote"
                value={datos.lote}
                onChange={cambiar('lote')}
                error={errores.lote}
                maxLength={80}
              />
            </div>
          </>
        ) : (
          <>
            <Input
              label="Producto"
              requerido
              value={datos.producto}
              onChange={cambiar('producto')}
              error={errores.producto}
              maxLength={120}
              autoFocus
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Select label="Tipo" value={datos.tipo} onChange={cambiar('tipo')}>
                {Object.entries(TIPOS_DESPARASITACION).map(([v, e]) => (
                  <option key={v} value={v}>
                    {e}
                  </option>
                ))}
              </Select>
              <Select label="Via" value={datos.via} onChange={cambiar('via')}>
                {Object.entries(VIAS_DESPARASITACION).map(([v, e]) => (
                  <option key={v} value={v}>
                    {e}
                  </option>
                ))}
              </Select>
              <Input
                label="Dosis"
                value={datos.dosis}
                onChange={cambiar('dosis')}
                error={errores.dosis}
                maxLength={100}
              />
            </div>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Fecha de aplicacion"
            type="date"
            requerido
            value={datos.fecha_aplicacion}
            onChange={cambiar('fecha_aplicacion')}
            error={errores.fecha_aplicacion}
            max={hoyISO()}
          />
          <Input
            label="Proxima dosis"
            type="date"
            value={datos.fecha_proxima}
            onChange={cambiar('fecha_proxima')}
            error={errores.fecha_proxima}
            ayuda="Genera el recordatorio automatico"
          />
        </div>

        <Input
          as="textarea"
          label="Observaciones"
          value={datos.observaciones}
          onChange={cambiar('observaciones')}
          error={errores.observaciones}
          maxLength={2000}
        />
      </form>
    </Modal>
  )
}

function limpiarNulos(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v ?? ''])
  )
}
