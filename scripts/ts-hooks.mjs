import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function withTsSuffix(path) {
  if (!existsSync(path) || statSync(path).isDirectory()) {
    for (const suffix of [".ts", "/index.ts"]) {
      if (existsSync(path + suffix)) return pathToFileURL(path + suffix).href;
    }
  }
  if (existsSync(path)) return pathToFileURL(path).href;
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const resolved = withTsSuffix(`${root}/${specifier.slice(2)}`);
    if (resolved) return { shortCircuit: true, url: resolved };
  }
  if ((specifier.startsWith(".") || specifier.startsWith("/")) && context.parentURL?.startsWith("file:")) {
    const path = fileURLToPath(new URL(specifier, context.parentURL));
    const resolved = withTsSuffix(path);
    if (resolved && resolved !== pathToFileURL(path).href) return { shortCircuit: true, url: resolved };
  }
  return next(specifier, context);
}
