import { defineConfig } from "vite";
export default defineConfig({
  server: { port: 5173, strictPort: true },
  // Скрипты рендера/озвучки пишут сюда файлы — не перезагружать превью из-за них.
  optimizeDeps: { include: ["p5", "p5.brush"] },
});
