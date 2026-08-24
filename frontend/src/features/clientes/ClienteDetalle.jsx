import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { clientesApi } from '../../api/clientes'
import { ClienteForm } from './ClienteForm'
import { PacienteForm } from '../pacientes/PacienteForm'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { calcularEdad, formatearPeso } from '../../lib/format'
import { SEXOS } from '../../lib/constants'

/**
 * Ficha del cliente con sus mascotas.
 *
 * El motivo de que exista esta pantalla es concreto: dar de alta una mascota
 * desde aca deja al dueno YA VINCULADO. En el flujo real de mostrador uno
 * atiende a una persona y carga sus animales; obligar a buscar de nuevo al
 * cliente que se acaba de abrir es trabajo repetido y una fuente de errores
 * (elegir el dueno equivocado en una lista de homonimos).
 */
export function ClienteDetalle() {
  const { id } = useParams()

  const [cliente, setCliente] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(false)
  const [nuevaMascota, setNuevaMascota] = useState(false)

  const cargar = useCallback(() => {
    setCargando(true)
    setError(null)

    clientesApi
      .obtener(id)
      .then(setCliente)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [id])

  useEffect(cargar, [cargar])

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
        <Link to="/clientes" className="mt-4 inline-block text-[13px] text-pino-700 hover:underline">
          Volver a Clientes
        </Link>
      </div>
    )
  }

  if (!cliente) return null

  const pacientes = cliente.pacientes ?? []

  return (
    <div className="escalonar mx-auto max-w-4xl">
      <PageHeader
        volver={{ a: '/clientes', texto: 'Clientes' }}
        rotulo="Ficha de cliente"
        titulo={`${cliente.apellido}, ${cliente.nombre}`}
        acciones={
          <Button variante="secundario" onClick={() => setEditando(true)}>
            Editar datos
          </Button>
        }
      />

      <div className="grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="rotulo mb-3 border-b border-linea pb-2.5">Identificacion</h2>
          <dl className="space-y-2.5 text-[13px]">
            <Dato etiqueta="Documento" valor={cliente.documento ?? 'Sin registrar'} destacado />
            <Dato etiqueta="Telefono" valor={cliente.telefono} />
            {cliente.telefono_alt && <Dato etiqueta="Alternativo" valor={cliente.telefono_alt} />}
            <Dato etiqueta="Email" valor={cliente.email ?? '-'} />
          </dl>
        </section>

        <section>
          <h2 className="rotulo mb-3 border-b border-linea pb-2.5">Domicilio</h2>
          <dl className="space-y-2.5 text-[13px]">
            <Dato etiqueta="Direccion" valor={cliente.direccion ?? '-'} />
            <Dato etiqueta="Ciudad" valor={cliente.ciudad ?? '-'} />
            <Dato etiqueta="Codigo postal" valor={cliente.codigo_postal ?? '-'} />
          </dl>
        </section>

        {cliente.notas && (
          <section className="sm:col-span-2">
            <h2 className="rotulo mb-2">Notas</h2>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-tinta-2">
              {cliente.notas}
            </p>
          </section>
        )}
      </div>

      {/* ===================== Mascotas ===================== */}
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-linea pb-2.5">
          <h2 className="font-display text-[18px] font-medium tracking-[-0.02em] text-tinta">
            Mascotas
            <span className="num ml-2 text-[13px] font-sans font-normal text-tinta-3">
              ({pacientes.length})
            </span>
          </h2>

          {/* El alta desde aca no vuelve a pedir el dueno. */}
          <Button tamanio="sm" onClick={() => setNuevaMascota(true)}>
            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 4a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 0110 4z" />
            </svg>
            Agregar mascota
          </Button>
        </div>

        {pacientes.length === 0 ? (
          <EmptyState
            titulo="Sin mascotas registradas"
            descripcion="Al agregarla desde aca queda vinculada a este cliente automaticamente."
            accion={<Button onClick={() => setNuevaMascota(true)}>Agregar mascota</Button>}
          />
        ) : (
          <ul className="divide-y divide-linea">
            {pacientes.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/pacientes/${p.id}`}
                  className={`group flex items-baseline gap-4 py-3 transition-colors hover:bg-papel-hondo ${
                    p.fallecido ? 'opacity-60' : ''
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-tinta">
                      {p.nombre}
                      {Boolean(p.fallecido) && (
                        <span className="ml-2 rounded-sm bg-piedra-50 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-[0.08em] text-piedra-600">
                          Fallecido
                        </span>
                      )}
                    </span>
                    <span className="block text-[12px] text-tinta-3">
                      {p.especie}
                      {p.raza && ` / ${p.raza}`} &middot; {SEXOS[p.sexo]} &middot;{' '}
                      {calcularEdad(p.fecha_nacimiento)}
                    </span>
                  </span>

                  <span className="num shrink-0 text-[13px] text-tinta-2">
                    {formatearPeso(p.peso_kg)}
                  </span>
                  <span
                    className="shrink-0 text-laton-500 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  >
                    &rarr;
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ===================== Modales ===================== */}
      {editando && (
        <ClienteForm
          abierto={editando}
          cliente={cliente}
          onCerrar={() => setEditando(false)}
          onGuardado={cargar}
        />
      )}

      {nuevaMascota && (
        <PacienteForm
          abierto={nuevaMascota}
          clienteFijo={cliente}
          onCerrar={() => setNuevaMascota(false)}
          onGuardado={cargar}
        />
      )}
    </div>
  )
}

function Dato({ etiqueta, valor, destacado = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-tinta-3">{etiqueta}</dt>
      <dd className={`num text-right ${destacado ? 'font-medium text-tinta' : 'text-tinta-2'}`}>
        {valor}
      </dd>
    </div>
  )
}
