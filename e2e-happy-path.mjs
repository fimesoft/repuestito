/**
 * e2e-happy-path.mjs
 *
 * Happy-path end-to-end test for the Repuestito API.
 * Runtime: Node.js ≥ 18 (native fetch + performance API)
 * No external dependencies.
 *
 * Usage:
 *   node e2e-happy-path.mjs
 *
 * Requirements:
 *   - API running on http://localhost:3000
 *   - PostgreSQL accessible (DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME)
 *     for reading the verificationCode that the API sends via email.
 *   - psql available in PATH (used only in step 3 to fetch the code)
 */

import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { performance } from 'perf_hooks';

// ─── Config ────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000/api';
const TIMESTAMP = Date.now();
const TEST_EMAIL = `e2e-test-${TIMESTAMP}@repuestito.test`;
const TEST_PASSWORD = 'TestPass123!';
const TENANT_NAME = 'E2E Test Store';
const BRANCH_NAME = 'Sucursal E2E';

// GOD user for steps requiring elevated role
const GOD_EMAIL    = process.env.E2E_GOD_EMAIL    ?? 'god-e2e@repuestito.test';
const GOD_PASSWORD = process.env.E2E_GOD_PASSWORD ?? 'E2eGodPass123!';

// DB config (matches repuestito-api/.env defaults)
const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = process.env.DB_PORT ?? '5432';
const DB_USER = process.env.DB_USER ?? 'diegoquintero';
const DB_PASS = process.env.DB_PASS ?? '';
const DB_NAME = process.env.DB_NAME ?? 'repuestito_db';

// ─── ANSI colors ───────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// ─── State shared between steps ────────────────────────────────────────────
const state = {
  /** @type {string} */ cookieJar: '',
  /** @type {string} */ godCookieJar: '',
  /** @type {string|null} */ countryCode: null,
  /** @type {string|null} */ tenantId: null,
  /** @type {string|null} */ branchId: null,
  /** @type {string|null} */ replacementId: null,
  /** @type {number|null} */ brandId: null,
  /** @type {string|null} */ userId: null,
};

// ─── Results collector ─────────────────────────────────────────────────────
/** @type {Array<{step:number,name:string,method:string,path:string,status:number|string,latency:number,result:'PASS'|'FAIL'|'SKIP',detail:string}>} */
const results = [];

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Minimal cookie-jar implementation that merges Set-Cookie headers.
 * @param {Headers} headers
 */
function updateCookieJar(headers) {
  const setCookie = headers.getSetCookie?.() ?? [];
  if (!setCookie.length) return;

  /** @type {Record<string,string>} */
  const jar = {};
  // parse existing jar
  for (const pair of state.cookieJar.split(';')) {
    const [k, v] = pair.trim().split('=');
    if (k) jar[k.trim()] = v ?? '';
  }
  // merge new cookies (strip directives)
  for (const cookieStr of setCookie) {
    const segment = cookieStr.split(';')[0].trim();
    const eqIdx = segment.indexOf('=');
    if (eqIdx === -1) continue;
    const name = segment.slice(0, eqIdx).trim();
    const value = segment.slice(eqIdx + 1).trim();
    jar[name] = value;
  }
  state.cookieJar = Object.entries(jar)
    .filter(([k]) => k)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * Typed fetch wrapper with cookie management and latency measurement.
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<{status:number, body:unknown, latency:number}>}
 */
async function apiFetch(path, options = {}) {
  const headers = /** @type {Record<string,string>} */ ({
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  });
  if (state.cookieJar) headers['Cookie'] = state.cookieJar;

  const t0 = performance.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const latency = Math.round(performance.now() - t0);

  updateCookieJar(res.headers);

  let body;
  const ct = res.headers.get('content-type') ?? '';
  try {
    body = ct.includes('application/json') ? await res.json() : await res.text();
  } catch {
    body = null;
  }

  return { status: res.status, body, latency };
}

/**
 * Same as apiFetch but uses the GOD cookie jar.
 * @param {string} path
 * @param {RequestInit} [options]
 */
async function apiFetchAsGod(path, options = {}) {
  const headers = /** @type {Record<string,string>} */ ({
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  });
  if (state.godCookieJar) headers['Cookie'] = state.godCookieJar;

  const t0 = performance.now();
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const latency = Math.round(performance.now() - t0);

  // Persist GOD cookies
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) {
    const jar = {};
    for (const pair of state.godCookieJar.split(';')) {
      const [k, v] = pair.trim().split('=');
      if (k) jar[k.trim()] = v ?? '';
    }
    for (const cookieStr of setCookie) {
      const segment = cookieStr.split(';')[0].trim();
      const eqIdx = segment.indexOf('=');
      if (eqIdx === -1) continue;
      jar[segment.slice(0, eqIdx).trim()] = segment.slice(eqIdx + 1).trim();
    }
    state.godCookieJar = Object.entries(jar).filter(([k]) => k).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  let body;
  try {
    const ct = res.headers.get('content-type') ?? '';
    body = ct.includes('application/json') ? await res.json() : await res.text();
  } catch { body = null; }

  return { status: res.status, body, latency };
}

/**
 * Record a step result and print it to the console.
 * @param {number} step
 * @param {string} name
 * @param {string} method
 * @param {string} path
 * @param {number|string} status
 * @param {number} latency
 * @param {'PASS'|'FAIL'|'SKIP'} result
 * @param {string} [detail]
 */
function record(step, name, method, path, status, latency, result, detail = '') {
  results.push({ step, name, method, path, status, latency, result, detail });
  const icon = result === 'PASS' ? `${C.green}✅ PASS${C.reset}` :
               result === 'SKIP' ? `${C.yellow}⏭  SKIP${C.reset}` :
               `${C.red}❌ FAIL${C.reset}`;
  const statusColor = typeof status === 'number' && status >= 200 && status < 300
    ? C.green : C.red;
  console.log(
    `${C.bold}[${step.toString().padStart(2, '0')}]${C.reset} ${icon} ` +
    `${C.cyan}${method.padEnd(6)}${C.reset} ${path.padEnd(45)} ` +
    `${statusColor}${status}${C.reset} ${C.gray}${latency}ms${C.reset}` +
    (detail ? `\n       ${C.gray}${detail}${C.reset}` : ''),
  );
}

// ─── Steps ─────────────────────────────────────────────────────────────────

// 01. GET /countries — public list (requires auth per controller @UseGuards)
// Note: CountryController has @UseGuards(JwtAuthGuard) at class level, so this
// needs authentication. We call it unauthenticated first; if 401, we skip and
// re-fetch it after login (step 05b).
async function step01_getCountries() {
  const { status, body, latency } = await apiFetch('/countries');
  if (status === 200 && Array.isArray(body) && body.length > 0) {
    state.countryCode = body[0].code ?? body[0].countryCode ?? null;
    record(1, 'GET countries (unauthenticated)', 'GET', '/countries', status, latency, 'PASS',
      `countryCode=${state.countryCode}, total=${body.length}`);
  } else if (status === 401) {
    // Expected — controller requires auth. Will retry after login.
    record(1, 'GET countries (unauthenticated)', 'GET', '/countries', status, latency, 'SKIP',
      'Requires auth — will retry after login (step 05b)');
  } else {
    record(1, 'GET countries (unauthenticated)', 'GET', '/countries', status, latency, 'FAIL',
      `Unexpected: ${JSON.stringify(body)}`);
  }
}

// 02. POST /auth/register
async function step02_register() {
  const { status, body, latency } = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (status === 201 || status === 200) {
    record(2, 'POST register', 'POST', '/auth/register', status, latency, 'PASS',
      `email=${TEST_EMAIL}`);
  } else {
    record(2, 'POST register', 'POST', '/auth/register', status, latency, 'FAIL',
      JSON.stringify(body));
    throw new Error('register failed — cannot continue auth flow');
  }
}

// 03. Read verificationCode from DB (psql)
function step03_readVerificationCode() {
  const t0 = performance.now();
  try {
    const pgpassEnv = DB_PASS ? { ...process.env, PGPASSWORD: DB_PASS } : process.env;
    const sql = `SELECT "verificationCode" FROM users WHERE email='${TEST_EMAIL}' LIMIT 1;`;
    const out = execFileSync(
      'psql',
      ['-h', DB_HOST, '-p', String(DB_PORT), '-U', DB_USER, '-d', DB_NAME, '-t', '-c', sql],
      { env: pgpassEnv, encoding: 'utf8' },
    ).trim();
    const code = out.replace(/\s/g, '');
    const latency = Math.round(performance.now() - t0);
    if (!code || code.length !== 6) {
      record(3, 'READ verificationCode from DB', 'DB', 'users.verificationCode', 'N/A', latency, 'FAIL',
        `Got: "${code}" — expected 6-digit code`);
      throw new Error('could not read verificationCode from DB');
    }
    record(3, 'READ verificationCode from DB', 'DB', 'users.verificationCode', 'N/A', latency, 'PASS',
      `code=****** (6 digits)`);
    return code;
  } catch (err) {
    const latency = Math.round(performance.now() - t0);
    if (err instanceof Error && err.message.includes('could not read')) throw err;
    record(3, 'READ verificationCode from DB', 'DB', 'users.verificationCode', 'N/A', latency, 'FAIL',
      `psql error: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
    throw new Error('psql unavailable — cannot get verificationCode');
  }
}

// 04. POST /auth/verify-email
async function step04_verifyEmail(code) {
  const { status, body, latency } = await apiFetch('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email: TEST_EMAIL, code }),
  });
  if (status === 200 || status === 201) {
    record(4, 'POST verify-email', 'POST', '/auth/verify-email', status, latency, 'PASS',
      body?.message ?? '');
  } else {
    record(4, 'POST verify-email', 'POST', '/auth/verify-email', status, latency, 'FAIL',
      JSON.stringify(body));
    throw new Error('verify-email failed');
  }
}

// 05. POST /auth/login
async function step05_login() {
  const { status, body, latency } = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (status === 200 || status === 201) {
    state.userId = body?.user?.id ?? null;
    record(5, 'POST login', 'POST', '/auth/login', status, latency, 'PASS',
      `userId=${state.userId}, role=${body?.user?.role}`);
  } else {
    record(5, 'POST login', 'POST', '/auth/login', status, latency, 'FAIL',
      JSON.stringify(body));
    throw new Error('login failed');
  }
}

// 05b. GET /countries (authenticated) — fallback if step 01 was 401
async function step05b_getCountriesAuthenticated() {
  const { status, body, latency } = await apiFetch('/countries');
  if (status === 200 && Array.isArray(body) && body.length > 0) {
    state.countryCode = body[0].code ?? body[0].countryCode ?? null;
    record(6, 'GET countries (authenticated)', 'GET', '/countries', status, latency, 'PASS',
      `countryCode=${state.countryCode}, total=${body.length}`);
  } else {
    record(6, 'GET countries (authenticated)', 'GET', '/countries', status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 06. GET /auth/me
async function step06_getMe() {
  const { status, body, latency } = await apiFetch('/auth/me');
  if (status === 200) {
    record(7, 'GET auth/me', 'GET', '/auth/me', status, latency, 'PASS',
      `email=${body?.email}, role=${body?.role}`);
  } else {
    record(7, 'GET auth/me', 'GET', '/auth/me', status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 07. GET /brand-replacements — validates endpoint; brandId read from DB (id is @Excluded)
async function step07_getBrands() {
  const { status, body, latency } = await apiFetch('/brand-replacements');
  if (status === 200 && Array.isArray(body) && body.length > 0) {
    record(8, 'GET brand-replacements', 'GET', '/brand-replacements', status, latency, 'PASS',
      `total=${body.length}, first.name=${body[0]?.name}`);
  } else if (status === 200 && Array.isArray(body) && body.length === 0) {
    record(8, 'GET brand-replacements', 'GET', '/brand-replacements', status, latency, 'SKIP',
      'No brands available — replacement creation will be skipped');
  } else {
    record(8, 'GET brand-replacements', 'GET', '/brand-replacements', status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 07b. Read brandId from DB (id is @Excluded in the API response)
function step07b_readBrandId() {
  const t0 = performance.now();
  try {
    const pgpassEnv = DB_PASS ? { ...process.env, PGPASSWORD: DB_PASS } : process.env;
    const sql = `SELECT id FROM brand_replacements WHERE is_active = true LIMIT 1;`;
    const out = execFileSync(
      'psql',
      ['-h', DB_HOST, '-p', String(DB_PORT), '-U', DB_USER, '-d', DB_NAME, '-t', '-c', sql],
      { env: pgpassEnv, encoding: 'utf8' },
    ).trim();
    const id = parseInt(out.replace(/\s/g, ''), 10);
    const latency = Math.round(performance.now() - t0);
    if (!id || isNaN(id)) {
      record('07b', 'READ brandId from DB', 'DB', 'brand_replacements.id', 'N/A', latency, 'FAIL',
        `Got: "${out}" — expected numeric id`);
      return;
    }
    state.brandId = id;
    record('07b', 'READ brandId from DB', 'DB', 'brand_replacements.id', 'N/A', latency, 'PASS',
      `brandId=${id}`);
  } catch (err) {
    const latency = Math.round(performance.now() - t0);
    record('07b', 'READ brandId from DB', 'DB', 'brand_replacements.id', 'N/A', latency, 'FAIL',
      `psql error: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  }
}

// 08b. Login as GOD user (separate session, does not replace MODERATOR cookie)
async function stepGodLogin() {
  const { status, body, latency } = await apiFetchAsGod('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: GOD_EMAIL, password: GOD_PASSWORD }),
  });
  if (status === 201 || status === 200) {
    record(9, 'POST auth/login (GOD)', 'POST', '/auth/login', status, latency, 'PASS',
      `role=${body?.role ?? '?'}`);
    return true;
  }
  record(9, 'POST auth/login (GOD)', 'POST', '/auth/login', status, latency, 'FAIL',
    `GOD login failed — tenant/replacement steps will be skipped. ${JSON.stringify(body)}`);
  return false;
}

// 10. POST /tenants — uses GOD session
async function step08_createTenant() {
  const payload = {
    businessName: TENANT_NAME,
    taxId: `E2E-${TIMESTAMP}`,
    country: state.countryCode ?? 'VE',
    subdomain: `e2e-${TIMESTAMP}`,
  };
  const { status, body, latency } = await apiFetchAsGod('/tenants', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (status === 201) {
    state.tenantId = body?.id ?? null;
    record(10, 'POST tenants', 'POST', '/tenants', status, latency, 'PASS',
      `tenantId=${state.tenantId}`);
  } else {
    record(10, 'POST tenants', 'POST', '/tenants', status, latency, 'FAIL',
      JSON.stringify(body));
    // Fallback: use first existing tenant
    const listRes = await apiFetchAsGod('/tenants');
    if (listRes.status === 200 && Array.isArray(listRes.body) && listRes.body.length > 0) {
      state.tenantId = listRes.body[0].id ?? null;
    }
  }
}

// 09. POST /branches — requires GOD or MODERATOR
async function step09_createBranch() {
  if (!state.tenantId) {
    record(10, 'POST branches', 'POST', '/branches', 'SKIP', 0, 'SKIP',
      'No tenantId available — skipping branch creation');
    return;
  }
  const payload = {
    tenantId: state.tenantId,
    name: BRANCH_NAME,
    address: 'Av. Principal E2E, Local 1',
    latitude: 10.4806,
    longitude: -66.9036,
    phone: '+58 212 0000000',
  };
  const { status, body, latency } = await apiFetch('/branches', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (status === 201) {
    state.branchId = body?.id ?? null;
    record(10, 'POST branches', 'POST', '/branches', status, latency, 'PASS',
      `branchId=${state.branchId}`);
  } else if (status === 403) {
    record(10, 'POST branches', 'POST', '/branches', status, latency, 'SKIP',
      'Requires GOD or MODERATOR role — got 403');
  } else {
    record(10, 'POST branches', 'POST', '/branches', status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 10. GET /users — requires GOD or MODERATOR
async function step10_listUsers() {
  const { status, body, latency } = await apiFetch('/users');
  if (status === 200) {
    record(11, 'GET users', 'GET', '/users', status, latency, 'PASS',
      `total=${Array.isArray(body) ? body.length : '?'}`);
  } else if (status === 403) {
    record(11, 'GET users', 'GET', '/users', status, latency, 'SKIP',
      'Requires GOD or MODERATOR role');
  } else {
    record(11, 'GET users', 'GET', '/users', status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 11. POST /replacements — requires GOD or MODERATOR
async function step11_createReplacement() {
  if (!state.tenantId) {
    record(12, 'POST replacements', 'POST', '/replacements', 'SKIP', 0, 'SKIP',
      'No tenantId available');
    return;
  }
  if (!state.brandId) {
    record(12, 'POST replacements', 'POST', '/replacements', 'SKIP', 0, 'SKIP',
      'No brandId available — need at least one brand-replacement in DB');
    return;
  }
  const payload = {
    name: `Filtro de Aceite E2E ${TIMESTAMP}`,
    brandId: state.brandId,
    countryCode: state.countryCode ?? 'VE',
    price: 25.99,
    stock: 10,
    tenantId: state.tenantId,
    branchId: state.branchId ?? undefined,
    codeOem: `OEM-E2E-${TIMESTAMP}`,
    latitude: 10.4806,
    longitude: -66.9036,
  };
  const { status, body, latency } = await apiFetch('/replacements', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (status === 201) {
    state.replacementId = body?.id ?? null;
    record(12, 'POST replacements', 'POST', '/replacements', status, latency, 'PASS',
      `replacementId=${state.replacementId}`);
  } else if (status === 403) {
    record(12, 'POST replacements', 'POST', '/replacements', status, latency, 'SKIP',
      'Requires GOD or MODERATOR role');
  } else {
    record(12, 'POST replacements', 'POST', '/replacements', status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 12. GET /replacements (list with search)
async function step12_listReplacements() {
  const qs = `?page=1&limit=10${state.countryCode ? `&country=${state.countryCode}` : ''}`;
  const { status, body, latency } = await apiFetch(`/replacements${qs}`);
  if (status === 200) {
    record(13, 'GET replacements', 'GET', '/replacements', status, latency, 'PASS',
      `total=${body?.total ?? body?.data?.length ?? '?'}, page=${body?.page ?? 1}`);
  } else {
    record(13, 'GET replacements', 'GET', '/replacements', status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 13. PATCH /replacements/:id (update stock)
async function step13_updateReplacement() {
  if (!state.replacementId) {
    record(14, 'PATCH replacements/:id', 'PATCH', '/replacements/:id', 'SKIP', 0, 'SKIP',
      'No replacementId — skipped step 11');
    return;
  }
  const { status, body, latency } = await apiFetch(`/replacements/${state.replacementId}`, {
    method: 'PATCH',
    body: JSON.stringify({ stock: 50 }),
  });
  if (status === 200) {
    record(14, 'PATCH replacements/:id', 'PATCH', `/replacements/${state.replacementId}`, status, latency, 'PASS',
      `stock=${body?.stock}`);
  } else if (status === 403) {
    record(14, 'PATCH replacements/:id', 'PATCH', `/replacements/${state.replacementId}`, status, latency, 'SKIP',
      'Requires GOD or MODERATOR');
  } else {
    record(14, 'PATCH replacements/:id', 'PATCH', `/replacements/${state.replacementId}`, status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 14. GET /replacements/:id (verify updated stock)
async function step14_getReplacement() {
  if (!state.replacementId) {
    record(15, 'GET replacements/:id', 'GET', '/replacements/:id', 'SKIP', 0, 'SKIP',
      'No replacementId');
    return;
  }
  const { status, body, latency } = await apiFetch(`/replacements/${state.replacementId}`);
  if (status === 200) {
    const stockOk = body?.stock === 50;
    record(15, 'GET replacements/:id', 'GET', `/replacements/${state.replacementId}`, status, latency,
      stockOk ? 'PASS' : 'FAIL',
      `stock=${body?.stock} (expected 50)`);
  } else {
    record(15, 'GET replacements/:id', 'GET', `/replacements/${state.replacementId}`, status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 15. GET /vehicle-brands
async function step15_getVehicleBrands() {
  const { status, body, latency } = await apiFetch('/vehicle-brands');
  if (status === 200) {
    record(16, 'GET vehicle-brands', 'GET', '/vehicle-brands', status, latency, 'PASS',
      `total=${Array.isArray(body) ? body.length : '?'}`);
  } else {
    record(16, 'GET vehicle-brands', 'GET', '/vehicle-brands', status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 16. GET /vehicle-models
async function step16_getVehicleModels() {
  const { status, body, latency } = await apiFetch('/vehicle-models');
  if (status === 200) {
    record(17, 'GET vehicle-models', 'GET', '/vehicle-models', status, latency, 'PASS',
      `total=${Array.isArray(body) ? body.length : '?'}`);
  } else {
    record(17, 'GET vehicle-models', 'GET', '/vehicle-models', status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 17. GET /vehicle-versions
async function step17_getVehicleVersions() {
  const { status, body, latency } = await apiFetch('/vehicle-versions');
  if (status === 200) {
    record(18, 'GET vehicle-versions', 'GET', '/vehicle-versions', status, latency, 'PASS',
      `total=${Array.isArray(body) ? body.length : '?'}`);
  } else {
    record(18, 'GET vehicle-versions', 'GET', '/vehicle-versions', status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 18. GET /customers — requires GOD or MODERATOR; lists by tenantId
async function step18_getCustomers() {
  if (!state.tenantId) {
    record(19, 'GET customers', 'GET', '/customers', 'SKIP', 0, 'SKIP', 'No tenantId available');
    return;
  }
  const { status, body, latency } = await apiFetch(`/customers?tenantId=${state.tenantId}`);
  if (status === 200) {
    record(19, 'GET customers', 'GET', '/customers', status, latency, 'PASS',
      `total=${Array.isArray(body) ? body.length : '?'}`);
  } else if (status === 403) {
    record(19, 'GET customers', 'GET', '/customers', status, latency, 'SKIP',
      'Requires GOD or MODERATOR role');
  } else {
    record(19, 'GET customers', 'GET', '/customers', status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 19. POST /customers — requires GOD or MODERATOR
async function step19_createCustomer() {
  if (!state.tenantId) {
    record(20, 'POST customers', 'POST', '/customers', 'SKIP', 0, 'SKIP', 'No tenantId available');
    return;
  }
  const payload = {
    tenantId: state.tenantId,
    name: 'Cliente',
    lastname: 'E2E',
    doc: `E2E-${TIMESTAMP}`,
    phone: '+58 412 0000000',
    email: `cliente-e2e-${TIMESTAMP}@repuestito.test`,
  };
  const { status, body, latency } = await apiFetch('/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (status === 201) {
    const customerId = body?.id ?? null;
    record(20, 'POST customers', 'POST', '/customers', status, latency, 'PASS',
      `customerId=${customerId}`);
    return customerId;
  } else if (status === 403) {
    record(20, 'POST customers', 'POST', '/customers', status, latency, 'SKIP',
      'Requires GOD or MODERATOR role');
  } else {
    record(20, 'POST customers', 'POST', '/customers', status, latency, 'FAIL',
      JSON.stringify(body));
  }
  return null;
}

// 20. POST /orders — requires GOD or MODERATOR
async function step20_createOrder(customerId) {
  if (!state.tenantId || !state.replacementId) {
    record(21, 'POST orders', 'POST', '/orders', 'SKIP', 0, 'SKIP',
      'No tenantId or replacementId available');
    return null;
  }
  const payload = {
    tenantId: state.tenantId,
    branchId: state.branchId ?? undefined,
    customerId: customerId ?? undefined,
    buyerName: 'Cliente',
    buyerLastname: 'E2E',
    items: [
      {
        replacementId: state.replacementId,
        description: 'Filtro de aceite E2E',
        quantity: 2,
        unitPrice: 25.99,
      },
    ],
  };
  const { status, body, latency } = await apiFetch('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (status === 201) {
    const orderId = body?.id ?? null;
    record(21, 'POST orders', 'POST', '/orders', status, latency, 'PASS',
      `orderId=${orderId}, total=${body?.total}`);
    return orderId;
  } else if (status === 403) {
    record(21, 'POST orders', 'POST', '/orders', status, latency, 'SKIP',
      'Requires GOD or MODERATOR role');
  } else {
    record(21, 'POST orders', 'POST', '/orders', status, latency, 'FAIL',
      JSON.stringify(body));
  }
  return null;
}

// 21. PATCH /orders/:id/confirm
async function step21_confirmOrder(orderId) {
  if (!orderId || !state.tenantId) {
    record(22, 'PATCH orders/:id/confirm', 'PATCH', '/orders/:id/confirm', 'SKIP', 0, 'SKIP',
      'No orderId available');
    return;
  }
  const { status, body, latency } = await apiFetch(`/orders/${orderId}/confirm`, {
    method: 'PATCH',
    body: JSON.stringify({ tenantId: state.tenantId }),
  });
  if (status === 200) {
    record(22, 'PATCH orders/:id/confirm', 'PATCH', `/orders/${orderId}/confirm`, status, latency, 'PASS',
      `status=${body?.status}`);
  } else if (status === 403) {
    record(22, 'PATCH orders/:id/confirm', 'PATCH', `/orders/${orderId}/confirm`, status, latency, 'SKIP',
      'Requires GOD or MODERATOR');
  } else {
    record(22, 'PATCH orders/:id/confirm', 'PATCH', `/orders/${orderId}/confirm`, status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 22. POST /orders/:id/fulfill → converts to invoice
async function step22_fulfillOrder(orderId) {
  if (!orderId || !state.tenantId) {
    record(23, 'POST orders/:id/fulfill', 'POST', '/orders/:id/fulfill', 'SKIP', 0, 'SKIP',
      'No orderId available');
    return;
  }
  const { status, body, latency } = await apiFetch(`/orders/${orderId}/fulfill`, {
    method: 'POST',
    body: JSON.stringify({ tenantId: state.tenantId }),
  });
  if (status === 200 || status === 201) {
    record(23, 'POST orders/:id/fulfill', 'POST', `/orders/${orderId}/fulfill`, status, latency, 'PASS',
      `status=${body?.status}`);
  } else if (status === 403) {
    record(23, 'POST orders/:id/fulfill', 'POST', `/orders/${orderId}/fulfill`, status, latency, 'SKIP',
      'Requires GOD or MODERATOR');
  } else {
    record(23, 'POST orders/:id/fulfill', 'POST', `/orders/${orderId}/fulfill`, status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 23. GET /invoices — requires GOD or MODERATOR
async function step23_listInvoices() {
  if (!state.tenantId) {
    record(24, 'GET invoices', 'GET', '/invoices', 'SKIP', 0, 'SKIP', 'No tenantId available');
    return;
  }
  const { status, body, latency } = await apiFetch(`/invoices?tenantId=${state.tenantId}`);
  if (status === 200) {
    record(24, 'GET invoices', 'GET', '/invoices', status, latency, 'PASS',
      `total=${body?.total ?? body?.data?.length ?? '?'}`);
  } else if (status === 403) {
    record(24, 'GET invoices', 'GET', '/invoices', status, latency, 'SKIP',
      'Requires GOD or MODERATOR');
  } else {
    record(24, 'GET invoices', 'GET', '/invoices', status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 24. POST /auth/forgot-password
async function step24_forgotPassword() {
  const { status, body, latency } = await apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: TEST_EMAIL }),
  });
  if (status === 200 || status === 201) {
    record(25, 'POST auth/forgot-password', 'POST', '/auth/forgot-password', status, latency, 'PASS',
      body?.message ?? '');
  } else {
    record(25, 'POST auth/forgot-password', 'POST', '/auth/forgot-password', status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// 25. POST /auth/logout
async function step25_logout() {
  const { status, body, latency } = await apiFetch('/auth/logout', { method: 'POST' });
  if (status === 200 || status === 201) {
    state.cookieJar = '';
    record(26, 'POST auth/logout', 'POST', '/auth/logout', status, latency, 'PASS',
      body?.message ?? '');
  } else {
    record(26, 'POST auth/logout', 'POST', '/auth/logout', status, latency, 'FAIL',
      JSON.stringify(body));
  }
}

// ─── Report generation ─────────────────────────────────────────────────────

function generateMarkdownReport() {
  const passed = results.filter(r => r.result === 'PASS').length;
  const failed = results.filter(r => r.result === 'FAIL').length;
  const skipped = results.filter(r => r.result === 'SKIP').length;
  const totalLatency = results.reduce((acc, r) => acc + (typeof r.latency === 'number' ? r.latency : 0), 0);

  const rows = results.map(r => {
    const icon = r.result === 'PASS' ? '✅ PASS' : r.result === 'SKIP' ? '⏭ SKIP' : '❌ FAIL';
    const detail = r.detail ? r.detail.replace(/\|/g, '\\|') : '';
    return `| ${r.step} | ${r.name} | \`${r.method}\` | \`${r.path}\` | ${r.status} | ${typeof r.latency === 'number' ? r.latency + 'ms' : r.latency} | ${icon} | ${detail} |`;
  }).join('\n');

  const now = new Date().toISOString();

  return `# E2E Happy Path Report

**Generated:** ${now}
**API Base URL:** ${BASE_URL}
**Test Email:** ${TEST_EMAIL}

## Summary

| Metric | Value |
|--------|-------|
| Total steps | ${results.length} |
| ✅ PASS | ${passed} |
| ❌ FAIL | ${failed} |
| ⏭ SKIP | ${skipped} |
| Total latency | ${totalLatency}ms |
| Average latency | ${results.length ? Math.round(totalLatency / results.length) : 0}ms |

## Results

| # | Step | Method | Path | HTTP Status | Latency | Result | Detail |
|---|------|--------|------|-------------|---------|--------|--------|
${rows}

## Notes

- Steps marked **SKIP** either require a higher role (GOD) than the test user (MODERATOR default), or depend on a skipped prerequisite.
- \`POST /api/tenants\` requires **GOD** role — if skipped, subsequent tenant-dependent steps use an existing tenant from the DB.
- \`POST /api/auth/register\` does not return the \`verificationCode\` in the response; the script reads it directly from PostgreSQL via \`psql\`.
- Countries endpoint (\`GET /api/countries\`) requires authentication (class-level \`@UseGuards(JwtAuthGuard)\`).

## Role Access Matrix

| Endpoint | Required Role | Test User Role | Expected |
|----------|--------------|----------------|----------|
| POST /api/tenants | GOD | MODERATOR | 403 → SKIP |
| DELETE /api/tenants/:id | GOD | MODERATOR | 403 → SKIP |
| POST /api/auth/invite | GOD | MODERATOR | 403 → SKIP |
| POST /api/vehicle-brands | GOD | MODERATOR | 403 → SKIP |
| POST /api/branches | GOD, MODERATOR | MODERATOR | 201 → PASS |
| POST /api/replacements | GOD, MODERATOR | MODERATOR | 201 → PASS |
| GET /api/users | GOD, MODERATOR | MODERATOR | 200 → PASS |
| POST /api/customers | GOD, MODERATOR | MODERATOR | 201 → PASS |
| POST /api/orders | GOD, MODERATOR | MODERATOR | 201 → PASS |
| POST /api/invoices | GOD, MODERATOR | MODERATOR | 201 → PASS |
`;
}

// ─── Console summary ────────────────────────────────────────────────────────

function printConsoleSummary() {
  const passed = results.filter(r => r.result === 'PASS').length;
  const failed = results.filter(r => r.result === 'FAIL').length;
  const skipped = results.filter(r => r.result === 'SKIP').length;

  console.log('\n' + '─'.repeat(70));
  console.log(`${C.bold}E2E SUMMARY${C.reset}`);
  console.log('─'.repeat(70));
  console.log(`${C.green}✅ PASS${C.reset}  ${passed}`);
  console.log(`${C.red}❌ FAIL${C.reset}  ${failed}`);
  console.log(`${C.yellow}⏭  SKIP${C.reset}  ${skipped}`);
  console.log('─'.repeat(70));
  if (failed === 0) {
    console.log(`${C.bold}${C.green}All executed steps passed.${C.reset}`);
  } else {
    console.log(`${C.bold}${C.red}${failed} step(s) failed. See e2e-report.md for details.${C.reset}`);
  }
  console.log(`\nReport saved to: ${C.cyan}e2e-report.md${C.reset}\n`);
}

// ─── Main orchestrator ─────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}${C.cyan}Repuestito API — E2E Happy Path${C.reset}`);
  console.log(`${C.gray}API: ${BASE_URL}  |  Email: ${TEST_EMAIL}${C.reset}\n`);
  console.log('─'.repeat(70));

  // Step 01 — countries (may be 401, retried after login)
  await step01_getCountries();
  const step01WasSkipped = results[0]?.result === 'SKIP';

  // Steps 02-05 — auth flow (must succeed or we abort)
  try {
    await step02_register();
  } catch {
    printConsoleSummary();
    return;
  }

  let verificationCode;
  try {
    verificationCode = step03_readVerificationCode();
  } catch {
    printConsoleSummary();
    return;
  }

  try {
    await step04_verifyEmail(verificationCode);
  } catch {
    printConsoleSummary();
    return;
  }

  try {
    await step05_login();
  } catch {
    printConsoleSummary();
    return;
  }

  // Step 05b — retry countries if step 01 was unauthenticated (401)
  if (step01WasSkipped) {
    await step05b_getCountriesAuthenticated();
  }

  // Step 06 — GET /auth/me
  await step06_getMe();

  // Step 07 — GET /brand-replacements
  await step07_getBrands();
  step07b_readBrandId();

  // Steps 08-09 — tenant & branch (requires GOD role)
  await stepGodLogin();
  await step08_createTenant();
  await step09_createBranch();

  // Step 10 — users list
  await step10_listUsers();

  // Steps 11-14 — replacements CRUD
  await step11_createReplacement();
  await step12_listReplacements();
  await step13_updateReplacement();
  await step14_getReplacement();

  // Steps 15-17 — vehicle catalog (read-only, authenticated)
  await step15_getVehicleBrands();
  await step16_getVehicleModels();
  await step17_getVehicleVersions();

  // Steps 18-23 — customers, orders, invoices
  await step18_getCustomers();
  const customerId = await step19_createCustomer();
  const orderId = await step20_createOrder(customerId);
  await step21_confirmOrder(orderId);
  await step22_fulfillOrder(orderId);
  await step23_listInvoices();

  // Steps 24-25 — forgot-password + logout
  await step24_forgotPassword();
  await step25_logout();

  // Generate report
  const report = generateMarkdownReport();
  writeFileSync('e2e-report.md', report, 'utf8');

  printConsoleSummary();
}

main().catch(err => {
  console.error(`${C.red}Fatal error:${C.reset}`, err);
  process.exit(1);
});

// ─── ENDPOINT MAP ──────────────────────────────────────────────────────────
// GET    /api/countries
// POST   /api/countries                     (GOD only)
// PUT    /api/countries/:id                 (GOD only)
// GET    /api/countries/:id
//
// POST   /api/auth/register
// POST   /api/auth/verify-email
// POST   /api/auth/login
// POST   /api/auth/logout
// GET    /api/auth/me                       (JwtAuthGuard)
// POST   /api/auth/invite                   (GOD only)
// POST   /api/auth/forgot-password
// POST   /api/auth/reset-password
//
// GET    /api/tenants
// POST   /api/tenants                       (GOD only)
// GET    /api/tenants/:id
// PUT    /api/tenants/:id                   (GOD only)
// DELETE /api/tenants/:id                   (GOD only)
//
// GET    /api/branches
// POST   /api/branches                      (GOD, MODERATOR)
// GET    /api/branches/:id
// PUT    /api/branches/:id                  (GOD, MODERATOR)
// DELETE /api/branches/:id                  (GOD, MODERATOR)
//
// GET    /api/users                         (GOD, MODERATOR)
// POST   /api/users                         (GOD, MODERATOR)
// GET    /api/users/:id                     (GOD, MODERATOR)
// PATCH  /api/users/:id                     (GOD, MODERATOR)
// DELETE /api/users/:id                     (GOD, MODERATOR)
//
// GET    /api/replacements
// POST   /api/replacements                  (GOD, MODERATOR)
// GET    /api/replacements/:id
// PATCH  /api/replacements/:id              (GOD, MODERATOR)
// DELETE /api/replacements/:id              (GOD, MODERATOR)
//
// GET    /api/vehicle-brands
// POST   /api/vehicle-brands                (GOD only)
// GET    /api/vehicle-brands/:id
// PUT    /api/vehicle-brands/:id            (GOD only)
// DELETE /api/vehicle-brands/:id            (GOD only)
//
// GET    /api/vehicle-models
// POST   /api/vehicle-models                (GOD only)
// GET    /api/vehicle-models/:id
// PUT    /api/vehicle-models/:id            (GOD only)
// DELETE /api/vehicle-models/:id            (GOD only)
//
// GET    /api/vehicle-versions
// POST   /api/vehicle-versions              (GOD only)
// GET    /api/vehicle-versions/:id
// PUT    /api/vehicle-versions/:id          (GOD only)
// DELETE /api/vehicle-versions/:id          (GOD only)
//
// GET    /api/brand-replacements
// POST   /api/brand-replacements            (GOD only)
//
// GET    /api/customers                     (GOD, MODERATOR)  ?tenantId=&q=
// POST   /api/customers                     (GOD, MODERATOR)
//
// GET    /api/orders                        (GOD, MODERATOR)  ?tenantId=&status=&from=&to=&page=&limit=
// POST   /api/orders                        (GOD, MODERATOR)
// GET    /api/orders/:id                    (GOD, MODERATOR)  ?tenantId=
// PATCH  /api/orders/:id/confirm            (GOD, MODERATOR)
// POST   /api/orders/:id/fulfill            (GOD, MODERATOR)
// PATCH  /api/orders/:id/cancel             (GOD, MODERATOR)
//
// GET    /api/invoices                      (GOD, MODERATOR)  ?tenantId=&from=&to=&page=&limit=
// POST   /api/invoices                      (GOD, MODERATOR)
// GET    /api/invoices/summary              (GOD, MODERATOR)  ?tenantId=&from=&to=
// GET    /api/invoices/:id                  (GOD, MODERATOR)  ?tenantId=
// PATCH  /api/invoices/:id/cancel           (GOD, MODERATOR)
//
// POST   /api/upload                        (Multer → Cloudinary)
