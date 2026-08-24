import { useCallback, useEffect, useRef, useState } from 'react'
import { adjuntosApi, TIPOS_ADJUNTO, formatearTamano } from '../../api/adjuntos'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Input'
import { formatearFecha } from '../../lib/format'

/**
 * Documentos del paciente: historias clinicas escaneadas, estudios,
 * consentimientos.
 *
 * Los archivos NO son URLs publicas. Se piden con el token y se abren desde
 * un blob local; por eso no hay un <a href> directo al archivo, que viajaria
 * sin cabecera Authorization y devolveria 401.
 */
export function DocumentosPaciente({ pacienteId }) {
  const [documentos, setDocumentos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [subiendo, setSubiendo] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [pendiente, setPendiente] = useState(null) // File a punto de subirse
  const [tipo, setTipo] = useState('documento')
  const [descripcion, setDescripcion] = useState('')
  const [errorSubida, setErrorSubida] = useState(null)

  const [aEliminar, setAEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  const inputRef = useRef(null)

  const cargar = useCallback(() => {
    setCargando(true)
    setError(null)

    adjuntosApi
      .listar(pacienteId)
      .then((d) => setDocumentos(d ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [pacienteId])

  useEffect(cargar, [cargar])

  const elegir = (archivo) => {
    if (!archivo) return

    setErrorSubida(null)
    setPendiente(archivo)

    // El nombre del archivo suele ser la mejor descripcion por defecto.
    setDescripcion(archivo.name.replace(/\.[^.]+$/, '').slice(0, 255))

    // Una radiografia o una foto casi nunca son "documento": se propone el
    // tipo segun el formato y el usuario corrige si hace falta.
    setTipo(archivo.type.startsWith('image/') ? 'radiografia' : 'documento')
  }

  const subir = async () => {
    if (!pendiente) return

    setSubiendo(true)
    setErrorSubida(null)

    try {
      await adjuntosApi.subir(pacienteId, pendiente, { tipo, descripcion })
      setPendiente(null)
      setDescripcion('')
      if (inputRef.current) inputRef.current.value = ''
      cargar()
    } catch (err) {
      setErrorSubida(err.errors?.archivo ?? err.message)
    } finally {
      setSubiendo(false)
    }
  }

  const abrir = async (doc) => {
    try {
      const url = await adjuntosApi.urlBlob(doc.id)
      window.open(url, '_blank', 'noopener')

      // Se libera despues de que el navegador tomo el blob; si se revoca de
      // inmediato la pestana nueva queda en blanco.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(err.message)
    }
  }

  const confirmarEliminar = async () => {
    setEliminando(true)

    try {
      await adjuntosApi.eliminar(aEliminar.id)
      setAEliminar(null)
      cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminando(false)
    }
  }

  return (
    <section className="hoja p-5 sm:col-span-2">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-linea pb-2.5">
        <h2 className="font-display text-[17px] font-medium tracking-[-0.02em] text-tinta">
          Documentos
          <span className="num ml-2 font-sans text-[12.5px] font-normal text-tinta-3">
            ({documentos.length})
          </span>
        </h2>
        <p className="text-[11.5px] text-tinta-3">PDF o imagen, hasta 10 MB</p>
      </div>

      {error && (
        <Alert tono="error" className="mb-4">
          {error}
        </Alert>
      )}

      {/* ===================== Zona de carga ===================== */}
      {pendiente ? (
        <div className="mb-5 rounded border border-pino-200 bg-pino-50 p-4">
          <p className="rotulo !text-pino-700">Archivo listo para subir</p>
          <p className="num mt-1.5 truncate text-[13px] font-medium text-tinta">
            {pendiente.name}{' '}
            <span className="font-normal text-tinta-3">({formatearTamano(pendiente.size)})</span>
          </p>

          {errorSubida && (
            <Alert tono="error" className="mt-3">
              {errorSubida}
            </Alert>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {Object.entries(TIPOS_ADJUNTO).map(([v, etiqueta]) => (
                <option key={v} value={v}>
                  {etiqueta}
                </option>
              ))}
            </Select>
            <Input
              label="Descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variante="secundario"
              tamanio="sm"
              disabled={subiendo}
              onClick={() => {
                setPendiente(null)
                setErrorSubida(null)
                if (inputRef.current) inputRef.current.value = ''
              }}
            >
              Cancelar
            </Button>
            <Button tamanio="sm" cargando={subiendo} onClick={subir}>
              Subir documento
            </Button>
          </div>
        </div>
      ) : (
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setArrastrando(true)
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault()
            setArrastrando(false)
            elegir(e.dataTransfer.files?.[0])
          }}
          className={`mb-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed px-6 py-8 text-center transition-colors ${
            arrastrando
              ? 'border-pino-600 bg-pino-50'
              : 'border-linea-fuerte bg-papel-hondo/40 hover:border-tinta-4'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.tif,.tiff,.txt"
            onChange={(e) => elegir(e.target.files?.[0])}
          />

          <svg
            className="size-5 text-tinta-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>

          <span className="text-[13px] font-medium text-tinta-2">
            Arrastra un archivo o hace clic para elegirlo
          </span>
          <span className="text-[11.5px] text-tinta-3">
            Historia clinica, estudios, consentimientos
          </span>
        </label>
      )}

      {/* ===================== Listado ===================== */}
      {cargando ? (
        <div className="grid place-items-center py-8">
          <Spinner etiqueta="Cargando documentos..." />
        </div>
      ) : documentos.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-tinta-3">
          Todavia no hay documentos adjuntos.
        </p>
      ) : (
        <ul className="divide-y divide-linea">
          {documentos.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <IconoArchivo mime={d.mime} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-tinta">
                  {d.descripcion || d.nombre_original}
                </p>
                <p className="num truncate text-[11.5px] text-tinta-3">
                  {TIPOS_ADJUNTO[d.tipo] ?? d.tipo} &middot; {formatearTamano(d.tamano_bytes)}{' '}
                  &middot; {formatearFecha(d.created_at)}
                  {d.subido_apellido && ` · ${d.subido_nombre} ${d.subido_apellido}`}
                </p>
              </div>

              <div className="flex shrink-0 gap-1">
                <Button variante="fantasma" tamanio="sm" onClick={() => abrir(d)}>
                  Ver
                </Button>
                <Button
                  variante="fantasma"
                  tamanio="sm"
                  className="text-ladrillo-600"
                  onClick={() => setAEliminar(d)}
                >
                  Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        abierto={aEliminar !== null}
        onCerrar={() => setAEliminar(null)}
        rotulo="Documentos"
        titulo="Eliminar documento"
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
        <p className="text-[13px] leading-relaxed text-tinta-2">
          Se eliminara definitivamente{' '}
          <strong className="text-tinta">{aEliminar?.descripcion || aEliminar?.nombre_original}</strong>,
          tanto el registro como el archivo en el servidor. La accion no se puede deshacer.
        </p>
      </Modal>
    </section>
  )
}

/** Marca visual por formato: PDF y las imagenes se distinguen de un vistazo. */
function IconoArchivo({ mime }) {
  const esImagen = String(mime).startsWith('image/')

  return (
    <span
      className={`grid size-9 shrink-0 place-items-center rounded-sm border text-[9px] font-medium uppercase tracking-[0.06em] ${
        esImagen
          ? 'border-laton-300 bg-laton-100 text-laton-700'
          : 'border-linea-fuerte bg-papel-hondo text-tinta-3'
      }`}
      aria-hidden="true"
    >
      {esImagen ? 'IMG' : 'PDF'}
    </span>
  )
}
