import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createRoundHandler } from './server/rounds.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'wordle-round-api',
    configureServer(server) { server.middlewares.use(createRoundHandler()); },
    configurePreviewServer(server) { server.middlewares.use(createRoundHandler()); },
  }],
})
