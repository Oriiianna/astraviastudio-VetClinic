import { useState } from 'react'
import { pacientesApi } from '../../api/pacientes'
import { useCatalogo, razasDe } from './useCatalogo'
import { SelectorCliente } from './SelectorCliente'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { Modal } from '../../components/ui/Modal'
import { SEXOS } from '../../lib/constants'
import { hoyISO } from '../../lib/format'

const VACIO = {
  cliente_id: '',
  nombre: '',
  especie_id: '',
  raza_id: '',
  sexo: 'desconocido',
  fecha_nacimiento: '',
  peso_kg: '',
  color: '',
  microchip: '',
  esterilizado: false,
  alergias: '',
  observaciones: '',
  fallecido: false,
  fecha_fallecimiento: '',
}

/** Alta y edicion de pacientes. Misma estructura que ClienteForm. */
export function PacienteForm({
  abierto,
  paciente = null,
  clienteFijo = null,
  onCerrar,
  onGuardado,
}) {
  const esEdicion = paciente !== null
  const { especies, cargando: cargandoCatalogo, error: errorCatalogo } = useCatalogo()

  const [datos, setDatos] = useState(() => {
    if (paciente) return { ...VACIO, ...limpiarNulos(paciente) }
    return clienteFijo ? { ...VACIO, cliente_id: clienteFijo.id } : VACIO
  })

  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const razas = razasDe(especies, datos.especie_id)

  const cambiar = (campo) => (e) => {
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value

    setDatos((d) => {
      // Cambiar de especie invalida la raza elegida: dejarla produciria un
      // caniche registrado como felino, que el backend rechaza igual.
      if (campo === 'especie_id') return { ...d, especie_id: valor, raza_id: '' }

      return { ...d, [campo]: valor }
    })

    setErrores((err) => (err[campo] ? { ...err, [campo]: undefined } : err))
  }

  const enviar = async (e) => {
    e.preventDefault()
    setError(null)
    setErrores({})
    setGuardando(true)

    try {
      // Los vacios van como null: el backend distingue "sin dato" de "".
      const payload = Object.fromEntries(
        Object.entries(datos).map(([k, v]) => [k, v === '' ? null : v])
      )

      const guardado = esEdicion
        ? await pacientesApi.actualizar(paciente.id, payload)
        : await pacientesApi.crear(payload)

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
      titulo={esEdicion ? `Editar a ${paciente.nombre}` : 'Nuevo paciente'}
      ancho="max-w-2xl"
      pie={
        <>
          <Button variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-paciente" cargando={guardando}>
            {esEdicion ? 'Guardar cambios' : 'Crear paciente'}
          </Button>
        </>
      }
    >
      <form id="form-paciente" onSubmit={enviar} className="space-y-4" noValidate>
        {error && <Alert tono="error">{error}</Alert>}
        {errorCatalogo && (
          <Alert tono="error">No se pudo cargar el catalogo de especies: {errorCatalogo}</Alert>
        )}

        {/* Dueno ya vinculado (alta desde su ficha o desde el listado
            filtrado por cliente). No se ofrece cambiarlo: si hiciera falta,
            se da de alta desde Pacientes, que si permite elegir. Se muestran
            documento y telefono para poder confirmar de un vistazo que es la
            persona correcta antes de guardar. */}
        {clienteFijo ? (
          <div className="rounded border border-pino-200 bg-pino-50 px-3.5 py-3">
            <p className="rotulo !text-pino-700">Dueno vinculado</p>
            <p className="mt-1 text-[13.5px] font-medium text-tinta">
              {clienteFijo.apellido}, {clienteFijo.nombre}
            </p>
            <p className="num mt-0.5 text-[12px] text-tinta-2">
              {clienteFijo.documento ? `Doc. ${clienteFijo.documento}` : 'Sin documento registrado'}
              {clienteFijo.telefono && ` · ${clienteFijo.telefono}`}
            </p>
          </div>
        ) : (
          <SelectorCliente
            requerido
            error={errores.cliente_id}
            clienteInicial={
              esEdicion
                ? {
                    id: paciente.cliente_id,
                    nombre: paciente.cliente_nombre,
                    apellido: paciente.cliente_apellido,
                    telefono: paciente.cliente_telefono,
                  }
                : null
            }
            onChange={(id) => {
              setDatos((d) => ({ ...d, cliente_id: id }))
              setErrores((err) => ({ ...err, cliente_id: undefined }))
            }}
          />
        )}

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

          <Select
            label="Sexo"
            value={datos.sexo}
            onChange={cambiar('sexo')}
            error={errores.sexo}
          >
            {Object.entries(SEXOS).map(([v, etiqueta]) => (
              <option key={v} value={v}>
                {etiqueta}
              </option>
            ))}
          </Select>

          <Select
            label="Especie"
            requerido
            value={datos.especie_id}
            onChange={cambiar('especie_id')}
            error={errores.especie_id}
            disabled={cargandoCatalogo}
          >
            <option value="">{cargandoCatalogo ? 'Cargando...' : 'Seleccionar...'}</option>
            {especies.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </Select>

          <Select
            label="Raza"
            value={datos.raza_id}
            onChange={cambiar('raza_id')}
            error={errores.raza_id}
            disabled={!datos.especie_id}
          >
            <option value="">
              {datos.especie_id ? 'Sin especificar' : 'Elegi una especie primero'}
            </option>
            {razas.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </Select>

          <Input
            label="Fecha de nacimiento"
            type="date"
            value={datos.fecha_nacimiento}
            onChange={cambiar('fecha_nacimiento')}
            error={errores.fecha_nacimiento}
            max={hoyISO()}
            ayuda="La edad se calcula sola a partir de esta fecha"
          />

          <Input
            label="Peso (kg)"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={datos.peso_kg}
            onChange={cambiar('peso_kg')}
            error={errores.peso_kg}
          />

          <Input
            label="Color"
            value={datos.color}
            onChange={cambiar('color')}
            error={errores.color}
            maxLength={60}
          />

          <Input
            label="Microchip"
            value={datos.microchip}
            onChange={cambiar('microchip')}
            error={errores.microchip}
            maxLength={50}
          />

          <Input
            as="textarea"
            label="Alergias"
            className="sm:col-span-2"
            value={datos.alergias}
            onChange={cambiar('alergias')}
            error={errores.alergias}
            maxLength={2000}
            ayuda="Se muestra destacado en la ficha del paciente"
          />

          <Input
            as="textarea"
            label="Observaciones"
            className="sm:col-span-2"
            value={datos.observaciones}
            onChange={cambiar('observaciones')}
            error={errores.observaciones}
            maxLength={2000}
          />
        </div>

        <label className="flex items-center gap-2 text-[13px] text-tinta-2">
          <input
            type="checkbox"
            checked={Boolean(datos.esterilizado)}
            onChange={cambiar('esterilizado')}
            className="size-4 rounded border-linea-fuerte text-pino-700 focus:border-pino-600"
          />
          Esterilizado / castrado
        </label>

        <div className="border-t border-linea pt-4">
          <label className="flex items-center gap-2 text-[13px] text-tinta-2">
            <input
              type="checkbox"
              checked={Boolean(datos.fallecido)}
              onChange={cambiar('fallecido')}
              className="size-4 rounded border-linea-fuerte text-ladrillo-600 focus:ring-ladrillo-600"
            />
            El animal falleció
          </label>

          {Boolean(datos.fallecido) && (
            <Input
              label="Fecha de fallecimiento"
              type="date"
              className="mt-3 max-w-xs"
              value={datos.fecha_fallecimiento}
              onChange={cambiar('fecha_fallecimiento')}
              error={errores.fecha_fallecimiento}
              max={hoyISO()}
              ayuda="La ficha y su historial clinico se conservan"
            />
          )}
        </div>
      </form>
    </Modal>
  )
}

/**
 * La API devuelve null en los campos vacios, pero un <input> controlado con
 * value={null} pasa a no controlado y React emite un warning.
 */
function limpiarNulos(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (typeof v === 'number' && (k === 'esterilizado' || k === 'fallecido')) {
        return [k, Boolean(v)]
      }
      return [k, v ?? '']
    })
  )
}
