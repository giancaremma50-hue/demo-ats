import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // El alias `@/…` de `tsconfig.json`. Vitest no lee los `paths` de TypeScript,
  // así que sin esto cualquier módulo bajo prueba que importe con `@/` falla al
  // resolver — y el archivo de test entero queda sin correr, no solo ese import.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
