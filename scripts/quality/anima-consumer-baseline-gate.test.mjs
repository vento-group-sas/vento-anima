import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

import {
  CONSUMER_REPOSITORY,
  CONTRACTUAL_TEST_COUNT,
  EXPECTED_LAYOUT_FILES,
  EXPECTED_SCREEN_FILES,
  EXPECTED_TAB_FILES,
  PLATFORM_SET,
  PROFILES,
  RENDERER,
  REQUIRED_EVIDENCE_FIELDS,
  SURFACES,
  containsSensitiveData,
  detectServiceRoleMaterial,
  evaluateProfile,
  evaluateSurface,
  evidenceIsStale,
  sha256Identity,
  validateBinding,
  validateEvidence,
  validateNotificationContractSource,
  validateRouteInventoryEntries,
  validateTabConfigurationSource,
  probeSurfaceAnchors,
} from './anima-consumer-baseline-gate.mjs';

const positiveSurfaceScenarios = Object.freeze({
  'ANIMA-SURFACE-001': { bootstrap: true, session_resolution: true, login_guard: true, protected_not_exposed: true },
  'ANIMA-SURFACE-002': { providers_ready: true, error_boundary: true, update_gate: true, failure_normalized_ready: false },
  'ANIMA-SURFACE-003': { screen_count: 14, static_count: 14, dynamic_count: 0, no_duplicate: true },
  'ANIMA-SURFACE-004': { tab_count: 9, notification_allowlist: true, deep_link_allowlist: true, hidden_tab_as_auth: false },
  'ANIMA-SURFACE-005': { actor: true, site: true, geofence_valid: true, checkin_valid: true, invalid_site_success: false },
  'ANIMA-SURFACE-006': { durable_queue: true, restart_survival: true, idempotent_replay: true, payload_conflict_detected: true, duplicate_effect: false },
  'ANIMA-SURFACE-007': { view_authorized: true, mutation_authorized: true, break_state: true, server_revalidation: true, local_role_grants: false },
  'ANIMA-SURFACE-008': { actor_scope: true, own_history: true, foreign_history_denied: true, client_scope_bypass: false },
  'ANIMA-SURFACE-009': { read_scope: true, upload_scope: true, storage_lifecycle: true, partial_delete_detected: true, retry_reconciled: true },
  'ANIMA-SURFACE-010': { identity: true, eligibility: true, valid_state: true, missing_condition_valid: false },
  'ANIMA-SURFACE-011': { audience: true, persisted: true, notified: true, read_state: true, admin_authorized: true },
  'ANIMA-SURFACE-012': { direct_access_checked: true, effective_permission: true, team_scope: true, role_capability_divergence: false },
  'ANIMA-SURFACE-013': { actor_scope: true, territory_scope: true, ticket_scope: true, deep_link_safe: true },
  'ANIMA-SURFACE-014': { authenticated_account: true, cleanup_request: true, delete_request: true, pending_distinguished: true, executed_distinguished: true, other_account_safe: true },
  'ANIMA-SURFACE-015': { technical_capability: true, server_protection: true, site_scope: true, email_allowlist_grants: false },
  'ANIMA-SURFACE-016': { native_renderer: true, web_auth_separate: true, expo_router_preserved: true, platform_checked: true, ui_web_excluded: true },
});

const negativeSurfaceScenarios = Object.freeze({
  'ANIMA-SURFACE-001': { bootstrap: false, session_resolution: false, login_guard: false, protected_not_exposed: false },
  'ANIMA-SURFACE-002': { providers_ready: false, error_boundary: false, update_gate: false, failure_normalized_ready: true },
  'ANIMA-SURFACE-003': { screen_count: 15, static_count: 14, dynamic_count: 1, no_duplicate: false },
  'ANIMA-SURFACE-004': { tab_count: 8, notification_allowlist: false, deep_link_allowlist: false, hidden_tab_as_auth: true },
  'ANIMA-SURFACE-005': { actor: false, site: false, geofence_valid: false, checkin_valid: false, invalid_site_success: true },
  'ANIMA-SURFACE-006': { durable_queue: false, restart_survival: false, idempotent_replay: false, payload_conflict_detected: false, duplicate_effect: true },
  'ANIMA-SURFACE-007': { view_authorized: true, mutation_authorized: false, break_state: false, server_revalidation: false, local_role_grants: true },
  'ANIMA-SURFACE-008': { actor_scope: false, own_history: false, foreign_history_denied: false, client_scope_bypass: true },
  'ANIMA-SURFACE-009': { read_scope: false, upload_scope: false, storage_lifecycle: false, partial_delete_detected: false, retry_reconciled: false },
  'ANIMA-SURFACE-010': { identity: false, eligibility: false, valid_state: false, missing_condition_valid: true },
  'ANIMA-SURFACE-011': { audience: false, persisted: false, notified: false, read_state: false, admin_authorized: false },
  'ANIMA-SURFACE-012': { direct_access_checked: false, effective_permission: false, team_scope: false, role_capability_divergence: true },
  'ANIMA-SURFACE-013': { actor_scope: false, territory_scope: false, ticket_scope: false, deep_link_safe: false },
  'ANIMA-SURFACE-014': { authenticated_account: false, cleanup_request: false, delete_request: false, pending_distinguished: false, executed_distinguished: false, other_account_safe: false },
  'ANIMA-SURFACE-015': { technical_capability: false, server_protection: false, site_scope: false, email_allowlist_grants: true },
  'ANIMA-SURFACE-016': { native_renderer: false, web_auth_separate: false, expo_router_preserved: false, platform_checked: false, ui_web_excluded: false },
});

const positiveProfiles = Object.fromEntries(
  Object.entries(PROFILES).map(([profile, keys]) => [
    profile,
    Object.fromEntries(keys.map((key) => [key, true])),
  ]),
);

for (const surface of SURFACES) {
  test(`POS ${surface.id} ${surface.name}`, () => {
    assert.equal(evaluateSurface(surface.id, positiveSurfaceScenarios[surface.id]), true);
  });
}

for (const surface of SURFACES) {
  test(`NEG ${surface.id} ${surface.name} falla cerrado`, () => {
    assert.equal(evaluateSurface(surface.id, negativeSurfaceScenarios[surface.id]), false);
  });
}

for (const profile of Object.keys(PROFILES)) {
  test(`PROFILE POS ${profile}`, () => {
    assert.equal(evaluateProfile(profile, positiveProfiles[profile]), true);
  });
}

for (const profile of Object.keys(PROFILES)) {
  test(`PROFILE NEG ${profile}`, () => {
    const scenario = { ...positiveProfiles[profile] };
    scenario[Object.keys(scenario)[0]] = false;
    assert.equal(evaluateProfile(profile, scenario), false);
  });
}

function validEvidence() {
  const identity = sha256Identity('fixture');
  return {
    consumer_repository: CONSUMER_REPOSITORY,
    consumer_branch: 'main',
    consumer_base_commit: '1'.repeat(40),
    consumer_manifest_identity: identity,
    consumer_lockfile_identity: identity,
    expo_config_identity: identity,
    test_contract_identity: identity,
    test_suite_identity: identity,
    fixture_set_identity: identity,
    screen_inventory_identity: identity,
    layout_inventory_identity: identity,
    internal_surface_identity: identity,
    web_auth_identity: identity,
    source_contract_identity: identity,
    environment_identity: 'isolated:win32:x64:node:v24.19.0',
    runtime_identity: 'v24.19.0',
    expo_identity: '~54.0.35',
    react_native_identity: '0.81.5',
    react_identity: '19.1.0',
    platform_set: [...PLATFORM_SET],
    device_profile_set: ['synthetic-android', 'synthetic-ios'],
    approved_binding_set: [],
    owner_contract_refs: [],
    anima_profile_set: [],
    execution_identity: identity,
    started_at: '2026-08-18T11:49:00-05:00',
    completed_at: '2026-08-18T11:50:00-05:00',
    result: 'PASS',
    invalidation_reason: null,
    renderer: RENDERER,
    relation_29_created: false,
    ui_web_inferred: false,
    certification_scope: 'HARNESS_SELF_CERTIFICATION',
    consumer_conformance_claimed: false,
    test_summary: {
      executed: CONTRACTUAL_TEST_COUNT,
      passed: CONTRACTUAL_TEST_COUNT,
      failed: 0,
      skipped: 0,
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
}

test('REG-01 evidencia válida contiene todos los campos y pasa', () => {
  const evidence = validEvidence();
  for (const field of REQUIRED_EVIDENCE_FIELDS) assert.ok(field in evidence);
  assert.deepEqual(validateEvidence(evidence), []);
});

test('REG-02 cero tests jamás se normaliza a PASS', () => {
  const evidence = validEvidence();
  evidence.test_summary.executed = 0;
  assert.ok(validateEvidence(evidence).includes('ZERO_REQUIRED_TESTS'));
});

test('REG-03 evidencia de otro consumidor no satisface ANIMA', () => {
  const evidence = validEvidence();
  evidence.consumer_repository = 'devVentoGroup/vento-viso';
  assert.ok(validateEvidence(evidence).includes('WRONG_CONSUMER_REPOSITORY'));
});

test('REG-04 cambiar commit vuelve STALE la evidencia', () => {
  const previous = validEvidence();
  const current = { ...previous, consumer_base_commit: '2'.repeat(40) };
  assert.equal(evidenceIsStale(previous, current), true);
});

test('REG-05 renderer distinto queda bloqueado', () => {
  const evidence = validEvidence();
  evidence.renderer = 'WEB_REACT_DOM_CSS';
  assert.ok(validateEvidence(evidence).includes('RENDERER_MISMATCH'));
});

test('REG-06 relación base 29 queda prohibida', () => {
  const errors = validateBinding({
    binding_id: 'PKG-COMP-MX-029',
    consumer_repository: CONSUMER_REPOSITORY,
    renderer: RENDERER,
    target: 'anima-native',
    platform_set: [...PLATFORM_SET],
    package_name: '@vento/contracts',
    owner_contract_ref: 'SHELL-NATIVE-002',
    approval_state: 'APPROVED',
  });
  assert.ok(errors.includes('RELATION_29_FORBIDDEN'));
});

test('REG-07 @vento/ui-web queda prohibido para el binding nativo', () => {
  const errors = validateBinding({
    binding_id: 'NATIVE-BINDING-001',
    consumer_repository: CONSUMER_REPOSITORY,
    renderer: RENDERER,
    target: 'anima-native',
    platform_set: [...PLATFORM_SET],
    package_name: '@vento/ui-web',
    owner_contract_ref: 'SHELL-NATIVE-003',
    approval_state: 'APPROVED',
  });
  assert.ok(errors.includes('UI_WEB_FORBIDDEN'));
});

test('REG-08 binding sintético nunca se presenta como real', () => {
  const synthetic = {
    binding_id: 'CI013-SYNTHETIC-CONTRACTS-001',
    consumer_repository: CONSUMER_REPOSITORY,
    renderer: RENDERER,
    target: 'anima-native',
    platform_set: [...PLATFORM_SET],
    package_name: '@vento/contracts-synthetic',
    owner_contract_ref: 'SHELL-NATIVE-002',
    approval_state: 'SYNTHETIC',
  };
  assert.deepEqual(validateBinding(synthetic, { allowSynthetic: true }), []);
  assert.ok(validateBinding(synthetic).includes('SYNTHETIC_BINDING_NOT_REAL'));
});

test('REG-09 secretos con forma de secreto quedan bloqueados sin falsos positivos por nombres de superficie', () => {
  assert.equal(containsSensitiveData({ password: 'synthetic-fixture-password-12345678' }), true);
  assert.equal(containsSensitiveData({ payload: 'token=synthetic-fixture-token-12345678' }), true);
  assert.equal(
    containsSensitiveData({
      surfaces: {
        'request-password': 'web-auth/api/request-password.js',
        'set-password': 'web-auth/api/set-password.js',
      },
    }),
    false,
  );
});

test('REG-10 service-role queda detectado sin exponer valor', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vento-ci013-service-role-'));
  try {
    fs.writeFileSync(
      path.join(root, '.env.local'),
      'SUPABASE_SERVICE_ROLE_KEY=synthetic-fixture-service-role-value\n',
      'utf8',
    );
    const detected = detectServiceRoleMaterial(root, {});
    assert.deepEqual(detected, ['.env.local:SUPABASE_SERVICE_ROLE_KEY']);
    assert.equal(detected.some((entry) => entry.includes('synthetic-fixture-service-role-value')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('REG-11 inventario, tabs y notificaciones exactas pasan', () => {
  const inventory = validateRouteInventoryEntries(
    EXPECTED_SCREEN_FILES,
    EXPECTED_LAYOUT_FILES,
    [],
  );
  assert.equal(inventory.result, 'PASS');
  assert.equal(inventory.actual_screen_count, 14);
  assert.equal(inventory.actual_layout_count, 3);
  assert.equal(inventory.actual_tab_count, EXPECTED_TAB_FILES.length);
  assert.equal(inventory.actual_handler_count, 0);

  const tabs = validateTabConfigurationSource(`
    <Tabs.Screen name="home" options={{}} />
    <Tabs.Screen name="shifts" options={{}} />
    <Tabs.Screen name="history" options={{}} />
    <Tabs.Screen name="documents" options={{}} />
    <Tabs.Screen name="carnet" options={{}} />
    <Tabs.Screen name="announcements" options={{}} />
    <Tabs.Screen name="operativo" options={{ ...(ok ? {} : { href: null }) }} />
    <Tabs.Screen name="team" options={{ ...(ok ? {} : { href: null }) }} />
    <Tabs.Screen name="support" options={{}} />
  `);
  assert.equal(tabs.result, 'PASS');

  const notifications = validateNotificationContractSource(`
    if (
      data?.type === "shift_update" ||
      data?.type === "shift" ||
      data?.type === "shift_end_reminder" ||
      data?.type === "shift_auto_checkout"
    ) { router.replace("/shifts"); return; }
    if (data?.type === "support_message") { router.replace("/support"); }
  `);
  assert.equal(notifications.result, 'PASS');
});

test('REG-12 drift estructural y superficie conceptual sin ancla bloquean', () => {
  const screens = EXPECTED_SCREEN_FILES.slice(0, -1);
  const inventory = validateRouteInventoryEntries(
    screens,
    EXPECTED_LAYOUT_FILES,
    ['app/+api.ts'],
  );
  assert.equal(inventory.result, 'BLOCKED');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vento-ci013-surface-anchor-'));
  try {
    fs.mkdirSync(path.join(root, 'app', '(app)'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'app', '(app)', 'announcements.tsx'),
      '<Modal visible={isFormOpen} /> openCreate openEdit handleSave',
      'utf8',
    );
    const ok = probeSurfaceAnchors(root, {
      AnnouncementFormModal: {
        path: 'app/(app)/announcements.tsx',
        contains: ['<Modal', 'visible={isFormOpen}', 'openCreate', 'openEdit', 'handleSave'],
        conceptual: true,
      },
    });
    assert.equal(ok.result, 'PASS');

    const drift = probeSurfaceAnchors(root, {
      AnnouncementFormModal: {
        path: 'app/(app)/announcements.tsx',
        contains: ['missing-anchor'],
        conceptual: true,
      },
    });
    assert.equal(drift.result, 'OBSERVED_DRIFT');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// GAP-PKG-004: run the actual queue-storage implementation with a synthetic
// SecureStore in an isolated VM; no Android data, user identity, or network.
function attendanceQueueUnderTest(secureStore) {
  const source = fs.readFileSync(
    new URL('../../src/hooks/attendance/queue-storage.ts', import.meta.url),
    'utf8',
  );
  const executable = stripTypeScriptTypes(source)
    .replace(/^\s*import[\s\S]*?\s+from\s+["'][^"']+["'];/gmu, '')
    .replace(/\bexport\s+async\s+function\b/gu, 'async function');
  return runInNewContext(
    executable + '\n({persistPendingAttendanceQueueToStorage,loadPendingAttendanceQueueFromStorage})',
    {
      SecureStore: secureStore,
      getAttendanceQueueStorageKey: (id) => 'qa:attendance:' + id,
      getBreakQueueStorageKey: (id) => 'qa:break:' + id,
      getErrorMessage: (error) => String(error?.message ?? error),
      normalizePendingAttendanceEvent: (value) => value,
      console: { warn: () => {} },
    },
    { timeout: 3000 },
  );
}

test('GAP-PKG-004 offline checkout persists and survives a fresh queue module', async () => {
  const durable = new Map();
  const secureStore = {
    getItemAsync: async (key) => durable.get(key) ?? null,
    setItemAsync: async (key, value) => { durable.set(key, value); },
    deleteItemAsync: async (key) => { durable.delete(key); },
  };
  const record = { id: 'qa-checkout', payload: { action: 'check_out', site_id: 'qa-site' } };
  const diagnostics = [];
  const first = attendanceQueueUnderTest(secureStore);
  await first.persistPendingAttendanceQueueToStorage(
    'qa-employee', [record], (...args) => diagnostics.push(args),
  );
  const restarted = attendanceQueueUnderTest(secureStore);
  const recovered = await restarted.loadPendingAttendanceQueueFromStorage(
    'qa-employee', (...args) => diagnostics.push(args),
  );
  assert.deepEqual(JSON.parse(JSON.stringify(recovered)), [record]);
  assert.equal(diagnostics.length, 0);
});

test('GAP-PKG-004 offline checkout refuses success when SecureStore write fails', async () => {
  const diagnostics = [];
  const secureStore = {
    getItemAsync: async () => null,
    setItemAsync: async () => { throw new Error('QA_STORAGE_WRITE_FAILED'); },
    deleteItemAsync: async () => {},
  };
  const storage = attendanceQueueUnderTest(secureStore);
  await assert.rejects(
    storage.persistPendingAttendanceQueueToStorage(
      'qa-employee', [{ id: 'qa-checkout' }], (...args) => diagnostics.push(args),
    ),
    /QA_STORAGE_WRITE_FAILED/u,
  );
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0][0], 'queue');
});

test('GAP-PKG-004 offline checkout refuses success when queue delete fails', async () => {
  const secureStore = {
    getItemAsync: async () => null,
    setItemAsync: async () => {},
    deleteItemAsync: async () => { throw new Error('QA_STORAGE_DELETE_FAILED'); },
  };
  const storage = attendanceQueueUnderTest(secureStore);
  await assert.rejects(
    storage.persistPendingAttendanceQueueToStorage('qa-employee', [], () => {}),
    /QA_STORAGE_DELETE_FAILED/u,
  );
});

test('GAP-PKG-004 updates visible attendance queue only after durable storage', () => {
  const source = fs.readFileSync(
    new URL('../../src/hooks/use-attendance.ts', import.meta.url),
    'utf8',
  );
  const begin = source.indexOf('const setAndPersistPendingAttendanceQueue = useCallback');
  const end = source.indexOf('const loadPendingBreakQueue', begin);
  assert.ok(begin >= 0 && end > begin, 'Attendance persistence hook must exist');
  const body = source.slice(begin, end);
  const persisted = body.indexOf('await persistPendingAttendanceQueue(nextQueue)');
  const published = body.indexOf('setPendingAttendanceQueue(nextQueue)');
  assert.ok(persisted >= 0 && published > persisted,
    'Never publish a queued checkout before SecureStore confirms persistence');
});

test('GAP-PKG-004 does not expose a scheduled auto-checkout disabled by the server', () => {
  const policySource = fs.readFileSync(
    new URL('../../src/hooks/use-shift-policy.ts', import.meta.url),
    'utf8',
  );
  const guide = fs.readFileSync(
    new URL('../../docs/ANIMA-SHIFT-POLICY-CONFIG-SIN-BUILD.md', import.meta.url),
    'utf8',
  );
  assert.equal(
    policySource.split('scheduledAutoCheckoutEnabled: false').length - 1,
    2,
    'Both default and loaded policy must reflect the disabled scheduled auto-checkout',
  );
  assert.doesNotMatch(policySource, /scheduledAutoCheckoutEnabled: *data[.]scheduled_auto_checkout_enabled/gu);
  assert.match(guide, /autocierre por geocerca PENDIENTE DE IMPLEMENTACIÓN/gu);
  assert.match(guide, /El fin programado nunca constituye prueba automática/gu);
});

// GAP-PKG-004: contratos verificables de permisos. Son invariantes de codigo,
// no sustituyen QA Android/iOS con consentimientos y cambios de estado reales.
test('GAP-PKG-004: check-in requiere GPS preciso y autorización background previa', () => {
  const source = fs.readFileSync(new URL('../../src/hooks/use-attendance.ts', import.meta.url), 'utf8');
  const start = source.indexOf('const checkIn = useCallback');
  const end = source.indexOf('const geo = await ensureActionGeofenceReady({', start);
  assert.ok(start >= 0 && end > start, 'Debe existir el preflight de entrada');
  const preflight = source.slice(start, end);
  assert.match(preflight, /Location\.getForegroundPermissionsAsync\(\)/u);
  assert.match(preflight, /Location\.requestForegroundPermissionsAsync\(\)/u);
  assert.match(preflight, /foreground\.android\?\.accuracy\s*!==\s*"fine"/u);
  assert.match(preflight, /Location\.hasServicesEnabledAsync\(\)/u);
  assert.match(preflight, /if \(!await ensureAttendanceBackgroundLocationPermission\(\)\)/u,
    'El permiso background debe preceder la verificación de geocerca y cualquier escritura');
  assert.match(preflight, /Alert\.alert\(/u, 'Explicar el propósito antes del consentimiento');
  assert.match(preflight, /ensureAttendanceBackgroundLocationPermission\(\{ request: true \}\)/u,
    'El consentimiento background debe ser una acción expresa');
  assert.match(preflight, /Entrada no registrada:/u, 'Denegar permisos bloquea la nueva entrada');
  assert.doesNotMatch(preflight, /startAttendanceBackgroundLocation\(/u,
    'No iniciar seguimiento continuo antes del turno confirmado');
  const insert = source.indexOf('await insertAttendanceLogWithRetry(payload)', end);
  assert.ok(insert > end, 'La escritura solo ocurre después de los permisos y la geocerca');
});

test('GAP-PKG-004: tracking comienza solo con turno confirmado y permisos reales', () => {
  const file = fs.readFileSync(
    new URL('../../src/hooks/attendance/background-location-task.ts', import.meta.url), 'utf8');
  const start = file.indexOf('export async function startAttendanceBackgroundLocation(');
  const end = file.indexOf('export async function stopAttendanceBackgroundLocation(', start);
  assert.ok(start >= 0 && end > start, 'Debe existir el contrato de seguimiento');
  const body = file.slice(start, end);
  const shiftProof = body.indexOf('latestLog?.action !== "check_in"');
  const markerClear = body.indexOf('await SecureStore.deleteItemAsync(BG_LOCAL_CHECKOUT_KEY)');
  const permissionGate = body.indexOf('const permissionGranted = await ensureAttendanceBackgroundLocationPermission()');
  assert.ok(shiftProof >= 0 && markerClear > shiftProof && permissionGate > markerClear,
    'Turno confirmado primero, permiso real después; ningún GPS antes de turno');
  const settings = fs.readFileSync(
    new URL('../../app/account-settings.tsx', import.meta.url), 'utf8');
  assert.match(settings, /Ubicacion de turno requerida para entrar/u);
  assert.match(settings, /No se registraran nuevas entradas sin permiso preciso y de segundo plano/u);
  assert.match(settings, /ensureAttendanceBackgroundLocationPermission\(\{ request: true \}\)/u);
});

test('GAP-PKG-004: capacidades nativas declaradas sin conceder permiso runtime', () => {
  const expo = fs.readFileSync(new URL('../../app.config.js', import.meta.url), 'utf8');
  const manifestUrl = new URL('../../android/app/src/main/AndroidManifest.xml', import.meta.url);
  assert.match(expo, /isAndroidBackgroundLocationEnabled:\s*true/u);
  assert.match(expo, /isIosBackgroundLocationEnabled:\s*true/u);
  assert.match(expo, /ACCESS_BACKGROUND_LOCATION/u);
  assert.match(expo, /isAndroidForegroundServiceEnabled:\s*true/u);
  assert.match(expo, /FOREGROUND_SERVICE_LOCATION/u);
  // android/ es generado por Expo prebuild e ignorado por Git en runners CI.
  // Validar config fuente siempre, y el manifiesto Android real cuando exista.
  if (fs.existsSync(manifestUrl)) {
    const manifest = fs.readFileSync(manifestUrl, 'utf8');
    assert.match(manifest, /android\.permission\.ACCESS_BACKGROUND_LOCATION/u);
  }
  const policy = fs.readFileSync(
    new URL('../../docs/ANIMA-SHIFT-POLICY-CONFIG-SIN-BUILD.md', import.meta.url), 'utf8');
  assert.match(policy, /permiso de ubicación en segundo plano/u);
  assert.match(policy, /Si se deniegan, revocan o no están disponibles, fallar cerrado/u);
  assert.match(policy, /Autocierre no habilitado/u);
});

test('GAP-PKG-004 background SecureStore keys meet native naming requirements', () => {
  const source = fs.readFileSync(
    new URL('../../src/hooks/attendance/background-location-task.ts', import.meta.url),
    'utf8',
  );
  const declarations = new Map(
    [...source.matchAll(/\bconst\s+(BG_[A-Z_]+_KEY)\s*=\s*"([^"]+)"/gu)]
      .map((match) => [match[1], match[2]]),
  );
  for (const name of ['BG_DEPARTURE_NOTICE_KEY', 'BG_LOCAL_CHECKOUT_KEY']) {
    assert.ok(declarations.has(name), name + ' must remain defined');
    assert.match(declarations.get(name), /^[A-Za-z0-9._-]+$/u,
      name + ' must be accepted by native expo-secure-store');
  }
});

test('GAP-PKG-004 anti-mock rejects simulated Android GPS without bypassing production rules', () => {
  const geoSource = fs.readFileSync(
    new URL('../../src/lib/geolocation.ts', import.meta.url),
    'utf8',
  );
  const sharedSource = fs.readFileSync(
    new URL('../../src/hooks/attendance/shared.ts', import.meta.url),
    'utf8',
  );
  const geoFn = geoSource.match(/^export function buildValidatedLocationFromRaw\([\s\S]*?^\}/mu)?.[0];
  const blockFn = sharedSource.match(/^export function findBlockingGeoWarning\([\s\S]*?^\}/mu)?.[0];
  assert.ok(geoFn && blockFn, 'Production anti-mock functions must be present');
  const executable = stripTypeScriptTypes(geoFn + '\n' + blockFn)
    .replace(/^\s*export\s+function/gmu, 'function');
  const { buildValidatedLocationFromRaw, findBlockingGeoWarning } = runInNewContext(
    executable + '\n({buildValidatedLocationFromRaw,findBlockingGeoWarning})',
    {
      detectSpoofingPatterns: () => [],
      getDeviceInfo: () => ({ isDevice: false, platform: 'android' }),
      VALIDATION_CONFIG: { maxReasonableSpeed: 55 },
    },
    { timeout: 3000 },
  );
  const sample = {
    mocked: true,
    timestamp: Date.now(),
    coords: {
      latitude: 13.724345,
      longitude: -70.123456,
      accuracy: 10,
      speed: 0,
      altitude: null,
      heading: null,
    },
  };
  const simulated = buildValidatedLocationFromRaw(sample);
  assert.match(findBlockingGeoWarning(simulated), /mock|simulada/u);
  const withoutMockFlag = buildValidatedLocationFromRaw({ ...sample, mocked: false });
  assert.equal(findBlockingGeoWarning(withoutMockFlag), null,
    'The same geometrically valid sample is not blocked absent the mock flag');
});

test('GAP-PKG-004 background departure notification remains permission and anti-mock gated', () => {
  const source = fs.readFileSync(
    new URL('../../src/hooks/attendance/background-location-task.ts', import.meta.url),
    'utf8',
  );
  const start = source.indexOf('async function handleBackgroundLocation');
  const end = source.indexOf('TaskManager.defineTask', start);
  assert.ok(start >= 0 && end > start, 'Production background handler must be present');
  const handler = source.slice(start, end);
  assert.match(handler, /findBlockingGeoWarning\(validated\)/u);
  assert.match(handler, /if \(accuracy > SHIFT_DEPARTURE_TRACKING\.maxAccuracyMeters\) return/u);
  assert.match(handler, /now - previous\.firstOutsideAt < BG_OUTSIDE_CONFIRMATION_MS/u);
  assert.match(handler, /permission\.status !== "granted"\) return/u);
  assert.match(handler, /Notifications\.scheduleNotificationAsync\(/u);
});

function backgroundDepartureHarness(notificationStatus = 'granted') {
  const source = fs.readFileSync(
    new URL('../../src/hooks/attendance/background-location-task.ts', import.meta.url),
    'utf8',
  );
  const begin = source.indexOf('const BG_DEPARTURE_NOTICE_KEY');
  const end = source.indexOf('TaskManager.defineTask', begin);
  assert.ok(begin >= 0 && end > begin, 'Production departure handler must be extractable');
  const executable = stripTypeScriptTypes(source.slice(begin, end))
    .replace(/^\s*export\s+const\b/gmu, 'const');
  const storage = new Map();
  const notifications = [];
  const clock = { now: 100000 };
  const queries = {
    attendance_breaks: null,
    attendance_logs: {
      action: 'check_in', occurred_at: '2026-10-20T20:00:00.000Z',
      site_id: 'qa-site', geofence_site_id: 'qa-site',
    },
    sites: {
      id: 'qa-site', name: 'Sede sintética',
      latitude: 13.712345, longitude: -70.123456,
      checkin_radius_meters: 200,
    },
    site_attendance_policy: {
      checkin_radius_meters: 200, requires_geofence: true,
    },
  };
  const env = {
    SecureStore: {
      getItemAsync: async (key) => storage.get(key) ?? null,
      setItemAsync: async (key, value) => { storage.set(key, value); },
      deleteItemAsync: async (key) => { storage.delete(key); },
    },
    Notifications: {
      getPermissionsAsync: async () => ({ status: notificationStatus }),
      scheduleNotificationAsync: async (payload) => {
        notifications.push(JSON.parse(JSON.stringify(payload)));
      },
    },
    getSupabaseAuthSession: async () => ({ user: { id: 'qa-employee' } }),
    supabase: {
      from: (table) => ({
        select() { return this; },
        eq() { return this; },
        is() { return this; },
        order() { return this; },
        limit() { return this; },
        async maybeSingle() { return { data: queries[table], error: null }; },
      }),
    },
    ensureAttendanceBackgroundLocationPermission: async () => true,
    stopAttendanceBackgroundLocation: async () => {
      throw new Error('Unexpected stop during a confirmed synthetic shift');
    },
    buildValidatedLocationFromRaw: (raw) => ({
      latitude: raw.coords.latitude,
      longitude: raw.coords.longitude,
      accuracy: raw.coords.accuracy,
      isValid: true,
      validationWarnings: raw.mocked ? ['ubicacion mock'] : [],
    }),
    findBlockingGeoWarning: (location) =>
      location.validationWarnings.find((message) => message.includes('mock')) ?? null,
    calculateDistance: (lat, lon, siteLat, siteLon) =>
      Math.hypot((lat - siteLat) * 111000, (lon - siteLon) * 111000),
    SHIFT_DEPARTURE_TRACKING: { thresholdMeters: 200, maxAccuracyMeters: 35 },
    Date: class extends Date { static now() { return clock.now; } },
  };
  const { handleBackgroundLocation } = runInNewContext(
    executable + '\n({handleBackgroundLocation})', env, { timeout: 3000 },
  );
  return { handleBackgroundLocation, storage, notifications, clock, queries };
}

test('GAP-PKG-004 native departure handler notifies only after two valid outside samples', async () => {
  const harness = backgroundDepartureHarness();
  const outside = {
    timestamp: 100000, mocked: false,
    coords: { latitude: 13.724345, longitude: -70.123456, accuracy: 8 },
  };
  await harness.handleBackgroundLocation(outside);
  assert.equal(harness.notifications.length, 0);
  const noticeKey = 'anima.attendance.departure-notice';
  assert.equal(JSON.parse(harness.storage.get(noticeKey)).warned, false);
  harness.clock.now += 46000;
  await harness.handleBackgroundLocation(outside);
  assert.equal(harness.notifications.length, 1);
  assert.equal(harness.notifications[0].content.title, 'Posible salida de sede');
  assert.equal(JSON.parse(harness.storage.get(noticeKey)).warned, true);
  await harness.handleBackgroundLocation(outside);
  assert.equal(harness.notifications.length, 1, 'A confirmed warning must not duplicate');
});

test('GAP-PKG-004 departure handler rejects mock and denied notifications without sending alerts', async () => {
  const outside = {
    timestamp: 100000, mocked: false,
    coords: { latitude: 13.724345, longitude: -70.123456, accuracy: 8 },
  };
  const mocked = backgroundDepartureHarness();
  await mocked.handleBackgroundLocation({ ...outside, mocked: true });
  assert.equal(mocked.notifications.length, 0);
  assert.equal(mocked.storage.size, 0);
  const denied = backgroundDepartureHarness('denied');
  await denied.handleBackgroundLocation(outside);
  denied.clock.now += 46000;
  await denied.handleBackgroundLocation(outside);
  assert.equal(denied.notifications.length, 0);
  assert.equal(JSON.parse(denied.storage.get('anima.attendance.departure-notice')).warned, false);
});

test('GAP-PKG-004 background geofence clears pending warning during an active break', async () => {
  const harness = backgroundDepartureHarness();
  const outside = {
    timestamp: 100000, mocked: false,
    coords: { latitude: 13.724345, longitude: -70.123456, accuracy: 8 },
  };
  const key = 'anima.attendance.departure-notice';
  await harness.handleBackgroundLocation(outside);
  assert.equal(JSON.parse(harness.storage.get(key)).warned, false);

  harness.queries.attendance_breaks = { id: 'qa-active-break' };
  harness.clock.now += 46000;
  await harness.handleBackgroundLocation(outside);
  assert.equal(harness.notifications.length, 0);
  assert.equal(harness.storage.has(key), false,
    'An active break must discard accumulated outside samples');

  harness.queries.attendance_breaks = null;
  await harness.handleBackgroundLocation(outside);
  assert.equal(harness.notifications.length, 0,
    'Resuming from a break must start a new sample confirmation');
  assert.equal(JSON.parse(harness.storage.get(key)).warned, false);

  harness.clock.now += 46000;
  await harness.handleBackgroundLocation(outside);
  assert.equal(harness.notifications.length, 1,
    'Only two fresh outside samples after the break may trigger a warning');
});

test('GAP-PKG-004 check-in and check-out handle failed offline writes without false success', () => {
  const source = fs.readFileSync(
    new URL('../../src/hooks/use-attendance.ts', import.meta.url),
    'utf8',
  );
  const checkIn = source.slice(source.indexOf('const checkIn = useCallback'),
    source.indexOf('const checkOut = useCallback'));
  const checkOut = source.slice(source.indexOf('const checkOut = useCallback'),
    source.indexOf('const startBreak = useCallback'));
  assert.match(checkIn,
    /try\s*\{\s*await enqueuePendingAttendanceEvent\(payload, err\)\s*\}\s*catch\s*\(queueError\)\s*\{[\s\S]*?success: false/u);
  assert.match(checkOut,
    /try\s*\{\s*await enqueuePendingAttendanceEvent\(queuedPayload, err\)\s*\}\s*catch\s*\(queueError\)\s*\{[\s\S]*?success: false/u);
  const queued = checkOut.indexOf('queued = true');
  const stopped = checkOut.indexOf('await stopAttendanceBackgroundLocation({ localCheckout: true })');
  assert.ok(queued >= 0 && stopped > queued,
    'Never stop turn tracking before a check-out is confirmed or durably queued');
});

// Reconcile an uncertain network write by its unique event identity only.
// A previous check-in/out from the same site, source or minute cannot prove it.
function attendanceReconciliationUnderTest() {
  const source = fs.readFileSync(
    new URL('../../src/hooks/use-attendance.ts', import.meta.url), 'utf8',
  ).replace(/\r\n/gu, '\n');
  const start = source.indexOf('function reconcileAttendanceWriteConfirmed(');
  const end = source.indexOf('\n}\n', start);
  assert.ok(start >= 0 && end > start, 'Missing exact event reconciliation');
  const executable = stripTypeScriptTypes(source.slice(start, end + 2));
  return runInNewContext(
    executable + '\nreconcileAttendanceWriteConfirmed',
    {}, { timeout: 3000 },
  );
}

test('GAP-PKG-004 confirms uncertain writes only for the exact clientEventId', () => {
  const confirm = attendanceReconciliationUnderTest();
  const payload = {
    action: 'check_out',
    site_id: 'qa-site',
    source: 'anima',
    device_info: { clientEventId: 'qa-event-expected' },
    occurred_at: '2026-10-19T22:00:00.000Z',
  };
  const latest = {
    action: 'check_out', site_id: 'qa-site', source: 'anima',
    client_event_id: 'qa-event-expected',
    occurred_at: payload.occurred_at,
  };
  assert.equal(confirm(latest, payload), true);
  assert.equal(confirm({ ...latest, client_event_id: 'qa-other-event' }, payload), false,
    'Same action, site, source and timestamp must not masquerade as our event');
  assert.equal(confirm({ ...latest, client_event_id: null }, payload), false);
  assert.equal(confirm({ ...latest, action: 'check_in' }, payload), false);
  assert.equal(confirm({ ...latest, site_id: 'qa-other-site' }, payload), false);
  assert.equal(confirm({ ...latest, source: 'qa-other-source' }, payload), false);
  assert.equal(confirm(null, payload), false);
  assert.equal(confirm(latest, { ...payload, device_info: null }), false);
  assert.equal(confirm(latest, {
    ...payload, device_info: { clientEventId: '' },
  }), false);
});

test('GAP-PKG-004 retry reconciliation uses event identity, never proximity in time', () => {
  const source = fs.readFileSync(
    new URL('../../src/hooks/use-attendance.ts', import.meta.url), 'utf8',
  );
  const begin = source.indexOf('const insertAttendanceLogWithRetry = useCallback');
  const end = source.indexOf('const getSiteNameFromEmployeeSites', begin);
  assert.ok(begin >= 0 && end > begin, 'Attendance write retry must be inspectable');
  const body = source.slice(begin, end);
  assert.match(body, /reconcileAttendanceWriteConfirmed\(persisted, payload\)/u);
  assert.doesNotMatch(body, /ATTENDANCE_RECONCILE_WINDOW_MS/u,
    'Time proximity alone is not an idempotency proof');
});

function attendanceWriteRuntimeUnderTest({ insertError, storedEventId }) {
  const source = fs.readFileSync(
    new URL('../../src/hooks/use-attendance.ts', import.meta.url), 'utf8',
  );
  const begin = source.indexOf('const insertAttendanceLogWithRetry = useCallback');
  const end = source.indexOf('const getSiteNameFromEmployeeSites', begin);
  assert.ok(begin >= 0 && end > begin, 'Attendance retry is required for real behavioral QA');
  const statement = stripTypeScriptTypes(source.slice(begin, end));
  const calls = { inserts: [], selects: [], filters: [] };
  const supabase = {
    from(table) {
      assert.equal(table, 'attendance_logs');
      return {
        async insert(row) {
          calls.inserts.push(row);
          return { error: insertError };
        },
        select(columns) {
          calls.selects.push(columns);
          const query = {
            eq(column, value) {
              calls.filters.push([column, value]);
              return query;
            },
            async maybeSingle() {
              return {
                data: storedEventId == null ? null : {
                  action: 'check_out', site_id: 'qa-site', source: 'mobile',
                  client_event_id: storedEventId,
                },
                error: null,
              };
            },
          };
          return query;
        },
      };
    },
  };
  const write = runInNewContext(
    statement + '\ninsertAttendanceLogWithRetry',
    {
      useCallback: (callback) => callback,
      getSupabaseAuthSession: async () => ({ user: { id: 'qa-employee' } }),
      createSupabaseAuthSessionUnavailableError: () => new Error('no session'),
      supabase,
      getLastAttendanceLog: async () => null,
      reconcileAttendanceWriteConfirmed: attendanceReconciliationUnderTest(),
      ATTENDANCE_WRITE_MAX_ATTEMPTS: 1,
      ATTENDANCE_WRITE_BASE_DELAY_MS: 0,
      isLikelyOfflineError: () => false,
      sleep: async () => {},
    },
    { timeout: 3000 },
  );
  return { write, calls };
}

const qaAttendancePayload = Object.freeze({
  employee_id: 'qa-employee',
  action: 'check_out',
  site_id: 'qa-site',
  source: 'mobile',
  device_info: { clientEventId: 'qa-event-identity' },
});

test('GAP-PKG-004 uses indexed server client_event_id to reconcile lost responses', async () => {
  const { write, calls } = attendanceWriteRuntimeUnderTest({
    insertError: { message: 'QA_RESPONSE_LOST' },
    storedEventId: 'qa-event-identity',
  });
  await write(qaAttendancePayload);
  assert.equal(calls.inserts.length, 1);
  assert.equal(calls.inserts[0].client_event_id, 'qa-event-identity');
  assert.ok(calls.selects.some((columns) => columns.includes('client_event_id')));
  assert.ok(calls.filters.some(([column, value]) =>
    column === 'client_event_id' && value === 'qa-event-identity'));
  assert.ok(calls.filters.some(([column, value]) =>
    column === 'employee_id' && value === 'qa-employee'));
});

test('GAP-PKG-004 refuses to confirm unrelated server events after insert failure', async () => {
  const { write, calls } = attendanceWriteRuntimeUnderTest({
    insertError: new Error('QA_INSERT_FAILED'),
    storedEventId: 'qa-different-event',
  });
  await assert.rejects(write(qaAttendancePayload), /QA_INSERT_FAILED/u);
  assert.equal(calls.inserts[0].client_event_id, 'qa-event-identity');
});

test('GAP-PKG-004 rejects missing attendance event identity before writing', async () => {
  const { write, calls } = attendanceWriteRuntimeUnderTest({
    insertError: null, storedEventId: null,
  });
  await assert.rejects(
    write({ ...qaAttendancePayload, device_info: {} }),
    /clientEventId|ATTENDANCE_EVENT_ID/u,
  );
  assert.equal(calls.inserts.length, 0);
});

function queuedAttendanceDropGuardUnderTest() {
  const source = fs.readFileSync(
    new URL('../../src/hooks/use-attendance.ts', import.meta.url), 'utf8',
  ).replace(/\r\n/gu, '\n');
  const start = source.indexOf('function guardQueuedAttendanceDrop(');
  const end = source.indexOf('\n}\n', start);
  assert.ok(start >= 0 && end > start, 'Exact offline duplicate guard must exist');
  const executable = stripTypeScriptTypes(source.slice(start, end + 2));
  return runInNewContext(
    executable + '\nguardQueuedAttendanceDrop',
    { reconcileAttendanceWriteConfirmed: attendanceReconciliationUnderTest() },
    { timeout: 3000 },
  );
}

test('GAP-PKG-004 drops queued attendance only for the exact persisted event', () => {
  const guard = queuedAttendanceDropGuardUnderTest();
  const item = {
    eventId: 'qa-queue-id',
    payload: {
      action: 'check_out', site_id: 'qa-site', source: 'mobile',
      device_info: { clientEventId: 'qa-queue-id' },
    },
  };
  const latest = {
    action: 'check_out', site_id: 'qa-site', source: 'mobile',
    client_event_id: 'qa-queue-id',
  };
  const drop = { kind: 'drop', reason: 'Existing checkout' };
  assert.equal(guard(drop, item, latest).kind, 'drop');
  assert.equal(guard(drop, item, { ...latest, client_event_id: 'another-event' }).kind,
    'conflict', 'Matching business state is not a duplicate event identity');
  assert.equal(guard(drop, item, { ...latest, client_event_id: null }).kind,
    'conflict', 'Legacy logs without identity cannot prove a duplicate');
  assert.equal(guard(drop, item, null).kind, 'conflict');
  assert.equal(guard(drop, { ...item, eventId: 'other-queue-id' }, latest).kind,
    'conflict', 'Queue event ID must match the persisted clientEventId');
  assert.equal(guard(drop, { ...item, payload: {
    ...item.payload, device_info: { clientEventId: 'other-payload-id' },
  } }, latest).kind, 'conflict');
  assert.equal(guard({ kind: 'proceed' }, item, latest).kind, 'proceed');
  assert.equal(guard({ kind: 'conflict', reason: 'Already conflicted' }, item, latest).kind,
    'conflict');
});

test('GAP-PKG-004 queue evaluator guards silent drop and reads indexed last event ID', () => {
  const source = fs.readFileSync(
    new URL('../../src/hooks/use-attendance.ts', import.meta.url), 'utf8',
  );
  const start = source.indexOf('const evaluateQueueSyncDecision = useCallback');
  const end = source.indexOf('const syncAttendanceEventOnServer = useCallback', start);
  assert.ok(start >= 0 && end > start);
  assert.match(source.slice(start, end),
    /guardQueuedAttendanceDrop\(decision, item, last\)/u);
  const fetchStart = source.indexOf('const getLastAttendanceLog = useCallback');
  const fetchEnd = source.indexOf('const getPublishedShiftContext = useCallback', fetchStart);
  assert.ok(fetchStart >= 0 && fetchEnd > fetchStart);
  assert.match(source.slice(fetchStart, fetchEnd),
    /\.select\("action, occurred_at, site_id, source, shift_id, client_event_id, device_info, sites\(name\)"\)/u);
  assert.match(source.slice(fetchStart, fetchEnd),
    /client_event_id: \(data as any\)\?\.client_event_id \?\?/u);
});

function attendanceRpcDuplicateUnderTest({ rpcResult, persisted, queryError = null }) {
  const source = fs.readFileSync(
    new URL('../../src/hooks/use-attendance.ts', import.meta.url), 'utf8',
  );
  const begin = source.indexOf('const syncAttendanceEventOnServer = useCallback');
  const end = source.indexOf('const syncPendingAttendanceQueue = useCallback', begin);
  assert.ok(begin >= 0 && end > begin, 'Queue sync wrapper must be inspectable');
  const statement = stripTypeScriptTypes(source.slice(begin, end));
  const queries = [];
  const filter = {
    eq(column, value) { queries.push([column, value]); return filter; },
    async maybeSingle() { return { data: persisted, error: queryError }; },
  };
  const sync = runInNewContext(statement + '\nsyncAttendanceEventOnServer', {
    useCallback: (callback) => callback,
    syncAttendanceEventOnServerHelper: async () => rpcResult,
    insertAttendanceLogWithRetry: async () => {},
    getSupabaseAuthSession: async () => ({ user: { id: 'qa-employee' } }),
    supabase: { from: (table) => {
      assert.equal(table, 'attendance_logs');
      return { select: (columns) => {
        queries.push(['select', columns]);
        return filter;
      } };
    } },
    reconcileAttendanceWriteConfirmed: attendanceReconciliationUnderTest(),
  }, { timeout: 3000 });
  return { sync, queries };
}

const queuedRpcItem = Object.freeze({
  eventId: 'qa-sync-event',
  payload: {
    employee_id: 'qa-employee', action: 'check_out', site_id: 'qa-site',
    source: 'mobile', device_info: { clientEventId: 'qa-sync-event' },
  },
});

test('GAP-PKG-004 verifies RPC duplicate against the persisted event before removing queue item', async () => {
  const { sync, queries } = attendanceRpcDuplicateUnderTest({
    rpcResult: { eventId: 'qa-sync-event', result: 'duplicate' },
    persisted: {
      client_event_id: 'qa-sync-event', action: 'check_out',
      site_id: 'qa-site', source: 'mobile',
    },
  });
  const result = await sync(queuedRpcItem);
  assert.equal(result.result, 'duplicate');
  assert.ok(queries.some(([column, value]) =>
    column === 'employee_id' && value === 'qa-employee'));
  assert.ok(queries.some(([column, value]) =>
    column === 'client_event_id' && value === 'qa-sync-event'));
});

test('GAP-PKG-004 keeps mismatched RPC duplicates visible as conflicts', async () => {
  const persisted = {
    client_event_id: 'qa-sync-event', action: 'check_in',
    site_id: 'qa-site', source: 'mobile',
  };
  const { sync } = attendanceRpcDuplicateUnderTest({
    rpcResult: { eventId: 'qa-sync-event', result: 'duplicate' },
    persisted,
  });
  assert.equal((await sync(queuedRpcItem)).result, 'conflict');
  const noRow = attendanceRpcDuplicateUnderTest({
    rpcResult: { eventId: 'qa-sync-event', result: 'duplicate' }, persisted: null,
  });
  assert.equal((await noRow.sync(queuedRpcItem)).result, 'conflict');
});

test('GAP-PKG-004 RPC applied remains applied and lookup failures never fake duplicate', async () => {
  const applied = attendanceRpcDuplicateUnderTest({
    rpcResult: { eventId: 'qa-sync-event', result: 'applied' }, persisted: null,
  });
  assert.equal((await applied.sync(queuedRpcItem)).result, 'applied');
  assert.equal(applied.queries.length, 0);
  const lookupFailure = attendanceRpcDuplicateUnderTest({
    rpcResult: { eventId: 'qa-sync-event', result: 'duplicate' },
    persisted: null, queryError: new Error('QA_LOOKUP_FAILED'),
  });
  assert.equal((await lookupFailure.sync(queuedRpcItem)).result, 'error');
});

test('GAP-PKG-004 turns a PostgreSQL replay conflict into duplicate only with exact persisted identity', async () => {
  // The actual isolated Postgres sync_attendance_events RPC returns 'conflict'
  // for a replay because its sequence trigger runs before UNIQUE detection.
  const exact = {
    client_event_id: 'qa-sync-event', action: 'check_out',
    site_id: 'qa-site', source: 'mobile',
  };
  const verified = attendanceRpcDuplicateUnderTest({
    rpcResult: { eventId: 'qa-sync-event', result: 'conflict',
      message: 'Secuencia inválida: check_out repetido' },
    persisted: exact,
  });
  const confirmed = await verified.sync(queuedRpcItem);
  assert.equal(confirmed.result, 'duplicate',
    'An exact server-persisted event must not stay stuck as a queue conflict');
  assert.ok(verified.queries.some(([column, value]) =>
    column === 'client_event_id' && value === 'qa-sync-event'));

  const mismatch = attendanceRpcDuplicateUnderTest({
    rpcResult: { eventId: 'qa-sync-event', result: 'conflict',
      message: 'Otro check-out' },
    persisted: { ...exact, client_event_id: 'another-event' },
  });
  assert.equal((await mismatch.sync(queuedRpcItem)).result, 'conflict');

  const noRow = attendanceRpcDuplicateUnderTest({
    rpcResult: { eventId: 'qa-sync-event', result: 'conflict',
      message: 'Ubicacion requerida' },
    persisted: null,
  });
  const unresolved = await noRow.sync(queuedRpcItem);
  assert.equal(unresolved.result, 'conflict');
  assert.equal(unresolved.message, 'Ubicacion requerida',
    'A rejected GPS check-out must retain its original conflict reason');

  const blockedLookup = attendanceRpcDuplicateUnderTest({
    rpcResult: { eventId: 'qa-sync-event', result: 'conflict',
      message: 'Sin confirmar' },
    persisted: null, queryError: new Error('QA_NO_SERVER_VISIBILITY'),
  });
  assert.notEqual((await blockedLookup.sync(queuedRpcItem)).result, 'duplicate');
});

test('GAP-PKG-004 foreground geofence respects active employee and break state', async () => {
  const attendanceSource = fs.readFileSync(
    new URL('../../src/hooks/use-attendance.ts', import.meta.url), 'utf8',
  );
  const hookCall = attendanceSource.slice(
    attendanceSource.indexOf('const { registerOpenShiftDepartureEvent } = useShiftDepartureTracking('),
    attendanceSource.indexOf('const { startRealtimeGeofence, stopRealtimeGeofence } = useRealtimeGeofence('),
  );
  assert.match(hookCall, /isEmployeeActive:\s*!!employee\?\.isActive/u);
  assert.match(hookCall, /isOnBreak:\s*attendanceState\.isOnBreak/u);

  const source = fs.readFileSync(
    new URL('../../src/hooks/attendance/use-shift-departure-tracking.ts', import.meta.url),
    'utf8',
  );
  const begin = source.indexOf('export function useShiftDepartureTracking(');
  assert.ok(begin >= 0, 'Production foreground departure hook must exist');
  const executable = stripTypeScriptTypes(
    source.slice(begin).replace(/^export function /u, 'function '),
  );
  const createHook = runInNewContext(executable + '\nuseShiftDepartureTracking', {
    useRef: (value) => ({ current: value }),
    useEffect: () => {},
    useCallback: (callback) => callback,
    findBlockingGeoWarning: () => null,
  }, { timeout: 3000 });
  const position = {
    latitude: 13.724345, longitude: -70.123456, accuracy: 8,
    isValid: true, validationWarnings: [],
  };
  let attendanceReads = 0;
  const build = (isEmployeeActive, isOnBreak) => createHook({
    userId: 'qa-employee', isEmployeeActive, isOnBreak,
    attendanceStatus: 'checked_in',
    departureMinCheckIntervalMs: 100,
    departureMaxAccuracyMeters: 25,
    departureThresholdMeters: 200,
    getLastAttendanceLog: async () => {
      attendanceReads += 1;
      return null;
    },
    resolveSite: async () => { throw new Error('Unexpected site lookup'); },
  });

  await build(true, true).registerOpenShiftDepartureEvent(position);
  await build(false, false).registerOpenShiftDepartureEvent(position);
  assert.equal(attendanceReads, 0,
    'No location-driven work or warning should happen on a break or for inactive staff');

  await build(true, false).registerOpenShiftDepartureEvent(position);
  assert.equal(attendanceReads, 1, 'An eligible active employee still reaches the server check');
});

test('GAP-PKG-004 QA Android verifica unicamente host/puerto local y GoTrue antes de credenciales sinteticas', () => {
  const source = fs.readFileSync(new URL('../../app/(auth)/login.tsx', import.meta.url), 'utf8');
  const from = source.indexOf('  const qaEndpoint = useMemo(() => {');
  const until = source.indexOf('  }, []);', from);
  assert.ok(from >= 0 && until > from, 'La clasificacion local QA debe estar en LoginScreen');
  const endpointCode = source.slice(from, until + '  }, []);'.length);
  const classify = (apiUrl, variant = 'development') => runInNewContext(
    endpointCode + '\nqaEndpoint', {
      __DEV__: true,
      Constants: { expoConfig: { extra: { appVariant: variant } } },
      process: { env: { EXPO_PUBLIC_SUPABASE_URL: apiUrl } },
      URL,
      useMemo: (callback) => callback(),
    }, { timeout: 3000 },
  );
  for (const accepted of [
    'http://10.0.2.2:23151/',
    'http://127.0.0.1:23151/',
    'http://localhost:23151/',
  ]) {
    assert.equal(classify(accepted)?.qaLocalRoute, true, accepted);
  }
  for (const rejected of [
    'http://10.0.2.2:54321/',
    'http://127.0.0.1:9999/',
    'https://127.0.0.1:23151/',
    'http://127.0.0.1:23151/admin',
    'http://other-host:23151/',
    'https://project.supabase.co/',
  ]) {
    assert.equal(classify(rejected)?.qaLocalRoute, false, rejected);
  }
  assert.equal(classify('http://127.0.0.1:23151/', 'production'), null);
  assert.ok(source.includes('/auth/v1/health'), 'El control debe hacer HTTP desde Android');
  assert.ok(source.includes('.name === "GoTrue"'), 'No aceptar 200 generico sin identidad GoTrue');
  assert.ok(source.includes('qaHttpHealth !== "REACHABLE"'),
    'El login QA sintetico no puede enviar credenciales antes del healthcheck');
});

test('GAP-PKG-004: entrada confirmada advierte tracking no disponible sin cierre automático', async () => {
  const source = fs.readFileSync(new URL('../../src/hooks/use-attendance.ts', import.meta.url), 'utf8');
  const marker = source.indexOf('// La entrada ya se confirmo: advertir si el seguimiento autorizado falla.');
  const begin = source.indexOf('      if (!trackingActive) {', marker);
  const end = source.indexOf('      await Haptics.notificationAsync', begin);
  const nativeStart = source.indexOf('startAttendanceBackgroundLocation({ confirmedNewCheckIn: true })');
  assert.ok(marker >= 0 && nativeStart >= 0 && nativeStart < marker && begin > marker && end > begin,
    'El tracking debe comprobarse después de confirmar la entrada');
  const branch = source.slice(begin, end);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const execute = new AsyncFunction('trackingActive', 'Alert', branch);
  const alerts = [];
  await execute(false, { alert: (...args) => alerts.push(args) });
  assert.equal(alerts.length, 1, 'Una tarea no iniciada debe informar al trabajador');
  assert.match(alerts[0][0], /seguimiento no disponible/u);
  assert.match(alerts[0][1], /entrada quedo registrada/u);
  assert.match(alerts[0][1], /no se realizara un checkout automatico/u);
  const tracked = [];
  await execute(true, { alert: (...args) => tracked.push(args) });
  assert.equal(tracked.length, 0, 'No mostrar alarma si el tracking funciona');
});

test('GAP-PKG-004: salida sin ubicación ofrece soporte sin confirmar un check-out', () => {
  const source = fs.readFileSync(new URL('../../src/hooks/use-attendance.ts', import.meta.url), 'utf8');
  const start = source.indexOf('  const checkOut = useCallback');
  const gate = source.indexOf('      if (!geo.canProceed) {', start);
  const location = source.indexOf('      const location = geo.location', gate);
  assert.ok(start >= 0 && gate > start && location > gate, 'El checkout requiere geocerca');
  const blocked = source.slice(gate, location);
  assert.match(blocked, /Tu turno continúa abierto y no se ha creado ninguna salida/u);
  assert.match(blocked, /pathname:\s*"\/support"[\s\S]*intent:\s*"checkout_review"/u,
    'La salida denegada debe abrir la solicitud de revisión guiada');
  assert.match(blocked, /return \{ success: false/u, 'La falta de GPS nunca confirma la salida');
  assert.doesNotMatch(blocked, /insertAttendanceLogWithRetry|enqueuePendingAttendanceEvent/u,
    'No insertar ni encolar salidas al fallar el guard territorial');
  const successPath = source.indexOf('await insertAttendanceLogWithRetry(payload)', location);
  assert.ok(successPath > location, 'Solo la verificación exitosa habilita guardar la salida');
});

test('GAP-PKG-004: revisión de salida prepara ticket editable sin confirmar asistencia', () => {
  const screen = fs.readFileSync(new URL('../../app/(app)/support.tsx', import.meta.url), 'utf8');
  assert.match(screen, /intent !== "checkout_review"/u);
  assert.match(screen, /checkoutReviewPreparedRef\.current = true/u,
    'La navegación no debe abrir múltiples formularios en el mismo montaje');
  assert.match(screen, /setTicketTitle\("Revisión de salida sin ubicación"\)/u);
  assert.match(screen, /setTicketMessage\(\[/u);
  assert.match(screen, /setIsTicketOpen\(true\)/u,
    'El trabajador confirma el envío desde el formulario');
  assert.match(screen, /no registra una salida ni cierra tu turno/u);
  assert.doesNotMatch(screen, /insertAttendanceLogWithRetry|enqueuePendingAttendanceEvent/u,
    'El formulario de Soporte nunca escribe asistencia');
});

test('GAP-PKG-004: ticket confirmado resiste fallo del chat sin inventar salida', () => {
  const source = fs.readFileSync(new URL('../../src/components/support/use-support-actions.ts', import.meta.url), 'utf8');
  const start = source.indexOf('  const submitTicket = useCallback');
  const end = source.indexOf('  const sendMessage = useCallback', start);
  assert.ok(start >= 0 && end > start);
  const submit = source.slice(start, end);
  assert.match(submit, /\.from\("support_tickets"\)/u);
  assert.match(submit, /let messageConfirmed = false/u);
  assert.match(submit, /Ticket created; initial chat message unconfirmed/u);
  assert.match(submit, /Promise\.allSettled/u,
    'Error de refresco no puede disfrazar un ticket ya persistido');
  assert.match(submit, /Revisa el ticket antes de intentar otro/u);
  assert.match(submit, /No se guardó ninguna salida/u);
  assert.doesNotMatch(submit, /\.from\("attendance_logs"\)/u);
});

test('GAP-PKG-004: geocerca fuera de sede bloquea insercion de entrada', async () => {
  const source = fs.readFileSync(new URL('../../src/hooks/use-attendance.ts', import.meta.url), 'utf8');
  const checkIn = source.indexOf('const checkIn = useCallback');
  const gateStart = source.indexOf('const geo = await ensureActionGeofenceReady({', checkIn);
  const blocked = source.indexOf('if (!geo.canProceed)', gateStart);
  const gateEnd = source.indexOf('if (!geo.siteId)', blocked);
  const insert = source.indexOf('await insertAttendanceLogWithRetry(payload)', gateStart);
  assert.ok(checkIn >= 0 && gateStart > checkIn && blocked > gateStart &&
    gateEnd > blocked && insert > gateEnd, 'La escritura debe quedar detras del bloqueo de geocerca');
  const gate = source.slice(gateStart, gateEnd);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const execute = new AsyncFunction('geoResult', 'setAttendanceDiagnostics', 'Haptics', 'insertAttendanceLogWithRetry',
    'let lastGeo = null; const geofenceStartedAt = Date.now();' +
    'const refreshGeofence=()=>{}; const canReuseRecentReadyGeofence=()=>{};' +
    'const ensureActionGeofenceReady=async()=>geoResult;\n' + gate +
    '\nawait insertAttendanceLogWithRetry({ testOnly: true }); return { success: true };');
  let writes = 0;
  const diagnostics = () => {};
  const haptics = { NotificationFeedbackType: { Error: 'error' }, notificationAsync: async () => {} };
  const insertMock = async () => { writes += 1; };
  const outside = await execute({ canProceed: false, status: 'outside',
    message: 'Fuera del radio autorizado', siteId: 'qa-site' }, diagnostics, haptics, insertMock);
  assert.equal(outside.success, false);
  assert.match(outside.error, /Fuera del radio/u);
  assert.equal(writes, 0, 'No escribir check-in cuando la geocerca rechaza');
  const unverified = await execute({ canProceed: false, status: 'checking',
    siteId: 'qa-site' }, diagnostics, haptics, insertMock);
  assert.equal(unverified.success, false);
  assert.equal(writes, 0, 'No escribir check-in con lectura GPS sin verificar');
});

test('GAP-PKG-004: CTA bloqueado revalida geocerca sin registrar asistencia', () => {
  const action = fs.readFileSync(
    new URL('../../src/components/home/AttendanceActionCard.tsx', import.meta.url), 'utf8');
  const home = fs.readFileSync(new URL('../../app/(app)/home.tsx', import.meta.url), 'utf8');

  assert.match(action, /isGeofenceBlocked && !canRegister && !isLoading && !isGeoChecking && !isCheckActionLocked/u,
    'Solo el bloqueo por geocerca libre de operaciones permite revalidar');
  assert.match(action, /const canPress = canRegister \|\| canRevalidateBlockedLocation/u);
  assert.match(action, /disabled=\{!canPress\}/u);
  assert.match(action,
    /onPress=\{canRevalidateBlockedLocation \? onRevalidateBlockedLocation : onCheck\}/u,
    'Revalidar ubicacion no puede ejecutar la mutacion de asistencia');
  assert.match(action, /backgroundColor: canPress \? PALETTE\.accent : RGBA\.ctaDisabled/u,
    'El CTA debe mostrarse activo cuando revalidar esta permitido');

  assert.match(home, /isGeofenceBlocked=\{attendanceUxState === "blocked"\}/u,
    'Solo el bloqueo confirmado del estado UX habilita la accion alternativa');
  const callback = home.match(/onRevalidateBlockedLocation=\{\(\) => \{([\s\S]*?)\}\}/u);
  assert.ok(callback, 'Home debe configurar un callback especifico para GPS');
  assert.match(callback[1], /refreshGeofence\(\{ force: true, source: "user" \}\)/u);
  assert.doesNotMatch(callback[1], /handleCheck|checkIn|checkOut|insertAttendance/u,
    'El CTA en modo bloqueado solo puede consultar GPS, nunca escribir asistencia');
});



