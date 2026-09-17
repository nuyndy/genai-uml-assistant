/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
