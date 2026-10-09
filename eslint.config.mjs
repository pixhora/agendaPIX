import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts", "dist/**", ".vercel/**"]),
  {
    // A home não pode importar next/link: isso puxa o runtime do React para o LCP.
    files: ["app/page.tsx", "components/landing/**/*.{ts,tsx}"],
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
]);
