import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { turnosApi } from '../../api/turnos'
import { recordatoriosApi } from '../../api/historial'
import { formatearFecha, hoyISO } from '../../lib/format'
import { ESTADOS_TURNO, ROLES } from '../../lib/constants'

/*
 * Portada.
 *
 * Estructura de doble columna asimetrica: la agenda del dia ocupa el peso
 * principal y los accesos quedan en una banda lateral. Es lo contrario de la
 * grilla de tarjetas iguales, que reparte la atencion por igual entre cosas
 * que no importan por igual.
 */

const ACCESOS = [
  { a: '/clientes', modulo: 'clientes', titulo: 'Clientes', detalle: 'Duenos y datos de contacto' },
  { a: '/pacientes', modulo: 'pacientes', titulo: 'Pacientes', detalle: 'Fichas de las mascotas' },
  { a: '/historial', modulo: 'historial', titulo: 'Historia clinica', detalle: 'Consultas, recetas y vacunas' },
  { a: '/turnos', modulo: 'turnos', titulo: 'Agenda', detalle: 'Turnos y calendario' },
]

export function InicioPage() {
  const { usuario, puede } = useAuth()

  const [turnosHoy, setTurnosHoy] = useState(null)
  const [recordatorios, setRecordatorios] = useState([])

  useEffect(() => {
    const iso = hoyISO()

    // Los paneles son informativos: si fallan, la pantalla sigue siendo util,
    // asi que el error se traga en lugar de bloquear el inicio.
    turnosApi
      .listar({ desde: iso, hasta: iso })
      .then((t) => setTurnosHoy(t ?? []))
      .catch(() => setTurnosHoy([]))

    recordatoriosApi.listar(30).then(setRecordatorios).catch(() => setRecordatorios([]))
  }, [])

  const fechaLarga = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const vencidos = recordatorios.filter((r) => Number(r.dias_restantes) < 0)

  return (
    <div className="escalonar mx-auto max-w-6xl">
      {/* ===================== Cabecera ===================== */}
      <header className="mb-10">
        <p className="rotulo">{fechaLarga}</p>
        <h1 className="mt-2.5 font-display text-[clamp(1.9rem,4vw,2.6rem)] font-light leading-tight tracking-[-0.03em] text-tinta">
          Hola, {usuario?.nombre}
        </h1>
        <div className="filete mt-5 max-w-md" aria-hidden="true" />
        <p className="mt-3 text-[13px] text-tinta-3">
          Ingresaste como {ROLES[usuario?.rol]?.toLowerCase()}.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        {/* ===================== Agenda del dia ===================== */}
        <section>
          <div className="mb-4 flex items-baseline justify-between border-b border-linea pb-2.5">
            <h2 className="font-display text-[18px] font-medium tracking-[-0.02em] text-tinta">
              Turnos de hoy
            </h2>
            <Link
              to="/turnos"
              className="text-[12px] text-pino-700 underline decoration-laton-300 decoration-1 underline-offset-4 transition-colors hover:decoration-laton-500"
            >
              Ver agenda completa
            </Link>
          </div>

          {turnosHoy === null ? (
            <p className="py-8 text-[13px] text-tinta-4">Cargando...</p>
          ) : turnosHoy.length === 0 ? (
            <div className="border border-dashed border-linea-fuerte px-6 py-10 text-center">
              <p className="text-[13px] text-tinta-3">No hay turnos agendados para hoy.</p>
            </div>
          ) : (
            <ul className="divide-y divide-linea">
              {turnosHoy.slice(0, 7).map((t) => (
                <li key={t.id} className="flex items-baseline gap-4 py-3">
                  {/* La hora en display, alineada en columna: es la referencia
                      con la que se recorre la lista. */}
                  <span className="num w-[92px] shrink-0 font-display text-[15px] text-tinta">
                    {String(t.fecha_hora_inicio).slice(11, 16)}
                    <span className="text-tinta-4">
                      &ndash;{String(t.fecha_hora_fin).slice(11, 16)}
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-tinta">
                      {t.paciente_nombre}
                    </span>
                    <span className="block truncate text-[12px] text-tinta-3">{t.motivo}</span>
                  </span>

                  <span
                    className={`shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ring-1 ring-inset ${
                      ESTADOS_TURNO[t.estado]?.clase ?? ''
                    }`}
                  >
                    {ESTADOS_TURNO[t.estado]?.etiqueta ?? t.estado}
                  </span>
                </li>
              ))}

              {turnosHoy.length > 7 && (
                <li className="pt-3 text-[12px] text-tinta-4">
                  y {turnosHoy.length - 7} turno(s) mas en la agenda.
                </li>
              )}
            </ul>
          )}
        </section>

        {/* ===================== Banda lateral ===================== */}
        <div className="space-y-8">
          <section>
            <h2 className="rotulo mb-3 border-b border-linea pb-2.5">Modulos</h2>

            <ul>
              {ACCESOS.filter((a) => puede(a.modulo)).map((a) => (
                <li key={a.a}>
                  <Link
                    to={a.a}
                    className="group flex items-baseline gap-3 border-b border-linea py-3 transition-colors hover:bg-papel-hondo"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium text-tinta">{a.titulo}</span>
                      <span className="block text-[12px] text-tinta-3">{a.detalle}</span>
                    </span>
                    <span
                      className="text-laton-500 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    >
                      &rarr;
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {recordatorios.length > 0 && (
            <section className="border border-ocre-200 bg-ocre-50/60 p-4">
              <h2 className="rotulo !text-ocre-700">
                {recordatorios.length} vencimiento(s) por atender
              </h2>

              {vencidos.length > 0 && (
                <p className="mt-1.5 text-[12px] font-medium text-ladrillo-700">
                  {vencidos.length} ya estan atrasados.
                </p>
              )}

              <ul className="mt-3 space-y-2.5">
                {recordatorios.slice(0, 5).map((r) => (
                  <li key={`${r.tipo}-${r.id}`} className="text-[12px] leading-snug">
                    <Link
                      to={`/historial/${r.paciente_id}`}
                      className="font-medium text-tinta hover:underline"
                    >
                      {r.paciente}
                    </Link>
                    <span className="text-tinta-2"> &mdash; {r.detalle}</span>
                    <span className="num mt-0.5 block text-tinta-3">
                      {formatearFecha(r.fecha_proxima)} &middot;{' '}
                      {Number(r.dias_restantes) < 0
                        ? `vencida hace ${Math.abs(r.dias_restantes)} dias`
                        : `en ${r.dias_restantes} dias`}
                      {r.cliente_telefono && ` · tel. ${r.cliente_telefono}`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
