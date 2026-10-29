import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8787' } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as never);
