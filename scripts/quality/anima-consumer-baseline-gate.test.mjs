import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

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