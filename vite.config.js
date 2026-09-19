import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite doesn't read PORT from the environment on its own, so honour it here —
// lets the harness assign a free port when 5173 is already taken by another
// session's dev server. Falls back to the usual 5173 when PORT isn't set.
export default defineConfig({
  plugins: [react()],
  server: { port: Number(process.env.PORT) || 5173 },
})
