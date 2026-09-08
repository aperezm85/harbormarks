// @ts-check

import node from "@astrojs/node"
import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

const checkOrigin = process.env.HARBOR_CHECK_ORIGIN !== "false"
const allowedDomains = process.env.HARBOR_ALLOWED_DOMAINS?.split(",")
  .map((domain) => domain.trim())
  .filter(Boolean)
  .map((hostname) => ({ hostname }))

// https://astro.build/config
export default defineConfig({
  adapter: node({ mode: "standalone" }),
  output: "server",
  security: {
    checkOrigin,
    ...(allowedDomains?.length ? { allowedDomains } : {}),
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
