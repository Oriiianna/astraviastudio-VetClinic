# VetClinic — PWA de gestión veterinaria

Gestión integral de una clínica veterinaria: clientes (dueños), pacientes (mascotas),
historial clínico y agenda de turnos, con tres roles (administrador, veterinario,
recepcionista).

```
veterinaria/
├── backend/     API RESTful — PHP 8 + Slim 4 + MySQL (PDO)
└── frontend/    PWA — React 19 + Vite + Tailwind v4 + vite-plugin-pwa
```

**Estado actual: los cinco módulos están operativos de punta a punta** — autenticación
con roles, clientes, pacientes, historial clínico (consultas, recetas, vacunas y
desparasitaciones) y agenda de turnos.

---

## Requisitos

| | Versión probada |
|---|---|
| PHP | 8.2.1 (con `pdo_mysql`) |
| Composer | 2.5.1 |
| Node.js | 24.13 |
| MySQL / MariaDB | MariaDB 10.4 (XAMPP) |

---

## Puesta en marcha

### 1. Base de datos

Importar los dos archivos, en este orden:

```bash
mysql -u root -p < backend/database/schema.sql
mysql -u root -p < backend/database/seed.sql
```

Si `mysql` no está en el PATH (caso habitual con XAMPP en Windows), importarlos desde
phpMyAdmin o DBeaver, o invocar el binario por ruta completa:

```bash
"C:/xampp/mysql/bin/mysql.exe" -u root -P 3307 < backend/database/schema.sql
```

`seed.sql` carga el catálogo de especies/razas y clientes de demostración. **No crea
usuarios**: un hash de contraseña dentro de un `.sql` versionado termina copiado a
producción tarde o temprano.

### 2. Backend

```bash
cd backend
composer install
cp .env.example .env
```

Editar `.env` con los datos de la base y generar la clave JWT:

```bash
php -r "echo bin2hex(random_bytes(32));"
```

Crear el primer usuario y levantar la API:

```bash
php bin/crear-usuario.php
composer start                 # http://localhost:8080
```

Comprobar: `curl http://localhost:8080/api/health`

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                    # http://localhost:5173
```

El `dev server` hace proxy de `/api` hacia `http://127.0.0.1:8080`, así que front y API
comparten origen y la cookie del refresh token viaja sin conflictos de `SameSite`.

Para probar el build de producción (incluido el service worker):

```bash
npm run build && npm run preview   # http://localhost:4173
```

---

## Endpoints

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/health` | público | Estado del servicio (no toca la base) |
| POST | `/api/auth/login` | público | Devuelve access token + cookie de refresh |
| POST | `/api/auth/refresh` | cookie | Rota el refresh y renueva el access token |
| POST | `/api/auth/logout` | cookie | Revoca el refresh token |
| GET | `/api/auth/me` | autenticado | Perfil del usuario |
| POST | `/api/auth/password` | autenticado | Cambia la contraseña y cierra todas las sesiones |
| GET | `/api/clientes` | staff | Listado paginado. `?q=` busca en nombre, apellido, documento, teléfono y email |
| GET | `/api/clientes/{id}` | staff | Ficha con sus mascotas |
| POST · PUT | `/api/clientes[/{id}]` | staff | Alta y edición |
| DELETE | `/api/clientes/{id}` | **admin** | Baja lógica |
| GET | `/api/pacientes` | staff | `?q=` busca por mascota, microchip **y datos del dueño**. Filtros: `cliente_id`, `especie_id`, `incluir_fallecidos` |
| GET | `/api/pacientes/{id}` | staff | Ficha + historial de pesos |
| POST · PUT | `/api/pacientes[/{id}]` | staff | Alta y edición |
| DELETE | `/api/pacientes/{id}` | **admin** | Baja lógica; bloqueada si tiene consultas |
| GET | `/api/especies` | staff | Catálogo con razas anidadas |
| GET | `/api/consultas` | **clínico** | `?paciente_id=&veterinario_id=&desde=&hasta=&q=` |
| POST · PUT | `/api/consultas[/{id}]` | **clínico** | Consulta + recetas en una transacción |
| DELETE | `/api/consultas/{id}` | **admin** | |
| GET | `/api/pacientes/{id}/historial` | **clínico** | Consultas + vacunas + desparasitaciones |
| POST · PUT · DELETE | `/api/vacunas[/{id}]` | **clínico** | Ídem `/api/desparasitaciones` |
| GET | `/api/recordatorios?dias=30` | staff | Vencimientos próximos y atrasados |
| GET | `/api/turnos` | staff | `?desde=&hasta=&veterinario_id=&estado=`. Sin paginar: la agenda pide un rango |
| POST · PUT | `/api/turnos[/{id}]` | staff | Valida solapamiento en transacción |
| PATCH | `/api/turnos/{id}/estado` | staff | Cambio rápido de estado |
| DELETE | `/api/turnos/{id}` | **admin** | |
| GET | `/api/veterinarios` | staff | Activos, para los selectores |
| GET · POST | `/api/pacientes/{id}/adjuntos` | staff | Documentos del paciente. El alta es `multipart/form-data` |
| GET | `/api/adjuntos/{id}/archivo` | staff | **Streaming autenticado** del binario |
| PUT · DELETE | `/api/adjuntos/{id}` | staff | Metadatos y baja (borra también el archivo) |
| PUT | `/api/auth/perfil` | autenticado | Cada usuario edita **sus** datos. El id sale del token |
| GET · POST | `/api/usuarios` | **admin** | Listado y alta |
| PUT | `/api/usuarios/{id}` | **admin** | Datos y rol |
| PATCH | `/api/usuarios/{id}/estado` | **admin** | Alta/baja lógica |
| POST | `/api/usuarios/{id}/password` | **admin** | Reseteo; cierra sus sesiones |

**Roles:** `staff` = admin + veterinario + recepcionista. `clínico` = admin +
veterinario — la recepción no ve diagnósticos, ni en la API ni en la UI.

Todas las respuestas comparten la misma forma:

```json
{ "success": true, "data": {}, "message": null, "errors": null }
```

Los listados agregan `meta` con `total`, `page`, `per_page` y `total_pages`.

---

## Decisiones de seguridad

- **Inyección SQL**: PDO con `ATTR_EMULATE_PREPARES => false`, o sea sentencias
  preparadas reales del servidor. Los identificadores que no pueden parametrizarse
  (`ORDER BY`, columnas) se validan contra whitelists en `BaseModel`.
- **Asignación masiva**: cada modelo declara `$camposPermitidos`; `Validator::validate()`
  devuelve solo los campos declarados. Un `PUT` con `{"rol":"admin"}` no escribe nada.
- **Tokens**: access token JWT de 15 min **en memoria** de React (nunca en
  `localStorage`, que es legible por cualquier script inyectado) + refresh token opaco
  de 7 días en cookie `httpOnly; SameSite=Strict`, guardado solo como SHA-256 en la base.
- **Rotación con detección de robo**: cada uso del refresh emite uno nuevo. Hay una
  ventana de gracia de 30 s para la carrera entre pestañas; un reuso posterior se
  interpreta como token filtrado y **revoca todas las sesiones del usuario**.
- **CORS**: whitelist explícita desde `.env`, nunca `*` (incompatible con credenciales).
  El middleware envuelve a todos los demás, así hasta un 500 sale con cabeceras CORS —
  si no, el navegador reporta un error de CORS en lugar del error real.
- **Fuerza bruta**: bloqueo por `email + IP` tras 5 intentos fallidos. El login responde
  el mismo mensaje ante usuario inexistente o contraseña incorrecta, y ejecuta igual un
  `password_verify` contra un hash ficticio para no delatar por tiempo qué emails existen.
- **Errores**: `PDOException` y cualquier excepción no prevista se registran completas en
  `logs/` y al cliente le llega un 500 genérico. Con `APP_ENV=production` no sale ningún
  detalle técnico.

- **Archivos adjuntos**: los binarios se guardan en `backend/storage/`, **fuera del
  document root**, y se entregan por `GET /api/adjuntos/{id}/archivo`, que exige sesión.
  Servirlos como estáticos desde `public/uploads/` dejaría la historia clínica de un
  paciente accesible a cualquiera que adivinara la URL. Además: el MIME se determina con
  `finfo` sobre el contenido real (no el que declara el navegador), la extensión sale de
  una whitelist interna y el nombre en disco es aleatorio — un `informe.php` renombrado a
  `.pdf` se rechaza igual.
- **Escalada de privilegios**: `rol` no está en `$camposPermitidos` de `Usuario`. Cambiarlo
  exige el método explícito `cambiarRol()`, que solo invoca el controlador de admin. Un
  `PUT /api/auth/perfil` con `{"rol":"admin"}` se guarda ignorando ese campo.
- **Último administrador**: la API rechaza con 409 que un admin se desactive a sí mismo,
  se quite el rol, o que se desactive al único admin activo que queda.

> La autorización real vive en `RoleMiddleware` (API). Lo que hace el frontend
> (`ProtectedRoute`, `RoleGate`) es solo UX: todo permiso definido en React tiene que
> tener su equivalente en `routes/api.php`.

---

## PWA

- `registerType: 'prompt'` — la actualización **no** se aplica sola. Un veterinario a
  mitad de cargar una consulta perdería el formulario si la app se recargara por su
  cuenta; `ReloadPrompt` le deja elegir cuándo.
- Estrategias de caché:

  | Recurso | Estrategia | Motivo |
  |---|---|---|
  | Shell (JS/CSS/HTML/iconos) | precache | arranque instantáneo y offline |
  | `/api/auth/**` | `NetworkOnly` | **nunca** cachear tokens ni credenciales |
  | `/api/**` (GET) | `NetworkFirst` (5 s) | datos frescos, con caída a caché sin red |
  | `/uploads/**` | `CacheFirst` (30 d) | fotos y estudios no cambian |
  | Fuentes | `CacheFirst` (1 año) | inmutables |

- `navigateFallback: index.html` con `navigateFallbackDenylist: [/^\/api/]`, para que sin
  red una llamada a la API no reciba el HTML del shell y falle al parsear JSON.
- Iconos: `node scripts/generar-iconos.mjs` los genera sin dependencias nativas.
  Reemplazar los PNG de `public/` cuando exista el logo real y borrar el script.

**Limitación conocida:** sin conexión, una recarga completa no puede restaurar la sesión,
porque el access token vive en memoria y renovarlo requiere servidor. El shell carga y se
muestra el aviso de sin conexión, pero hay que volver a autenticarse al recuperar la red.
Es el precio de no guardar el token en `localStorage`. Trabajar offline de verdad
(escritura diferida) requiere la cola con IndexedDB descrita abajo.

---

## Diseño

La dirección es **editorial clínica**: la referencia no es un dashboard SaaS sino el
manual encuadernado de una práctica veterinaria. Todo el sistema vive en
[src/index.css](frontend/src/index.css); las páginas no definen color propio.

- **Tipografía**: *Fraunces* (serif variable, alto contraste) para títulos y cifras
  destacadas, *Archivo* para interfaz y datos. **Auto-hospedadas** en
  [public/fonts/](frontend/public/fonts/), ~194 KB en total, precargadas por el service
  worker: la app se ve igual desde la primera carga sin conexión y no depende de un CDN.
- **Paleta**: papel marfil (`--color-papel`), tinta verde-negra (`--color-tinta`), pino
  institucional y latón como único acento. El fondo nunca es blanco puro — baja el brillo
  en una pantalla que se mira ocho horas.
- **Tres reglas que sostienen el conjunto**:
  1. *Filetes, no sombras.* La jerarquía se construye con líneas de 1px y espacio en
     blanco. Las sombras se reservan para lo que de verdad flota (modales, desplegables).
  2. *Radios chicos (3–4px).* El redondeo generoso lee "app"; el filo preciso lee
     "impreso".
  3. *Números tabulares* en todo dato clínico — pesos, dosis, temperaturas y horarios se
     leen en columna y deben alinearse.
- **Encabezado unico**: todas las pantallas abren con
  [PageHeader](frontend/src/components/layout/PageHeader.jsx) — rotulo de seccion,
  titulo en display y filete de laton. Antes cada pagina resolvia su titulo por su
  cuenta y se notaba: unas llevaban rotulo y otras un `h1` suelto.
- **Escala tipografica explicita** (`text-[13px]`, `text-[27px]`) en vez de los alias de
  Tailwind (`text-sm`, `text-2xl`). Con dos familias variables y numeros tabulares, los
  saltos de la escala por defecto quedaban gruesos.
- **Utilidades propias**: `.rotulo` (versalitas espaciadas para etiquetas de sección),
  `.filete` (regla ornamental bajo los títulos), `.hoja` (superficie con filete),
  `.escalonar` (entrada escalonada al cargar, sin tocar el JS). Todo respeta
  `prefers-reduced-motion`, y hay una hoja de estilos de impresión porque las recetas y
  las historias clínicas se imprimen.

> Los mensajes de error llevan el atributo `data-error`. Es deliberado: da a las pruebas
> E2E un anclaje estable, en vez de atarlas a una clase de color que cualquier rediseño
> rompe (nos pasó).

## Decisiones que conviene conocer antes de tocar el código

- **`frontend/dev-dist/` no se borra a mano.** Lo genera `vite-plugin-pwa` para
  servir el service worker en desarrollo. Está en `.gitignore` y se regenera solo al
  arrancar el dev server, pero borrarlo *con el servidor corriendo* deja la pantalla en
  un overlay de error de Vite hasta reiniciarlo.
- **`workbox-window` está excluido del optimizador de Vite** (`optimizeDeps.exclude`).
  El registro del SW lo carga con un import dinámico y, pre-empaquetado, cada reinicio
  invalida el hash: el SW no se registra y la consola se llena de `504 Outdated Optimize
  Dep`. Con la exclusión, los errores de consola en desarrollo pasaron de 54 a 3.


- **Fechas locales:** usar `hoyISO()` / `fechaISO()` de `src/lib/format.js`, nunca
  `new Date().toISOString().slice(0,10)`. Eso último devuelve **UTC**: en Argentina
  (UTC−3), a partir de las 21:00 informa el día siguiente y el servidor —que valida en
  hora local— rechaza el valor por "fecha futura". Ya nos pasó.
- **Placeholders repetidos en SQL:** con `EMULATE_PREPARES => false` las sentencias
  preparadas son reales y MySQL **no** admite reutilizar un parámetro nombrado. Un
  `LIKE :q` sobre seis columnas necesita `:q0`…`:q5` ligados al mismo valor.
- **Middleware por nombre de clase:** en `routes/api.php` se pasa
  `JwtAuthMiddleware::class`, no una instancia. Con `$container->get()` el middleware
  —y con él la conexión PDO— se construiría al *definir* las rutas, o sea en cada
  petición, incluidas `/health` y `/login`.
- **Closures de rutas sin `static`:** Slim los vincula al contenedor con `bindTo()`,
  que devuelve `null` sobre un closure estático y hace fallar el `CallableResolver`.
- **Refresh deduplicado:** todo refresco pasa por `refrescarSesion()` en
  `src/api/client.js`. El servidor **rota** el token en cada uso, así que dos llamadas
  concurrentes harían que la segunda llegue con uno ya revocado. Pasa con `<StrictMode>`
  en desarrollo. El backend además tolera 30 s de gracia para la carrera entre pestañas,
  y trata un reuso posterior como token filtrado: revoca todas las sesiones del usuario.
- **El service worker se registra en `App.jsx`**, fuera del router. Si `ReloadPrompt`
  viviera dentro de `AppShell` (que sólo se monta con sesión iniciada), la PWA no sería
  instalable desde la pantalla de login.
- **Sin librerías de calendario ni de gráficos:** la agenda semanal y el gráfico de peso
  están escritos a mano (unas decenas de líneas cada uno). FullCalendar o Recharts
  sumarían >100 KB a una PWA que tiene que arrancar rápido en el celular del
  veterinario. Si más adelante se piden vistas de mes con drag & drop o varios gráficos,
  ahí sí conviene reevaluarlo.

## Patrón para agregar un módulo nuevo

`Clientes` es la plantilla más simple; `Pacientes` la más completa.

**Backend:** modelo en `src/Models/` extendiendo `BaseModel` (whitelist
`$camposPermitidos`, `$ordenPermitido`, `listar()` con búsqueda) → controlador en
`src/Controllers/` (validar con `Validator`, delegar SQL al modelo, responder con
`ApiResponse`) → grupo de rutas en `routes/api.php` con su `RoleMiddleware` → registrar
en `config/container.php`.

**Frontend:** `src/api/<modulo>.js` → `src/features/<modulo>/` con
`use<Modulo>.js` (debounce + `AbortController`), `<Modulo>Page.jsx` y
`<Modulo>Form.jsx` → registrar la ruta en `src/routes/index.jsx` y el permiso en
`src/auth/contexto.js`.

> Todo permiso definido en `PERMISOS` (frontend) debe tener su equivalente en
> `routes/api.php`. La UI sólo oculta; quien protege los datos es la API.

---

## Verificación

Las pruebas viven en [frontend/tests/e2e/](frontend/tests/e2e/) — dentro del
repositorio, no en una carpeta temporal. `smoke_ui.py` es la que hay que correr después
de tocar el diseño: recorre las pantallas y verifica lo que un cambio de presentación
rompe sin que el build se queje (**29/29**).

El proyecto se validó además con Playwright contra la app real (backend + MySQL +
navegador) y con pruebas de la API por `curl`:

| Suite | Cubre |
|---|---|
| Auth + Clientes | 21/21 — login, 401/422, CRUD, debounce, RBAC, sesión tras F5 |
| Pacientes | 29/29 — razas por especie, microchip duplicado, filtros, ficha, navegación cruzada |
| Historial + Turnos | 29/29 — recetas dinámicas, línea de tiempo, solapamiento, estados |
| PWA offline | 9/9 — SW activo, precaché sirve el shell, `/api/auth` nunca cacheado |
| Adjuntos, perfil y usuarios | 27/27 — dueño vinculado, subida y rechazo de formatos, perfil propio, RBAC de /usuarios |

Por `curl` se verificó además: rollback de la transacción de consulta ante una receta
inválida, los cuatro tipos de solapamiento de turnos (y que los consecutivos y los
cancelados **no** bloqueen), rate limiting de login, rotación y detección de reuso del
refresh token, CORS con whitelist e inyección SQL en los buscadores. Para los adjuntos:
rechazo de un `.php` renombrado a `.pdf`, límite de 10 MB, 401 sin token y 404 al pedir
el binario por URL directa.

## Pendiente (fases siguientes)

- **Cola offline con IndexedDB**: migrar de `generateSW` a `injectManifest` con un SW
  propio y `BackgroundSyncPlugin` sobre `POST /api/consultas`. Requiere una columna
  `client_uuid UNIQUE` para descartar reenvíos duplicados. Es el módulo de Historial el
  que más lo necesita: es donde más duele perder una carga por falta de red.
- **Web Push** (VAPID + `minishlink/web-push`) para recordatorios de vacunas y turnos.
  La vista `v_recordatorios_pendientes` del esquema ya provee los datos.
- **Carga de imágenes** con `FormData` hacia `public/uploads/` (la tabla `adjuntos` y el
  `.htaccess` que bloquea la ejecución de PHP ya están).
- **Aviso de dependencia**: `react-router-dom@7.18.2` tiene un aviso de seguridad
  (CSRF en **modo RSC**). No aplica a este proyecto —es una SPA de cliente contra una API
  separada, sin RSC— y 7.18.2 es la última versión publicada: lo que `npm audit fix`
  propone es un *downgrade* a 7.11.0. Revisar cuando salga una versión parcheada.


Pasos para poner el sistema en producción y venderlo
🏗️ 1. Conseguí un servidor
Tenés dos opciones principales:

VPS (recomendado para este stack):

Hostinger VPS, DigitalOcean Droplet, o Contabo — desde ~$5-10 USD/mes
Te dan acceso SSH, instalás lo que quieras (PHP, MySQL, Nginx)
Hosting compartido:

Más barato pero limitado — PHP compartido como cPanel (Hostinger, SiteGround)
El problema: no podés levantar el servidor PHP de Slim con composer start fácilmente → necesitarías configurar el DocumentRoot hacia backend/public/
Recomendación: VPS Ubuntu 22.04

🌐 2. Comprá un dominio
Compralo en NIC Argentina (.com.ar), Namecheap o GoDaddy
Ejemplo: veterinarialopez.com.ar
Apuntá el DNS del dominio a la IP del VPS
🔒 3. Configurá SSL (HTTPS)
En el VPS instalás Certbot + Let's Encrypt — es gratis
Configura Nginx como reverse proxy hacia el backend PHP
⚙️ 4. Configurá el servidor (VPS)
Instalás en el VPS:

Nginx — servidor web y reverse proxy
PHP 8.2 con extensión pdo_mysql
Composer
MySQL o MariaDB
Node.js — solo para buildear el frontend (no para servirlo)
🗄️ 5. Base de datos en producción
Creás una base de datos MySQL en el VPS
Importás schema.sql y seed.sql
Creás un usuario MySQL específico para la app (no uses root)
🚀 6. Deploy del Backend
Subís el código al VPS (vía git clone o FTP)
Corres composer install --no-dev
Configurás el .env con los datos reales (DB, JWT, URL del frontend)
Configurás Nginx para que apunte a backend/public/ como root
Usás PHP-FPM en lugar de composer start (ese comando es solo para desarrollo)
🎨 7. Deploy del Frontend
En el .env del frontend cambiás la URL de la API a la del dominio real
Corrés npm run build → genera la carpeta dist/
Subís esa carpeta dist/ al VPS
Configurás Nginx para servir esos archivos estáticos
👤 8. Creás el usuario para la veterinaria
bash
php bin/crear-usuario.php
Lo corrés en el servidor para crear el admin del cliente.

📋 Resumen del flujo
Dominio → DNS → VPS con Nginx
                 ├── /           → dist/ del React (estático)
                 └── /api        → PHP-FPM → backend/public/
                                      └── MySQL (local en el VPS)
💡 Consejo para escalarlo como negocio
Si vas a venderlo a varias veterinarias, evaluá:

Opción	Descripción
Una instancia por cliente	Cada cliente tiene su VPS/base → más caro, más aislado
Multi-tenant	Una sola app, varias clínicas en la misma DB → requiere cambios en el código
SaaS con subdominio	lopez.tuapp.com, garcia.tuapp.com → profesional y escalable
Para empezar, una instancia por cliente es lo más simple y seguro.