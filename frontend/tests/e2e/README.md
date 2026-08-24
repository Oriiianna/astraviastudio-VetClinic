# Pruebas end-to-end

Playwright contra la aplicación real (backend + MySQL + navegador).

Viven **en el repositorio a propósito**: antes estaban en una carpeta temporal del
sistema y se perdieron al limpiarse. Una suite de pruebas fuera del control de versiones
no existe.

## Requisitos

```bash
pip install playwright
playwright install chromium
```

## Ejecución

Con el backend en `:8080` y el front en `:5173`:

```bash
python tests/e2e/smoke_ui.py
```

`smoke_ui.py` es la prueba de humo de la interfaz: recorre las pantallas principales y
verifica navegación, encabezados, listados, buscadores, modales, fichas y permisos por
rol. **Es la que hay que correr después de tocar el diseño**, porque es donde un cambio
de presentación rompe cosas sin que el build se queje.

Sale con código 1 si algo falla, así que sirve tal cual en CI.

## Convenciones aprendidas a los golpes

- **Nunca acoplar a clases de color.** Los mensajes de error se ubican por el atributo
  `data-error`, no por `text-ladrillo-600`. Un rediseño no debe romper las pruebas — nos
  pasó, y por eso el componente `Input` expone ese atributo.
- **Campos por etiqueta, no por posición.** `get_by_label(...)` acotado al `dialog`: los
  formularios cambian la cantidad de `<input>` según el estado (el selector de dueño
  desaparece al elegir uno, y `nth=3` deja de ser el microchip para ser el color).
- **`exact=False`** al buscar etiquetas: los campos obligatorios llevan un asterisco que
  forma parte del texto accesible (`"Dueno*"`).
- **Cuidado con las mayúsculas.** La utilidad `.rotulo` aplica `text-transform: uppercase`,
  así que `inner_text()` devuelve el texto en mayúsculas. Comparar en minúsculas.
- **Datos propios y cambios relativos.** Cada prueba crea lo que necesita y lo limpia.
  Medir contra totales absolutos las hace fallar según lo que dejó la corrida anterior.
- **Esperar a React, no solo a la red.** `networkidle` puede llegar antes de que termine
  una redirección; esperar un selector concreto de la pantalla destino.
