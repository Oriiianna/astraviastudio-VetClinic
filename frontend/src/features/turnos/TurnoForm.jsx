import { useEffect, useState } from 'react'
import { turnosApi, veterinariosApi } from '../../api/turnos'
import { SelectorPaciente } from '../../components/SelectorPaciente'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { Modal } from '../../components/ui/Modal'
import { ESTADOS_TURNO, TIPOS_TURNO } from '../../lib/constants'

/** 'Y-m-d H:i:s' -> valor de <input type="datetime-local">. */
function aInputLocal(valor) {
  if (!valor) return ''

  return String(valor).replace(' ', 'T').slice(0, 16)
}

/** Suma minutos a un valor de datetime-local. */
function sumarMinutos(valorLocal, minutos) {
  if (!valorLocal) return ''

  const d = new Date(valorLocal)
  d.setMinutes(d.getMinutes() + minutos)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())

  return d.toISOString().slice(0, 16)
}

export function TurnoForm({ abierto, turno = null, inicioSugerido = null, onCerrar, onGuardado }) {
  const esEdicion = turno !== null

  const [veterinarios, setVeterinarios] = useState([])
  const [datos, setDatos] = useState(() => ({
    paciente_id: turno?.paciente_id ?? '',
    veterinario_id: turno?.veterinario_id ?? '',
    fecha_hora_inicio: aInputLocal(turno?.fecha_hora_inicio) || inicioSugerido || '',
    fecha_hora_fin: aInputLocal(turno?.fecha_hora_fin) || sumarMinutos(inicioSugerido, 30),
    motivo: turno?.motivo ?? '',
    tipo: turno?.tipo ?? 'consulta',
    estado: turno?.estado ?? 'programado',
    notas: turno?.notas ?? '',
  }))

  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    veterinariosApi.listar().then(setVeterinarios).catch(() => setVeterinarios([]))
  }, [])

  const cambiar = (campo) => (e) => {
    const valor = e.target.value

    setDatos((d) => {
      // Mover el inicio arrastra el fin manteniendo la duracion: es lo que
      // uno espera al reprogramar, y evita tener que editar los dos campos.
      if (campo === 'fecha_hora_inicio' && d.fecha_hora_inicio && d.fecha_hora_fin) {
        const dur = (new Date(d.fecha_hora_fin) - new Date(d.fecha_hora_inicio)) / 60000

        return { ...d, fecha_hora_inicio: valor, fecha_hora_fin: sumarMinutos(valor, dur) }
      }

      if (campo === 'fecha_hora_inicio' && !d.fecha_hora_fin) {
        return { ...d, fecha_hora_inicio: valor, fecha_hora_fin: sumarMinutos(valor, 30) }
      }

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
      const payload = {
        ...datos,
        fecha_hora_inicio: datos.fecha_hora_inicio.replace('T', ' ') + ':00',
        fecha_hora_fin: datos.fecha_hora_fin.replace('T', ' ') + ':00',
        notas: datos.notas || null,
      }

      const guardado = esEdicion
        ? await turnosApi.actualizar(turno.id, payload)
        : await turnosApi.crear(payload)

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
      titulo={esEdicion ? 'Editar turno' : 'Nuevo turno'}
      ancho="max-w-2xl"
      pie={
        <>
          <Button variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-turno" cargando={guardando}>
            {esEdicion ? 'Guardar cambios' : 'Agendar turno'}
          </Button>
        </>
      }
    >
      <form id="form-turno" onSubmit={enviar} className="space-y-4" noValidate>
        {error && <Alert tono="error">{error}</Alert>}

        <SelectorPaciente
          requerido
          error={errores.paciente_id}
          pacienteInicial={
            esEdicion
              ? {
                  id: turno.paciente_id,
                  nombre: turno.paciente_nombre,
                  especie: turno.especie,
                  cliente_nombre: turno.cliente_nombre,
                  cliente_apellido: turno.cliente_apellido,
                }
              : null
          }
          onChange={(p) => {
            setDatos((d) => ({ ...d, paciente_id: p?.id ?? '' }))
            setErrores((err) => ({ ...err, paciente_id: undefined }))
          }}
        />

        <Select
          label="Veterinario"
          requerido
          value={datos.veterinario_id}
          onChange={cambiar('veterinario_id')}
          error={errores.veterinario_id}
        >
          <option value="">Seleccionar...</option>
          {veterinarios.map((v) => (
            <option key={v.id} value={v.id}>
              {v.apellido}, {v.nombre}
              {v.matricula ? ` (MP ${v.matricula})` : ''}
            </option>
          ))}
        </Select>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Inicio"
            type="datetime-local"
            requerido
            value={datos.fecha_hora_inicio}
            onChange={cambiar('fecha_hora_inicio')}
            error={errores.fecha_hora_inicio}
          />
          <Input
            label="Fin"
            type="datetime-local"
            requerido
            value={datos.fecha_hora_fin}
            onChange={cambiar('fecha_hora_fin')}
            error={errores.fecha_hora_fin}
          />
        </div>

        <Input
          label="Motivo"
          requerido
          value={datos.motivo}
          onChange={cambiar('motivo')}
          error={errores.motivo}
          maxLength={200}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Tipo" value={datos.tipo} onChange={cambiar('tipo')} error={errores.tipo}>
            {Object.entries(TIPOS_TURNO).map(([v, etiqueta]) => (
              <option key={v} value={v}>
                {etiqueta}
              </option>
            ))}
          </Select>

          <Select
            label="Estado"
            value={datos.estado}
            onChange={cambiar('estado')}
            error={errores.estado}
          >
            {Object.entries(ESTADOS_TURNO).map(([v, { etiqueta }]) => (
              <option key={v} value={v}>
                {etiqueta}
              </option>
            ))}
          </Select>
        </div>

        <Input
          as="textarea"
          label="Notas"
          value={datos.notas}
          onChange={cambiar('notas')}
          error={errores.notas}
          maxLength={2000}
        />
      </form>
    </Modal>
  )
}
