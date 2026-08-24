import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { pacientesApi } from '../../api/pacientes'
import { PacienteForm } from './PacienteForm'
import { DocumentosPaciente } from './DocumentosPaciente'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { RoleGate } from '../../auth/RoleGate'
import { calcularEdad, formatearFecha, formatearPeso } from '../../lib/format'
import { SEXOS } from '../../lib/constants'

export function PacienteDetalle() {
  const { id } = useParams()
  const [paciente, setPaciente] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(false)

  const cargar = () => {
    setCargando(true)
    setError(null)

    pacientesApi
      .obtener(id)
      .then(setPaciente)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [id])

  if (cargando) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner etiqueta="Cargando ficha..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <Alert tono="error">{error}</Alert>
        <Link to="/pacientes" className="mt-4 inline-block text-[13px] text-pino-700 hover:underline">
          Volver a Pacientes
        </Link>
      </div>
    )
  }

  if (!paciente) return null

  return (
    <div className="escalonar mx-auto max-w-4xl">
      <Link
        to="/pacientes"
        className="mb-4 inline-flex items-center gap-1 text-[13px] text-tinta-3 hover:text-tinta"
      >
        <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L9.06 10l3.71 3.71a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
        </svg>
        Pacientes
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[27px] font-light leading-tight tracking-[-0.03em] text-tinta">
              {paciente.nombre}
            </h1>
            {Boolean(paciente.fallecido) && (
              <span className="rounded-full bg-piedra-50 px-2.5 py-1 text-[11.5px] font-medium text-piedra-600">
                Fallecido {formatearFecha(paciente.fecha_fallecimiento)}
              </span>
            )}
          </div>
          <p className="mt-2 text-[13px] text-tinta-3">
            {paciente.especie}
            {paciente.raza && ` / ${paciente.raza}`} · {SEXOS[paciente.sexo]} ·{' '}
            {calcularEdad(paciente.fecha_nacimiento)}
          </p>
        </div>

        <div className="flex gap-2">
          {/* Solo para quien tiene acceso al historial: la recepcion no debe
              ver diagnosticos, y la API tambien se lo bloquea. */}
          <RoleGate modulo="historial">
            <Link
              to={`/historial/${paciente.id}`}
              className="inline-flex items-center rounded bg-pino-800 px-3.5 py-2 text-[13px] font-medium text-papel hover:bg-pino-700"
            >
              Historia clinica
            </Link>
          </RoleGate>

          <Button variante="secundario" onClick={() => setEditando(true)}>
            Editar ficha
          </Button>
        </div>
      </header>

      {/* Las alergias van arriba y destacadas: es el dato que no puede
          pasarse por alto antes de medicar. */}
      {paciente.alergias && (
        <Alert tono="aviso" titulo="Alergias" className="mb-5">
          {paciente.alergias}
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <section className="rounded border border-linea bg-papel-alto p-5">
          <h2 className="rotulo mb-3 border-b border-linea pb-2.5">Datos del paciente</h2>
          <dl className="space-y-2 text-[13px]">
            <Dato etiqueta="Fecha de nacimiento" valor={formatearFecha(paciente.fecha_nacimiento)} />
            <Dato etiqueta="Edad" valor={calcularEdad(paciente.fecha_nacimiento)} />
            <Dato etiqueta="Peso actual" valor={formatearPeso(paciente.peso_kg)} />
            <Dato etiqueta="Color" valor={paciente.color ?? '-'} />
            <Dato etiqueta="Microchip" valor={paciente.microchip ?? 'Sin microchip'} />
            <Dato
              etiqueta="Esterilizado"
              valor={Number(paciente.esterilizado) === 1 ? 'Si' : 'No'}
            />
          </dl>
        </section>

        <section className="rounded border border-linea bg-papel-alto p-5">
          <h2 className="rotulo mb-3 border-b border-linea pb-2.5">Dueno</h2>
          <dl className="space-y-2 text-[13px]">
            <Dato
              etiqueta="Nombre"
              valor={`${paciente.cliente_apellido}, ${paciente.cliente_nombre}`}
            />
            <Dato etiqueta="Telefono" valor={paciente.cliente_telefono} />
            <Dato etiqueta="Documento" valor={paciente.cliente_documento ?? '-'} />
          </dl>

          <Link
            to={`/pacientes?cliente_id=${paciente.cliente_id}`}
            className="mt-4 inline-block text-[13px] font-medium text-pino-700 hover:underline"
          >
            Ver sus otras mascotas
          </Link>
        </section>

        {paciente.observaciones && (
          <section className="rounded border border-linea bg-papel-alto p-5 sm:col-span-2">
            <h2 className="rotulo mb-2">Observaciones</h2>
            <p className="whitespace-pre-wrap text-[13px] text-tinta-2">{paciente.observaciones}</p>
          </section>
        )}

        <section className="rounded border border-linea bg-papel-alto p-5 sm:col-span-2">
          <h2 className="rotulo mb-3 border-b border-linea pb-2.5">Evolucion del peso</h2>

          {paciente.historial_peso?.length > 0 ? (
            <GraficoPeso datos={paciente.historial_peso} />
          ) : (
            <p className="text-[13px] text-tinta-3">
              Todavia no hay pesos registrados en consultas. Cada consulta del historial clinico
              agrega un punto a este grafico.
            </p>
          )}
        </section>

        <DocumentosPaciente pacienteId={paciente.id} />
      </div>

      {editando && (
        <PacienteForm
          abierto={editando}
          paciente={paciente}
          onCerrar={() => setEditando(false)}
          onGuardado={cargar}
        />
      )}
    </div>
  )
}

function Dato({ etiqueta, valor }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-tinta-3">{etiqueta}</dt>
      <dd className="text-right font-medium text-tinta">{valor}</dd>
    </div>
  )
}

/**
 * Grafico de linea en SVG plano.
 *
 * Son pocos puntos y un solo grafico: sumar Recharts (~100 KB) al bundle de
 * una PWA que tiene que arrancar rapido en el celular del veterinario no se
 * justifica todavia. Si aparecen mas visualizaciones, conviene revisarlo.
 */
function GraficoPeso({ datos }) {
  const ANCHO = 600
  const ALTO = 160
  const MARGEN = { top: 10, right: 10, bottom: 24, left: 40 }

  const pesos = datos.map((d) => Number(d.peso_kg))
  const min = Math.min(...pesos)
  const max = Math.max(...pesos)
  // Si todos los pesos son iguales el rango es 0 y la division explota.
  const rango = max - min || 1

  const anchoUtil = ANCHO - MARGEN.left - MARGEN.right
  const altoUtil = ALTO - MARGEN.top - MARGEN.bottom

  const x = (i) => MARGEN.left + (datos.length === 1 ? anchoUtil / 2 : (i / (datos.length - 1)) * anchoUtil)
  const y = (peso) => MARGEN.top + altoUtil - ((peso - min) / rango) * altoUtil

  const linea = datos.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(Number(d.peso_kg))}`).join(' ')

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="w-full min-w-[420px]"
        role="img"
        aria-label={`Evolucion del peso: ${datos.length} registros, de ${min} a ${max} kg`}
      >
        <line x1={MARGEN.left} y1={MARGEN.top} x2={MARGEN.left} y2={ALTO - MARGEN.bottom} stroke="#e2e8f0" />
        <line x1={MARGEN.left} y1={ALTO - MARGEN.bottom} x2={ANCHO - MARGEN.right} y2={ALTO - MARGEN.bottom} stroke="#e2e8f0" />

        <text x={4} y={MARGEN.top + 4} className="fill-tinta-4 text-[10px]">{max} kg</text>
        <text x={4} y={ALTO - MARGEN.bottom} className="fill-tinta-4 text-[10px]">{min} kg</text>

        <path d={linea} fill="none" stroke="#0d9488" strokeWidth="2" strokeLinejoin="round" />

        {datos.map((d, i) => (
          <circle key={d.fecha + i} cx={x(i)} cy={y(Number(d.peso_kg))} r="3.5" fill="#0d9488">
            <title>{`${formatearFecha(d.fecha)}: ${d.peso_kg} kg`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}
