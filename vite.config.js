import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite doesn't read PORT from the environment on its own, so honour it here —
// lets the harness assign a free port when 5173 is already taken by another
// session's dev server. Falls back to the usual 5173 when PORT isn't set.
// GitHub Pages serves this repo at /<repo-name>/, so production builds need that
// base path or every asset 404s and the page is blank. Dev stays at "/" so
// localhost:5173 keeps working unchanged.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/grid/" : "/",
  plugins: [react()],
  server: { port: Number(process.env.PORT) || 5173 },
}))
