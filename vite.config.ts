import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Self-signed SSL certificate — needed so phones on the same WiFi
    // can access the dev server over HTTPS, which is required for the
    // DeviceOrientationEvent compass API to work on real mobile devices.
    basicSsl(),
    {
      name: 'admin-fallback-middleware',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && req.url.startsWith('/admin') && !req.url.includes('.')) {
            req.url = '/admin/index.html';
          }
          next();
        });
      },
    },
  ],
  server: {
    // Expose to all network interfaces so phones on the same WiFi can connect
    host: true,
    port: 5173,
    // HTTPS is required for DeviceOrientationEvent (compass) on mobile browsers.
    // basicSsl() generates a self-signed certificate automatically.
    // When your phone opens the URL, tap "Advanced → Proceed" to bypass the
    // browser's self-signed certificate warning (this is safe on your local network).
    https: true,
  },
  // Exclude the MapLibre GL worker from Vite's dep pre-bundler so that the
  // ?worker&url import in Map3DPage.tsx goes through Vite's worker pipeline
  // rather than the optimizer (which would strip the ?worker query and break
  // the worker URL resolution, causing the map `load` event to never fire).
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('leaflet')) {
              return 'vendor-leaflet';
            }
            if (id.includes('@supabase') || id.includes('websocket')) {
              return 'vendor-supabase';
            }
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            return 'vendor';
          }
        },
      },
    },
  },
});
