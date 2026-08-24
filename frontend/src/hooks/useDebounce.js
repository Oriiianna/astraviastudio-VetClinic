import { useEffect, useState } from 'react'

/**
 * Devuelve el valor recien despues de que dejo de cambiar durante `retardo` ms.
 *
 * Es lo que evita que la caja de busqueda de clientes dispare una peticion por
 * cada tecla: escribir "fernandez" son 9 pulsaciones, o sea 9 consultas a
 * MySQL de las cuales 8 se descartan antes de pintarse. Con 300 ms de
 * debounce queda una sola.
 */
export function useDebounce(valor, retardo = 300) {
  const [debounced, setDebounced] = useState(valor)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(valor), retardo)

    // La limpieza cancela el timer anterior en cada pulsacion: por eso solo
    // sobrevive el ultimo.
    return () => clearTimeout(id)
  }, [valor, retardo])

  return debounced
}
