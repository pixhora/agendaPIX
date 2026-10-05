import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, next) {
  if ((specifier.startsWith(".") || specifier.startsWith("/")) && context.parentURL?.startsWith("file:")) {
    const base = new URL(specifier, context.parentURL);
    const path = fileURLToPath(base);
    if (!existsSync(path) || statSync(path).isDirectory()) {
      for (const suffix of [".ts", "/index.ts"]) {
        if (existsSync(path + suffix)) return { shortCircuit: true, url: pathToFileURL(path + suffix).href };
      }
    }
  }
  return next(specifier, context);
}
