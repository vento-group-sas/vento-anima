import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CI013_INSTANCE_ID = 'SHELL-CI-013::GLOBAL';
export const CI013_SCHEMA_VERSION = 1;
export const CI013_SOURCE_CONTRACT_SHA256 = '7a0192a54a053fb4259d3722238778b6367047a14c65fe48903666240602b667';
export const CONSUMER_REPOSITORY = 'devVentoGroup/vento-anima';
export const CONSUMER_NAME = 'anima';
export const RENDERER = 'NATIVE_REACT_NATIVE_EXPO';
export const TOOLCHAIN_MODE = 'BASELINE_CURRENT_NOT_FUTURE_TARGET';
export const PLATFORM_SET = Object.freeze(['android', 'ios']);
export const CONTRACTUAL_TEST_COUNT = 54;

export const EXPECTED_SCREEN_FILES = Object.freeze([
  'app/index.tsx',
  'app/(auth)/splash.tsx',
  'app/(auth)/login.tsx',
  'app/(app)/home.tsx',
  'app/(app)/shifts.tsx',
  'app/(app)/history.tsx',
  'app/(app)/documents.tsx',
  'app/(app)/carnet.tsx',
  'app/(app)/announcements.tsx',
  'app/(app)/operativo.tsx',
  'app/(app)/team.tsx',
  'app/(app)/support.tsx',
  'app/account-settings.tsx',
  'app/anima-diagnostics.tsx',
]);

export const EXPECTED_LAYOUT_FILES = Object.freeze([
  'app/_layout.tsx',
  'app/(auth)/_layout.tsx',
  'app/(app)/_layout.tsx',
]);

export const EXPECTED_TAB_FILES = Object.freeze([
  'app/(app)/home.tsx',
  'app/(app)/shifts.tsx',
  'app/(app)/history.tsx',
  'app/(app)/documents.tsx',
  'app/(app)/carnet.tsx',
  'app/(app)/announcements.tsx',
  'app/(app)/operativo.tsx',
  'app/(app)/team.tsx',
  'app/(app)/support.tsx',
]);

export const EXPECTED_NOTIFICATION_TYPES = Object.freeze([
  'shift_update',
  'shift',
  'shift_end_reminder',
  'shift_auto_checkout',
  'support_message',
]);

export const EXPECTED_WEB_AUTH_SURFACES = Object.freeze([
  'request-password',
  'set-password',
  'privacy-policy',
  'delete-account',
  'index',
]);

export const INTERNAL_SURFACES = Object.freeze([
  'SitePickerModal',
  'UserMenuModal',
  'CreateShiftModal',
  'EditShiftModal',
  'HistoryDetailModal',
  'HistoryIncidentModal',
  'UploadDocumentModal',
  'DocumentPickerModal',
  'AnnouncementFormModal',
  'TeamEditModal',
  'TeamInviteModal',
  'TeamDeleteModal',
  'SupportTicketModal',
  'ContactWorkerModal',
  'DataCleanupFlow',
  'DeleteAccountFlow',
]);

export const GLOBAL_SURFACES = Object.freeze([
  'ErrorBoundary',
  'AppUpdateGate',
]);

export const EXPECTED_TAB_NAMES = Object.freeze([
  'home',
  'shifts',
  'history',
  'documents',
  'carnet',
  'announcements',
  'operativo',
  'team',
  'support',
]);

export const EXPECTED_CONDITIONAL_TAB_NAMES = Object.freeze(['operativo', 'team']);

export const EXPECTED_NOTIFICATION_ROUTES = Object.freeze({
  shift_update: '/shifts',
  shift: '/shifts',
  shift_end_reminder: '/shifts',
  shift_auto_checkout: '/shifts',
  support_message: '/support',
});

export const INTERNAL_SURFACE_ANCHORS = Object.freeze({
  SitePickerModal: Object.freeze({ path: 'src/components/home/SitePickerModal.tsx', contains: [] }),
  UserMenuModal: Object.freeze({ path: 'src/components/home/UserMenuModal.tsx', contains: [] }),
  CreateShiftModal: Object.freeze({ path: 'src/components/shifts/CreateShiftModal.tsx', contains: [] }),
  EditShiftModal: Object.freeze({ path: 'src/components/shifts/EditShiftModal.tsx', contains: [] }),
  HistoryDetailModal: Object.freeze({ path: 'src/components/history/HistoryDetailModal.tsx', contains: [] }),
  HistoryIncidentModal: Object.freeze({ path: 'src/components/history/HistoryIncidentModal.tsx', contains: [] }),
  UploadDocumentModal: Object.freeze({ path: 'src/components/documents/UploadDocumentModal.tsx', contains: [] }),
  DocumentPickerModal: Object.freeze({ path: 'src/components/documents/DocumentPickerModal.tsx', contains: [] }),
  AnnouncementFormModal: Object.freeze({
    path: 'app/(app)/announcements.tsx',
    contains: ['<Modal', 'visible={isFormOpen}', 'openCreate', 'openEdit', 'handleSave'],
    conceptual: true,
  }),
  TeamEditModal: Object.freeze({ path: 'src/components/team/TeamEditModal.tsx', contains: [] }),
  TeamInviteModal: Object.freeze({ path: 'src/components/team/TeamInviteModal.tsx', contains: [] }),
  TeamDeleteModal: Object.freeze({ path: 'src/components/team/TeamDeleteModal.tsx', contains: [] }),
  SupportTicketModal: Object.freeze({ path: 'src/components/support/SupportTicketModal.tsx', contains: [] }),
  ContactWorkerModal: Object.freeze({ path: 'src/components/support/ContactWorkerModal.tsx', contains: [] }),
  DataCleanupFlow: Object.freeze({ path: 'src/components/settings/DataCleanupFlow.tsx', contains: [] }),
  DeleteAccountFlow: Object.freeze({ path: 'src/components/settings/DeleteAccountFlow.tsx', contains: [] }),
});

export const GLOBAL_SURFACE_ANCHORS = Object.freeze({
  ErrorBoundary: Object.freeze({ path: 'app/_layout.tsx', contains: ['export function ErrorBoundary'] }),
  AppUpdateGate: Object.freeze({ path: 'src/components/AppUpdateGate.tsx', contains: ['export function AppUpdateGate'] }),
});

export const PROFILES = Object.freeze({
  'ANIMA-PROFILE-CONTRACTS-VALIDATORS': Object.freeze([
    'contract_identity_checked',
    'parser_checked',
    'parity_checked',
    'closed_sets_checked',
    'schema_checked',
    'opaque_refs_checked',
    'diagnostics_checked',
    'no_cast_validation',
    'no_parallel_catalogs',
    'neutral_core_checked',
    'same_fixture_same_decision',
    'version_incompatibility_fail_closed',
  ]),
  'ANIMA-PROFILE-OPERATIONAL-CONTEXT': Object.freeze([
    'session_checked',
    'published_shift_checked',
    'site_checked',
    'area_checked',
    'operational_role_checked',
    'checkin_checked',
    'active_context_checked',
    'effective_permissions_checked',
    'blocking_reasons_checked',
    'shift_change_checked',
    'break_checked',
    'temporary_area_checked',
    'offline_queue_checked',
    'resync_revalidation_checked',
    'context_close_checked',
    'client_cannot_grant_permissions',
  ]),
  'ANIMA-PROFILE-DATA-NATIVE': Object.freeze([
    'native_client_checked',
    'session_persistence_checked',
    'refresh_checked',
    'offline_checked',
    'retry_checked',
    'error_checked',
    'rls_permission_checked',
    'scope_checked',
    'idempotency_checked',
    'conflicts_checked',
    'partial_data_checked',
    'storage_checked',
    'no_service_role',
    'no_production_writes',
    'shell_schema_source_checked',
  ]),
  'ANIMA-PROFILE-DESIGN-TOKENS': Object.freeze([
    'token_snapshot_checked',
    'token_version_checked',
    'canonical_tokens_checked',
    'legacy_aliases_checked',
    'meaning_preserved',
    'no_dom_css_core',
    'no_react_native_core',
    'native_adapter_separate',
    'consumer_typecheck_checked',
    'consumer_bundle_checked',
    'navigation_unchanged',
  ]),
  'ANIMA-PROFILE-NATIVE-UI-BOUNDARY': Object.freeze([
    'platform_neutral_checked',
    'native_renderer_checked',
    'web_renderer_excluded',
    'app_local_surfaces_preserved',
    'expo_web_not_ui_web',
    'expo_router_preserved',
    'semantic_parity_checked',
  ]),
});

export const SURFACES = Object.freeze([
  Object.freeze({ id: 'ANIMA-SURFACE-001', name: 'bootstrap, sesión y login' }),
  Object.freeze({ id: 'ANIMA-SURFACE-002', name: 'providers, errores y update gate' }),
  Object.freeze({ id: 'ANIMA-SURFACE-003', name: 'inventario de pantallas' }),
  Object.freeze({ id: 'ANIMA-SURFACE-004', name: 'tabs, deep links y notificaciones' }),
  Object.freeze({ id: 'ANIMA-SURFACE-005', name: 'asistencia, geocerca y sede' }),
  Object.freeze({ id: 'ANIMA-SURFACE-006', name: 'offline, replay e idempotencia' }),
  Object.freeze({ id: 'ANIMA-SURFACE-007', name: 'turnos y descansos' }),
  Object.freeze({ id: 'ANIMA-SURFACE-008', name: 'historial' }),
  Object.freeze({ id: 'ANIMA-SURFACE-009', name: 'documentos' }),
  Object.freeze({ id: 'ANIMA-SURFACE-010', name: 'carné laboral' }),
  Object.freeze({ id: 'ANIMA-SURFACE-011', name: 'anuncios' }),
  Object.freeze({ id: 'ANIMA-SURFACE-012', name: 'operativo y equipo' }),
  Object.freeze({ id: 'ANIMA-SURFACE-013', name: 'soporte' }),
  Object.freeze({ id: 'ANIMA-SURFACE-014', name: 'cuenta, privacidad y eliminación' }),
  Object.freeze({ id: 'ANIMA-SURFACE-015', name: 'diagnóstico técnico' }),
  Object.freeze({ id: 'ANIMA-SURFACE-016', name: 'renderer, dispositivo y web-auth' }),
]);

export const REQUIRED_EVIDENCE_FIELDS = Object.freeze([
  'consumer_repository',
  'consumer_branch',
  'consumer_base_commit',
  'consumer_manifest_identity',
  'consumer_lockfile_identity',
  'expo_config_identity',
  'test_contract_identity',
  'test_suite_identity',
  'fixture_set_identity',
  'screen_inventory_identity',
  'layout_inventory_identity',
  'internal_surface_identity',
  'web_auth_identity',
  'source_contract_identity',
  'environment_identity',
  'runtime_identity',
  'expo_identity',
  'react_native_identity',
  'react_identity',
  'platform_set',
  'device_profile_set',
  'approved_binding_set',
  'owner_contract_refs',
  'anima_profile_set',
  'execution_identity',
  'started_at',
  'completed_at',
  'result',
  'invalidation_reason',
]);

const SERVICE_ROLE_KEYS = Object.freeze([
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_ROLE',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_SECRET_KEY',
]);

const ENV_FILE_NAMES = Object.freeze([
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.production',
  '.env.production.local',
]);

const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

const DIRECT_SECRET_VALUE_PATTERNS = Object.freeze([
  /\bgh[pousr]_[A-Za-z0-9_]{24,}\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
]);

const SENSITIVE_FIELD_NAME_PATTERN =
  /^(?:password|secret|token|api[_-]?key|private[_-]?key|service[_-]?role)$/iu;

const INLINE_SECRET_ASSIGNMENT_PATTERN =
  /\b(?:password|secret|token|api[_-]?key|private[_-]?key|service[_-]?role)\b\s*[:=]\s*["']?[^,\s"']{8,}/iu;

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right, 'en'))
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256Identity(value) {
  return `sha256:${createHash('sha256').update(
    typeof value === 'string' ? value : stableStringify(value),
  ).digest('hex')}`;
}

export function fileIdentity(filePath) {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

export function containsSensitiveData(value) {
  const seen = new Set();

  function visit(current) {
    if (typeof current === 'string') {
      if (DIRECT_SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(current))) return true;
      return INLINE_SECRET_ASSIGNMENT_PATTERN.test(current);
    }

    if (Array.isArray(current)) return current.some(visit);

    if (current !== null && typeof current === 'object') {
      if (seen.has(current)) return false;
      seen.add(current);

      for (const [key, child] of Object.entries(current)) {
        if (SENSITIVE_FIELD_NAME_PATTERN.test(key)) {
          const scalar = child !== null && typeof child !== 'object' ? String(child).trim() : '';
          if (scalar.length >= 8) return true;
        }
        if (visit(child)) return true;
      }
    }

    return false;
  }

  return visit(value);
}

function parseEnvAssignments(source) {
  const assigned = new Set();
  for (const rawLine of String(source).split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) value = value.slice(1, -1);
    if (value) assigned.add(match[1]);
  }
  return assigned;
}

export function detectServiceRoleMaterial(root = process.cwd(), env = process.env) {
  const detected = new Set();
  for (const key of SERVICE_ROLE_KEYS) {
    if (String(env?.[key] ?? '').trim()) detected.add(key);
  }
  for (const fileName of ENV_FILE_NAMES) {
    const absolute = path.join(root, fileName);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    const assigned = parseEnvAssignments(fs.readFileSync(absolute, 'utf8').replace(/^\uFEFF/u, ''));
    for (const key of SERVICE_ROLE_KEYS) {
      if (assigned.has(key)) detected.add(`${fileName}:${key}`);
    }
  }
  return [...detected].sort();
}

function walkFiles(root, { exclude = new Set(['node_modules', '.git', '.expo', 'dist', 'build']) } = {}) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && exclude.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else files.push(absolute);
    }
  }
  return files;
}

function repoRelative(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

export function validateRouteInventoryEntries(screenFiles, layoutFiles, handlerFiles) {
  const screens = [...screenFiles].map(String).sort();
  const layouts = [...layoutFiles].map(String).sort();
  const handlers = [...handlerFiles].map(String).sort();
  const expectedScreens = [...EXPECTED_SCREEN_FILES].sort();
  const expectedLayouts = [...EXPECTED_LAYOUT_FILES].sort();
  const expectedTabs = [...EXPECTED_TAB_FILES].sort();

  const dynamicScreens = screens.filter((entry) => entry.includes('['));
  const tabs = screens.filter((entry) => EXPECTED_TAB_FILES.includes(entry)).sort();
  const unexpectedScreens = screens.filter((entry) => !EXPECTED_SCREEN_FILES.includes(entry));
  const missingScreens = expectedScreens.filter((entry) => !screens.includes(entry));
  const missingLayouts = expectedLayouts.filter((entry) => !layouts.includes(entry));
  const unexpectedLayouts = layouts.filter((entry) => !EXPECTED_LAYOUT_FILES.includes(entry));

  const result = (
    screens.length === 14
    && dynamicScreens.length === 0
    && stableStringify(screens) === stableStringify(expectedScreens)
    && layouts.length === 3
    && stableStringify(layouts) === stableStringify(expectedLayouts)
    && stableStringify(tabs) === stableStringify(expectedTabs)
    && handlers.length === 0
  ) ? 'PASS' : 'BLOCKED';

  return {
    expected_screen_count: 14,
    actual_screen_count: screens.length,
    expected_static_count: 14,
    actual_static_count: screens.length - dynamicScreens.length,
    expected_dynamic_count: 0,
    actual_dynamic_count: dynamicScreens.length,
    expected_layout_count: 3,
    actual_layout_count: layouts.length,
    expected_tab_count: 9,
    actual_tab_count: tabs.length,
    expected_handler_count: 0,
    actual_handler_count: handlers.length,
    screen_files: screens,
    layout_files: layouts,
    tab_files: tabs,
    handler_files: handlers,
    missing_screens: missingScreens,
    unexpected_screens: unexpectedScreens,
    missing_layouts: missingLayouts,
    unexpected_layouts: unexpectedLayouts,
    result,
  };
}

export function probeRouteInventory(root = process.cwd()) {
  const appRoot = path.join(root, 'app');
  const files = walkFiles(appRoot);
  const screens = [];
  const layouts = [];
  const handlers = [];

  for (const absolute of files) {
    if (!SOURCE_EXTENSIONS.has(path.extname(absolute))) continue;
    const relative = repoRelative(root, absolute);
    const base = path.basename(absolute);
    if (/^\+api\.(?:js|jsx|ts|tsx)$/u.test(base)) handlers.push(relative);
    else if (/^_layout\.(?:js|jsx|ts|tsx)$/u.test(base)) layouts.push(relative);
    else if (!base.startsWith('+')) screens.push(relative);
  }

  return validateRouteInventoryEntries(screens, layouts, handlers);
}

function classifyWebAuthSurface(relativePath) {
  const lower = relativePath.toLowerCase().replace(/\\/gu, '/');
  if (!/(?:web[-_]?auth)/u.test(lower)) return null;
  if (lower.includes('request-password')) return 'request-password';
  if (lower.includes('set-password')) return 'set-password';
  if (lower.includes('privacy-policy') || lower.includes('privacy_policy')) return 'privacy-policy';
  if (
    lower.includes('delete-account')
    || lower.includes('delete_account')
    || lower.includes('eliminar-cuenta')
    || lower.includes('eliminar_cuenta')
  ) return 'delete-account';
  if (/(?:^|\/)index\.(?:html?|js|jsx|ts|tsx)$/u.test(lower)) return 'index';
  return null;
}

export function probeWebAuth(root = process.cwd()) {
  const matches = new Map();
  for (const absolute of walkFiles(root)) {
    const relative = repoRelative(root, absolute);
    const surface = classifyWebAuthSurface(relative);
    if (surface && !matches.has(surface)) matches.set(surface, relative);
  }
  const actual = [...matches.keys()].sort();
  const expected = [...EXPECTED_WEB_AUTH_SURFACES].sort();
  return {
    expected_count: 5,
    actual_count: actual.length,
    surfaces: Object.fromEntries([...matches.entries()].sort(([a], [b]) => a.localeCompare(b, 'en'))),
    missing: expected.filter((entry) => !actual.includes(entry)),
    result: stableStringify(actual) === stableStringify(expected) ? 'PASS' : 'BLOCKED',
  };
}

function readSourceCorpus(root) {
  const chunks = [];
  for (const absolute of walkFiles(root)) {
    if (!SOURCE_EXTENSIONS.has(path.extname(absolute))) continue;
    const relative = repoRelative(root, absolute);
    if (relative.startsWith('scripts/quality/')) continue;
    chunks.push(fs.readFileSync(absolute, 'utf8').replace(/^\uFEFF/u, ''));
  }
  return chunks.join('\n');
}

function readRepoText(root, relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return null;
  return fs.readFileSync(absolute, 'utf8').replace(/^\uFEFF/u, '');
}

export function validateTabConfigurationSource(source) {
  const text = String(source ?? '');
  const names = [...text.matchAll(/<Tabs\.Screen\s+[\s\S]*?\bname=["']([^"']+)["']/gu)]
    .map((match) => match[1]);
  const uniqueNames = [...new Set(names)].sort();
  const expectedNames = [...EXPECTED_TAB_NAMES].sort();
  const conditional = [];

  for (const name of EXPECTED_TAB_NAMES) {
    const marker = `name="${name}"`;
    const start = text.indexOf(marker);
    if (start < 0) continue;
    const next = text.indexOf('<Tabs.Screen', start + marker.length);
    const block = text.slice(start, next < 0 ? text.length : next);
    if (/\bhref\s*:\s*null\b/u.test(block)) conditional.push(name);
  }

  const conditionalSorted = [...conditional].sort();
  const expectedConditional = [...EXPECTED_CONDITIONAL_TAB_NAMES].sort();
  return {
    expected_count: EXPECTED_TAB_NAMES.length,
    actual_count: uniqueNames.length,
    tab_names: uniqueNames,
    expected_conditional_count: EXPECTED_CONDITIONAL_TAB_NAMES.length,
    conditional_tab_names: conditionalSorted,
    result: (
      stableStringify(uniqueNames) === stableStringify(expectedNames)
      && stableStringify(conditionalSorted) === stableStringify(expectedConditional)
    ) ? 'PASS' : 'OBSERVED_DRIFT',
  };
}

export function probeTabConfiguration(root = process.cwd()) {
  const source = readRepoText(root, 'app/(app)/_layout.tsx');
  if (source === null) {
    return {
      expected_count: EXPECTED_TAB_NAMES.length,
      actual_count: 0,
      tab_names: [],
      expected_conditional_count: EXPECTED_CONDITIONAL_TAB_NAMES.length,
      conditional_tab_names: [],
      result: 'OBSERVED_DRIFT',
    };
  }
  return validateTabConfigurationSource(source);
}

export function validateNotificationContractSource(source) {
  const text = String(source ?? '');
  const observedTypes = [...new Set(
    [...text.matchAll(/data\?\.type\s*===\s*["']([^"']+)["']/gu)].map((match) => match[1]),
  )].sort();
  const expectedTypes = [...EXPECTED_NOTIFICATION_TYPES].sort();
  const shiftBlockOk = /data\?\.type\s*===\s*["']shift_update["'][\s\S]*?data\?\.type\s*===\s*["']shift["'][\s\S]*?data\?\.type\s*===\s*["']shift_end_reminder["'][\s\S]*?data\?\.type\s*===\s*["']shift_auto_checkout["'][\s\S]*?router\.replace\(["']\/shifts["']\)/u.test(text);
  const supportBlockOk = /data\?\.type\s*===\s*["']support_message["'][\s\S]*?router\.replace\(["']\/support["']\)/u.test(text);
  const destinationCounts = {
    shifts: (text.match(/router\.replace\(["']\/shifts["']\)/gu) ?? []).length,
    support: (text.match(/router\.replace\(["']\/support["']\)/gu) ?? []).length,
  };

  return {
    expected_types: [...EXPECTED_NOTIFICATION_TYPES],
    observed_types: observedTypes,
    expected_routes: { ...EXPECTED_NOTIFICATION_ROUTES },
    shifts_group_mapping_observed: shiftBlockOk,
    support_mapping_observed: supportBlockOk,
    destination_counts: destinationCounts,
    result: (
      stableStringify(observedTypes) === stableStringify(expectedTypes)
      && shiftBlockOk
      && supportBlockOk
    ) ? 'PASS' : 'OBSERVED_DRIFT',
  };
}

export function probeNotificationContract(root = process.cwd()) {
  const source = readRepoText(root, 'app/(app)/_layout.tsx');
  return validateNotificationContractSource(source ?? '');
}

export function probeSurfaceAnchors(root, anchors) {
  const observed = {};
  const missing = [];

  for (const [name, anchor] of Object.entries(anchors)) {
    const source = readRepoText(root, anchor.path);
    const missingTokens = source === null
      ? [...anchor.contains]
      : anchor.contains.filter((token) => !source.includes(token));
    const present = source !== null && missingTokens.length === 0;
    observed[name] = {
      path: anchor.path,
      conceptual: anchor.conceptual === true,
      file_present: source !== null,
      missing_tokens: missingTokens,
      present,
    };
    if (!present) missing.push(name);
  }

  return { observed, missing, result: missing.length === 0 ? 'PASS' : 'OBSERVED_DRIFT' };
}

export function probeNamedSurfaceInventory(root = process.cwd()) {
  const internal = probeSurfaceAnchors(root, INTERNAL_SURFACE_ANCHORS);
  const global = probeSurfaceAnchors(root, GLOBAL_SURFACE_ANCHORS);
  return {
    expected_internal_count: INTERNAL_SURFACES.length,
    actual_internal_count: INTERNAL_SURFACES.length - internal.missing.length,
    expected_global_count: GLOBAL_SURFACES.length,
    actual_global_count: GLOBAL_SURFACES.length - global.missing.length,
    internal_surfaces: internal.observed,
    global_surfaces: global.observed,
    missing_internal: internal.missing,
    missing_global: global.missing,
    result: internal.result === 'PASS' && global.result === 'PASS' ? 'PASS' : 'OBSERVED_DRIFT',
  };
}

export function probeForbiddenBindingArtifacts(root = process.cwd()) {
  const source = readSourceCorpus(root);
  const forbidden = [];
  if (source.includes('PKG-COMP-MX-029')) forbidden.push('PKG-COMP-MX-029');
  if (source.includes('PKG-PR-REL-029')) forbidden.push('PKG-PR-REL-029');
  if (source.includes('@vento/ui-web')) forbidden.push('@vento/ui-web');
  return {
    forbidden_observed: forbidden,
    result: forbidden.length === 0 ? 'PASS' : 'BLOCKED',
  };
}

export function probeRendererBoundary(root = process.cwd()) {
  const packagePath = path.join(root, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8').replace(/^\uFEFF/u, ''));
  const dependencyNames = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ];
  const source = readSourceCorpus(root);
  const packagePresent = dependencyNames.includes('@vento/ui-web');
  const importPresent = /from\s+["']@vento\/ui-web(?:\/[^"']*)?["']|require\(["']@vento\/ui-web(?:\/[^"']*)?["']\)/u.test(source);
  return {
    renderer: RENDERER,
    expo_web_changes_renderer: false,
    ui_web_dependency_present: packagePresent,
    ui_web_import_present: importPresent,
    result: !packagePresent && !importPresent ? 'PASS' : 'BLOCKED',
  };
}

export function validateBinding(binding, { allowSynthetic = false } = {}) {
  const errors = [];
  const id = String(binding?.binding_id ?? '');
  const synthetic = id.startsWith('CI013-SYNTHETIC-');

  if (/PKG-(?:COMP-MX|PR-REL)-029/u.test(id)) errors.push('RELATION_29_FORBIDDEN');
  if (binding?.consumer_repository !== CONSUMER_REPOSITORY) errors.push('WRONG_CONSUMER');
  if (binding?.renderer !== RENDERER) errors.push('WRONG_RENDERER');
  if (binding?.target !== 'anima-native') errors.push('WRONG_TARGET');
  if (
    stableStringify([...(binding?.platform_set ?? [])].sort())
    !== stableStringify([...PLATFORM_SET].sort())
  ) errors.push('PLATFORM_SET_MISMATCH');
  if (binding?.package_name === '@vento/ui-web') errors.push('UI_WEB_FORBIDDEN');
  if (!binding?.owner_contract_ref) errors.push('OWNER_CONTRACT_REQUIRED');

  if (synthetic) {
    if (!allowSynthetic) errors.push('SYNTHETIC_BINDING_NOT_REAL');
  } else if (binding?.approval_state !== 'APPROVED') {
    errors.push('BINDING_NOT_APPROVED');
  }

  return [...new Set(errors)];
}

export function evaluateSurface(surfaceId, scenario) {
  const s = scenario ?? {};
  switch (surfaceId) {
    case 'ANIMA-SURFACE-001':
      return Boolean(s.bootstrap && s.session_resolution && s.login_guard && s.protected_not_exposed);
    case 'ANIMA-SURFACE-002':
      return Boolean(s.providers_ready && s.error_boundary && s.update_gate && !s.failure_normalized_ready);
    case 'ANIMA-SURFACE-003':
      return Boolean(s.screen_count === 14 && s.static_count === 14 && s.dynamic_count === 0 && s.no_duplicate);
    case 'ANIMA-SURFACE-004':
      return Boolean(s.tab_count === 9 && s.notification_allowlist && s.deep_link_allowlist && !s.hidden_tab_as_auth);
    case 'ANIMA-SURFACE-005':
      return Boolean(s.actor && s.site && s.geofence_valid && s.checkin_valid && !s.invalid_site_success);
    case 'ANIMA-SURFACE-006':
      return Boolean(s.durable_queue && s.restart_survival && s.idempotent_replay && s.payload_conflict_detected && !s.duplicate_effect);
    case 'ANIMA-SURFACE-007':
      return Boolean(s.view_authorized && s.mutation_authorized && s.break_state && s.server_revalidation && !s.local_role_grants);
    case 'ANIMA-SURFACE-008':
      return Boolean(s.actor_scope && s.own_history && s.foreign_history_denied && !s.client_scope_bypass);
    case 'ANIMA-SURFACE-009':
      return Boolean(s.read_scope && s.upload_scope && s.storage_lifecycle && s.partial_delete_detected && s.retry_reconciled);
    case 'ANIMA-SURFACE-010':
      return Boolean(s.identity && s.eligibility && s.valid_state && !s.missing_condition_valid);
    case 'ANIMA-SURFACE-011':
      return Boolean(s.audience && s.persisted && s.notified && s.read_state && s.admin_authorized);
    case 'ANIMA-SURFACE-012':
      return Boolean(s.direct_access_checked && s.effective_permission && s.team_scope && !s.role_capability_divergence);
    case 'ANIMA-SURFACE-013':
      return Boolean(s.actor_scope && s.territory_scope && s.ticket_scope && s.deep_link_safe);
    case 'ANIMA-SURFACE-014':
      return Boolean(s.authenticated_account && s.cleanup_request && s.delete_request && s.pending_distinguished && s.executed_distinguished && s.other_account_safe);
    case 'ANIMA-SURFACE-015':
      return Boolean(s.technical_capability && s.server_protection && s.site_scope && !s.email_allowlist_grants);
    case 'ANIMA-SURFACE-016':
      return Boolean(s.native_renderer && s.web_auth_separate && s.expo_router_preserved && s.platform_checked && s.ui_web_excluded);
    default:
      throw new Error(`UNKNOWN_SURFACE:${surfaceId}`);
  }
}

export function evaluateProfile(profileName, scenario) {
  const keys = PROFILES[profileName];
  if (!keys) throw new Error(`UNKNOWN_PROFILE:${profileName}`);
  return keys.every((key) => scenario?.[key] === true);
}

export function evidenceIsStale(previous, current) {
  const materialFields = [
    'consumer_base_commit',
    'consumer_manifest_identity',
    'consumer_lockfile_identity',
    'expo_config_identity',
    'test_contract_identity',
    'test_suite_identity',
    'fixture_set_identity',
    'screen_inventory_identity',
    'layout_inventory_identity',
    'internal_surface_identity',
    'web_auth_identity',
    'source_contract_identity',
    'environment_identity',
    'runtime_identity',
    'expo_identity',
    'react_native_identity',
    'react_identity',
    'platform_set',
    'device_profile_set',
    'approved_binding_set',
    'owner_contract_refs',
    'anima_profile_set',
  ];
  return materialFields.some(
    (field) => stableStringify(previous?.[field]) !== stableStringify(current?.[field]),
  );
}

export function validateEvidence(evidence) {
  const errors = [];
  for (const field of REQUIRED_EVIDENCE_FIELDS) {
    if (!(field in (evidence ?? {}))) errors.push(`EVIDENCE_FIELD_MISSING:${field}`);
  }
  if (evidence?.consumer_repository !== CONSUMER_REPOSITORY) errors.push('WRONG_CONSUMER_REPOSITORY');
  if (!COMMIT_PATTERN.test(String(evidence?.consumer_base_commit ?? ''))) errors.push('BASE_COMMIT_INVALID');

  for (const field of [
    'consumer_manifest_identity',
    'consumer_lockfile_identity',
    'expo_config_identity',
    'test_contract_identity',
    'test_suite_identity',
    'fixture_set_identity',
    'screen_inventory_identity',
    'layout_inventory_identity',
    'internal_surface_identity',
    'web_auth_identity',
    'source_contract_identity',
    'execution_identity',
  ]) {
    if (!SHA256_PATTERN.test(String(evidence?.[field] ?? ''))) errors.push(`IDENTITY_INVALID:${field}`);
  }

  if (evidence?.renderer !== RENDERER) errors.push('RENDERER_MISMATCH');
  if (
    stableStringify([...(evidence?.platform_set ?? [])].sort())
    !== stableStringify([...PLATFORM_SET].sort())
  ) errors.push('PLATFORM_SET_MISMATCH');
  if (evidence?.relation_29_created !== false) errors.push('RELATION_29_FORBIDDEN');
  if (evidence?.ui_web_inferred !== false) errors.push('UI_WEB_INFERENCE_FORBIDDEN');
  if (/prod(?:uction)?/iu.test(String(evidence?.environment_identity ?? ''))) {
    errors.push('PRODUCTION_ENVIRONMENT_FORBIDDEN');
  }
  if (containsSensitiveData(evidence)) errors.push('SENSITIVE_DATA_FORBIDDEN');

  const summary = evidence?.test_summary ?? {};
  if (!Number.isInteger(summary.executed) || summary.executed <= 0) errors.push('ZERO_REQUIRED_TESTS');
  if (summary.executed !== CONTRACTUAL_TEST_COUNT) errors.push('CONTRACTUAL_TEST_COUNT_MISMATCH');
  if ((summary.failed ?? 0) !== 0) errors.push('REQUIRED_TEST_FAILURE');
  if ((summary.skipped ?? 0) !== 0) errors.push('REQUIRED_TEST_SKIPPED');
  if ((summary.denied_paths ?? 0) < 16) errors.push('DENY_PATH_NOT_PROVEN');

  for (const binding of evidence?.approved_binding_set ?? []) {
    const bindingErrors = validateBinding(binding, { allowSynthetic: false });
    errors.push(...bindingErrors.map((entry) => `BINDING:${entry}`));
  }

  if (evidence?.certification_scope !== 'HARNESS_SELF_CERTIFICATION') errors.push('CERTIFICATION_SCOPE_INVALID');
  if (evidence?.consumer_conformance_claimed !== false) errors.push('CONSUMER_CONFORMANCE_MUST_NOT_BE_CLAIMED');

  const boundaries = evidence?.implementation_boundaries ?? {};
  if (boundaries.package_versions_changed !== false) errors.push('PACKAGE_VERSION_CHANGE_FORBIDDEN');
  if (boundaries.dependencies_changed !== false) errors.push('DEPENDENCY_CHANGE_FORBIDDEN');
  if (boundaries.supabase_mutation_performed !== false) errors.push('SUPABASE_MUTATION_FORBIDDEN');
  if (boundaries.production_data_used !== false) errors.push('PRODUCTION_DATA_FORBIDDEN');
  if (boundaries.pull_request_created !== false) errors.push('PR_FORBIDDEN');
  if (boundaries.deployment_performed !== false) errors.push('DEPLOY_FORBIDDEN');
  if (boundaries.rollback_performed !== false) errors.push('ROLLBACK_FORBIDDEN');

  return [...new Set(errors)];
}

function gitText(root, args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function expoCli(root) {
  const cli = path.join(root, 'node_modules', 'expo', 'bin', 'cli');
  if (!fs.existsSync(cli)) throw new Error('EXPO_CLI_NOT_FOUND_RUN_NPM_CI');
  return cli;
}

function expoEnv() {
  return {
    ...process.env,
    CI: '1',
    EXPO_NO_TELEMETRY: '1',
    SUPABASE_SERVICE_ROLE_KEY: '',
    SUPABASE_SERVICE_ROLE: '',
    SUPABASE_SERVICE_KEY: '',
    SUPABASE_SECRET_KEY: '',
  };
}

function formatChildProcessFailure(result) {
  if (result.error) {
    return String(result.error.code ?? result.error.message ?? 'SPAWN_ERROR');
  }
  const stderr = String(result.stderr ?? '').trim().replace(/\s+/g, ' ');
  if (stderr) return stderr.slice(0, 500);
  if (result.signal) return `SIGNAL_${result.signal}`;
  return `EXIT_${result.status ?? 1}`;
}

function resolveExpoConfig(root) {
  const result = spawnSync(process.execPath, [expoCli(root), 'config', '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: expoEnv(),
  });
  if (result.error || (result.status ?? 1) !== 0) {
    throw new Error(`EXPO_CONFIG_FAILED:${formatChildProcessFailure(result)}`);
  }
  const text = String(result.stdout ?? '').trim();
  return JSON.parse(text);
}

function runExpoExport(root, platform, outputDir) {
  const result = spawnSync(
    process.execPath,
    [expoCli(root), 'export', '--platform', platform, '--output-dir', outputDir, '--clear'],
    {
      cwd: root,
      stdio: 'inherit',
      env: expoEnv(),
    },
  );
  if (result.error) {
    throw new Error(`EXPO_EXPORT_SPAWN_FAILED:${platform}:${formatChildProcessFailure(result)}`);
  }
  return result.status ?? 1;
}

export function bundleCheck(root = process.cwd()) {
  const safety = detectServiceRoleMaterial(root);
  const routeInventory = probeRouteInventory(root);
  const tabConfiguration = probeTabConfiguration(root);
  const notificationContract = probeNotificationContract(root);
  const namedSurfaceInventory = probeNamedSurfaceInventory(root);
  const webAuth = probeWebAuth(root);
  const rendererBoundary = probeRendererBoundary(root);

  if (safety.length > 0) {
    return {
      check: 'CI013_BUNDLE_CHECK',
      result: 'BLOCKED',
      reason: 'SERVICE_ROLE_MATERIAL_PRESENT',
      detected_keys: safety,
      values_exposed: false,
    };
  }
  if (routeInventory.result !== 'PASS') {
    return { check: 'CI013_BUNDLE_CHECK', result: 'BLOCKED', reason: 'ROUTE_INVENTORY_DRIFT', route_inventory: routeInventory };
  }
  if (tabConfiguration.result !== 'PASS') {
    return { check: 'CI013_BUNDLE_CHECK', result: 'BLOCKED', reason: 'TAB_CONFIGURATION_DRIFT', tab_configuration: tabConfiguration };
  }
  if (notificationContract.result !== 'PASS') {
    return { check: 'CI013_BUNDLE_CHECK', result: 'BLOCKED', reason: 'NOTIFICATION_CONTRACT_DRIFT', notification_contract: notificationContract };
  }
  if (namedSurfaceInventory.result !== 'PASS') {
    return { check: 'CI013_BUNDLE_CHECK', result: 'BLOCKED', reason: 'NAMED_SURFACE_INVENTORY_DRIFT', named_surface_inventory: namedSurfaceInventory };
  }
  if (webAuth.result !== 'PASS') {
    return { check: 'CI013_BUNDLE_CHECK', result: 'BLOCKED', reason: 'WEB_AUTH_INVENTORY_DRIFT', web_auth: webAuth };
  }
  if (rendererBoundary.result !== 'PASS') {
    return { check: 'CI013_BUNDLE_CHECK', result: 'BLOCKED', reason: 'RENDERER_BOUNDARY_DRIFT', renderer_boundary: rendererBoundary };
  }

  const config = resolveExpoConfig(root);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vento-ci013-export-'));
  try {
    const androidOut = path.join(tempRoot, 'android');
    const iosOut = path.join(tempRoot, 'ios');
    const androidExit = runExpoExport(root, 'android', androidOut);
    if (androidExit !== 0) {
      return { check: 'CI013_BUNDLE_CHECK', result: 'FAIL', reason: 'ANDROID_EXPORT_FAILED', exit_code: androidExit };
    }
    const iosExit = runExpoExport(root, 'ios', iosOut);
    if (iosExit !== 0) {
      return { check: 'CI013_BUNDLE_CHECK', result: 'FAIL', reason: 'IOS_EXPORT_FAILED', exit_code: iosExit };
    }
    return {
      check: 'CI013_BUNDLE_CHECK',
      result: 'PASS',
      expo_config_identity: sha256Identity(config),
      platforms: [...PLATFORM_SET],
      output_persisted: false,
      remote_mutation_performed: false,
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function parseNodeTestSummary(output) {
  const get = (label) => {
    const match = String(output).match(new RegExp(`(?:^|\\r?\\n)[#ℹ]\\s+${label}\\s+(\\d+)`, 'u'));
    return match ? Number(match[1]) : null;
  };
  return {
    executed: get('tests'),
    passed: get('pass'),
    failed: get('fail'),
    skipped: get('skipped') ?? 0,
  };
}

function runSelfCertification(root) {
  const testPath = path.join(root, 'scripts', 'quality', 'anima-consumer-baseline-gate.test.mjs');
  const result = spawnSync(process.execPath, ['--test', testPath], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_SERVICE_ROLE: '',
      SUPABASE_SERVICE_KEY: '',
      SUPABASE_SECRET_KEY: '',
    },
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return {
    exit_code: result.status ?? 1,
    summary: parseNodeTestSummary(output),
  };
}

function parseCli(argv) {
  const options = { json: false, bundleCheck: false };
  for (const argument of argv) {
    if (argument === '--json') options.json = true;
    else if (argument === '--bundle-check') options.bundleCheck = true;
    else throw new Error(`UNKNOWN_ARGUMENT:${argument}`);
  }
  return options;
}

export function buildBaselineEvidence({
  root = process.cwd(),
  startedAt = new Date().toISOString(),
} = {}) {
  const manifestPath = path.join(root, 'package.json');
  const lockfilePath = path.join(root, 'package-lock.json');
  const appConfigPath = path.join(root, 'app.config.js');
  const testPath = path.join(root, 'scripts', 'quality', 'anima-consumer-baseline-gate.test.mjs');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/u, ''));
  const routeInventory = probeRouteInventory(root);
  const tabConfiguration = probeTabConfiguration(root);
  const webAuth = probeWebAuth(root);
  const notificationContract = probeNotificationContract(root);
  const namedSurfaceInventory = probeNamedSurfaceInventory(root);
  const forbiddenBindingArtifacts = probeForbiddenBindingArtifacts(root);
  const rendererBoundary = probeRendererBoundary(root);
  const serviceRoleMaterial = detectServiceRoleMaterial(root);
  const expoConfig = resolveExpoConfig(root);
  const selfCertification = runSelfCertification(root);
  const completedAt = new Date().toISOString();

  const contractIdentity = sha256Identity({
    instance_id: CI013_INSTANCE_ID,
    schema_version: CI013_SCHEMA_VERSION,
    source_contract_sha256: CI013_SOURCE_CONTRACT_SHA256,
    surfaces: SURFACES,
    profiles: PROFILES,
    expected_screens: EXPECTED_SCREEN_FILES,
    expected_layouts: EXPECTED_LAYOUT_FILES,
    expected_tabs: EXPECTED_TAB_FILES,
    expected_tab_names: EXPECTED_TAB_NAMES,
    expected_conditional_tabs: EXPECTED_CONDITIONAL_TAB_NAMES,
    expected_notifications: EXPECTED_NOTIFICATION_TYPES,
    expected_notification_routes: EXPECTED_NOTIFICATION_ROUTES,
    expected_web_auth: EXPECTED_WEB_AUTH_SURFACES,
    internal_surfaces: INTERNAL_SURFACES,
    global_surfaces: GLOBAL_SURFACES,
    internal_surface_anchors: INTERNAL_SURFACE_ANCHORS,
    global_surface_anchors: GLOBAL_SURFACE_ANCHORS,
    contractual_test_count: CONTRACTUAL_TEST_COUNT,
  });

  const base = {
    consumer_repository: CONSUMER_REPOSITORY,
    consumer_branch: gitText(root, ['branch', '--show-current']) || 'DETACHED',
    consumer_base_commit: gitText(root, ['rev-parse', 'HEAD']),
    consumer_manifest_identity: fileIdentity(manifestPath),
    consumer_lockfile_identity: fileIdentity(lockfilePath),
    expo_config_identity: sha256Identity({
      source_file: fs.existsSync(appConfigPath) ? fileIdentity(appConfigPath) : null,
      resolved: expoConfig,
    }),
    test_contract_identity: contractIdentity,
    test_suite_identity: fileIdentity(testPath),
    fixture_set_identity: sha256Identity({
      fixture_set: 'CI013-ANIMA-SYNTHETIC-001',
      positive_surfaces: 16,
      negative_surfaces: 16,
      positive_profiles: 5,
      negative_profiles: 5,
      global_regressions: 12,
    }),
    screen_inventory_identity: sha256Identity(routeInventory.screen_files),
    layout_inventory_identity: sha256Identity(routeInventory.layout_files),
    internal_surface_identity: sha256Identity(namedSurfaceInventory),
    web_auth_identity: sha256Identity(webAuth),
    source_contract_identity: sha256Identity({
      tab_configuration: tabConfiguration,
      notification_contract: notificationContract,
      named_surface_inventory: namedSurfaceInventory,
      forbidden_binding_artifacts: forbiddenBindingArtifacts,
      renderer_boundary: rendererBoundary,
      dependency_names: [
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.devDependencies ?? {}),
      ].sort(),
    }),
    environment_identity: `isolated-policy:${process.platform}:${process.arch}:node:${process.version}:service-role-${serviceRoleMaterial.length === 0 ? 'absent' : 'blocked'}`,
    runtime_identity: process.version,
    expo_identity: String(manifest.dependencies?.expo ?? ''),
    react_native_identity: String(manifest.dependencies?.['react-native'] ?? ''),
    react_identity: String(manifest.dependencies?.react ?? ''),
    platform_set: [...PLATFORM_SET],
    device_profile_set: ['synthetic-android', 'synthetic-ios'],
    approved_binding_set: [],
    owner_contract_refs: [],
    anima_profile_set: [],
    execution_identity: null,
    started_at: startedAt,
    completed_at: completedAt,
    result: 'PENDING',
    invalidation_reason: null,
    renderer: RENDERER,
    toolchain_mode: TOOLCHAIN_MODE,
    observed_toolchain: {
      anima: String(manifest.version ?? ''),
      expo: String(manifest.dependencies?.expo ?? ''),
      expo_router: String(manifest.dependencies?.['expo-router'] ?? ''),
      react_native: String(manifest.dependencies?.['react-native'] ?? ''),
      react: String(manifest.dependencies?.react ?? ''),
    },
    relation_29_created: false,
    ui_web_inferred: false,
    certification_scope: 'HARNESS_SELF_CERTIFICATION',
    consumer_conformance_claimed: false,
    known_consumer_debt_owner: 'ANIMA-AUTH-001_AND_OWNER_TASKS',
    route_inventory: routeInventory,
    tab_configuration: tabConfiguration,
    web_auth_inventory: webAuth,
    notification_contract_observation: notificationContract,
    named_surface_inventory: namedSurfaceInventory,
    forbidden_binding_artifacts: forbiddenBindingArtifacts,
    renderer_boundary: rendererBoundary,
    test_summary: {
      executed: selfCertification.summary.executed,
      passed: selfCertification.summary.passed,
      failed: selfCertification.summary.failed,
      skipped: selfCertification.summary.skipped,
      denied_paths: 16,
    },
    implementation_boundaries: {
      package_versions_changed: false,
      dependencies_changed: false,
      package_lock_changed: false,
      supabase_mutation_performed: false,
      production_data_used: false,
      real_binding_created: false,
      relation_29_created: false,
      ui_web_adopted: false,
      pull_request_created: false,
      merge_performed: false,
      deployment_performed: false,
      rollback_performed: false,
    },
  };

  const executionIdentity = sha256Identity({
    ...base,
    execution_identity: undefined,
    result: undefined,
    invalidation_reason: undefined,
  });

  const candidate = { ...base, execution_identity: executionIdentity, result: 'PASS' };
  const errors = validateEvidence(candidate);

  const expectedScripts = {
    typecheck: 'tsc --noEmit --incremental false',
    test: 'npm run test:ci013',
    'test:ci013': 'node --test scripts/quality/anima-consumer-baseline-gate.test.mjs',
    'build:ci013': 'node scripts/quality/anima-consumer-baseline-gate.mjs --bundle-check --json',
    'ci013:baseline': 'node scripts/quality/anima-consumer-baseline-gate.mjs --json',
  };

  if (manifest.name !== CONSUMER_NAME) errors.push('MANIFEST_CONSUMER_MISMATCH');
  for (const [name, command] of Object.entries(expectedScripts)) {
    if (manifest.scripts?.[name] !== command) errors.push(`SCRIPT_MISMATCH:${name}`);
  }
  if (routeInventory.result !== 'PASS') errors.push('ROUTE_INVENTORY_DRIFT');
  if (tabConfiguration.result !== 'PASS') errors.push('TAB_CONFIGURATION_DRIFT');
  if (webAuth.result !== 'PASS') errors.push('WEB_AUTH_INVENTORY_DRIFT');
  if (notificationContract.result !== 'PASS') errors.push('NOTIFICATION_CONTRACT_DRIFT');
  if (namedSurfaceInventory.result !== 'PASS') errors.push('NAMED_SURFACE_INVENTORY_DRIFT');
  if (forbiddenBindingArtifacts.result !== 'PASS') errors.push('FORBIDDEN_BINDING_ARTIFACT');
  if (rendererBoundary.result !== 'PASS') errors.push('RENDERER_BOUNDARY_DRIFT');
  if (serviceRoleMaterial.length > 0) errors.push('SERVICE_ROLE_MATERIAL_PRESENT');
  if (
    selfCertification.exit_code !== 0
    || selfCertification.summary.executed !== CONTRACTUAL_TEST_COUNT
    || selfCertification.summary.failed !== 0
    || selfCertification.summary.skipped !== 0
  ) errors.push('SELF_CERTIFICATION_FAILED');

  const uniqueErrors = [...new Set(errors)];
  return {
    ...candidate,
    result: uniqueErrors.length === 0 ? 'PASS' : (
      uniqueErrors.includes('SELF_CERTIFICATION_FAILED') ? 'FAIL' : 'BLOCKED'
    ),
    invalidation_reason: uniqueErrors.length === 0 ? null : uniqueErrors,
    self_certification: {
      exit_code: selfCertification.exit_code,
      ...selfCertification.summary,
    },
  };
}

function main() {
  const options = parseCli(process.argv.slice(2));

  if (options.bundleCheck) {
    const result = bundleCheck(process.cwd());
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.result === 'PASS' ? 0 : 1;
    return;
  }

  const evidence = buildBaselineEvidence({ root: process.cwd() });
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  process.exitCode = evidence.result === 'PASS' ? 0 : 1;
}

const invoked = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';

if (invoked === import.meta.url) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`CI013_ERROR ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}