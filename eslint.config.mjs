import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Skills de agentes versionadas desde repos externos: no es código nuestro.
    ".claude/skills/**",
    // Worktrees de git de otras sesiones/branches — copias completas del
    // repo en otro estado, con su propio .claude/skills incluido. Sin este
    // ignore, ESLint las barre igual que el código real del proyecto.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
