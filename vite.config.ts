import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // The app runs Vite in Express middleware mode, where the preview proxy
      // does not forward the HMR WebSocket reliably. Leaving the client enabled
      // causes repeated "WebSocket closed without opened" runtime errors.
      hmr: false,
      // Keep the preview stable while edits are applied by the host.
      watch: null,
    },
  };
});
