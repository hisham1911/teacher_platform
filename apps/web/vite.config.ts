import fs from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig, loadEnv, type Plugin } from 'vite';

function copyPublicDirPlugin(): Plugin {
  return {
    name: 'custom-copy-public',
    apply: 'build',
    closeBundle() {
      if (fs.existsSync('public')) {
        fs.cpSync('public', 'dist', { recursive: true });
      }
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = env.VITE_API_BASE_URL || 'http://localhost:5000';

  return {
    publicDir: command === 'build' ? false : 'public',
    plugins: [react(), tailwindcss(), copyPublicDirPlugin()],
    server: {
      proxy: {
        '/api': {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      reportCompressedSize: false,
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      globals: true,
    },
  };
});
