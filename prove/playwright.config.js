import { defineConfig } from '@playwright/test'
import path from 'node:path'

/**
 * Le prove dell'app vera nel browser, con il database finto.
 * In locale: `npm run e2e`. Su GitHub girano da sole (.github/workflows).
 */
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  // L'app si apre una volta prima delle prove (vedi riscaldamento.js).
  globalSetup: './riscaldamento.js',
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  webServer: [
    {
      command: 'npx vite --config prove/vite.config.js',
      cwd: path.resolve(import.meta.dirname, '..'),
      url: 'http://localhost:5199/prove/index.html',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // Il collegamento vero, verso un Supabase finto (rete.spec.js).
      command: 'npx vite --config prove/vite.rete.config.js',
      cwd: path.resolve(import.meta.dirname, '..'),
      url: 'http://localhost:5198/prove/index.html',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  use: {
    baseURL: 'http://localhost:5199',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    trace: 'off',
  },
})
