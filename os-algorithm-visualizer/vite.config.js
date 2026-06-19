import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    root: '.',
    base: './',
    build: {
        outDir: path.resolve(__dirname, 'dist'),
        assetsDir: 'assets',
        sourcemap: false,
        minify: 'esbuild'
    },
    server: {
        port: 3000,
        open: true
    }
});
