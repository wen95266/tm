import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listens on all local IPs (0.0.0.0) so you can access it from local network if needed
    port: 5173
  }
});