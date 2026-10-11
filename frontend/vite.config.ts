/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Cố định port 5173 và KHÔNG tự nhảy port (strictPort).
    // Google OAuth (GSI) whitelist theo origin: http://localhost:5173. Nếu Vite
    // âm thầm nhảy sang 5174/5175, origin đổi và Google trả lỗi `origin_mismatch`.
    // Báo lỗi rõ khi port bận còn hơn để lỗi OAuth khó hiểu xuất hiện sau đó.
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    pool: "threads",
    maxWorkers: 1,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
