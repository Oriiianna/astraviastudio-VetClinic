"""Prueba de humo de la interfaz.

Recorre las pantallas principales y verifica lo que un cambio de presentacion
puede romper: navegacion, encabezados, listados, buscadores, modales, fichas y
permisos por rol. No cubre logica de negocio; cubre que la interfaz siga en pie
despues de tocar el diseno.

    python tests/e2e/smoke_ui.py     # backend en :8080, front en :5173
"""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
ok, errores = [], []


def check(nombre, cond, detalle=""):
    ok.append((nombre, cond))
    print(f"  {'PASA' if cond else 'FALLA'}  {nombre}" + (f"  ({detalle})" if detalle else ""))


def login(page, email, pwd):
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.wait_for_selector('input[type="email"]', timeout=10000)
    page.fill('input[type="email"]', email)
    page.fill('input[type="password"]', pwd)
    page.click('button[type="submit"]')
    page.wait_for_selector('a[href="/clientes"]', timeout=10000)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1366, "height": 1000})
    page = ctx.new_page()
    page.on("console", lambda m: errores.append(f"[{m.type}] {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errores.append(f"[pageerror] {e}"))

    print("\n=== 1. ACCESO ===")
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.wait_for_timeout(1200)
    check("el login se dibuja", page.locator('input[type="email"]').is_visible())
    check("la marca aparece en el panel", "VetClinic" in page.locator("body").inner_text())

    login(page, "admin@vet.local", "admin1234")
    check("el admin entra", page.url.rstrip("/") == BASE, page.url)

    print("\n=== 2. NAVEGACION Y ENCABEZADOS ===")
    # Cada pantalla debe traer rotulo de seccion y titulo en display.
    PANTALLAS = [
        ("/clientes", "Clientes", "Registro"),
        ("/pacientes", "Pacientes", "Registro"),
        ("/historial", "Historial", "Clinica"),
        ("/turnos", "Turnos", "Agenda"),
        ("/usuarios", "Usuarios", "Administracion"),
        ("/perfil", "Mis datos", "Cuenta"),
    ]
    for ruta, titulo, rotulo in PANTALLAS:
        page.goto(f"{BASE}{ruta}", wait_until="networkidle")
        page.wait_for_selector("h1", timeout=10000)
        page.wait_for_timeout(700)
        # "main header": el primer <header> del documento es la cabecera movil
        # del AppShell (oculta en escritorio pero presente en el DOM).
        cabecera = page.locator("main header").first.inner_text()
        h1 = page.locator("h1").first.inner_text()
        check(f"{ruta} tiene titulo y rotulo",
              titulo in h1 and rotulo.lower() in cabecera.lower(), h1)

    check("el filete del encabezado esta presente",
          page.locator("div.filete").count() >= 1)

    print("\n=== 3. LISTADOS ===")
    for ruta in ("/clientes", "/pacientes", "/usuarios"):
        page.goto(f"{BASE}{ruta}", wait_until="networkidle")
        page.wait_for_selector("table tbody tr", timeout=10000)
        filas = page.locator("table tbody tr").count()
        check(f"{ruta} lista filas", filas > 0, f"{filas} filas")

    print("\n=== 4. BUSCADOR ===")
    page.goto(f"{BASE}/clientes", wait_until="networkidle")
    page.wait_for_selector("table tbody tr", timeout=8000)
    caja = page.locator('input[type="search"]')
    check("hay caja de busqueda", caja.is_visible())
    caja.fill("gomez")
    page.wait_for_timeout(1200)
    encontradas = page.locator("table tbody tr").count()
    check("el buscador filtra", encontradas == 1, f"{encontradas}")

    print("\n=== 5. AGENDA ===")
    page.goto(f"{BASE}/turnos", wait_until="networkidle")
    page.wait_for_timeout(1500)
    check("la vista dia muestra una columna", page.locator("main section").count() == 1)
    page.click('button:has-text("Semana")')
    page.wait_for_timeout(1500)
    columnas = page.locator("main section").count()
    check("la vista semana muestra siete", columnas == 7, f"{columnas}")
    check("el control de fecha responde",
          page.locator('input[aria-label="Fecha de la agenda"]').is_visible())
    check("el filtro por veterinario responde",
          page.locator('select[aria-label="Filtrar por veterinario"]').is_visible())
    page.click('button:has-text("Dia")')
    page.wait_for_timeout(900)

    print("\n=== 6. MODALES ===")
    page.goto(f"{BASE}/clientes", wait_until="networkidle")
    page.wait_for_selector("table tbody tr", timeout=8000)
    page.click('button:has-text("Nuevo cliente")')
    page.wait_for_selector("dialog[open]", timeout=8000)
    check("el modal abre", page.locator("dialog[open]").count() == 1)
    check("el modal tiene titulo", page.locator("dialog h2").count() == 1)
    page.click('dialog button:has-text("Cancelar")')
    page.wait_for_timeout(800)
    check("el modal cierra", page.locator("dialog").count() == 0)

    print("\n=== 7. FICHAS ===")
    page.locator("tr a[href^='/clientes/']").first.click()
    page.wait_for_selector("h1", timeout=8000)
    page.wait_for_timeout(1300)
    check("abre la ficha de cliente", "/clientes/" in page.url, page.url)
    # >= 1 porque la ficha sin mascotas suma el boton del estado vacio.
    check("ofrece agregar mascota ya vinculada",
          page.locator('button:has-text("Agregar mascota")').count() >= 1)

    page.goto(f"{BASE}/pacientes", wait_until="networkidle")
    page.wait_for_selector("table tbody tr", timeout=8000)
    page.locator("tr a[href^='/pacientes/']").first.click()
    page.wait_for_selector("h1", timeout=8000)
    page.wait_for_timeout(1500)
    check("abre la ficha de paciente", "/pacientes/" in page.url, page.url)
    check("la ficha incluye documentos",
          "documentos" in page.locator("main").inner_text().lower())

    print("\n=== 8. ROLES ===")
    page.click('button:has-text("Cerrar sesion")')
    page.wait_for_timeout(2200)
    login(page, "recepcion@vet.local", "recep1234")
    nav = page.locator("aside nav a").all_inner_texts()
    check("recepcion no ve Historial", "Historial" not in nav, str(nav))
    check("recepcion no ve Usuarios", "Usuarios" not in nav)
    page.goto(f"{BASE}/usuarios", wait_until="networkidle")
    page.wait_for_timeout(1000)
    check("acceso directo bloqueado", "sin-permiso" in page.url, page.url)

    browser.close()

print("\n" + "=" * 58)
fallos = [n for n, c in ok if not c]
print(f"RESULTADO: {len(ok) - len(fallos)}/{len(ok)} comprobaciones pasaron")
if fallos:
    print("FALLARON:", " | ".join(fallos))
print(f"\nERRORES DE CONSOLA: {len(errores)}")
for e in errores[:8]:
    print("  ", e)

sys.exit(1 if fallos else 0)
