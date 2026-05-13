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
  ]),
  {
    // React Compiler 19 ships some very strict purity/effect rules. They're
    // helpful in general but they false-flag a few canonical patterns we use
    // (e.g. hydration markers `useEffect(() => setHydrated(true), [])`,
    // `Date.now()` / `Math.random()` inside event-handler closures). Downgrade
    // those specific rules to warnings so we don't block CI on them.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
]);

export default eslintConfig;
