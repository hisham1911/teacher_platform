import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function copyPublicDirPlugin(): Plugin {
  return {
    name: 'custom-copy-public',
    apply: 'build',
    closeBundle() {
      const srcDir = path.resolve(__dirname, 'public');
      const destDir = path.resolve(__dirname, 'dist');
      if (fs.existsSync(srcDir)) {
        fs.cpSync(srcDir, destDir, { recursive: true });
      }
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = env.VITE_API_BASE_URL || 'http://localhost:5000';

  return {
    publicDir: command === 'build' ? false : path.resolve(__dirname, 'public'),
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
