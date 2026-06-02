import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Reglas del React Compiler (react-hooks v6) que Next 16 trae como `error`.
    // Las bajamos a `warn`: marcan patrones legítimos como falsos positivos
    //   - set-state-in-effect: seed de caché + fetch async en effects (correcto)
    //   - purity: Date.now() dentro de useMemo de filtros que dependen de polling
    //   - refs: patrón "latest ref" (asignar callback a ref en render)
    // Quedan visibles como advertencia, pero no rompen el build ni la DoD.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build scripts standalone de Node (CommonJS): no son parte del bundle de la
    // app, se corren con `node scripts/x.js`. require() es correcto acá.
    "scripts/**",
  ]),
]);

export default eslintConfig;
