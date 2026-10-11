// Verificação de PR, sem rede e sem depender da árvore de trabalho: lê os arquivos do git.
// Uso: node scripts/check-pr.mjs [ref=HEAD] [base=origin/master]
// Sai com código 1 e lista cada falha. Regras em AGENTS.md (seção 9) e em docs/CI-LOCAL.md.
import { execFileSync, spawnSync } from "node:child_process";

const ref = process.argv[2] ?? "HEAD";
const base = process.argv[3] ?? "origin/master";
const failures = [];
const fail = (msg) => failures.push(msg);

function git(args, opts = {}) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...opts });
}
function tryGit(args) {
  const r = spawnSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return { ok: r.status === 0, out: r.stdout ?? "", err: r.stderr ?? "" };
}
function showOrNull(rev, path) {
  const r = tryGit(["show", `${rev}:${path}`]);
  return r.ok ? r.out : null;
}
function listFiles(rev, dir) {
  const r = tryGit(["ls-tree", "-r", "--name-only", rev, dir]);
  return r.ok ? r.out.split("\n").filter(Boolean) : [];
}

// 1. A branch precisa conter a master atual (sem isso o merge pode voltar atrás).
if (!tryGit(["merge-base", "--is-ancestor", base, ref]).ok) {
  fail(`a branch não contém ${base}. Faça rebase: git rebase ${base}`);
}

// 2. Sem conflito com a master.
const merge = spawnSync("git", ["merge-tree", "--write-tree", base, ref], { encoding: "utf8" });
if (merge.status !== 0) {
  fail(`conflito com ${base} (merge-tree falhou). Resolva antes do merge.`);
}

// 3. Migrations: número único, sequência, journal e snapshot consistentes, e migrations novas acima da base.
const migrationFiles = listFiles(ref, "db/migrations").filter((f) => f.endsWith(".sql"));
const numberOf = (path) => Number(path.split("/").pop().match(/^(\d{4})_/)?.[1] ?? NaN);
const byNumber = new Map();
for (const file of migrationFiles) {
  const n = numberOf(file);
  if (Number.isNaN(n)) fail(`migration sem número de 4 dígitos: ${file}`);
  if (byNumber.has(n)) fail(`número de migration repetido: ${n} (${byNumber.get(n)} e ${file})`);
  byNumber.set(n, file);
}
const baseMigrations = listFiles(base, "db/migrations").filter((f) => f.endsWith(".sql"));
const baseMax = Math.max(-1, ...baseMigrations.map(numberOf));
for (const file of migrationFiles) {
  const n = numberOf(file);
  if (!baseMigrations.includes(file) && n <= baseMax) {
    fail(`migration nova ${file} tem número menor ou igual ao da master (${String(baseMax).padStart(4, "0")}). Renumere para ${String(baseMax + 1).padStart(4, "0")} ou acima.`);
  }
}
const journalRaw = showOrNull(ref, "db/migrations/meta/_journal.json");
if (migrationFiles.length && !journalRaw) fail("db/migrations/meta/_journal.json ausente");
if (journalRaw) {
  const entries = JSON.parse(journalRaw).entries ?? [];
  const tags = new Set(entries.map((e) => e.tag));
  const newTags = new Set(migrationFiles.filter((f) => !baseMigrations.includes(f)).map((f) => f.split("/").pop().replace(/\.sql$/, "")));
  entries.forEach((entry, index) => {
    if (entry.idx !== index) fail(`journal: idx ${entry.idx} fora de sequência (esperado ${index}) em ${entry.tag}`);
    if (index > 0 && !(entry.when > entries[index - 1].when)) {
      fail(`journal: 'when' de ${entry.tag} não é maior que o da anterior. O migrator pularia essa migration.`);
    }
    // Histórico já mergeado pode ter lacunas antigas; a regra vale para o que este PR adiciona.
    const prefix = entry.tag.slice(0, 4);
    if (newTags.has(entry.tag) && showOrNull(ref, `db/migrations/meta/${prefix}_snapshot.json`) === null) fail(`snapshot ausente para a migration nova ${entry.tag}`);
  });
  for (const file of migrationFiles) {
    const tag = file.split("/").pop().replace(/\.sql$/, "");
    if (!tags.has(tag)) fail(`migration ${file} não está no journal`);
  }
}

// 4. package.json mudou sem o lockfile.
const changed = git(["diff", "--name-only", `${base}...${ref}`]).split("\n").filter(Boolean);
if (changed.includes("package.json") && !changed.includes("pnpm-lock.yaml")) {
  fail("package.json mudou sem pnpm-lock.yaml. Rode pnpm install e commite o lockfile.");
}

// 5. Só o que foi adicionado no PR (linhas '+') é checado.
const added = git(["diff", "--unified=0", `${base}...${ref}`, "--", ":!*.snap", ":!*snapshot*", ":!*.png", ":!pnpm-lock.yaml", ":!db/migrations/meta/*"]);
let file = "";
const addedLines = [];
for (const line of added.split("\n")) {
  if (line.startsWith("+++ b/")) file = line.slice(6);
  else if (line.startsWith("+") && !line.startsWith("+++")) addedLines.push({ file, text: line.slice(1) });
}
const secretPatterns = [
  { re: /postgres(ql)?:\/\/[^:\s]+:[^@\s]+@(?!localhost|127\.0\.0\.1|\[::1\])/, what: "URL de banco com senha fora do localhost" },
  { re: /sk_live_[A-Za-z0-9]{10,}/, what: "chave Stripe de produção" },
  { re: /APP_USR-[0-9a-f-]{20,}/, what: "token de produção do Mercado Pago" },
  { re: /-----BEGIN (RSA |OPENSSH |EC |)PRIVATE KEY-----/, what: "chave privada" },
];
const debugPatterns = [
  { re: /\bconsole\.log\(/, what: "console.log esquecido" },
  { re: /\bdebugger\b/, what: "debugger esquecido" },
  { re: /\b(it|describe|test)\.only\(/, what: ".only esquecido (esconde testes)" },
];
for (const { file: f, text } of addedLines) {
  for (const { re, what } of secretPatterns) if (re.test(text)) fail(`${what} em ${f}`);
  const isCode = /^(app|lib|components|db|scripts|tests)\//.test(f) && !f.startsWith("tests/e2e/visual");
  if (isCode) for (const { re, what } of debugPatterns) if (re.test(text) && !f.startsWith("scripts/")) fail(`${what} em ${f}`);
  if (/\bTODO\b(?!\()/.test(text)) fail(`TODO sem dono (use TODO(nome)) em ${f}`);
}

if (failures.length) {
  console.error(`\nCheck de PR REPROVADO (${ref} contra ${base}):`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}
console.log(`Check de PR OK: ${ref} contra ${base} (${migrationFiles.length} migrations, ${changed.length} arquivos alterados).`);
