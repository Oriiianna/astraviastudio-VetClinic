import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      // 'prompt' y no 'autoUpdate': un veterinario a mitad de una consulta
      // cargada no puede perder el formulario porque el service worker
      // decidio recargar la pagina. ReloadPrompt.jsx le deja elegir cuando.
      registerType: 'prompt',

      // Permite auditar el service worker con `npm run dev`, sin tener que
      // hacer un build para cada prueba.
      devOptions: { enabled: true, type: 'module' },

      includeAssets: ['apple-touch-icon.png', 'favicon.ico', 'robots.txt'],

      manifest: {
        name: 'VetClinic - Gestion Veterinaria',
        short_name: 'VetClinic',
        description:
          'Gestion integral de clientes, pacientes, historial clinico y turnos de la clinica veterinaria.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#0d9488',
        background_color: '#f8fafc',
        categories: ['medical', 'productivity', 'business'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            // `maskable` es lo que evita que Android recorte el logo dentro
            // de un circulo blanco en la pantalla de inicio.
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Agenda de hoy',
            short_name: 'Agenda',
            url: '/turnos',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Nuevo cliente',
            short_name: 'Cliente',
            url: '/clientes?nuevo=1',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,woff,woff2}'],

        // SPA: cualquier navegacion se resuelve con el index precacheado...
        navigateFallback: 'index.html',
        // ...salvo /api, que jamas debe ser secuestrada por el shell. Sin esta
        // denylist, una peticion a la API estando offline devolveria el HTML
        // de la app y el cliente fallaria al parsear JSON.
        navigateFallbackDenylist: [/^\/api/],

        cleanupOutdatedCaches: true,
        clientsClaim: true,

        runtimeCaching: [
          {
            // NUNCA cachear autenticacion: ni tokens, ni el perfil del
            // usuario. Un token servido desde cache sobreviviria al logout.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/auth'),
            handler: 'NetworkOnly',
          },
          {
            // Datos de negocio: red primero para que siempre esten frescos,
            // con caida a cache si la conexion tarda mas de 5 s o no hay red.
            // Es lo que sostiene la consulta offline de fichas ya visitadas.
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith('/api/') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-datos',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Fotos de mascotas y estudios: no cambian una vez subidos.
            urlPattern: ({ url }) => url.pathname.startsWith('/uploads/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'imagenes-pacientes',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fuentes',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],

  // workbox-window lo carga el registro del service worker con un import
  // dinamico. Si el optimizador de dependencias de Vite lo pre-empaqueta,
  // cada reinicio del dev server invalida el hash y el import falla con
  // "504 Outdated Optimize Dep": el SW no se registra y la consola se llena
  // de ruido. Excluirlo lo deja servirse tal cual. Solo afecta a desarrollo.
  optimizeDeps: {
    exclude: ['workbox-window'],
  },

  // El proxy hace que en desarrollo el front y la API compartan origen.
  // Ventaja concreta: la cookie httpOnly del refresh token viaja sin pelear
  // con SameSite, y las reglas del service worker (que matchean por pathname
  // /api) funcionan igual que en produccion.
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:8080', changeOrigin: true },
    },
  },

  // `vite preview` NO hereda server.proxy: necesita el suyo. Sin esto, probar
  // el build de produccion en local deja la API sin responder.
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:8080', changeOrigin: true },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Separar React del codigo de la app: al desplegar una correccion,
        // el chunk del vendor conserva su hash y el navegador no vuelve a
        // descargarlo.
        //
        // Vite 8 usa Rolldown, que exige manualChunks como FUNCION; la forma
        // de objeto ({ vendor: [...] }) que aceptaba Rollup falla aqui.
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
})
