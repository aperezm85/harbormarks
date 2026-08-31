import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores(["dist", ".astro"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Ambient declaration files must stay scripts rather than modules, so that
    // `declare namespace App` augments the global scope. An `import` would turn
    // env.d.ts into a module and break that, so the triple-slash path reference
    // to Astro's generated types is the correct mechanism here.
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": ["error", { path: "always" }],
    },
  },
])
