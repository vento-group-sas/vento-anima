#!/usr/bin/env node
// GAP-PKG-004: arranque de Metro exclusivamente contra Supabase QA aislado.
// No genera .env ni expone claves privilegiadas al cliente Android.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACKAGE_ID = 'GAP-PKG-004';
const ANIMA_PACKAGE = 'com.vento.anima.dev';
const animaRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function fail(code) { throw new Error(code); }
function jsonFile(filename) { return JSON.parse(fs.readFileSync(filename, 'utf8')); }

function findShellRoot() {
  const candidates = [
    process.env.VENTO_SHELL_ROOT,
    path.join(path.dirname(animaRoot), 'vento-shell'),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const root = path.resolve(candidate);
    try {
      if (jsonFile(path.join(root, 'package.json')).name !== 'vento-shell') continue;
      const file = path.join(root, 'scripts/quality/supabase-db-harness.mjs');
      if (!fs.statSync(file).isFile()) continue;
      return fs.realpathSync(root);
    } catch { /* candidato ajeno o inexistente */ }
  }
  fail('QA_SHELL_WORKSPACE_NOT_FOUND: configurar VENTO_SHELL_ROOT con el directorio real de vento-shell');
}

function assertAnimaDevelopment() {
  if (jsonFile(path.join(animaRoot, 'package.json')).name !== 'anima') fail('QA_ANIMA_WORKSPACE_INVALID');
  process.env.APP_VARIANT = 'development';
  const requireFromAnima = createRequire(path.join(animaRoot, 'package.json'));
  const config = requireFromAnima(path.join(animaRoot, 'app.config.js'))().expo;
  if (config.android?.package !== ANIMA_PACKAGE || config.extra?.appVariant !== 'development') {
    fail('QA_ANIMA_DEVELOPMENT_IDENTITY_INVALID');
  }
}

function assertAnonKey(value) {
  if (typeof value !== 'string' || value.length < 40) fail('QA_ANON_KEY_MISSING');
  // El CLI aislado expone ANON_KEY como JWT; nunca usar service_role en Expo.
  try {
    const tokens = value.split('.');
    if (tokens.length !== 3) fail('QA_KEY_FORMAT_INVALID');
    const payload = JSON.parse(Buffer.from(tokens[1], 'base64url').toString('utf8'));
    if (payload.role !== 'anon') fail('QA_KEY_ROLE_NOT_ANON');
    if (typeof payload.exp === 'number' && payload.exp <= Date.now() / 1000) fail('QA_ANON_KEY_EXPIRED');
  } catch { fail('QA_ANON_KEY_UNVERIFIED'); }
  return value;
}

async function verifiedQaBinding(shellRoot) {
  const file = path.join(shellRoot, 'scripts/quality/supabase-db-harness.mjs');
  const module = await import(pathToFileURL(file).href);
  const approved = module.QA_ISOLATED_PROFILES?.[PACKAGE_ID];
  if (!approved || typeof module.runIsolatedQaPreflight !== 'function') fail('QA_PROFILE_NOT_AVAILABLE');
  const result = await module.runIsolatedQaPreflight({
    root: shellRoot,
    packageId: PACKAGE_ID,
    afterVerified: ({ profile, api, anonKey }) => ({
      project: profile.project,
      port: profile.apiPort,
      api,
      anonKey,
    }),
  });
  if (result.project !== approved.project || result.port !== approved.apiPort ||
      result.api !== 'http://127.0.0.1:' + approved.apiPort) {
    fail('QA_BACKEND_IDENTITY_MISMATCH');
  }
  return { port: result.port, anonKey: assertAnonKey(result.anonKey) };
}

async function portIsBusy(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1200, () => finish(true)); // fallo cerrado ante incertidumbre
  });
}

async function availableMetroPort() {
  for (let port = 8081; port <= 8090; port += 1) {
    if (!(await portIsBusy(port))) return port;
  }
  fail('QA_METRO_PORTS_BUSY: 8081-8090; no se cerraron procesos existentes');
}

function expoCli() {
  const packageRoot = path.join(animaRoot, 'node_modules/expo');
  const metadata = jsonFile(path.join(packageRoot, 'package.json'));
  const entry = typeof metadata.bin === 'string' ? metadata.bin : metadata.bin?.expo;
  if (typeof entry !== 'string' || !/^bin\/[a-zA-Z0-9_./-]+$/.test(entry) || entry.split('/').includes('..')) {
    fail('QA_EXPO_CLI_PATH_INVALID');
  }
  const file = path.resolve(packageRoot, entry);
  if (!fs.statSync(file).isFile()) fail('QA_EXPO_CLI_NOT_FOUND');
  return file;
}

async function main() {
  if (process.argv.length !== 2) fail('QA_ARGUMENTS_NOT_SUPPORTED');
  assertAnimaDevelopment();
  const shellRoot = findShellRoot();
  const qa = await verifiedQaBinding(shellRoot);
  const metroPort = await availableMetroPort();
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (/^EXPO_PUBLIC_SUPABASE_/i.test(name)) delete env[name];
  }
  for (const name of ['SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY']) {
    delete env[name];
  }
  Object.assign(env, {
    APP_VARIANT: 'development',
    EXPO_NO_DOTENV: '1',
    EXPO_NO_SENTRY: 'true',
    SENTRY_DISABLE_AUTO_UPLOAD: 'true',
    EXPO_PUBLIC_SUPABASE_URL: 'http://10.0.2.2:' + qa.port,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: qa.anonKey,
  });
  console.log('QA_BACKEND: VERIFIED | ' + PACKAGE_ID + ' | http://10.0.2.2:' + qa.port);
  console.log('ANIMA_DEV: ' + ANIMA_PACKAGE + ' | METRO_PORT: ' + metroPort);
  console.log('QA_CREDENTIALS: public anon key injected; value not displayed');
  console.log('METRO_STARTING: awaiting Expo readiness; no .env files modified');
  const child = spawn(process.execPath, [expoCli(), 'start', '--dev-client', '--localhost', '--port', String(metroPort)], {
    cwd: animaRoot,
    env,
    stdio: 'inherit',
    windowsHide: false,
  });
  child.on('error', () => { console.error('QA_EXPO_START_FAILED'); process.exitCode = 1; });
  child.on('exit', (code) => { process.exitCode = code ?? 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => { if (!child.killed) child.kill(signal); });
  }
}

main().catch(error => {
  const message = String(error?.message ?? 'QA_START_FAILED');
  console.error('ESTADO: FAIL | OPERACION: ANIMA_QA_METRO_START | ' + message);
  process.exitCode = 1;
});
