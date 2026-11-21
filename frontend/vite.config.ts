import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // loadEnv garante que VITE_PROXY_TARGET funcione tanto no .env quanto no shell.
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:3000';
  const serverPort = Number(env.VITE_PORT ?? 5173);
  const previewPort = Number(env.VITE_PREVIEW_PORT ?? 4173);

  return {
    plugins: [react()],
    server: {
      host: true,
      port: serverPort,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: previewPort,
    },
  };
});
