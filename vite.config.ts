import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

// Сборка рассчитана на запуск двойным кликом по dist/index.html (file://).
// Браузеры не грузят с диска модули и шрифты отдельными файлами (CORS, origin null),
// поэтому всё собирается в один JS и один CSS, ассеты встраиваются как data:,
// а scripts/postbuild.mjs вкладывает JS и CSS прямо в index.html.
export default defineConfig({
  base: './',
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    assetsInlineLimit: () => true,
    cssCodeSplit: false,
    modulePreload: false,
    // Один файл — намеренно (см. комментарий выше), предупреждение о размере не нужно.
    chunkSizeWarningLimit: 2048,
    rolldownOptions: {
      output: { codeSplitting: false },
    },
  },
})
