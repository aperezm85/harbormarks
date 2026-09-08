// @ts-check

import node from "@astrojs/node"
import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

// https://astro.build/config
export default defineConfig({
  adapter: node({ mode: "standalone" }),
  output: "server",
  security: {
    // Astro freezes `checkOrigin` and `allowedDomains` into the build manifest,
    // so they can only ever reflect the machine that ran `astro build`. Because
    // HarborMarks ships a prebuilt image, the CSRF origin check is done at
    // request time in src/lib/origin-check.ts instead, where operators can
    // configure it with HARBOR_CHECK_ORIGIN and HARBOR_ALLOWED_DOMAINS.
    checkOrigin: false,
  },
  server: {
    host: process.env.HOST || "localhost",
    port: Number(process.env.PORT) || 4321,
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [react()],
})
