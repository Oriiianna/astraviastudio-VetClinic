import { useState } from 'react'
import { consultasApi } from '../../api/historial'
import { SelectorPaciente } from '../../components/SelectorPaciente'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { Modal } from '../../components/ui/Modal'
import { VIAS_RECETA } from '../../lib/constants'

const RECETA_VACIA = {
  medicamento: '',
  presentacion: '',
  dosis: '',
  frecuencia: '',
  duracion: '',
  via: 'oral',
  indicaciones: '',
}

/** Fecha y hora actuales en el formato que espera <input type="datetime-local">. */
function ahoraLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())

  return d.toISOString().slice(0, 16)
}

const VACIA = {
  paciente_id: '',
  fecha: ahoraLocal(),
  motivo: '',
  anamnesis: '',
  examen_fisico: '',
  peso_kg: '',
  temperatura_c: '',
  frecuencia_cardiaca: '',
  frecuencia_respiratoria: '',
  diagnostico: '',
  tratamiento: '',
  observaciones: '',
  proximo_control: '',
}

/**
 * Registro de una consulta medica con sus recetas.
 *
 * Las recetas son filas dinamicas que se guardan en la MISMA peticion que la
 * consulta: el backend las inserta dentro de una transaccion, asi no puede
 * quedar una consulta sin sus indicaciones.
 */
export function ConsultaForm({ abierto, consulta = null, pacienteFijo = null, onCerrar, onGuardado }) {
  const esEdicion = consulta !== null

  const [datos, setDatos] = useState(() => {
    if (consulta) {
      return {
        ...VACIA,
        ...limpiarNulos(consulta),
        fecha: (consulta.fecha ?? '').replace(' ', 'T').slice(0, 16),
      }
    }

    return pacienteFijo ? { ...VACIA, paciente_id: pacienteFijo.id } : VACIA
  })

  const [recetas, setRecetas] = useState(() =>
    consulta?.recetas?.length ? consulta.recetas.map((r) => ({ ...RECETA_VACIA, ...limpiarNulos(r) })) : []
  )

  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cambiar = (campo) => (e) => {
    setDatos((d) => ({ ...d, [campo]: e.target.value }))
    setErrores((err) => (err[campo] ? { ...err, [campo]: undefined } : err))
  }

  const cambiarReceta = (i, campo) => (e) => {
    const valor = e.target.value
    setRecetas((rs) => rs.map((r, idx) => (idx === i ? { ...r, [campo]: valor } : r)))
    setErrores((err) => ({ ...err, [`recetas.${i}.${campo}`]: undefined }))
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

      // El backend espera 'Y-m-d H:i:s'; el input da 'Y-m-dTH:i'.
      if (payload.fecha) payload.fecha = payload.fecha.replace('T', ' ') + ':00'

      payload.recetas = recetas.filter((r) => r.medicamento.trim() !== '')

      const guardada = esEdicion
        ? await consultasApi.actualizar(consulta.id, payload)
        : await consultasApi.crear(payload)

      onGuardado?.(guardada)
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
      titulo={esEdicion ? 'Editar consulta' : 'Nueva consulta'}
      ancho="max-w-3xl"
      pie={
        <>
          <Button variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-consulta" cargando={guardando}>
            {esEdicion ? 'Guardar cambios' : 'Registrar consulta'}
          </Button>
        </>
      }
    >
      <form id="form-consulta" onSubmit={enviar} className="space-y-5" noValidate>
        {error && <Alert tono="error">{error}</Alert>}

        {pacienteFijo ? (
          <div className="rounded bg-papel-hondo px-3 py-2 text-[13px]">
            <span className="text-tinta-3">Paciente: </span>
            <span className="font-medium text-tinta">{pacienteFijo.nombre}</span>
            <span className="ml-2 text-tinta-3">
              {pacienteFijo.especie}
              {pacienteFijo.raza ? ` / ${pacienteFijo.raza}` : ''}
            </span>
          </div>
        ) : (
          <SelectorPaciente
            requerido
            error={errores.paciente_id}
            pacienteInicial={
              esEdicion
                ? {
                    id: consulta.paciente_id,
                    nombre: consulta.paciente_nombre,
                    especie: consulta.especie,
                    cliente_nombre: consulta.cliente_nombre,
                    cliente_apellido: consulta.cliente_apellido,
                  }
                : null
            }
            onChange={(p) => {
              setDatos((d) => ({ ...d, paciente_id: p?.id ?? '' }))
              setErrores((err) => ({ ...err, paciente_id: undefined }))
            }}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Motivo de la consulta"
            requerido
            className="sm:col-span-2"
            value={datos.motivo}
            onChange={cambiar('motivo')}
            error={errores.motivo}
            maxLength={200}
            autoFocus
          />

          <Input
            label="Fecha y hora"
            type="datetime-local"
            value={datos.fecha}
            onChange={cambiar('fecha')}
            error={errores.fecha}
          />

          <Input
            label="Proximo control"
            type="date"
            value={datos.proximo_control}
            onChange={cambiar('proximo_control')}
            error={errores.proximo_control}
          />

          <Input
            as="textarea"
            label="Anamnesis"
            className="sm:col-span-2"
            value={datos.anamnesis}
            onChange={cambiar('anamnesis')}
            error={errores.anamnesis}
            ayuda="Lo que relata el dueno"
            maxLength={5000}
          />
        </div>

        {/* --- Signos vitales --- */}
        <fieldset className="rounded border border-linea p-4">
          <legend className="px-1 text-[13px] font-medium text-tinta-2">Signos vitales</legend>

          <div className="grid gap-4 sm:grid-cols-4">
            <Input
              label="Peso (kg)"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={datos.peso_kg}
              onChange={cambiar('peso_kg')}
              error={errores.peso_kg}
              ayuda="Actualiza la ficha"
            />
            <Input
              label="Temp. (C)"
              type="number"
              step="0.1"
              inputMode="decimal"
              value={datos.temperatura_c}
              onChange={cambiar('temperatura_c')}
              error={errores.temperatura_c}
            />
            <Input
              label="F. cardiaca"
              type="number"
              inputMode="numeric"
              value={datos.frecuencia_cardiaca}
              onChange={cambiar('frecuencia_cardiaca')}
              error={errores.frecuencia_cardiaca}
            />
            <Input
              label="F. respiratoria"
              type="number"
              inputMode="numeric"
              value={datos.frecuencia_respiratoria}
              onChange={cambiar('frecuencia_respiratoria')}
              error={errores.frecuencia_respiratoria}
            />
          </div>
        </fieldset>

        <Input
          as="textarea"
          label="Examen fisico"
          value={datos.examen_fisico}
          onChange={cambiar('examen_fisico')}
          error={errores.examen_fisico}
          maxLength={5000}
        />

        <Input
          as="textarea"
          label="Diagnostico"
          value={datos.diagnostico}
          onChange={cambiar('diagnostico')}
          error={errores.diagnostico}
          maxLength={5000}
        />

        <Input
          as="textarea"
          label="Tratamiento"
          value={datos.tratamiento}
          onChange={cambiar('tratamiento')}
          error={errores.tratamiento}
          maxLength={5000}
        />

        {/* --- Recetas --- */}
        <fieldset className="rounded border border-linea p-4">
          <legend className="px-1 text-[13px] font-medium text-tinta-2">
            Receta ({recetas.length})
          </legend>

          {recetas.length === 0 && (
            <p className="mb-3 text-[13px] text-tinta-3">
              Sin medicamentos indicados.
            </p>
          )}

          <div className="space-y-4">
            {recetas.map((r, i) => (
              <div key={i} className="rounded bg-papel-hondo p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11.5px] font-medium text-tinta-3">Medicamento {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => setRecetas((rs) => rs.filter((_, idx) => idx !== i))}
                    className="text-[11.5px] font-medium text-ladrillo-600 hover:underline"
                  >
                    Quitar
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Medicamento"
                    requerido
                    value={r.medicamento}
                    onChange={cambiarReceta(i, 'medicamento')}
                    error={errores[`recetas.${i}.medicamento`]}
                    maxLength={150}
                  />
                  <Input
                    label="Presentacion"
                    value={r.presentacion}
                    onChange={cambiarReceta(i, 'presentacion')}
                    error={errores[`recetas.${i}.presentacion`]}
                    maxLength={100}
                  />
                  <Input
                    label="Dosis"
                    requerido
                    value={r.dosis}
                    onChange={cambiarReceta(i, 'dosis')}
                    error={errores[`recetas.${i}.dosis`]}
                    maxLength={100}
                  />
                  <Input
                    label="Frecuencia"
                    requerido
                    value={r.frecuencia}
                    onChange={cambiarReceta(i, 'frecuencia')}
                    error={errores[`recetas.${i}.frecuencia`]}
                    maxLength={100}
                    ayuda="ej: cada 12 horas"
                  />
                  <Input
                    label="Duracion"
                    value={r.duracion}
                    onChange={cambiarReceta(i, 'duracion')}
                    error={errores[`recetas.${i}.duracion`]}
                    maxLength={100}
                    ayuda="ej: 7 dias"
                  />
                  <Select label="Via" value={r.via} onChange={cambiarReceta(i, 'via')}>
                    {Object.entries(VIAS_RECETA).map(([v, etiqueta]) => (
                      <option key={v} value={v}>
                        {etiqueta}
                      </option>
                    ))}
                  </Select>
                  <Input
                    as="textarea"
                    label="Indicaciones"
                    className="sm:col-span-2"
                    value={r.indicaciones}
                    onChange={cambiarReceta(i, 'indicaciones')}
                    error={errores[`recetas.${i}.indicaciones`]}
                    maxLength={1000}
                  />
                </div>
              </div>
            ))}
          </div>

          <Button
            variante="secundario"
            tamanio="sm"
            className="mt-3"
            onClick={() => setRecetas((rs) => [...rs, { ...RECETA_VACIA }])}
          >
            Agregar medicamento
          </Button>
        </fieldset>

        <Input
          as="textarea"
          label="Observaciones"
          value={datos.observaciones}
          onChange={cambiar('observaciones')}
          error={errores.observaciones}
          maxLength={5000}
        />
      </form>
    </Modal>
  )
}

function limpiarNulos(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v ?? '']))
}
