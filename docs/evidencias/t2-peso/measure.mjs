// Mede artefatos existentes; não inicia servidor nem recria build.
import fs from 'node:fs';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';

const definitions = [
  ['/dashboard', '(owner)'],
  ['/dashboard/services', '(owner)/services'],
  ['/dashboard/customers', '(owner)/customers'],
  ['/dashboard/settings', '(owner)/settings'],
  ['/dashboard/login', 'login'],
];
const measurements = definitions.map(([route, directory]) => {
  const manifestPath = `.next/server/app/dashboard/${directory}/page_client-reference-manifest.js`;
  const context = {};
  vm.runInNewContext(fs.readFileSync(manifestPath, 'utf8'), context);
  const manifest = Object.values(context.__RSC_MANIFEST)[0];
  const buildManifest = JSON.parse(fs.readFileSync(`.next/server/app/dashboard/${directory}/page/build-manifest.json`, 'utf8'));
  const chunks = [...new Set([
    ...Object.values(manifest.clientModules).flatMap((module) => module.chunks),
    ...buildManifest.rootMainFiles.map((file) => `/_next/${file}`),
  ])].sort();
  const files = chunks.map((url) => {
    const bytes = fs.readFileSync(`.next/${url.replace('/_next/', '')}`);
    return { url, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
  });
  return {
    route,
    manifestModifiedAt: fs.statSync(manifestPath).mtime.toISOString(),
    files,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
  };
});
const result = {
  measuredAt: new Date().toISOString(),
  node: process.version,
  method: 'União de rootMainFiles e chunks de clientModules por manifesto de rota; inclui boundaries, sem polyfills condicionais. gzip local por arquivo. Não representa waterfall HTTP, HTML/RSC, CSS, tempo de execução ou tráfego efetivo com cache.',
  measurements,
};
fs.writeFileSync('docs/evidencias/t2-peso/results.json', `${JSON.stringify(result, null, 2)}\n`);
for (const { route, bytes, gzipBytes, files } of measurements) console.log(`${route}: ${files.length} chunks; ${bytes} bytes; gzip ${gzipBytes} bytes`);
