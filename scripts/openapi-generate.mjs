/**
 * Gera `src/app/core/api/generated/api-types.ts` a partir do Swagger.
 *
 * URL (primeira disponível):
 * 1. Variável de ambiente OPENAPI_SWAGGER_URL
 * 2. Arquivo config/openapi.config.local.json → propriedade "swaggerUrl"
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outFile = join(root, 'src', 'app', 'core', 'api', 'generated', 'api-types.ts');
const localConfigPath = join(root, 'config', 'openapi.config.local.json');
const dotEnvPath = join(root, '.env');

/** Preenche OPENAPI_SWAGGER_URL a partir de `.env` na raiz, se a variável ainda não estiver definida. */
function hydrateOpenapiUrlFromDotEnv() {
  if (process.env.OPENAPI_SWAGGER_URL?.trim()) return;
  if (!existsSync(dotEnvPath)) return;
  try {
    const text = readFileSync(dotEnvPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const m = /^OPENAPI_SWAGGER_URL\s*=\s*(.*)$/.exec(t);
      if (!m) continue;
      let v = m[1].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (v) process.env.OPENAPI_SWAGGER_URL = v;
      break;
    }
  } catch (e) {
    console.error('Erro ao ler .env:', e?.message ?? e);
    process.exit(1);
  }
}

function resolveSwaggerUrl() {
  hydrateOpenapiUrlFromDotEnv();
  const fromEnv = process.env.OPENAPI_SWAGGER_URL?.trim();
  if (fromEnv) return fromEnv;

  if (existsSync(localConfigPath)) {
    try {
      const raw = readFileSync(localConfigPath, 'utf8');
      const cfg = JSON.parse(raw);
      const u = typeof cfg.swaggerUrl === 'string' ? cfg.swaggerUrl.trim() : '';
      if (u) return u;
    } catch (e) {
      console.error('Erro ao ler config/openapi.config.local.json:', e?.message ?? e);
      process.exit(1);
    }
  }

  return '';
}

const url = resolveSwaggerUrl();
if (!url) {
  console.error(
    [
      'URL do Swagger não configurada.',
      '',
      'Defina uma das opções:',
      '  • Variável de ambiente OPENAPI_SWAGGER_URL apontando para o JSON do Swagger;',
      '  • Arquivo config/openapi.config.local.json com { "swaggerUrl": "..." }',
      '    (copie config/openapi.config.example.json e ajuste a URL);',
      '  • Opcional: copie .env.example para .env e defina OPENAPI_SWAGGER_URL.',
      ''
    ].join('\n')
  );
  process.exit(1);
}

const binName = process.platform === 'win32' ? 'openapi-typescript.cmd' : 'openapi-typescript';
const cli = join(root, 'node_modules', '.bin', binName);
if (!existsSync(cli)) {
  console.error('openapi-typescript não encontrado. Execute npm ci na raiz do projeto.');
  process.exit(1);
}

const r = spawnSync(cli, [url, '-o', outFile], {
  stdio: 'inherit',
  cwd: root,
  shell: process.platform === 'win32'
});

if (r.error) {
  console.error(r.error);
  process.exit(1);
}
if (r.status !== 0) process.exit(r.status ?? 1);
