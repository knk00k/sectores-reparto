import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/') || id.includes('\\node_modules\\')) {
            if (id.includes('xlsx')) return 'excel';
            if (id.includes('geoman')) return 'map-editor';
            if (id.includes('leaflet')) return 'map';
            if (id.includes('jszip') || id.includes('pako')) return 'kmz';
          }
        },
      },
    },
  },
});
