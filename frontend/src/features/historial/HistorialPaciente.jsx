import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { consultasApi, vacunasApi, desparasitacionesApi } from '../../api/historial'
import { ConsultaForm } from './ConsultaForm'
import { SanidadForm } from './SanidadForm'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { RoleGate } from '../../auth/RoleGate'
import { calcularEdad, formatearFecha, formatearFechaHora, formatearPeso } from '../../lib/format'
import { VIAS_RECETA } from '../../lib/constants'

/**
 * Historia clinica completa de un paciente, en linea de tiempo.
 *
 * Consultas, vacunas y desparasitaciones se mezclan en un solo hilo ordenado
 * por fecha: es como se lee una historia clinica en papel, y evita que el
 * veterinario tenga que saltar entre tres pestanias para reconstruir el caso.
 */
export function HistorialPaciente() {
  const { pacienteId } = useParams()

  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [consultaForm, setConsultaForm] = useState(null) // {} = nueva, {..} = editar
  const [sanidadForm, setSanidadForm] = useState(null) // {tipo, registro}
  const [aEliminar, setAEliminar] = useState(null) // {clase, id, etiqueta}
  const [errorAccion, setErrorAccion] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  const cargar = useCallback(() => {
    setCargando(true)
    setError(null)

    consultasApi
      .historialDe(pacienteId)
      .then(setDatos)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [pacienteId])

  useEffect(cargar, [cargar])

  const confirmarEliminar = async () => {
    setEliminando(true)
    setErrorAccion(null)

    try {
      const apis = {
        consulta: consultasApi,
        vacuna: vacunasApi,
        desparasitacion: desparasitacionesApi,
      }

      await apis[aEliminar.clase].eliminar(aEliminar.id)
      setAEliminar(null)
      cargar()
    } catch (err) {
      setErrorAccion(err.message)
    } finally {
      setEliminando(false)
    }
  }

  if (cargando) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner etiqueta="Cargando historia clinica..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <Alert tono="error">{error}</Alert>
        <Link to="/historial" className="mt-4 inline-block text-[13px] text-pino-700 hover:underline">
          Volver al historial
        </Link>
      </div>
    )
  }

  if (!datos) return null

  const { paciente, consultas, vacunas, desparasitaciones } = datos

  // Un solo hilo ordenado por fecha descendente.
  const linea = [
    ...consultas.map((c) => ({ clase: 'consulta', fecha: c.fecha, dato: c })),
    ...vacunas.map((v) => ({ clase: 'vacuna', fecha: v.fecha_aplicacion, dato: v })),
    ...desparasitaciones.map((d) => ({ clase: 'desparasitacion', fecha: d.fecha_aplicacion, dato: d })),
  ].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))

  return (
    <div className="escalonar mx-auto max-w-4xl">
      <Link
        to="/historial"
        className="mb-4 inline-flex items-center gap-1 text-[13px] text-tinta-3 hover:text-tinta"
      >
        <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L9.06 10l3.71 3.71a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
        </svg>
        Historial
      </Link>

      {/* --- Cabecera del paciente --- */}
      <header className="mb-6 rounded border border-linea bg-papel-alto p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[24px] font-light leading-tight tracking-[-0.03em] text-tinta">
              {paciente.nombre}
              {Boolean(paciente.fallecido) && (
                <span className="ml-2 rounded-full bg-piedra-50 px-2 py-0.5 text-[11.5px] font-normal text-piedra-600">
                  Fallecido
                </span>
              )}
            </h1>
            <p className="mt-2 text-[13px] text-tinta-3">
              {paciente.especie}
              {paciente.raza && ` / ${paciente.raza}`} · {calcularEdad(paciente.fecha_nacimiento)} ·{' '}
              {formatearPeso(paciente.peso_kg)}
            </p>
            <p className="mt-0.5 text-[13px] text-tinta-3">
              Dueno: {paciente.cliente_apellido}, {paciente.cliente_nombre} ·{' '}
              {paciente.cliente_telefono}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setConsultaForm({})}>Nueva consulta</Button>
            <Button variante="secundario" onClick={() => setSanidadForm({ tipo: 'vacuna' })}>
              Vacuna
            </Button>
            <Button
              variante="secundario"
              onClick={() => setSanidadForm({ tipo: 'desparasitacion' })}
            >
              Desparasitacion
            </Button>
          </div>
        </div>

        {paciente.alergias && (
          <Alert tono="aviso" titulo="Alergias" className="mt-4">
            {paciente.alergias}
          </Alert>
        )}

        <div className="mt-4 flex gap-4 border-t border-linea pt-3 text-[13px]">
          <Resumen etiqueta="Consultas" valor={consultas.length} />
          <Resumen etiqueta="Vacunas" valor={vacunas.length} />
          <Resumen etiqueta="Desparasitaciones" valor={desparasitaciones.length} />
          <Link
            to={`/pacientes/${paciente.id}`}
            className="ml-auto self-end text-pino-700 hover:underline"
          >
            Ver ficha completa
          </Link>
        </div>
      </header>

      {/* --- Linea de tiempo --- */}
      {linea.length === 0 ? (
        <div className="rounded border border-dashed border-linea-fuerte bg-papel-alto p-8 text-center">
          <p className="text-[13px] text-tinta-3">
            Este paciente todavia no tiene registros clinicos.
          </p>
        </div>
      ) : (
        <ol className="relative space-y-4 border-l border-linea pl-6">
          {linea.map((item) => (
            <li key={`${item.clase}-${item.dato.id}`} className="relative">
              {/* Cada tipo de registro tiene su propia marca en la linea:
                  la consulta va llena en tinta, la vacuna en laton y la
                  desparasitacion hueca. Se distinguen de un vistazo incluso
                  en escala de grises o impreso. */}
              <span
                className={`absolute -left-[1.9rem] top-2 grid size-[11px] place-items-center rounded-full ring-4 ring-papel ${
                  item.clase === 'consulta'
                    ? 'bg-pino-800'
                    : item.clase === 'vacuna'
                      ? 'bg-laton-500'
                      : 'border-[1.5px] border-tinta-3 bg-papel'
                }`}
                aria-hidden="true"
              />

              {item.clase === 'consulta' ? (
                <TarjetaConsulta
                  consulta={item.dato}
                  onEditar={() => setConsultaForm(item.dato)}
                  onEliminar={() =>
                    setAEliminar({ clase: 'consulta', id: item.dato.id, etiqueta: item.dato.motivo })
                  }
                />
              ) : (
                <TarjetaSanidad
                  tipo={item.clase}
                  registro={item.dato}
                  onEditar={() => setSanidadForm({ tipo: item.clase, registro: item.dato })}
                  onEliminar={() =>
                    setAEliminar({
                      clase: item.clase,
                      id: item.dato.id,
                      etiqueta: item.dato.tipo_vacuna ?? item.dato.producto,
                    })
                  }
                />
              )}
            </li>
          ))}
        </ol>
      )}

      {/* --- Modales --- */}
      {consultaForm && (
        <ConsultaForm
          abierto
          consulta={consultaForm.id ? consultaForm : null}
          pacienteFijo={consultaForm.id ? null : paciente}
          onCerrar={() => setConsultaForm(null)}
          onGuardado={cargar}
        />
      )}

      {sanidadForm && (
        <SanidadForm
          abierto
          tipo={sanidadForm.tipo}
          pacienteId={paciente.id}
          registro={sanidadForm.registro ?? null}
          onCerrar={() => setSanidadForm(null)}
          onGuardado={cargar}
        />
      )}

      <Modal
        abierto={aEliminar !== null}
        onCerrar={() => setAEliminar(null)}
        titulo="Eliminar registro"
        pie={
          <>
            <Button variante="secundario" onClick={() => setAEliminar(null)} disabled={eliminando}>
              Cancelar
            </Button>
            <Button variante="peligro" onClick={confirmarEliminar} cargando={eliminando}>
              Eliminar
            </Button>
          </>
        }
      >
        {errorAccion && (
          <Alert tono="error" className="mb-3">
            {errorAccion}
          </Alert>
        )}
        <p className="text-[13px] text-tinta-2">
          Se eliminara definitivamente{' '}
          <strong className="text-tinta">{aEliminar?.etiqueta}</strong>. Los registros medicos
          normalmente se corrigen en lugar de borrarse.
        </p>
      </Modal>
    </div>
  )
}

function Resumen({ etiqueta, valor }) {
  return (
    <div>
      <p className="text-[16px] font-medium text-tinta">{valor}</p>
      <p className="text-[11.5px] text-tinta-3">{etiqueta}</p>
    </div>
  )
}

function TarjetaConsulta({ consulta, onEditar, onEliminar }) {
  return (
    <article className="rounded border border-linea bg-papel-alto p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="inline-flex rounded bg-pino-50 px-1.5 py-0.5 text-[11.5px] font-medium text-pino-700">
            Consulta
          </span>
          <h3 className="mt-1 font-medium text-tinta">{consulta.motivo}</h3>
        </div>
        <div className="text-right">
          <p className="text-[11.5px] text-tinta-3">{formatearFechaHora(consulta.fecha)}</p>
          <p className="text-[11.5px] text-tinta-4">
            {consulta.veterinario_nombre} {consulta.veterinario_apellido}
            {consulta.veterinario_matricula && ` (MP ${consulta.veterinario_matricula})`}
          </p>
        </div>
      </div>

      <dl className="mt-3 space-y-2 text-[13px]">
        {consulta.anamnesis && <Campo etiqueta="Anamnesis" valor={consulta.anamnesis} />}
        {consulta.examen_fisico && <Campo etiqueta="Examen fisico" valor={consulta.examen_fisico} />}
        {consulta.diagnostico && <Campo etiqueta="Diagnostico" valor={consulta.diagnostico} />}
        {consulta.tratamiento && <Campo etiqueta="Tratamiento" valor={consulta.tratamiento} />}
        {consulta.observaciones && <Campo etiqueta="Observaciones" valor={consulta.observaciones} />}
      </dl>

      {/* Signos vitales */}
      {(consulta.peso_kg || consulta.temperatura_c || consulta.frecuencia_cardiaca) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded bg-papel-hondo px-3 py-2 text-[11.5px] text-tinta-2">
          {consulta.peso_kg && <span>Peso: {formatearPeso(consulta.peso_kg)}</span>}
          {consulta.temperatura_c && <span>Temp: {consulta.temperatura_c} C</span>}
          {consulta.frecuencia_cardiaca && <span>FC: {consulta.frecuencia_cardiaca}</span>}
          {consulta.frecuencia_respiratoria && <span>FR: {consulta.frecuencia_respiratoria}</span>}
        </div>
      )}

      {consulta.recetas?.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[11.5px] font-medium text-tinta-3">
            Receta ({consulta.recetas.length})
          </p>
          <ul className="space-y-1 text-[13px]">
            {consulta.recetas.map((r) => (
              <li key={r.id} className="rounded bg-papel-hondo px-3 py-2">
                <span className="font-medium text-tinta">{r.medicamento}</span>
                {r.presentacion && <span className="text-tinta-3"> {r.presentacion}</span>}
                <span className="text-tinta-2">
                  {' '}
                  — {r.dosis}, {r.frecuencia}
                  {r.duracion && `, ${r.duracion}`} ({VIAS_RECETA[r.via] ?? r.via})
                </span>
                {r.indicaciones && (
                  <p className="mt-0.5 text-[11.5px] text-tinta-3">{r.indicaciones}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {consulta.proximo_control && (
        <p className="mt-3 text-[11.5px] text-tinta-3">
          Proximo control: {formatearFecha(consulta.proximo_control)}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-1 border-t border-linea pt-2">
        <Button variante="fantasma" tamanio="sm" onClick={onEditar}>
          Editar
        </Button>
        <RoleGate roles={['admin']}>
          <Button variante="fantasma" tamanio="sm" className="text-ladrillo-600" onClick={onEliminar}>
            Eliminar
          </Button>
        </RoleGate>
      </div>
    </article>
  )
}

function TarjetaSanidad({ tipo, registro, onEditar, onEliminar }) {
  const esVacuna = tipo === 'vacuna'
  const titulo = esVacuna ? registro.tipo_vacuna : registro.producto

  return (
    <article className="rounded border border-linea bg-papel-alto p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span
            className={`inline-flex rounded px-1.5 py-0.5 text-[11.5px] font-medium ${
              esVacuna ? 'bg-pino-50 text-pino-700' : 'bg-piedra-50 text-piedra-600'
            }`}
          >
            {esVacuna ? 'Vacuna' : 'Desparasitacion'}
          </span>
          <h3 className="mt-1 font-medium text-tinta">{titulo}</h3>
          <p className="text-[13px] text-tinta-3">
            {esVacuna
              ? [registro.marca, registro.lote && `Lote ${registro.lote}`].filter(Boolean).join(' · ')
              : [registro.tipo, registro.via, registro.dosis].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11.5px] text-tinta-3">{formatearFecha(registro.fecha_aplicacion)}</p>
          <p className="text-[11.5px] text-tinta-4">
            {registro.veterinario_nombre} {registro.veterinario_apellido}
          </p>
        </div>
      </div>

      {registro.fecha_proxima && (
        <p className="mt-2 text-[11.5px] text-tinta-2">
          Proxima dosis: <strong>{formatearFecha(registro.fecha_proxima)}</strong>
        </p>
      )}

      {registro.observaciones && (
        <p className="mt-2 text-[13px] text-tinta-2">{registro.observaciones}</p>
      )}

      <div className="mt-3 flex justify-end gap-1 border-t border-linea pt-2">
        <Button variante="fantasma" tamanio="sm" onClick={onEditar}>
          Editar
        </Button>
        <Button variante="fantasma" tamanio="sm" className="text-ladrillo-600" onClick={onEliminar}>
          Eliminar
        </Button>
      </div>
    </article>
  )
}

function Campo({ etiqueta, valor }) {
  return (
    <div>
      <dt className="text-[11.5px] font-medium text-tinta-3">{etiqueta}</dt>
      <dd className="whitespace-pre-wrap text-tinta-2">{valor}</dd>
    </div>
  )
}
