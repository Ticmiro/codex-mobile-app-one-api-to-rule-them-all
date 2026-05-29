const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');

const PORT = Number(process.env.TICMIRO_PORT || process.env.PORT || 4899);
const HOST = process.env.TICMIRO_HOST || '0.0.0.0';
const PUBLIC_BASE_URL = String(process.env.TICMIRO_PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`).replace(/\/+$/, '');
const DATA_DIR = process.env.TICMIRO_DATA_DIR || path.join(__dirname, '..', '..', '..', 'runtime', 'server');
const STATE_PATH = path.join(DATA_DIR, 'state.json');
const PROVIDERS_PATH = path.join(DATA_DIR, 'providers.json');
const AUTH_DIR = process.env.TICMIRO_AUTH_DIR || path.join(DATA_DIR, 'auth');
const MOBILE_TOKEN = String(process.env.TICMIRO_MOBILE_TOKEN || '').trim();
const AGENT_TOKEN = String(process.env.TICMIRO_AGENT_TOKEN || MOBILE_TOKEN).trim();
const ADMIN_TOKEN = String(process.env.TICMIRO_ADMIN_TOKEN || '').trim();
const PROXY_KEYS = new Set(splitList(process.env.TICMIRO_PROXY_API_KEYS));
const MAX_BODY_BYTES = Number(process.env.TICMIRO_MAX_BODY_BYTES || 16 * 1024 * 1024);
const TOKEN_REFRESH_SKEW_MS = Number(process.env.TICMIRO_TOKEN_REFRESH_SKEW_SECONDS || 180) * 1000;
const PROXY_KEY_DAILY_REQUEST_LIMIT = Number(process.env.TICMIRO_PROXY_KEY_DAILY_REQUEST_LIMIT || 0);
const PROXY_KEY_DAILY_TOKEN_LIMIT = Number(process.env.TICMIRO_PROXY_KEY_DAILY_TOKEN_LIMIT || 0);
const STATIC_DIR = path.join(__dirname, '..', '..', 'mobile-web', 'public');
const CODEX_BACKEND_BASE_URL = 'https://chatgpt.com/backend-api/codex';
const CODEX_CLI_ORIGINATOR = 'codex_cli_rs';
const CODEX_CLI_USER_AGENT = process.env.TICMIRO_CODEX_USER_AGENT || 'codex_cli_rs/0.133.0 (Windows 11; x86_64) vscode/1.111.0';

function splitList(value) {
  return String(value || '')
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
}

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function state() {
  return {
    agents: {},
    snapshot: {},
    commands: [],
    events: [],
    oauth: {},
    oauthStatus: {},
    ...readJson(STATE_PATH, {}),
  };
}

function saveState(next) {
  next.events = (next.events || []).slice(-120);
  next.commands = (next.commands || []).slice(-400);
  next.oauthStatus = pruneObjectByTimestamp(next.oauthStatus || {}, 120, 'updatedAt');
  writeJson(STATE_PATH, next);
}

function pruneObjectByTimestamp(object, limit, timestampKey) {
  const entries = Object.entries(object || {});
  if (entries.length <= limit) return object || {};
  return Object.fromEntries(entries
    .sort(([, left], [, right]) => Date.parse(right?.[timestampKey] || right?.createdAt || 0) - Date.parse(left?.[timestampKey] || left?.createdAt || 0))
    .slice(0, limit));
}

function providersConfig() {
  if (process.env.TICMIRO_PROVIDER_CONFIG_JSON) {
    return normalizeProviders(JSON.parse(process.env.TICMIRO_PROVIDER_CONFIG_JSON));
  }
  return normalizeProviders(readJson(PROVIDERS_PATH, { providers: [], routes: {} }));
}

function saveProviders(config) {
  writeJson(PROVIDERS_PATH, normalizeProviders(config));
}

function normalizeProviders(config) {
  const providers = Array.isArray(config.providers) ? config.providers : [];
  const accounts = Array.isArray(config.accounts) ? config.accounts : [];
  return {
    providers: providers.map(normalizeProvider).filter((provider) => provider.id && provider.baseUrl),
    accounts: accounts.map(normalizeAccount).filter((account) => account.id && account.providerId),
    routes: config.routes && typeof config.routes === 'object' ? config.routes : {},
  };
}

function normalizeProvider(provider) {
  return {
    id: String(provider.id || '').trim(),
    label: String(provider.label || provider.id || '').trim(),
    type: String(provider.type || 'openai-compatible').trim(),
    baseUrl: String(provider.baseUrl || provider.base_url || '').replace(/\/+$/, ''),
    apiKey: String(provider.apiKey || provider.api_key || '').trim(),
    apiKeyEnv: String(provider.apiKeyEnv || provider.api_key_env || '').trim(),
    accountId: String(provider.accountId || provider.account_id || '').trim(),
    priority: Number(provider.priority || 100),
    models: Array.isArray(provider.models) ? provider.models : [],
    headers: provider.headers && typeof provider.headers === 'object' ? provider.headers : {},
    routing: provider.routing && typeof provider.routing === 'object' ? provider.routing : {},
    oauth: normalizeOAuth(provider.oauth),
  };
}

function normalizeOAuth(oauth) {
  if (!oauth || typeof oauth !== 'object') return null;
  return {
    adapter: String(oauth.adapter || oauth.accountFlow || oauth.account_flow || 'generic-oauth-pkce').trim(),
    authorizationUrl: String(oauth.authorizationUrl || oauth.authorization_url || '').trim(),
    tokenUrl: String(oauth.tokenUrl || oauth.token_url || '').trim(),
    profileUrl: String(oauth.profileUrl || oauth.profile_url || '').trim(),
    callbackUrl: String(oauth.callbackUrl || oauth.callback_url || oauth.redirectUri || oauth.redirect_uri || '').trim(),
    clientId: String(oauth.clientId || oauth.client_id || '').trim(),
    clientSecret: String(oauth.clientSecret || oauth.client_secret || '').trim(),
    tokenAuth: String(oauth.tokenAuth || oauth.token_auth || '').trim(),
    scopes: normalizeStringList(oauth.scopes || oauth.scope),
    scopeParam: String(oauth.scopeParam || oauth.scope_param || 'scope').trim(),
    scopeSeparator: String(oauth.scopeSeparator || oauth.scope_separator || ' ').trim(),
    authorizationParams: objectOrEmpty(oauth.authorizationParams || oauth.authorization_params),
    tokenParams: objectOrEmpty(oauth.tokenParams || oauth.token_params),
    headers: objectOrEmpty(oauth.headers),
    profileHeaders: objectOrEmpty(oauth.profileHeaders || oauth.profile_headers),
    profileFieldMap: objectOrEmpty(oauth.profileFieldMap || oauth.profile_field_map),
    accountModels: normalizeStringList(oauth.accountModels || oauth.account_models),
  };
}

function normalizeAccount(account) {
  const providerId = String(account.providerId || account.provider_id || account.provider || '').trim();
  const idToken = String(account.idToken || account.id_token || account.tokenPayload?.id_token || account.token_payload?.id_token || '').trim();
  const tokenPayload = objectOrEmpty(account.tokenPayload || account.token_payload);
  const providerSpecificData = objectOrEmpty(account.providerSpecificData || account.provider_specific_data);
  const profile = enrichProfileFromTokenPayload(objectOrEmpty(account.profile), {
    ...tokenPayload,
    id_token: idToken,
    access_token: account.accessToken || account.access_token || tokenPayload.access_token,
    user: tokenPayload.user || account.user,
    account: tokenPayload.account || account.account,
    providerSpecificData,
  });
  const email = accountEmail({ ...account, profile, providerSpecificData });
  const readableLabel = readableAccountLabel(account.label || account.name);
  return {
    id: String(account.id || account.accountId || account.account_id || '').trim(),
    providerId,
    label: firstString(email, readableLabel, profile.name, account.id),
    type: String(account.type || account.accountType || account.account_type || 'oauth').trim(),
    status: String(account.status || (account.disabled ? 'disabled' : 'active')).trim(),
    priority: Number(account.priority || 100),
    accessToken: String(account.accessToken || account.access_token || account.apiKey || account.api_key || '').trim(),
    apiKeyEnv: String(account.apiKeyEnv || account.api_key_env || '').trim(),
    refreshToken: String(account.refreshToken || account.refresh_token || '').trim(),
    idToken,
    expiresAt: String(account.expiresAt || account.expires_at || '').trim(),
    scopes: normalizeStringList(account.scopes || account.scope),
    models: normalizeStringList(account.models || account.modelAllowlist || account.model_allowlist),
    modelRoutes: objectOrEmpty(account.modelRoutes || account.model_routes || account.routes),
    quota: normalizeQuota(account.quota || account.limits),
    profile,
    providerSpecificData,
    error: String(account.error || '').trim(),
    createdAt: String(account.createdAt || account.created_at || '').trim(),
    updatedAt: String(account.updatedAt || account.updated_at || '').trim(),
    lastRefreshAt: String(account.lastRefreshAt || account.last_refresh_at || '').trim(),
  };
}

function normalizeStringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return splitList(value);
}

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function emailFromText(value) {
  const source = String(value || '').trim();
  const variants = [
    source,
    source.replace(/\.json$/i, ''),
    source.replace(/[-_.](plus|free|pro|team|enterprise)(?:\.json)?$/i, ''),
  ];
  for (const variant of variants) {
    const match = variant.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (!match) continue;
    const [localPart, ...domainParts] = match[0]
      .replace(/\.json$/i, '')
      .replace(/[-_.](plus|free|pro|team|enterprise)$/i, '')
      .split('@');
    const local = localPart.replace(/^(codex|openai|claude|anthropic|gemini|kimi|antigravity)[-_]/i, '');
    const domain = domainParts.join('@');
    if (local && domain) return `${local}@${domain}`;
  }
  return '';
}

function decodeBase64UrlJson(value) {
  const textValue = String(value || '').trim();
  if (!textValue) return {};
  try {
    const padded = textValue.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(textValue.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

function jwtPayload(tokenValue) {
  const parts = String(tokenValue || '').trim().split('.');
  if (parts.length < 2) return {};
  return decodeBase64UrlJson(parts[1]);
}

function profileFromIdToken(idToken) {
  const claims = jwtPayload(idToken);
  if (!claims || typeof claims !== 'object') return {};
  const authInfo = claims['https://api.openai.com/auth'] || claims.codex_auth_info || {};
  return {
    id: firstString(claims.sub, authInfo.chatgpt_account_id),
    sub: firstString(claims.sub),
    email: firstString(claims.email, authInfo.email),
    name: firstString(claims.name, claims.given_name),
    accountId: firstString(authInfo.chatgpt_account_id, authInfo.account_id),
    planType: firstString(authInfo.chatgpt_plan_type, authInfo.plan_type),
  };
}

function enrichProfileFromTokenPayload(profile, tokenPayload = {}) {
  const idToken = tokenPayload.id_token || tokenPayload.idToken;
  const accessToken = tokenPayload.access_token || tokenPayload.accessToken;
  const baseProfile = objectOrEmpty(profile);
  const jwtProfile = {
    ...profileFromIdToken(idToken),
    ...profileFromIdToken(accessToken),
  };
  const sourceUser = objectOrEmpty(tokenPayload.user);
  const sourceAccount = objectOrEmpty(tokenPayload.account);
  const providerSpecificData = objectOrEmpty(tokenPayload.providerSpecificData || tokenPayload.provider_specific_data);
  return {
    ...baseProfile,
    ...jwtProfile,
    id: firstString(baseProfile.id, sourceUser.id, sourceAccount.id, jwtProfile.id),
    sub: firstString(baseProfile.sub, sourceUser.id, jwtProfile.sub),
    email: firstString(baseProfile.email, sourceUser.email, sourceAccount.email, providerSpecificData.email, providerSpecificData.chatgptEmail, tokenPayload.email, jwtProfile.email, emailFromText(baseProfile.label), emailFromText(tokenPayload.label)),
    name: firstString(baseProfile.name, sourceUser.name, sourceAccount.name, tokenPayload.name, jwtProfile.name),
    accountId: firstString(baseProfile.accountId, sourceAccount.id, providerSpecificData.chatgptAccountId, providerSpecificData.chatgpt_account_id, tokenPayload.accountId, tokenPayload.account_id, jwtProfile.accountId),
    planType: firstString(baseProfile.planType, sourceAccount.planType, sourceAccount.plan_type, providerSpecificData.chatgptPlanType, providerSpecificData.chatgpt_plan_type, tokenPayload.planType, tokenPayload.plan_type, jwtProfile.planType),
  };
}

function isTechnicalAccountLabel(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  if (text.includes('@')) return false;
  if (/^(acct|auth|oauth|token|session)[-_][a-z0-9._-]{8,}$/i.test(text)) return true;
  if (/^[a-f0-9]{16,}(?:\.json)?$/i.test(text)) return true;
  if (/^[a-z0-9_-]{24,}(?:\.json)?$/i.test(text)) return true;
  return false;
}

function readableAccountLabel(value) {
  const text = String(value || '').trim();
  return isTechnicalAccountLabel(text) ? '' : text;
}

function emailFromObject(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const email = firstString(
      source.email,
      source.mail,
      source.userEmail,
      source.user_email,
      source.accountEmail,
      source.account_email,
      source.chatgptEmail,
      source.chatgpt_email,
      source.user?.email,
      source.profile?.email,
      source.account?.email,
      source.providerSpecificData?.email,
      source.providerSpecificData?.chatgptEmail,
      source.provider_specific_data?.email,
      source.provider_specific_data?.chatgpt_email,
      findDeepValue(source, ['email', 'mail', 'userEmail', 'accountEmail', 'chatgptEmail']),
    );
    const parsed = emailFromText(email);
    if (parsed) return parsed;
  }
  return '';
}

function accountIdFromObject(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const value = firstString(
      source.accountId,
      source.account_id,
      source.chatgptAccountId,
      source.chatgpt_account_id,
      source.id,
      source.account?.id,
      source.user?.accountId,
      source.user?.account_id,
      source.providerSpecificData?.chatgptAccountId,
      source.providerSpecificData?.chatgpt_account_id,
      source.provider_specific_data?.chatgptAccountId,
      source.provider_specific_data?.chatgpt_account_id,
      findDeepValue(source, ['chatgptAccountId', 'chatgpt_account_id', 'accountId', 'account_id']),
    );
    if (value) return value;
  }
  return '';
}

function accountLookupKeys(account = {}) {
  account = account && typeof account === 'object' ? account : {};
  return [
    account.id,
    account.accountId,
    account.account_id,
    account.profile?.accountId,
    account.profile?.account_id,
    account.providerSpecificData?.chatgptAccountId,
    account.providerSpecificData?.chatgpt_account_id,
    account.provider_specific_data?.chatgptAccountId,
    account.provider_specific_data?.chatgpt_account_id,
    accountIdFromObject(account.providerSpecificData, account.provider_specific_data, account.profile, account),
    accountEmail(account),
  ].map((value) => String(value || '').trim()).filter(Boolean);
}

function accountEmail(account = {}, row = {}) {
  account = account && typeof account === 'object' ? account : {};
  row = row && typeof row === 'object' ? row : {};
  return firstString(
    emailFromObject(account.profile, account.providerSpecificData, account.provider_specific_data, account, row),
    emailFromText(row.accountEmail),
    emailFromText(row.account_email),
    emailFromText(row.email),
    emailFromText(row.displayName),
    emailFromText(row.label),
    emailFromText(row.account),
    emailFromText(row.name),
    emailFromText(account.profile?.name),
    emailFromText(account.profile?.label),
    emailFromText(account.accountEmail),
    emailFromText(account.account_email),
    emailFromText(account.label),
    emailFromText(account.name),
    emailFromText(account.id),
  );
}

function accountDisplayName(account = {}, row = {}) {
  account = account && typeof account === 'object' ? account : {};
  row = row && typeof row === 'object' ? row : {};
  const email = accountEmail(account, row);
  return firstString(
    email,
    readableAccountLabel(row.displayName),
    readableAccountLabel(row.label),
    readableAccountLabel(row.account),
    readableAccountLabel(account.label),
    readableAccountLabel(account.name),
    account.profile?.name,
    row.name,
    account.id,
  );
}

function normalizeQuota(value) {
  if (!value || typeof value !== 'object') return {};
  return {
    requestsPerDay: Number(value.requestsPerDay || value.requests_per_day || 0),
    tokensPerDay: Number(value.tokensPerDay || value.tokens_per_day || 0),
  };
}

function json(res, status, payload, headers = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function text(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store' });
  res.end(body);
}

function token(req) {
  const auth = String(req.headers.authorization || '');
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  return String(req.headers['x-control-token'] || req.headers['x-api-key'] || '').trim();
}

function requireToken(req, res, expected, label) {
  if (!expected) {
    json(res, 503, { ok: false, error: `${label} token is not configured.` });
    return false;
  }
  if (token(req) === expected) return true;
  json(res, 401, { ok: false, error: 'Unauthorized.' });
  return false;
}

function requireProxyKey(req, res) {
  const keys = configuredProxyKeys();
  if (!keys.length) {
    json(res, 503, { error: { message: 'Proxy API keys are not configured.', type: 'configuration_error' } });
    return false;
  }
  if (keys.includes(token(req))) return true;
  json(res, 401, { error: { message: 'Invalid or missing API key.', type: 'invalid_request_error' } });
  return false;
}

function suppliedControlToken(req, url) {
  return token(req) || String(url?.searchParams?.get('token') || url?.searchParams?.get('access_token') || '').trim();
}

function requireMobileOrAdminToken(req, res, url, headers = {}) {
  const supplied = suppliedControlToken(req, url);
  const expected = [MOBILE_TOKEN, ADMIN_TOKEN].filter(Boolean);
  if (!expected.length) {
    json(res, 503, { ok: false, error: 'Mobile/Admin token is not configured.' }, headers);
    return false;
  }
  if (expected.includes(supplied)) return true;
  json(res, 401, { ok: false, error: 'Unauthorized.' }, headers);
  return false;
}

function body(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error(`Body too large. Max ${MAX_BODY_BYTES} bytes.`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function jsonBody(req) {
  const raw = await body(req);
  if (!raw.length) return {};
  return JSON.parse(raw.toString('utf8'));
}

function httpError(status, message, type = 'invalid_request_error') {
  const error = new Error(message);
  error.status = status;
  error.type = type;
  return error;
}

function publicProvider(provider, config) {
  const accounts = providerAccounts(config, provider);
  const readiness = oauthReadiness(provider);
  return {
    id: provider.id,
    label: provider.label,
    type: provider.type,
    baseUrl: provider.baseUrl,
    modelCount: provider.models.length,
    accountCount: accounts.length,
    activeAccountCount: accounts.filter((account) => isAccountActive(account) && accountHasUsableCredential(account)).length,
    keyConfigured: Boolean(providerApiKey(provider) || accounts.some(accountToken)),
    oauthConfigured: readiness.ready,
    oauthAdapter: provider.oauth?.adapter || '',
    oauthMissing: readiness.missing,
    platform: provider.routing?.platform || '',
  };
}

function adminProvider(provider, config = {}) {
  const accounts = providerAccounts(config, provider);
  return {
    id: provider.id,
    label: provider.label,
    type: provider.type,
    baseUrl: provider.baseUrl,
    modelCount: provider.models.length,
    accountCount: accounts.length,
    activeAccountCount: accounts.filter((account) => isAccountActive(account) && accountHasUsableCredential(account)).length,
    keyConfigured: Boolean(providerApiKey(provider) || accounts.some(accountToken)),
    apiKeyEnv: provider.apiKeyEnv,
    apiKeyConfigured: Boolean(providerApiKey(provider)),
    accountId: provider.accountId,
    priority: provider.priority,
    models: provider.models,
    headers: provider.headers,
    routing: provider.routing,
    platform: provider.routing?.platform || '',
    oauthReadiness: oauthReadiness(provider),
    oauth: provider.oauth ? {
      ...provider.oauth,
      clientSecret: '',
      clientSecretConfigured: Boolean(provider.oauth.clientSecret),
    } : null,
  };
}

function oauthReadiness(provider) {
  if (!provider?.oauth) return { ready: false, missing: ['Enable OAuth / PKCE'], adapter: '' };
  const checks = [
    ['Authorization URL', provider.oauth.authorizationUrl],
    ['Token URL', provider.oauth.tokenUrl],
    ['Client ID', provider.oauth.clientId],
  ];
  const missing = checks.filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
  return { ready: missing.length === 0, missing, adapter: provider.oauth.adapter || 'generic-oauth-pkce' };
}

function publicOAuthStatus(status = {}) {
  return {
    state: status.state || '',
    providerId: status.providerId || '',
    platform: status.platform || '',
    status: status.status || 'unknown',
    accountId: status.accountId || '',
    accountLabel: status.accountLabel || '',
    authFile: status.authFile || '',
    error: status.error || '',
    authUrlConfigured: Boolean(status.authUrl),
    callbackUrl: status.callbackUrl || '',
    createdAt: status.createdAt || '',
    updatedAt: status.updatedAt || '',
  };
}

function publicOAuthStatuses(statuses = {}) {
  return Object.fromEntries(Object.entries(statuses || {}).map(([key, value]) => [key, publicOAuthStatus(value)]));
}

function publicAccount(account, usage = null) {
  const email = accountEmail(account);
  const displayName = accountDisplayName(account);
  return {
    id: account.id,
    providerId: account.providerId,
    label: account.label,
    displayName,
    email,
    accountEmail: email,
    type: account.type,
    status: account.status,
    priority: account.priority,
    tokenConfigured: Boolean(accountToken(account)),
    tokenUsable: accountHasUsableCredential(account),
    routeEligible: accountCanRouteModel(account),
    refreshConfigured: Boolean(account.refreshToken),
    authMethod: accountAuthMethod(account),
    expiresAt: account.expiresAt,
    models: account.models,
    quota: account.quota,
    usage: usage ? publicUsageBucket(usage) : undefined,
    profile: sanitizeProfile(account.profile),
    providerSpecificData: sanitizeProviderSpecificData(account.providerSpecificData),
    error: account.error,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    lastRefreshAt: account.lastRefreshAt,
  };
}

function adminAccount(account, usage = null) {
  return {
    ...publicAccount(account, usage),
    apiKeyEnv: account.apiKeyEnv,
    modelRoutes: account.modelRoutes,
    accessTokenConfigured: Boolean(account.accessToken),
    refreshTokenConfigured: Boolean(account.refreshToken),
  };
}

function sanitizeProfile(profile) {
  if (!profile || typeof profile !== 'object') return {};
  const output = {};
  for (const key of ['id', 'sub', 'email', 'name', 'organization', 'team', 'accountId', 'planType']) {
    if (profile[key]) output[key] = profile[key];
  }
  return output;
}

function sanitizeProviderSpecificData(value) {
  const source = objectOrEmpty(value);
  const output = {};
  for (const key of ['authMethod', 'source', 'chatgptAccountId', 'chatgptPlanType', 'jwtExp']) {
    if (source[key] !== undefined && source[key] !== '') output[key] = source[key];
  }
  return output;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function hasNonEmptyAny(object, keys) {
  return keys.some((key) => hasOwn(object, key) && String(object[key] || '').trim());
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function mergeProviderSecrets(existing, payload) {
  if (!existing) return payload;
  const merged = cloneJson(payload);
  if (!hasNonEmptyAny(merged, ['apiKey', 'api_key']) && existing.apiKey) {
    merged.apiKey = existing.apiKey;
  }
  if (!hasOwn(merged, 'oauth') && existing.oauth) {
    merged.oauth = existing.oauth;
  } else if (merged.oauth && typeof merged.oauth === 'object' && existing.oauth?.clientSecret) {
    if (!hasNonEmptyAny(merged.oauth, ['clientSecret', 'client_secret'])) {
      merged.oauth.clientSecret = existing.oauth.clientSecret;
    }
  }
  return merged;
}

function mergeAccountSecrets(existing, payload) {
  if (!existing) return payload;
  const merged = cloneJson(payload);
  if (!hasNonEmptyAny(merged, ['accessToken', 'access_token', 'apiKey', 'api_key']) && existing.accessToken) {
    merged.accessToken = existing.accessToken;
  }
  if (!hasNonEmptyAny(merged, ['refreshToken', 'refresh_token']) && existing.refreshToken) {
    merged.refreshToken = existing.refreshToken;
  }
  return merged;
}

function providerApiKey(provider) {
  if (provider.apiKey) return provider.apiKey;
  if (provider.apiKeyEnv && process.env[provider.apiKeyEnv]) return process.env[provider.apiKeyEnv];
  return '';
}

function accountToken(account) {
  if (account.accessToken) return account.accessToken;
  if (account.apiKeyEnv && process.env[account.apiKeyEnv]) return process.env[account.apiKeyEnv];
  return '';
}

function accountAuthMethod(account = {}) {
  return firstString(account.providerSpecificData?.authMethod, account.authType, account.auth_type, account.type);
}

function accountIsUnsupportedImport(account = {}) {
  const method = accountAuthMethod(account).replace(/[-\s]/g, '_').toLowerCase();
  const type = String(account.type || '').replace(/[-\s]/g, '_').toLowerCase();
  return method === 'access_token' || type === 'unsupported_import';
}

function accountCanRouteModel(account = {}) {
  return !accountIsUnsupportedImport(account);
}

function effectiveAccountExpiresAt(account = {}) {
  return firstString(account.expiresAt, jwtExpiryIso(account.accessToken));
}

function accountAccessTokenExpired(account = {}) {
  if (account.refreshToken) return false;
  const expiresAt = Date.parse(effectiveAccountExpiresAt(account));
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt - Date.now() <= TOKEN_REFRESH_SKEW_MS;
}

function accountHasUsableCredential(account = {}) {
  if (!accountToken(account)) return false;
  return !accountAccessTokenExpired(account);
}

function safeAuthFileName(name) {
  const base = String(name || id('auth')).trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || id('auth');
  return base.endsWith('.json') ? base : `${base}.json`;
}

function oauthAuthFileName(provider, account) {
  const email = accountEmail(account);
  const plan = account.profile?.planType || '';
  return safeAuthFileName([provider.id, email || account.label || account.id, plan].filter(Boolean).join('-'));
}

function writeOAuthAuthFile(provider, account, tokenPayload) {
  ensureDir(AUTH_DIR);
  const name = oauthAuthFileName(provider, account);
  writeJson(path.join(AUTH_DIR, name), {
    type: provider.id,
    providerId: provider.id,
    accountId: account.id,
    email: accountEmail(account),
    label: accountDisplayName(account),
    profile: account.profile,
    tokenPayload: {
      access_token: tokenPayload.access_token || '',
      refresh_token: tokenPayload.refresh_token || '',
      id_token: tokenPayload.id_token || tokenPayload.idToken || '',
      token_type: tokenPayload.token_type || tokenPayload.tokenType || '',
      expires_in: tokenPayload.expires_in || tokenPayload.expiresIn || '',
      scope: tokenPayload.scope || '',
    },
    createdAt: account.createdAt,
    updatedAt: now(),
  });
  return name;
}

function listAuthFiles() {
  ensureDir(AUTH_DIR);
  return fs.readdirSync(AUTH_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const file = path.join(AUTH_DIR, name);
      const payload = readJson(file, {});
      const tokenPayload = importedTokenPayload({ content: payload.tokenPayload || payload.content || payload });
      const user = objectOrEmpty(payload.user);
      const profile = objectOrEmpty(payload.profile);
      const providerSpecificData = objectOrEmpty(payload.providerSpecificData || payload.provider_specific_data);
      const tokenProfile = objectOrEmpty(tokenPayload.profile);
      const tokenUser = objectOrEmpty(tokenPayload.user);
      const tokenAccount = objectOrEmpty(tokenPayload.account);
      const tokenProviderSpecificData = objectOrEmpty(tokenPayload.providerSpecificData || tokenPayload.provider_specific_data);
      const email = firstString(
        emailFromObject(payload, tokenPayload, user, profile, tokenUser, tokenAccount, providerSpecificData, tokenProviderSpecificData, tokenProfile),
        payload.email,
        user.email,
        profile.email,
        tokenUser.email,
        tokenAccount.email,
        tokenPayload.email,
        tokenProfile.email,
        providerSpecificData.email,
        providerSpecificData.chatgptEmail,
        tokenProviderSpecificData.email,
        tokenProviderSpecificData.chatgptEmail,
        tokenProviderSpecificData.chatgpt_email,
        emailFromText(payload.label),
        emailFromText(payload.name),
        emailFromText(tokenPayload.label),
        emailFromText(tokenPayload.name),
        emailFromText(name),
      );
      const accountId = firstString(
        payload.accountId,
        payload.account_id,
        accountIdFromObject(payload, tokenPayload, user, profile, tokenUser, tokenAccount, providerSpecificData, tokenProviderSpecificData, tokenProfile),
      );
      const label = firstString(email, readableAccountLabel(payload.label), user.name, profile.name, tokenUser.name, tokenAccount.name, tokenPayload.name, tokenProfile.name, payload.label);
      const stat = fs.statSync(file);
      return {
        name,
        providerId: String(payload.providerId || payload.provider_id || payload.provider || payload.type || '').trim(),
        accountId: String(accountId || '').trim(),
        label: String(label || '').trim(),
        email: String(email || '').trim(),
        disabled: Boolean(payload.disabled),
        routeEligible: accountCanRouteModel(payload),
        tokenConfigured: Boolean(extractImportedAccessToken(payload, tokenPayload)),
        refreshConfigured: Boolean(extractImportedRefreshToken(payload, tokenPayload)),
        updatedAt: stat.mtime.toISOString(),
      };
    });
}

function parseJsonLike(value, fieldName = 'payload') {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value.replace(/^\uFEFF/, ''));
    } catch (error) {
      throw httpError(400, `${fieldName} is not valid JSON: ${error.message}`);
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  throw httpError(400, `${fieldName} must be a JSON object.`);
}

function importedTokenPayload(payload) {
  return parseJsonLike(payload.tokenPayload || payload.token_payload || payload.content || payload.file || payload.auth || payload.tokens || payload, 'token payload');
}

function firstString(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function extractImportedAccessToken(payload, tokenPayload) {
  return firstString(
    payload.accessToken,
    payload.access_token,
    payload.apiKey,
    payload.api_key,
    tokenPayload.access_token,
    tokenPayload.accessToken,
    tokenPayload.api_key,
    tokenPayload.apiKey,
    valueAtPath(tokenPayload, 'credentials.access_token'),
    valueAtPath(tokenPayload, 'tokens.access_token'),
  );
}

function extractImportedRefreshToken(payload, tokenPayload) {
  return firstString(
    payload.refreshToken,
    payload.refresh_token,
    tokenPayload.refresh_token,
    tokenPayload.refreshToken,
    valueAtPath(tokenPayload, 'credentials.refresh_token'),
    valueAtPath(tokenPayload, 'tokens.refresh_token'),
  );
}

function jwtExpiryIso(tokenValue) {
  const claims = jwtPayload(tokenValue);
  const exp = Number(claims.exp || 0);
  if (!Number.isFinite(exp) || exp <= 0) return '';
  return new Date(exp * 1000).toISOString();
}

function ensureProviderInConfig(config, provider) {
  if (!provider || !provider.id) return;
  if (!config.providers.some((item) => item.id === provider.id)) {
    config.providers = [...config.providers, provider];
  }
}

function providerModelIds(provider) {
  return (provider?.models || []).map((model) => (typeof model === 'string' ? model : model.id)).filter(Boolean);
}

function createAccountFromTokenPayload(provider, payload) {
  const tokenPayload = importedTokenPayload(payload);
  const accessToken = extractImportedAccessToken(payload, tokenPayload);
  const refreshToken = extractImportedRefreshToken(payload, tokenPayload);
  if (!accessToken && !payload.apiKeyEnv && !payload.api_key_env) throw httpError(400, 'Imported token payload does not contain access_token, apiKey, or apiKeyEnv.');
  const profile = enrichProfileFromTokenPayload(objectOrEmpty(payload.profile || tokenPayload.profile || tokenPayload.user || tokenPayload.account), tokenPayload);
  const label = firstString(payload.label, tokenPayload.label, profile.email, profile.name, tokenPayload.email, tokenPayload.name, `${provider.label || provider.id} imported account`);
  const importName = safeAuthFileName(payload.name || payload.fileName || label || provider.id);
  return normalizeAccount({
    id: payload.accountId || payload.account_id || payload.id || `acct-${provider.id}-${stableHash(importName)}`,
    providerId: provider.id,
    label,
    type: payload.type || payload.authType || payload.auth_type || 'oauth-import',
    status: payload.status || 'active',
    priority: payload.priority || 100,
    accessToken,
    apiKeyEnv: payload.apiKeyEnv || payload.api_key_env || '',
    refreshToken,
    idToken: tokenPayload.id_token || tokenPayload.idToken || '',
    expiresAt: payload.expiresAt || payload.expires_at || tokenExpiry(tokenPayload),
    scopes: payload.scopes || payload.scope || tokenPayload.scope,
    models: payload.models || payload.modelAllowlist || payload.model_allowlist || provider.oauth?.accountModels || providerModelIds(provider),
    quota: payload.quota,
    profile,
    providerSpecificData: payload.providerSpecificData || payload.provider_specific_data || tokenPayload.providerSpecificData || tokenPayload.provider_specific_data || {},
    createdAt: payload.createdAt || payload.created_at || now(),
    updatedAt: now(),
  });
}

function providerAccounts(config, provider) {
  return (config.accounts || []).filter((account) => account.providerId === provider.id);
}

function isAccountActive(account) {
  return !['disabled', 'revoked', 'error'].includes(String(account.status || '').toLowerCase());
}

function allModels(config) {
  const seen = new Set();
  const models = [];
  for (const provider of config.providers) {
    for (const model of provider.models) {
      const modelId = typeof model === 'string' ? model : model.id;
      if (!modelId || seen.has(modelId)) continue;
      seen.add(modelId);
      models.push({ id: modelId, object: 'model', created: 0, owned_by: provider.id });
    }
  }
  for (const [modelId, route] of Object.entries(config.routes || {})) {
    if (!modelId || seen.has(modelId)) continue;
    const routeConfig = normalizeRoute(route);
    seen.add(modelId);
    models.push({ id: modelId, object: 'model', created: 0, owned_by: routeConfig.provider || 'route' });
  }
  return models;
}

function normalizeRoute(route) {
  if (!route) return {};
  if (typeof route === 'string') return { provider: route };
  return route && typeof route === 'object' ? route : {};
}

function routeForModel(config, modelId, routingState) {
  const explicit = normalizeRoute(config.routes?.[modelId]);
  if (explicit.provider) {
    const provider = config.providers.find((item) => item.id === explicit.provider);
    if (!provider) throw httpError(400, `No provider found for route ${modelId}.`);
    return finalizeRoute(config, provider, modelId, explicit.model || explicit.upstreamModel || explicit.upstream_model || modelId, explicit, routingState);
  }
  for (const provider of [...config.providers].sort((a, b) => a.priority - b.priority)) {
    for (const model of provider.models) {
      const idValue = typeof model === 'string' ? model : model.id;
      if (idValue === modelId) {
        const upstreamModel = typeof model === 'string' ? modelId : (model.upstreamModel || model.upstream_model || idValue);
        return finalizeRoute(config, provider, modelId, upstreamModel, model, routingState);
      }
    }
  }
  throw httpError(400, `No route configured for model ${modelId}.`);
}

function finalizeRoute(config, provider, requestedModel, upstreamModel, routeConfig, routingState) {
  const account = selectAccount(config, provider, requestedModel, upstreamModel, routeConfig, routingState);
  return {
    provider,
    account,
    requestedModel,
    upstreamModel: accountUpstreamModel(account, requestedModel, upstreamModel),
    strategy: String(routeConfig.accountStrategy || routeConfig.account_strategy || provider.routing?.strategy || 'least-used'),
  };
}

function accountUpstreamModel(account, requestedModel, upstreamModel) {
  if (!account?.modelRoutes) return upstreamModel;
  return account.modelRoutes[requestedModel] || account.modelRoutes[upstreamModel] || upstreamModel;
}

function selectAccount(config, provider, requestedModel, upstreamModel, routeConfig, routingState) {
  const explicitAccountId = String(routeConfig.accountId || routeConfig.account_id || provider.accountId || '').trim();
  if (explicitAccountId) {
    const account = config.accounts.find((item) => item.id === explicitAccountId && item.providerId === provider.id);
    if (!account) throw httpError(400, `Account ${explicitAccountId} is not configured for provider ${provider.id}.`);
    if (!accountCanRouteModel(account)) throw httpError(401, `Account ${explicitAccountId} is an unsupported token import and cannot call the model route. Use OAuth Login to create a supported account.`, 'authentication_error');
    if (!isAccountActive(account) || !accountHasUsableCredential(account)) throw httpError(429, `Account ${explicitAccountId} is not active or has no usable token.`, 'quota_error');
    if (!accountAllowsModel(account, requestedModel, upstreamModel)) throw httpError(400, `Account ${explicitAccountId} is not allowed to serve ${requestedModel}.`);
    return account;
  }

  const candidates = providerAccounts(config, provider)
    .filter((account) => isAccountActive(account))
    .filter(accountCanRouteModel)
    .filter(accountHasUsableCredential)
    .filter((account) => accountAllowsModel(account, requestedModel, upstreamModel));

  const available = candidates.filter((account) => accountHasQuota(account, routingState));
  if (available.length) return chooseAccount(available, provider, requestedModel, routeConfig, routingState);
  if (candidates.length) throw httpError(429, `All accounts for provider ${provider.id} are over quota for ${requestedModel}.`, 'quota_error');
  if (providerApiKey(provider)) return null;
  const webAccessOnly = providerAccounts(config, provider)
    .filter((account) => isAccountActive(account))
    .filter(accountHasUsableCredential)
    .filter((account) => !accountCanRouteModel(account));
  if (webAccessOnly.length) {
    throw httpError(401, `Provider ${provider.id} only has unsupported token imports, which are not used for model routing. Use OAuth Login to create a supported account.`, 'authentication_error');
  }
  throw httpError(400, `Provider ${provider.id} has no configured API key or active account token.`);
}

function accountAllowsModel(account, requestedModel, upstreamModel) {
  if (!account.models.length) return true;
  return account.models.includes(requestedModel) || account.models.includes(upstreamModel);
}

function chooseAccount(accounts, provider, requestedModel, routeConfig, routingState) {
  const strategy = String(routeConfig.accountStrategy || routeConfig.account_strategy || provider.routing?.strategy || 'least-used').toLowerCase();
  const ordered = [...accounts].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  if (strategy === 'round-robin' || strategy === 'round_robin') {
    routingState.routing = routingState.routing || {};
    routingState.routing.cursors = routingState.routing.cursors || {};
    const key = `${provider.id}:${requestedModel}`;
    const cursor = Number(routingState.routing.cursors[key] || 0);
    const account = ordered[cursor % ordered.length];
    routingState.routing.cursors[key] = (cursor + 1) % ordered.length;
    return account;
  }
  return ordered.sort((a, b) => {
    const aUsage = ensureUsageBucket(routingState, 'accounts', a.id);
    const bUsage = ensureUsageBucket(routingState, 'accounts', b.id);
    return a.priority - b.priority || aUsage.requests - bUsage.requests || a.id.localeCompare(b.id);
  })[0];
}

function accountHasQuota(account, routingState) {
  const usage = ensureUsageBucket(routingState, 'accounts', account.id);
  const requestLimit = Number(account.quota.requestsPerDay || 0);
  const tokenLimit = Number(account.quota.tokensPerDay || 0);
  if (requestLimit > 0 && usage.requests >= requestLimit) return false;
  if (tokenLimit > 0 && usage.totalTokens >= tokenLimit) return false;
  return true;
}

function ensureUsageBucket(root, group, key) {
  root.usage = root.usage || {};
  root.usage[group] = root.usage[group] || {};
  const day = new Date().toISOString().slice(0, 10);
  const current = root.usage[group][key] || {};
  if (current.day !== day) {
    root.usage[group][key] = {
      day,
      requests: 0,
      errors: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      lastStatus: 0,
      lastUsedAt: '',
      providerId: current.providerId || '',
      model: current.model || '',
    };
  }
  return root.usage[group][key];
}

function publicUsageBucket(bucket) {
  if (!bucket) return null;
  return {
    day: bucket.day,
    requests: bucket.requests || 0,
    errors: bucket.errors || 0,
    inputTokens: bucket.inputTokens || 0,
    outputTokens: bucket.outputTokens || 0,
    totalTokens: bucket.totalTokens || 0,
    lastStatus: bucket.lastStatus || 0,
    lastUsedAt: bucket.lastUsedAt || '',
    providerId: bucket.providerId || '',
    model: bucket.model || '',
  };
}

function publicUsage(usage = {}) {
  const out = { accounts: {}, proxyKeys: {}, providers: {} };
  for (const [key, bucket] of Object.entries(usage.accounts || {})) out.accounts[key] = publicUsageBucket(bucket);
  for (const [key, bucket] of Object.entries(usage.proxyKeys || {})) out.proxyKeys[key] = publicUsageBucket(bucket);
  for (const [key, bucket] of Object.entries(usage.providers || {})) out.providers[key] = publicUsageBucket(bucket);
  return out;
}

const BUILT_IN_OAUTH_PROVIDERS = [
  {
    id: 'codex',
    label: 'Codex / ChatGPT',
    type: 'codex-oauth',
    baseUrl: CODEX_BACKEND_BASE_URL,
    priority: 20,
    routing: { platform: 'codex', strategy: 'least-used' },
    models: [
      { id: 'gpt-5.5', upstreamModel: 'gpt-5.5' },
      { id: 'gpt-5.4-mini', upstreamModel: 'gpt-5.4-mini' },
    ],
    oauth: {
      adapter: 'codex-cli-oauth-pkce',
      authorizationUrl: 'https://auth.openai.com/oauth/authorize',
      tokenUrl: 'https://auth.openai.com/oauth/token',
      callbackUrl: 'http://localhost:1455/auth/callback',
      clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
      tokenAuth: 'none',
      scopes: ['openid', 'email', 'profile', 'offline_access'],
      authorizationParams: {
        prompt: 'login',
        id_token_add_organizations: 'true',
        codex_cli_simplified_flow: 'true',
      },
      accountModels: ['gpt-5.5', 'gpt-5.4-mini'],
      profileFieldMap: { email: 'email', name: 'name' },
    },
  },
  {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    type: 'gemini-cli-oauth',
    baseUrl: 'https://cloudcode-pa.googleapis.com',
    priority: 30,
    routing: { platform: 'gemini-cli', strategy: 'least-used' },
    models: [
      { id: 'gemini-2.5-pro', upstreamModel: 'gemini-2.5-pro' },
      { id: 'gemini-2.5-flash', upstreamModel: 'gemini-2.5-flash' },
    ],
    oauth: {
      adapter: 'gemini-cli-oauth',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      profileUrl: 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json',
      callbackUrl: 'http://localhost:8085/oauth2callback',
      clientId: process.env.TICMIRO_GEMINI_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.TICMIRO_GEMINI_OAUTH_CLIENT_SECRET || '',
      tokenAuth: 'client_secret_post',
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      authorizationParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
      accountModels: ['gemini-2.5-pro', 'gemini-2.5-flash'],
      profileFieldMap: { email: 'email', name: 'name' },
    },
  },
  {
    id: 'antigravity',
    label: 'Antigravity',
    type: 'antigravity-oauth',
    baseUrl: 'https://cloudcode-pa.googleapis.com',
    priority: 40,
    routing: { platform: 'antigravity', strategy: 'least-used' },
    models: [
      { id: 'gemini-2.5-pro', upstreamModel: 'gemini-2.5-pro' },
      { id: 'gemini-2.5-flash', upstreamModel: 'gemini-2.5-flash' },
    ],
    oauth: {
      adapter: 'antigravity-oauth',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      profileUrl: 'https://www.googleapis.com/oauth2/v2/userinfo?alt=json',
      callbackUrl: 'http://localhost:51121/oauth-callback',
      clientId: process.env.TICMIRO_ANTIGRAVITY_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.TICMIRO_ANTIGRAVITY_OAUTH_CLIENT_SECRET || '',
      tokenAuth: 'client_secret_post',
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/cclog',
        'https://www.googleapis.com/auth/experimentsandconfigs',
      ],
      authorizationParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
      accountModels: ['gemini-2.5-pro', 'gemini-2.5-flash'],
      profileFieldMap: { email: 'email', name: 'name' },
    },
  },
].map(normalizeProvider);

function builtInProviderById(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  return BUILT_IN_OAUTH_PROVIDERS.find((provider) => provider.id.toLowerCase() === normalized
    || String(provider.routing?.platform || '').toLowerCase() === normalized) || null;
}

function providerByIdOrPlatform(config, value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return config.providers.find((provider) => provider.id === normalized)
    || providerForPlatform(config, normalized)
    || builtInProviderById(normalized);
}

function mergedOAuthProviders(config) {
  const configuredIds = new Set(config.providers.map((provider) => provider.id));
  return [
    ...BUILT_IN_OAUTH_PROVIDERS.map((provider) => config.providers.find((item) => item.id === provider.id) || provider),
    ...config.providers.filter((provider) => provider.oauth && !configuredIds.has(provider.routing?.platform) && !BUILT_IN_OAUTH_PROVIDERS.some((item) => item.id === provider.id)),
  ];
}

function configuredProxyKeys(currentState = state()) {
  return [...new Set([...PROXY_KEYS, ...splitList(currentState.localConfig?.proxyKeys)])];
}

function preferredCodexModel(config, requested = '') {
  const requestedModel = String(requested || '').trim();
  if (requestedModel) return requestedModel;
  const modelIds = allModels(config).map((model) => model.id).filter(Boolean);
  return modelIds.includes('gpt-5.5') ? 'gpt-5.5' : modelIds[0] || 'gpt-5.5';
}

function apiOneKeyMaterial(config, currentState, payload = {}) {
  let proxyKeys = configuredProxyKeys(currentState);
  let generated = false;
  if (!proxyKeys.length) {
    const key = generateProxyApiKey();
    const localKeys = splitList(currentState.localConfig?.proxyKeys);
    saveLocalConfig(currentState, { proxyKeys: [...new Set([...localKeys, key])] });
    proxyKeys = configuredProxyKeys(currentState);
    generated = true;
  }
  const proxyApiKey = proxyKeys[0];
  return {
    provider: 'ticproxy',
    modelProvider: 'ticproxy',
    model: preferredCodexModel(config, payload.model),
    proxyBaseUrl: `${PUBLIC_BASE_URL}/v1`,
    proxyApiKey,
    proxyKeyRedacted: redactedSecret(proxyApiKey),
    generated,
    setDefault: payload.setDefault !== false,
  };
}

function redactedSecret(value) {
  const textValue = String(value || '').trim();
  if (!textValue) return '';
  if (textValue.length <= 10) return `${textValue.slice(0, 2)}...${textValue.slice(-2)}`;
  return `${textValue.slice(0, 6)}...${textValue.slice(-4)}`;
}

function publicCommand(command) {
  if (!command) return null;
  const result = command.result || null;
  const payloadPreview = command.payloadPreview || JSON.stringify(command.payload || {});
  const resultPreview = command.resultPreview || (result ? JSON.stringify(result).slice(0, 1200) : '');
  return {
    id: command.id,
    type: command.type,
    status: command.status,
    createdAt: command.createdAt,
    updatedAt: command.updatedAt,
    claimedAt: command.claimedAt || '',
    summary: command.summary || result?.summary || '',
    error: command.error || '',
    payloadPreview,
    resultPreview,
    result,
  };
}

function latestAgent(currentState = state()) {
  return Object.values(currentState.agents || {})
    .sort((a, b) => Date.parse(b.lastSeenAt || 0) - Date.parse(a.lastSeenAt || 0))[0] || null;
}

function isAgentOnline(agent) {
  const lastSeenAt = Date.parse(agent?.lastSeenAt || '');
  return Number.isFinite(lastSeenAt) && Date.now() - lastSeenAt < 45_000;
}

function groupMatchesCommand(command, group) {
  if (!group) return true;
  if (group === 'ticproxy') return String(command.type || '').startsWith('ticproxy.');
  if (group === 'codex-chat') return String(command.type || '').startsWith('codex.thread.') || String(command.type || '').startsWith('codex.desktop.');
  if (group === 'files') return String(command.type || '').startsWith('file.');
  if (group === 'tasks') return ['codex.exec', 'task.snapshot', 'snapshot.refresh', 'bridge.snapshot', 'codex.provider.switch'].includes(command.type);
  if (group === 'resident') return String(command.type || '').startsWith('resident.');
  return true;
}

function commandsForApi(currentState, url) {
  const limit = Math.max(1, Math.min(400, Number(url.searchParams.get('limit') || 80)));
  const group = String(url.searchParams.get('group') || '').trim();
  return (currentState.commands || [])
    .filter((command) => groupMatchesCommand(command, group))
    .slice(-limit)
    .reverse()
    .map(publicCommand);
}

function buildCodexSnapshot(rawSnapshot = {}) {
  const codex = rawSnapshot.codex || {};
  const threads = rawSnapshot.threads || codex.threads || [];
  const messagesByThread = rawSnapshot.messagesByThread || codex.messagesByThread || {};
  return {
    ...codex,
    config: {
      exists: Boolean(codex.configExists || codex.codexHomeExists || codex.config?.exists),
      codexHome: codex.codexHome || codex.config?.codexHome || '',
      modelProvider: codex.modelProvider || codex.config?.modelProvider || '',
      model: codex.model || codex.config?.model || '',
    },
    threads,
    messagesByThread,
    threadSync: rawSnapshot.threadSync || codex.threadSync || {},
  };
}

function usageRows(currentState = state()) {
  const usage = publicUsage(currentState.usage);
  const config = providersConfig();
  const accountsById = new Map((config.accounts || []).map((account) => [account.id, account]));
  const rows = [];
  for (const [accountId, bucket] of Object.entries(usage.accounts || {})) {
    const account = accountsById.get(accountId);
    rows.push({
      provider: bucket.providerId || 'account',
      account: account ? accountDisplayName(account) : accountId,
      accountId,
      model: bucket.model || '-',
      status: bucket.lastStatus || 0,
      time: bucket.lastUsedAt || '',
      requests: bucket.requests || 0,
      tokens: bucket.totalTokens || 0,
    });
  }
  for (const [key, bucket] of Object.entries(usage.proxyKeys || {})) {
    rows.push({
      provider: 'proxy-key',
      account: key,
      model: bucket.model || '-',
      status: bucket.lastStatus || 0,
      time: bucket.lastUsedAt || '',
      requests: bucket.requests || 0,
      tokens: bucket.totalTokens || 0,
    });
  }
  return rows.sort((a, b) => Date.parse(b.time || 0) - Date.parse(a.time || 0));
}

function authFileRows(config, currentState = state()) {
  const accountsById = new Map();
  for (const account of config.accounts || []) {
    for (const key of accountLookupKeys(account)) accountsById.set(key, account);
  }
  const files = listAuthFiles().map((file, index) => {
    const account = accountsById.get(file.accountId);
    const email = firstString(file.email, accountEmail(account, file));
    const displayName = accountDisplayName(account, { ...file, email });
    return {
      ...file,
      name: file.name,
      displayName,
      providerId: file.providerId || account?.providerId || '',
      provider: file.providerId || account?.providerId || 'auth-file',
      account: displayName,
      label: firstString(email, readableAccountLabel(file.label), readableAccountLabel(account?.label), file.label),
      email,
      authIndex: index,
      disabled: account ? !isAccountActive(account) : Boolean(file.disabled),
      routeEligible: account ? accountCanRouteModel(account) : file.routeEligible,
      tokenConfigured: account ? Boolean(accountToken(account)) : file.tokenConfigured,
      refreshConfigured: account ? Boolean(account.refreshToken) : file.refreshConfigured,
      quota: account?.quota || file.quota || {},
      usage: account ? publicUsageBucket(currentState.usage?.accounts?.[account.id]) : file.usage,
    };
  });
  const accountRows = (config.accounts || []).map((account, index) => {
    const email = accountEmail(account);
    const displayName = accountDisplayName(account);
    return {
      name: account.id,
      displayName,
      providerId: account.providerId,
      provider: account.providerId,
      accountId: account.id,
      account: displayName,
      label: account.label,
      email,
      authIndex: files.length + index,
      disabled: !isAccountActive(account),
      routeEligible: accountCanRouteModel(account),
      tokenConfigured: Boolean(accountToken(account)),
      refreshConfigured: Boolean(account.refreshToken),
      quota: account.quota,
      usage: publicUsageBucket(currentState.usage?.accounts?.[account.id]),
      updatedAt: account.updatedAt || account.createdAt || '',
    };
  });
  const seen = new Set(files.map((file) => file.accountId).filter(Boolean));
  return [...files, ...accountRows.filter((account) => !seen.has(account.accountId))];
}

function pseudoYaml(config, currentState = state()) {
  return JSON.stringify({
    publicBaseUrl: PUBLIC_BASE_URL,
    proxyBaseUrl: `${PUBLIC_BASE_URL}/v1`,
    providers: config.providers.map((provider) => adminProvider(provider, config)),
    routes: config.routes || {},
    proxyKeys: configuredProxyKeys(currentState).map(redactedSecret),
  }, null, 2);
}

function buildTicProxyManagement(config, currentState = state()) {
  const models = allModels(config);
  const providerEndpoints = config.providers.map((provider) => ({
    id: provider.id,
    label: provider.label || provider.id,
    type: provider.type,
    modelCount: provider.models.length,
    oauthConfigured: oauthReadiness(provider).ready,
  }));
  const providerItems = Object.fromEntries(config.providers.map((provider) => [provider.id, [{
    id: provider.id,
    name: provider.label || provider.id,
    type: provider.type,
    baseUrl: provider.baseUrl,
    models: providerModelIds(provider),
    oauth: {
      adapter: provider.oauth?.adapter || '',
      configured: oauthReadiness(provider).ready,
      missing: oauthReadiness(provider).missing,
    },
    accountCount: providerAccounts(config, provider).length,
  }]]));
  const proxyKeys = configuredProxyKeys(currentState);
  const usage = publicUsage(currentState.usage);
  return {
    configured: true,
    baseUrl: PUBLIC_BASE_URL,
    apiUrl: `${PUBLIC_BASE_URL}/v1`,
    refreshedAt: now(),
    latestVersion: 'community',
    allowSecretExport: false,
    allowYamlWrite: false,
    basic: {
      debug: Boolean(currentState.localConfig?.basic?.debug),
      requestLog: true,
      loggingToFile: false,
      usageStatisticsEnabled: true,
      wsAuth: false,
      switchProject: false,
      switchPreviewModel: false,
      forceModelPrefix: false,
      proxyUrl: '',
      routingStrategy: currentState.localConfig?.basic?.routingStrategy || 'least-used',
      requestRetry: 3,
      maxRetryInterval: 30,
      logsMaxTotalSizeMb: 0,
      ...(currentState.localConfig?.basic || {}),
    },
    apiKeys: proxyKeys.map(redactedSecret),
    apiKeyUsage: Object.entries(usage.proxyKeys || {}).map(([key, bucket]) => ({
      id: key,
      key,
      requests: bucket.requests || 0,
      tokens: bucket.totalTokens || 0,
      lastUsed: bucket.lastUsedAt || '',
    })),
    yaml: pseudoYaml(config, currentState),
    providerEndpoints,
    providerItems,
    oauthProviders: mergedOAuthProviders(config).map((provider) => ({
      id: provider.id,
      label: provider.label || provider.id,
      adapter: provider.oauth?.adapter || '',
      configured: oauthReadiness(provider).ready,
      missing: oauthReadiness(provider).missing,
    })),
    oauthExcludedModels: currentState.localConfig?.oauthExcludedModels || {},
    oauthModelAlias: currentState.localConfig?.oauthModelAlias || {},
    authFiles: authFileRows(config, currentState),
    usageRows: usageRows(currentState),
    logs: (currentState.events || []).slice(-80).map((event) => `[${event.at || ''}] ${event.type} ${JSON.stringify(event.payload || {})}`),
    errorLogs: [],
    providers: config.providers.map((provider) => publicProvider(provider, config)),
    models: models.map((model) => model.id),
  };
}

function buildDashboardSnapshot(config, currentState = state()) {
  const rawSnapshot = currentState.snapshot || {};
  const codex = buildCodexSnapshot(rawSnapshot);
  const ticproxyManagement = buildTicProxyManagement(config, currentState);
  return {
    ...rawSnapshot,
    updatedAt: rawSnapshot.updatedAt || '',
    codex,
    threads: codex.threads,
    messagesByThread: codex.messagesByThread,
    ticproxy: {
      healthy: Boolean(config.providers.length),
      keyPresent: configuredProxyKeys(currentState).length > 0,
      baseUrl: `${PUBLIC_BASE_URL}/v1`,
      modelCount: ticproxyManagement.models.length,
      models: ticproxyManagement.models,
      management: ticproxyManagement,
    },
    residentAgent: rawSnapshot.residentAgent || {
      online: false,
      source: 'community-server',
      processCount: 0,
      apiConfigured: false,
      apiReachable: false,
    },
    tasks: rawSnapshot.tasks || {
      pid: process.pid,
      service: { status: 'server-online', host: HOST, port: PORT },
      processes: [],
    },
    files: rawSnapshot.files || {
      roots: splitList(rawSnapshot.env?.allowedRoots).map((root, index) => ({ id: `root-${index + 1}`, label: root, path: root })),
    },
  };
}

function buildDashboardPayload(currentState = state()) {
  const config = providersConfig();
  const agent = latestAgent(currentState);
  const online = isAgentOnline(agent);
  const commands = (currentState.commands || []).map(publicCommand);
  const snapshot = buildDashboardSnapshot(config, currentState);
  return {
    ok: true,
    publicBaseUrl: PUBLIC_BASE_URL,
    status: {
      agent: agent ? { ...agent, id: agent.agentId || agent.id, status: online ? 'online' : 'offline' } : null,
      snapshotUpdatedAt: snapshot.updatedAt || '',
      pendingCount: commands.filter((command) => command.status === 'pending').length,
      runningCount: commands.filter((command) => command.status === 'running').length,
      codex: {
        provider: snapshot.codex.config.modelProvider,
        model: snapshot.codex.config.model,
      },
    },
    agents: Object.values(currentState.agents || {}),
    snapshot,
    commands: commands.slice(-80).reverse(),
    events: (currentState.events || []).slice(-80).reverse(),
    proxy: {
      baseUrl: `${PUBLIC_BASE_URL}/v1`,
      providers: config.providers.map((provider) => publicProvider(provider, config)),
      models: allModels(config),
      accountCount: config.accounts?.length || 0,
      accounts: (config.accounts || []).map((account) => publicAccount(account, currentState.usage?.accounts?.[account.id])),
      usage: publicUsage(currentState.usage),
    },
  };
}

function proxyKeyHasQuota(routingState, proxyKeyId) {
  const usage = ensureUsageBucket(routingState, 'proxyKeys', proxyKeyId);
  if (PROXY_KEY_DAILY_REQUEST_LIMIT > 0 && usage.requests >= PROXY_KEY_DAILY_REQUEST_LIMIT) return false;
  if (PROXY_KEY_DAILY_TOKEN_LIMIT > 0 && usage.totalTokens >= PROXY_KEY_DAILY_TOKEN_LIMIT) return false;
  return true;
}

function addUsage(bucket, usage, status, route) {
  bucket.requests = Number(bucket.requests || 0) + 1;
  bucket.errors = Number(bucket.errors || 0) + (status >= 400 ? 1 : 0);
  bucket.inputTokens = Number(bucket.inputTokens || 0) + Number(usage?.inputTokens || 0);
  bucket.outputTokens = Number(bucket.outputTokens || 0) + Number(usage?.outputTokens || 0);
  bucket.totalTokens = Number(bucket.totalTokens || 0) + Number(usage?.totalTokens || 0);
  bucket.lastStatus = status;
  bucket.lastUsedAt = now();
  bucket.providerId = route.provider.id;
  bucket.model = route.requestedModel;
}

function recordUsage(routingState, route, proxyKeyId, usage, status) {
  addUsage(ensureUsageBucket(routingState, 'providers', route.provider.id), usage, status, route);
  addUsage(ensureUsageBucket(routingState, 'proxyKeys', proxyKeyId), usage, status, route);
  if (route.account) addUsage(ensureUsageBucket(routingState, 'accounts', route.account.id), usage, status, route);
  saveState(routingState);
}

function recordRouteUsage(routingState, route, usage, status) {
  addUsage(ensureUsageBucket(routingState, 'providers', route.provider.id), usage, status, route);
  if (route.account) addUsage(ensureUsageBucket(routingState, 'accounts', route.account.id), usage, status, route);
  saveState(routingState);
}

function extractUsageFromText(textBody, contentType) {
  if (String(contentType || '').includes('event-stream') || /^event:\s/m.test(String(textBody || ''))) {
    for (const event of eventStreamJsonEvents(textBody).reverse()) {
      const usage = event.usage || event.response?.usage;
      if (!usage || typeof usage !== 'object') continue;
      const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokens ?? 0);
      const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? usage.completionTokens ?? 0);
      const totalTokens = Number(usage.total_tokens ?? usage.totalTokens ?? inputTokens + outputTokens);
      return { inputTokens, outputTokens, totalTokens };
    }
    return null;
  }
  if (!String(contentType || '').includes('json')) return null;
  try {
    const payload = JSON.parse(textBody);
    const usage = payload.usage || payload.response?.usage;
    if (!usage || typeof usage !== 'object') return null;
    const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokens ?? 0);
    const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? usage.completionTokens ?? 0);
    const totalTokens = Number(usage.total_tokens ?? usage.totalTokens ?? inputTokens + outputTokens);
    return { inputTokens, outputTokens, totalTokens };
  } catch {
    return null;
  }
}

function upstreamPath(url) {
  if (url.pathname === '/v1/chat/completions') return '/chat/completions';
  if (url.pathname === '/v1/responses') return '/responses';
  if (url.pathname === '/v1/responses/compact') return '/responses/compact';
  if (url.pathname === '/v1/embeddings') return '/embeddings';
  throw new Error(`Unsupported endpoint ${url.pathname}.`);
}

function connectionTestPayload(prompt, model) {
  return {
    model,
    input: String(prompt || 'Reply exactly: TICPROXY_CONNECTION_OK').slice(0, 4000),
    stream: false,
    store: false,
    max_output_tokens: 64,
  };
}

function routeProviderPlatform(route = {}) {
  const provider = route.provider || {};
  return String(provider.routing?.platform || provider.type || provider.id || '').toLowerCase();
}

function isCodexOAuthRoute(route = {}) {
  const platform = routeProviderPlatform(route);
  return Boolean(
    route.account
    && accountCanRouteModel(route.account)
    && (route.provider?.id === 'codex' || platform.includes('codex'))
    && !providerApiKey(route.provider || {})
  );
}

function codexBackendRoot(provider = {}) {
  const configured = String(provider.baseUrl || '').replace(/\/+$/, '');
  if (/\/backend-api\/codex$/i.test(configured)) return configured;
  return CODEX_BACKEND_BASE_URL;
}

function normalizeCodexInput(input) {
  if (typeof input === 'string') {
    return [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: input }] }];
  }
  if (!Array.isArray(input)) return input;
  return input.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const next = cloneJson(item);
    if (String(next.role || '').toLowerCase() === 'system') next.role = 'developer';
    return next;
  });
}

function normalizeCodexToolType(type) {
  if (type === 'web_search_preview' || type === 'web_search_preview_2025_03_11') return 'web_search';
  return type;
}

function normalizeCodexTools(value) {
  if (!Array.isArray(value)) return value;
  return value.map((tool) => {
    if (!tool || typeof tool !== 'object') return tool;
    return { ...tool, type: normalizeCodexToolType(tool.type) };
  });
}

function codexResponsesPayload(payload, upstreamModel) {
  const body = cloneJson(payload);
  body.model = upstreamModel;
  if (body.instructions === undefined || body.instructions === null) body.instructions = '';
  body.input = normalizeCodexInput(body.input);
  body.stream = true;
  body.store = false;
  body.parallel_tool_calls = true;
  body.include = ['reasoning.encrypted_content'];
  body.tools = normalizeCodexTools(body.tools);
  if (body.tool_choice && typeof body.tool_choice === 'object') {
    body.tool_choice = cloneJson(body.tool_choice);
    body.tool_choice.type = normalizeCodexToolType(body.tool_choice.type);
    body.tool_choice.tools = normalizeCodexTools(body.tool_choice.tools);
  }
  if (body.service_tier && body.service_tier !== 'priority') delete body.service_tier;
  for (const key of [
    'max_output_tokens',
    'max_completion_tokens',
    'temperature',
    'top_p',
    'truncation',
    'context_management',
    'user',
    'previous_response_id',
    'prompt_cache_retention',
    'safety_identifier',
    'stream_options',
  ]) {
    delete body[key];
  }
  return body;
}

function codexUpstreamRequestForRoute(route, url, payload, key) {
  const accountId = codexAccountId(route.account);
  return {
    url: `${codexBackendRoot(route.provider)}${upstreamPath(url)}`,
    body: codexResponsesPayload(payload, route.upstreamModel),
    forceStream: true,
    routeMode: 'codex-cli-oauth',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
      accept: 'text/event-stream',
      connection: 'Keep-Alive',
      originator: CODEX_CLI_ORIGINATOR,
      'user-agent': CODEX_CLI_USER_AGENT,
      ...(accountId ? { 'chatgpt-account-id': accountId } : {}),
      ...route.provider.headers,
    },
  };
}

function outputTextFromResponse(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (Array.isArray(payload.events)) return outputTextFromEvents(payload.events);
  const direct = firstString(payload.output_text, payload.response?.output_text);
  if (direct) return direct;
  const chunks = [];
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (typeof item?.content === 'string') chunks.push(item.content);
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      const text = firstString(content.text, content.output_text, content.input_text);
      if (text) chunks.push(text);
    }
  }
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  for (const choice of choices) {
    const text = firstString(choice.message?.content, choice.delta?.content, choice.text);
    if (text) chunks.push(text);
  }
  return chunks.join('\n').trim();
}

function eventStreamJsonEvents(textBody) {
  const events = [];
  for (const line of String(textBody || '').split(/\r?\n/)) {
    const match = line.match(/^data:\s*(.+)$/);
    if (!match) continue;
    const data = match[1].trim();
    if (!data || data === '[DONE]') continue;
    try {
      events.push(JSON.parse(data));
    } catch {
      // Ignore non-JSON SSE fragments.
    }
  }
  return events;
}

function parseUpstreamResponseBody(textBody, contentType = '') {
  const events = eventStreamJsonEvents(textBody);
  if (events.length) {
    return {
      eventStream: true,
      eventCount: events.length,
      events,
      lastType: firstString(events.at(-1)?.type, events.at(-1)?.response?.status),
      raw: String(textBody || '').slice(0, 1000),
    };
  }
  if (String(contentType || '').includes('event-stream')) return { eventStream: true, eventCount: 0, raw: String(textBody || '').slice(0, 1000) };
  return parseTokenResponse(textBody);
}

function outputTextFromEvents(events = []) {
  const chunks = [];
  for (const event of events) {
    const delta = firstString(event.delta, event.text, event.output_text, event.item?.text);
    if (delta) chunks.push(delta);
    const responseText = outputTextFromResponse(event.response);
    if (responseText) chunks.push(responseText);
    const itemText = outputTextFromResponse({ output: [event.item] });
    if (itemText) chunks.push(itemText);
  }
  return chunks.join('').trim();
}

function upstreamErrorMessage(payload, rawBody) {
  return firstString(
    payload?.error?.message,
    typeof payload?.error === 'string' ? payload.error : '',
    payload?.detail,
    payload?.message,
    payload?.error_description,
    payload?.raw,
    String(rawBody || '').slice(0, 1000),
    'Upstream returned an error.',
  );
}

function modelObjectId(model) {
  return typeof model === 'string' ? model : String(model?.id || '');
}

function upstreamModelForManualAccount(config, provider, requestedModel) {
  const explicit = normalizeRoute(config.routes?.[requestedModel]);
  if (explicit.provider === provider.id) return explicit.model || explicit.upstreamModel || explicit.upstream_model || requestedModel;
  const providerModel = (provider.models || []).find((model) => modelObjectId(model) === requestedModel);
  if (providerModel && typeof providerModel !== 'string') return providerModel.upstreamModel || providerModel.upstream_model || requestedModel;
  return requestedModel;
}

function resolveManualConnectionAccount(config, currentState, target) {
  const wanted = String(target || '').trim();
  if (!wanted) return null;
  const row = resolveAuthRow(config, currentState, wanted);
  const account = authTargetAccount(config, row, wanted);
  if (!account) throw httpError(404, `Auth/account ${wanted} was not found in TicProxy accounts.`);
  const provider = config.providers.find((item) => item.id === account.providerId);
  if (!provider) throw httpError(400, `Provider ${account.providerId || '<missing>'} for account ${account.id} is not configured.`);
  return { row, account, provider };
}

function routeForConnectionTest(config, currentState, requestedModel, payload = {}) {
  const target = firstString(payload.accountId, payload.account_id, payload.name, payload.account, payload.authFile?.name, payload.authFile?.accountId);
  const manual = resolveManualConnectionAccount(config, currentState, target);
  if (!manual) return routeForModel(config, requestedModel, currentState);
  const upstreamModel = upstreamModelForManualAccount(config, manual.provider, requestedModel);
  if (!accountCanRouteModel(manual.account)) throw httpError(401, `Account ${manual.account.id} is an unsupported token import and cannot call model routes. Use OAuth Login to create a supported account.`, 'authentication_error');
  if (!isAccountActive(manual.account)) throw httpError(429, `Account ${manual.account.id} is disabled or not active.`, 'quota_error');
  if (!accountHasUsableCredential(manual.account)) throw httpError(401, `Account ${manual.account.id} has no usable token.`, 'authentication_error');
  if (!accountAllowsModel(manual.account, requestedModel, upstreamModel)) throw httpError(400, `Account ${manual.account.id} is not allowed to serve ${requestedModel}.`);
  return {
    provider: manual.provider,
    account: manual.account,
    requestedModel,
    upstreamModel: accountUpstreamModel(manual.account, requestedModel, upstreamModel),
    strategy: 'manual-account',
  };
}

function connectionTestAccountLabel(account = {}) {
  return accountDisplayName(account);
}

async function connectionTestResult(config, currentState, payload = {}) {
  const requestedModel = String(payload.model || '').trim() || allModels(config)[0]?.id || 'gpt-5.5';
  const prompt = String(payload.prompt || '').trim() || 'Reply exactly: TICPROXY_CONNECTION_OK';
  const checkedAt = now();
  const started = Date.now();
  try {
    const route = routeForConnectionTest(config, currentState, requestedModel, payload);
    const key = await credentialForRoute(route, config);
    const url = new URL('/v1/responses', 'http://ticproxy.local');
    const testPayload = connectionTestPayload(prompt, requestedModel);
    const upstreamRequest = upstreamRequestForRoute(route, url, testPayload, key);
    const upstream = await fetch(upstreamRequest.url, {
      method: 'POST',
      headers: upstreamRequest.headers,
      body: JSON.stringify(upstreamRequest.body),
    });
    const contentType = upstream.headers.get('content-type') || (upstreamRequest.forceStream ? 'text/event-stream' : 'application/json; charset=utf-8');
    const textBody = await upstream.text();
    const parsed = parseUpstreamResponseBody(textBody, contentType);
    recordRouteUsage(currentState, route, extractUsageFromText(textBody, contentType), upstream.status);
    const routeMode = upstreamRequest.routeMode || 'openai-compatible';
    return {
      ok: upstream.ok,
      statusCode: upstream.status,
      checkedAt,
      latencyMs: Date.now() - started,
      provider: route.provider.id,
      accountId: route.account?.id || '',
      accountLabel: route.account ? connectionTestAccountLabel(route.account) : 'Provider API key',
      accountEmail: route.account ? accountEmail(route.account) : '',
      requestedModel: route.requestedModel,
      upstreamModel: route.upstreamModel,
      routeMode,
      routing: route.strategy,
      upstreamUrl: upstreamRequest.url,
      outputText: upstream.ok ? outputTextFromResponse(parsed).slice(0, 1000) : '',
      error: upstream.ok ? '' : upstreamErrorMessage(parsed, textBody).slice(0, 1000),
      responsePreview: redactJson(parsed.eventStream ? { eventStream: true, eventCount: parsed.eventCount, lastType: parsed.lastType, outputText: outputTextFromResponse(parsed).slice(0, 1000) } : parsed),
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: error.status || error.statusCode || 0,
      checkedAt,
      latencyMs: Date.now() - started,
      provider: '',
      accountId: String(payload.accountId || payload.name || ''),
      accountLabel: '',
      accountEmail: '',
      requestedModel,
      upstreamModel: requestedModel,
      routeMode: '',
      routing: '',
      upstreamUrl: '',
      outputText: '',
      error: error.message || String(error),
      responsePreview: {},
    };
  }
}

function tokenExpiresSoon(account) {
  if (!account.refreshToken || !account.expiresAt) return false;
  const expiresAt = Date.parse(account.expiresAt);
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt - Date.now() <= TOKEN_REFRESH_SKEW_MS;
}

function applyClientAuth(oauth, params, headers) {
  const method = String(oauth.tokenAuth || (oauth.clientSecret ? 'client_secret_post' : 'none')).toLowerCase();
  if (method === 'client_secret_basic') {
    const encoded = Buffer.from(`${oauth.clientId}:${oauth.clientSecret}`).toString('base64');
    headers.authorization = `Basic ${encoded}`;
    return;
  }
  if (method !== 'none' && oauth.clientSecret) params.set('client_secret', oauth.clientSecret);
}

function tokenExpiry(payload) {
  const expiryDate = payload.expiry_date ?? payload.expiryDate;
  if (expiryDate) {
    const numeric = Number(expiryDate);
    if (Number.isFinite(numeric)) return new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000).toISOString();
    return String(expiryDate);
  }
  if (payload.expires_at) {
    const numeric = Number(payload.expires_at);
    if (Number.isFinite(numeric)) {
      return new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000).toISOString();
    }
    return String(payload.expires_at);
  }
  if (payload.expires_in) return new Date(Date.now() + Number(payload.expires_in) * 1000).toISOString();
  return '';
}

async function refreshAccountToken(provider, account, config) {
  if (!tokenExpiresSoon(account)) return account;
  const oauth = provider.oauth;
  if (!oauth?.tokenUrl) throw httpError(401, `Account ${account.id} needs refresh but provider ${provider.id} has no token URL.`);
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: account.refreshToken,
    client_id: oauth.clientId,
    ...oauth.tokenParams,
  });
  const headers = { 'content-type': 'application/x-www-form-urlencoded', ...oauth.headers };
  applyClientAuth(oauth, params, headers);
  const response = await fetch(oauth.tokenUrl, { method: 'POST', headers, body: params });
  const payload = await response.json().catch(() => ({}));
  const target = config.accounts.find((item) => item.id === account.id);
  if (!response.ok || !payload.access_token) {
    if (target) {
      target.status = 'error';
      target.error = `Token refresh failed: ${JSON.stringify(payload).slice(0, 500)}`;
      target.updatedAt = now();
      saveProviders(config);
    }
    throw httpError(401, `Token refresh failed for account ${account.id}.`, 'authentication_error');
  }
  if (target) {
    target.accessToken = payload.access_token;
    target.refreshToken = payload.refresh_token || target.refreshToken;
    target.idToken = payload.id_token || payload.idToken || target.idToken || '';
    target.profile = oauthProfileFromToken(provider, { ...payload, id_token: target.idToken }, target.profile);
    if (!target.label || (/^acct-/i.test(target.label) && (target.profile?.email || target.profile?.name))) {
      target.label = firstString(target.profile?.email, target.profile?.name, target.id);
    }
    target.expiresAt = tokenExpiry(payload) || target.expiresAt;
    target.scopes = normalizeStringList(payload.scope || target.scopes);
    target.status = 'active';
    target.error = '';
    target.lastRefreshAt = now();
    target.updatedAt = now();
    saveProviders(config);
    return target;
  }
  return account;
}

async function credentialForRoute(route, config) {
  if (!route.account) return providerApiKey(route.provider);
  const refreshed = await refreshAccountToken(route.provider, route.account, config);
  route.account = refreshed;
  if (accountAccessTokenExpired(refreshed)) throw httpError(401, `Account ${refreshed.id} access token is expired; run OAuth Login again to refresh the account.`, 'authentication_error');
  const tokenValue = accountToken(refreshed);
  if (!tokenValue) throw httpError(401, `Account ${refreshed.id} has no usable token.`, 'authentication_error');
  return tokenValue;
}

function upstreamRequestForRoute(route, url, payload, key) {
  if (isCodexOAuthRoute(route) && (url.pathname === '/v1/responses' || url.pathname === '/v1/responses/compact')) {
    return codexUpstreamRequestForRoute(route, url, payload, key);
  }
  const upstreamRoot = route.provider.baseUrl.endsWith('/v1') ? route.provider.baseUrl : `${route.provider.baseUrl}/v1`;
  return {
    url: `${upstreamRoot}${upstreamPath(url)}`,
    body: { ...payload, model: route.upstreamModel },
    forceStream: false,
    routeMode: 'openai-compatible',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
      ...route.provider.headers,
    },
  };
}

async function proxy(req, res, url) {
  if (!requireProxyKey(req, res)) return;
  const config = providersConfig();
  const routingState = state();
  const proxyKeyId = stableHash(token(req));
  if (!proxyKeyHasQuota(routingState, proxyKeyId)) {
    json(res, 429, { error: { message: 'Proxy API key is over quota for the current day.', type: 'quota_error' } });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/v1/models') {
    json(res, 200, { object: 'list', data: allModels(config) });
    return;
  }
  if (req.method !== 'POST') {
    json(res, 405, { error: { message: 'Method not allowed.', type: 'invalid_request_error' } });
    return;
  }
  const payload = await jsonBody(req);
  const route = routeForModel(config, String(payload.model || ''), routingState);
  const key = await credentialForRoute(route, config);
  const upstreamRequest = upstreamRequestForRoute(route, url, payload, key);
  const upstream = await fetch(upstreamRequest.url, {
    method: 'POST',
    headers: upstreamRequest.headers,
    body: JSON.stringify(upstreamRequest.body),
  });
  const headers = {
    'content-type': upstream.headers.get('content-type') || (upstreamRequest.forceStream ? 'text/event-stream' : 'application/json; charset=utf-8'),
    'cache-control': 'no-store',
    'x-ticmiro-provider': route.provider.id,
    'x-ticmiro-account': route.account?.id || '',
    'x-ticmiro-upstream-model': route.upstreamModel,
    'x-ticmiro-routing': route.strategy,
    'x-ticmiro-route-mode': upstreamRequest.routeMode || 'openai-compatible',
  };
  if ((payload.stream || upstreamRequest.forceStream) && upstream.body) {
    recordUsage(routingState, route, proxyKeyId, null, upstream.status);
    res.writeHead(upstream.status, headers);
    Readable.fromWeb(upstream.body).pipe(res);
    return;
  }
  const textBody = await upstream.text();
  recordUsage(routingState, route, proxyKeyId, extractUsageFromText(textBody, headers['content-type']), upstream.status);
  res.writeHead(upstream.status, headers);
  res.end(textBody);
}

function commandGroup(type) {
  if (String(type || '').startsWith('ticproxy.')) return 'ticproxy';
  if (String(type || '').startsWith('codex.thread.') || String(type || '').startsWith('codex.desktop.')) return 'codex-chat';
  if (String(type || '').startsWith('file.')) return 'files';
  if (String(type || '').startsWith('resident.')) return 'resident';
  return 'tasks';
}

function completeCommand(command, result = {}, summary = '') {
  command.status = 'completed';
  command.result = result;
  command.summary = summary || result.summary || `${command.type} completed.`;
  command.updatedAt = now();
  return command;
}

function failCommand(command, error) {
  command.status = 'failed';
  command.error = error.message || String(error);
  command.updatedAt = now();
  return command;
}

function chooseProvider(config, payload = {}) {
  const providerId = String(payload.providerId || payload.provider_id || payload.provider || '').trim();
  if (providerId) {
    return providerByIdOrPlatform(config, providerId);
  }
  const platform = String(payload.platform || '').trim();
  if (platform) return providerByIdOrPlatform(config, platform);
  return mergedOAuthProviders(config)[0] || config.providers.find((provider) => provider.oauth) || config.providers[0] || null;
}

function redactJson(value) {
  if (Array.isArray(value)) return value.map(redactJson);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (/token|secret|key|authorization|password/i.test(key)) {
      out[key] = redactedSecret(item);
    } else {
      out[key] = redactJson(item);
    }
  }
  return out;
}

function saveLocalConfig(currentState, patch) {
  currentState.localConfig = {
    ...(currentState.localConfig || {}),
    ...patch,
  };
}

function importAuthText(config, payload = {}) {
  const rawText = String(payload.text || payload.content || payload.json || '').trim();
  if (!rawText) throw httpError(400, 'Auth JSON text is required.');
  const tokenPayload = parseJsonLike(rawText, 'auth JSON text');
  const provider = chooseProvider(config, { ...payload, ...tokenPayload });
  if (!provider) throw httpError(400, 'No provider is configured for this auth payload.');
  ensureProviderInConfig(config, provider);
  const name = safeAuthFileName(payload.name || payload.fileName || `${provider.id}-${stableHash(rawText)}`);
  const account = createAccountFromTokenPayload(provider, {
    ...payload,
    content: tokenPayload,
    name,
  });
  ensureDir(AUTH_DIR);
  writeJson(path.join(AUTH_DIR, name), {
    providerId: provider.id,
    accountId: account.id,
    label: account.label,
    importedAt: now(),
    tokenPayload,
  });
  config.accounts = [...(config.accounts || []).filter((item) => item.id !== account.id), account];
  saveProviders(config);
  return { name, account: adminAccount(account), authFile: listAuthFiles().find((file) => file.name === name) };
}

function authFilePathByName(name) {
  const safeName = safeAuthFileName(name);
  const fullPath = path.resolve(AUTH_DIR, safeName);
  if (!fullPath.startsWith(path.resolve(AUTH_DIR))) throw httpError(400, 'Auth file name is invalid.');
  return fullPath;
}

function readAuthFile(name) {
  const file = authFilePathByName(name);
  if (!fs.existsSync(file)) throw httpError(404, `Auth file ${name} was not found.`);
  return readJson(file, {});
}

function authFileNameForServer(item = {}) {
  return item.name || item.filename || item.file || item.id || item.accountId || item.account || item.email || '';
}

function authRowQuotaKey(item = {}) {
  return String(item.name || item.filename || item.file || item.id || item.accountId || item.account_id || item.email || item.account || '').trim();
}

function authTargetValues(item = {}) {
  return [
    authRowQuotaKey(item),
    authFileNameForServer(item),
    item.name,
    item.filename,
    item.file,
    item.id,
    item.accountId,
    item.account_id,
    item.account,
    item.email,
    item.label,
    item.displayName,
  ].map((value) => String(value || '').trim()).filter(Boolean);
}

function authTargetMatches(item = {}, target) {
  const wanted = String(target || '').trim();
  if (!wanted) return false;
  return authTargetValues(item).some((value) => value === wanted);
}

function resolveAuthRow(config, currentState, target) {
  const rows = authFileRows(config, currentState);
  return rows.find((row) => authTargetMatches(row, target)) || null;
}

function matchingAuthFiles(config, currentState, target) {
  const row = resolveAuthRow(config, currentState, target);
  const accountId = row?.accountId || row?.account_id || '';
  return listAuthFiles().filter((file) => authTargetMatches(file, target) || (accountId && file.accountId === accountId));
}

function authTargetAccount(config, row, target) {
  if (!row && !target) return null;
  const wanted = String(target || '').trim();
  return (config.accounts || []).find((account) => (
    accountLookupKeys(account).some((key) => key === row?.accountId || key === row?.id || key === wanted)
    || accountEmail(account) === wanted
    || account.profile?.email === wanted
    || account.label === wanted
    || row?.email && accountEmail(account) === row.email
  )) || null;
}

function readAuthTarget(config, currentState, target) {
  const row = resolveAuthRow(config, currentState, target);
  if (!row) throw httpError(404, `Auth/account ${target || '<missing>'} was not found.`);
  const files = matchingAuthFiles(config, currentState, target).map((file) => {
    const payload = readAuthFile(file.name);
    return { name: file.name, payload: redactJson(payload) };
  });
  const account = authTargetAccount(config, row, target);
  return {
    name: authFileNameForServer(row),
    row: redactJson(row),
    files,
    account: account ? adminAccount(account, currentState.usage?.accounts?.[account.id]) : null,
    disabled: account ? !isAccountActive(account) : Boolean(row.disabled),
  };
}

function setAuthTargetStatus(config, currentState, target, disabled) {
  const row = resolveAuthRow(config, currentState, target);
  if (!row) throw httpError(404, `Auth/account ${target || '<missing>'} was not found.`);
  const files = matchingAuthFiles(config, currentState, target);
  for (const file of files) {
    const payload = readAuthFile(file.name);
    payload.disabled = Boolean(disabled);
    writeJson(authFilePathByName(file.name), payload);
  }
  const account = authTargetAccount(config, row, target);
  if (account) {
    account.status = disabled ? 'disabled' : 'active';
    account.updatedAt = now();
    saveProviders(config);
  }
  return {
    name: authFileNameForServer(row),
    disabled: Boolean(disabled),
    accountId: account?.id || row.accountId || '',
    files: files.map((file) => file.name),
  };
}

function deleteAuthTargets(config, currentState, targets) {
  const deletedFiles = [];
  const deletedAccounts = new Set();
  for (const target of targets.map((value) => String(value || '').trim()).filter(Boolean)) {
    const row = resolveAuthRow(config, currentState, target);
    const files = row ? matchingAuthFiles(config, currentState, target) : [];
    if (!files.length) {
      const file = authFilePathByName(target);
      if (fs.existsSync(file)) files.push({ name: path.basename(file) });
    }
    for (const file of files) {
      const fullPath = authFilePathByName(file.name);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        deletedFiles.push(file.name);
      }
    }
    const account = authTargetAccount(config, row, target);
    if (account) deletedAccounts.add(account.id);
  }
  if (deletedAccounts.size) {
    config.accounts = (config.accounts || []).filter((account) => !deletedAccounts.has(account.id));
    saveProviders(config);
  }
  return { deletedFiles: [...new Set(deletedFiles)], deletedAccounts: [...deletedAccounts] };
}

function generateProxyApiKey() {
  return `ticproxy_${crypto.randomBytes(24).toString('base64url')}`;
}

const QUOTA_TARGETS = {
  codex: {
    method: 'GET',
    url: 'https://chatgpt.com/backend-api/wham/usage',
    headers: { 'user-agent': 'codex_cli_rs/0.76.0 WindowsTerminal' },
  },
  anthropic: {
    method: 'GET',
    url: 'https://api.anthropic.com/api/oauth/usage',
    headers: { 'anthropic-beta': 'oauth-2025-04-20' },
  },
  'gemini-cli': {
    method: 'POST',
    url: 'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota',
  },
  antigravity: {
    method: 'POST',
    url: 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
  },
  kimi: {
    method: 'GET',
    url: 'https://api.kimi.com/coding/v1/usages',
  },
};

function findDeepValue(source, names, seen = new Set()) {
  if (!source || typeof source !== 'object' || seen.has(source)) return '';
  seen.add(source);
  const wanted = new Set(names.map((name) => String(name || '').replace(/[-_\s]/g, '').toLowerCase()));
  for (const [key, value] of Object.entries(source)) {
    const normalized = key.replace(/[-_\s]/g, '').toLowerCase();
    if (wanted.has(normalized) && value !== undefined && value !== null && typeof value !== 'object') return String(value);
  }
  for (const value of Object.values(source)) {
    const found = findDeepValue(value, names, seen);
    if (found) return found;
  }
  return '';
}

function quotaProjectId(account, row) {
  return firstString(
    row.projectId,
    row.project_id,
    account.projectId,
    account.project_id,
    account.profile?.projectId,
    findDeepValue(account.profile, ['projectid']),
  );
}

function codexAccountId(account = {}) {
  return firstString(
    account.providerSpecificData?.chatgptAccountId,
    account.providerSpecificData?.chatgpt_account_id,
    account.profile?.accountId,
    account.profile?.chatgptAccountId,
    account.accountId,
    findDeepValue(jwtPayload(account.idToken), ['chatgptaccountid']),
    findDeepValue(jwtPayload(account.accessToken), ['chatgptaccountid']),
  );
}

async function quotaProbeHttp(config, provider, account, row) {
  const target = QUOTA_TARGETS[provider.id] || QUOTA_TARGETS[provider.routing?.platform];
  if (!target) throw httpError(400, `No direct quota probe is configured for provider ${provider.id}.`);
  let activeAccount = account;
  if (activeAccount?.refreshToken && tokenExpiresSoon(activeAccount)) {
    activeAccount = await refreshAccountToken(provider, activeAccount, config);
  }
  const accessToken = accountToken(activeAccount);
  if (!accessToken) throw httpError(400, `Account ${account.id} has no OAuth access token.`);

  const headers = {
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
    accept: 'application/json',
    ...(target.headers || {}),
  };
  if (provider.id === 'codex') {
    const accountId = codexAccountId(activeAccount);
    if (accountId) headers['chatgpt-account-id'] = accountId;
  }

  let body;
  if (provider.id === 'gemini-cli' || provider.id === 'antigravity') {
    const projectId = quotaProjectId(activeAccount, row);
    if (!projectId) throw httpError(400, `${provider.id} quota needs project_id in the auth metadata.`);
    body = JSON.stringify({ project: projectId });
  }

  const response = await fetch(target.url, {
    method: target.method,
    headers,
    body,
  });
  const textBody = await response.text();
  const parsedBody = parseTokenResponse(textBody);
  return {
    ok: response.ok,
    statusCode: response.status,
    body: parsedBody,
    error: response.ok ? '' : firstString(parsedBody.error?.message, parsedBody.error_description, parsedBody.error, parsedBody.message, parsedBody.raw, textBody.slice(0, 500)),
  };
}

async function quotaProbeResult(config, currentState, name) {
  const row = resolveAuthRow(config, currentState, name);
  if (!row) throw httpError(404, `Auth/account ${name} was not found.`);
  const account = authTargetAccount(config, row, name);
  const usage = account ? publicUsageBucket(currentState.usage?.accounts?.[account.id]) : row.usage;
  const providerId = row.providerId || row.provider || account?.providerId || 'auth-file';
  const provider = account ? config.providers.find((item) => item.id === account.providerId) : null;
  const quotaKey = authRowQuotaKey(row);
  const displayName = accountDisplayName(account, row);
  const email = accountEmail(account, row);
  const baseResult = {
    ok: true,
    name: quotaKey,
    quotaKey,
    target: name,
    accountId: row.accountId || account?.id || '',
    displayName,
    accountLabel: displayName,
    accountEmail: email,
    email,
    provider: providerId,
    checkedAt: now(),
    quota: account?.quota || row.quota || {},
    usage: usage || null,
    response: {
      requestsUsed: usage?.requests || 0,
      tokensUsed: usage?.totalTokens || 0,
      requestsPerDay: account?.quota?.requestsPerDay || 0,
      tokensPerDay: account?.quota?.tokensPerDay || 0,
      lastUsedAt: usage?.lastUsedAt || '',
    },
  };

  if (!account || !provider) {
    return {
      ...baseResult,
      ok: false,
      error: 'Direct quota check needs a configured OAuth account. This row only has local usage metadata.',
    };
  }
  const accountKind = `${account.type || ''} ${account.id || ''} ${account.label || ''}`.toLowerCase();
  if (accountCanRouteModel(account) && !account.refreshToken && !account.idToken && (account.type !== 'oauth' || accountKind.includes('api-key') || accountKind.includes('apikey'))) {
    return {
      ...baseResult,
      ok: false,
      error: 'Direct quota check is available for OAuth login accounts, not plain API-key accounts.',
    };
  }

  try {
    const probe = await quotaProbeHttp(config, provider, account, row);
    return {
      ...baseResult,
      ok: probe.ok,
      statusCode: probe.statusCode,
      error: probe.error,
      response: probe.body,
    };
  } catch (error) {
    return {
      ...baseResult,
      ok: false,
      error: error.message || String(error),
      response: {
        requestsUsed: usage?.requests || 0,
        tokensUsed: usage?.totalTokens || 0,
        lastUsedAt: usage?.lastUsedAt || '',
        error: error.message || String(error),
      },
    };
  }
}

async function runImmediateCommand(command, currentState) {
  const config = providersConfig();
  const payload = command.payload || {};
  if (command.type === 'snapshot.refresh') {
    return completeCommand(command, buildDashboardPayload(currentState), 'Snapshot refreshed.');
  }
  if (command.type === 'ticproxy.management.refresh') {
    return completeCommand(command, {
      management: buildTicProxyManagement(config, currentState),
    }, 'TicProxy management refreshed.');
  }
  if (command.type === 'ticproxy.oauth.start') {
    const provider = chooseProvider(config, payload);
    if (!provider) throw httpError(400, 'No provider is configured for OAuth.');
    const projectId = String(payload.projectId || payload.project_id || '').trim();
    const result = startOAuthFlow(provider, {
      accountLabel: payload.accountLabel || payload.account_label || '',
      models: payload.models || '',
      scopes: payload.scopes || '',
      callbackUrl: payload.callbackUrl || payload.callback_url || '',
      authorizationParams: projectId ? { project_id: projectId } : {},
      tokenParams: projectId ? { project_id: projectId } : {},
    });
    return completeCommand(command, {
      url: result.authUrl,
      authUrl: result.authUrl,
      state: result.state,
      callbackUrl: result.callbackUrl,
      statusUrl: `${PUBLIC_BASE_URL}/admin/oauth/status?state=${encodeURIComponent(result.state)}`,
      providerId: provider.id,
      adapter: result.adapter,
    }, 'OAuth URL created.');
  }
  if (command.type === 'ticproxy.oauth.poll') {
    const oauthState = String(payload.state || payload.oauthState || '').trim();
    const flow = currentState.oauthStatus?.[oauthState];
    if (!oauthState || !flow) throw httpError(404, `OAuth state ${oauthState || '<missing>'} was not found.`);
    return completeCommand(command, {
      flow: publicOAuthStatus(flow),
      status: flow.status || 'unknown',
      state: oauthState,
      providerId: flow.providerId || '',
      callbackUrl: flow.callbackUrl || '',
    }, `OAuth status: ${flow.status || 'unknown'}.`);
  }
  if (command.type === 'ticproxy.oauth.callback') {
    const { account, flow } = await completeOAuthRedirect(payload);
    return completeCommand(command, publicCallbackResult(account, flow), 'OAuth callback saved.');
  }
  if (command.type === 'ticproxy.auth.uploadText') {
    const result = importAuthText(config, payload);
    return completeCommand(command, result, 'Auth JSON imported.');
  }
  if (command.type === 'ticproxy.auth.view') {
    const name = String(payload.name || '').trim();
    const target = readAuthTarget(config, currentState, name);
    return completeCommand(command, {
      name: target.name,
      text: JSON.stringify(target, null, 2),
    }, 'Auth/account loaded.');
  }
  if (command.type === 'ticproxy.auth.delete') {
    const names = Array.isArray(payload.names) ? payload.names : [payload.name].filter(Boolean);
    const deleted = deleteAuthTargets(config, currentState, names);
    return completeCommand(command, deleted, 'Auth/account deleted.');
  }
  if (command.type === 'ticproxy.auth.deleteAll') {
    if (String(payload.confirm || '') !== 'delete all auth files') throw httpError(400, 'Delete confirmation is required.');
    ensureDir(AUTH_DIR);
    const names = fs.readdirSync(AUTH_DIR).filter((name) => name.endsWith('.json'));
    for (const name of names) fs.unlinkSync(path.join(AUTH_DIR, name));
    const deletedAccounts = (config.accounts || []).map((account) => account.id);
    config.accounts = [];
    saveProviders(config);
    return completeCommand(command, { deletedFiles: names, deletedAccounts }, 'All auth/accounts deleted.');
  }
  if (command.type === 'ticproxy.auth.status') {
    const name = String(payload.name || '').trim();
    const result = setAuthTargetStatus(config, currentState, name, Boolean(payload.disabled));
    return completeCommand(command, result, 'Auth/account status updated.');
  }
  if (command.type === 'ticproxy.auth.models') {
    const name = String(payload.name || '').trim();
    const row = authFileRows(config, currentState).find((item) => authFileNameForServer(item) === name || item.accountId === name);
    const provider = config.providers.find((item) => item.id === (row?.providerId || row?.provider));
    return completeCommand(command, {
      name,
      models: providerModelIds(provider || {}),
    }, 'Auth models loaded.');
  }
  if (command.type === 'ticproxy.quota.usageQueue') {
    const count = Math.max(1, Math.min(100, Number(payload.count || 10)));
    return completeCommand(command, { rows: usageRows(currentState).slice(0, count) }, 'Usage queue loaded.');
  }
  if (command.type === 'ticproxy.quota.probe') {
    const name = String(payload.name || payload.authFile?.name || payload.authFile?.accountId || '').trim();
    return completeCommand(command, await quotaProbeResult(config, currentState, name), 'Quota loaded.');
  }
  if (command.type === 'ticproxy.quota.probeAll') {
    const results = await Promise.all(authFileRows(config, currentState).map((item) => quotaProbeResult(config, currentState, authFileNameForServer(item))));
    return completeCommand(command, { results }, 'Quota loaded for all accounts.');
  }
  if (command.type === 'ticproxy.connection.test') {
    const result = await connectionTestResult(config, currentState, payload);
    return completeCommand(command, result, result.ok
      ? `TicProxy connection OK: ${result.accountLabel || result.provider || result.routeMode}.`
      : `TicProxy connection failed${result.statusCode ? ` ${result.statusCode}` : ''}: ${result.error || 'unknown error'}`);
  }
  if (command.type === 'ticproxy.logs.refresh') {
    return completeCommand(command, { lines: buildTicProxyManagement(config, currentState).logs }, 'Logs loaded.');
  }
  if (command.type === 'ticproxy.logs.clear') {
    currentState.events = [];
    return completeCommand(command, { cleared: true }, 'Logs cleared.');
  }
  if (command.type === 'ticproxy.errorLog.download') {
    return completeCommand(command, { name: payload.name || '', lines: [] }, 'No error log found.');
  }
  if (command.type === 'ticproxy.config.updateBasic') {
    saveLocalConfig(currentState, { basic: { ...(currentState.localConfig?.basic || {}), ...(payload.basic || {}) } });
    return completeCommand(command, { management: buildTicProxyManagement(config, currentState) }, 'Basic settings saved.');
  }
  if (command.type === 'ticproxy.apiKeys.add') {
    const generated = !String(payload.key || '').trim();
    const key = String(payload.key || '').trim() || generateProxyApiKey();
    const localKeys = splitList(currentState.localConfig?.proxyKeys);
    saveLocalConfig(currentState, { proxyKeys: [...new Set([...localKeys, key])] });
    return completeCommand(command, {
      key,
      redactedKey: redactedSecret(key),
      generated,
    }, generated ? 'Proxy API key generated.' : 'Proxy API key added.');
  }
  if (command.type === 'ticproxy.apiKeys.delete') {
    const index = Number(payload.index);
    const envKeyCount = PROXY_KEYS.size;
    const localKeys = splitList(currentState.localConfig?.proxyKeys);
    if (index >= envKeyCount) {
      localKeys.splice(index - envKeyCount, 1);
      saveLocalConfig(currentState, { proxyKeys: localKeys });
    }
    return completeCommand(command, { index, envKeyReadOnly: index < envKeyCount }, index < envKeyCount ? 'Install-time keys are read-only.' : 'Proxy API key deleted.');
  }
  if (command.type === 'ticproxy.config.saveYaml') {
    return completeCommand(command, { readOnly: true }, 'Self-host config is saved through Providers/Accounts, not raw YAML.');
  }
  if (command.type === 'ticproxy.provider.save') {
    const providerId = String(payload.provider || payload.providerId || '').trim();
    const current = config.providers.find((provider) => provider.id === providerId);
    const [first] = Array.isArray(payload.items) ? payload.items : [];
    if (!current || !first) throw httpError(400, 'Provider payload is invalid.');
    const provider = normalizeProvider(mergeProviderSecrets(current, {
      ...current,
      ...first,
      id: current.id,
      label: first.name || first.label || current.label,
      baseUrl: first.baseUrl || first['base-url'] || current.baseUrl,
      models: first.models || current.models,
    }));
    config.providers = config.providers.map((item) => (item.id === provider.id ? provider : item));
    saveProviders(config);
    return completeCommand(command, { provider: adminProvider(provider, providersConfig()) }, 'Provider saved.');
  }
  if (command.type === 'ticproxy.provider.delete') {
    return completeCommand(command, { readOnly: true }, 'Provider delete is disabled here. Remove providers in providers.json if needed.');
  }
  if (command.type === 'ticproxy.oauth.excluded.save') {
    saveLocalConfig(currentState, { oauthExcludedModels: payload.models || {} });
    return completeCommand(command, { models: payload.models || {} }, 'OAuth excluded models saved.');
  }
  if (command.type === 'ticproxy.oauth.alias.save') {
    saveLocalConfig(currentState, { oauthModelAlias: payload.aliases || {} });
    return completeCommand(command, { aliases: payload.aliases || {} }, 'OAuth model aliases saved.');
  }
  if (command.type === 'codex.thread.read') {
    const snapshot = buildDashboardSnapshot(config, currentState);
    const threadId = String(payload.threadId || '').trim();
    const thread = (snapshot.codex.threads || []).find((item) => item.id === threadId);
    if (!thread) throw httpError(404, `Thread ${threadId || '<missing>'} was not found.`);
    return completeCommand(command, {
      thread,
      messages: snapshot.codex.messagesByThread?.[threadId] || [],
    }, 'Thread loaded.');
  }
  if (command.type === 'codex.provider.switch') {
    return completeCommand(command, {
      provider: payload.provider || '',
      model: payload.model || '',
      readOnly: true,
    }, 'Codex provider switch requires the desktop agent profile; current server kept settings unchanged.');
  }
  return null;
}

function commandPayloadHasSecret(type) {
  return ['ticproxy.auth.uploadText', 'ticproxy.connection.test'].includes(String(type || ''));
}

function redactedCommandPayload(type, payload = {}) {
  if (!commandPayloadHasSecret(type)) return payload || {};
  if (String(type || '') === 'ticproxy.connection.test') {
    return {
      name: String(payload.name || payload.account || '').trim(),
      accountId: String(payload.accountId || payload.account_id || payload.authFile?.accountId || '').trim(),
      model: String(payload.model || '').trim(),
      prompt: '[prompt redacted]',
    };
  }
  return {
    name: String(payload.name || payload.fileName || '').trim(),
    provider: String(payload.provider || payload.providerId || '').trim(),
    text: '[secret payload redacted]',
  };
}

async function createMobileCommand(currentState, type, payload) {
  const localConfigBefore = JSON.stringify(currentState.localConfig || {});
  const command = {
    id: id('cmd'),
    type,
    status: 'pending',
    payload: payload || {},
    createdAt: now(),
    updatedAt: now(),
  };
  try {
    const completed = await runImmediateCommand(command, currentState);
    if (!completed) {
      command.status = 'pending';
    }
  } catch (error) {
    failCommand(command, error);
  }
  const next = state();
  if (JSON.stringify(currentState.localConfig || {}) !== localConfigBefore) {
    next.localConfig = currentState.localConfig || {};
  }
  if (type === 'ticproxy.logs.clear') {
    next.events = [];
  }
  if (commandPayloadHasSecret(type)) {
    command.payload = redactedCommandPayload(type, payload);
    command.payloadPreview = '[secret payload redacted]';
  }
  next.commands = [...(next.commands || []), command];
  next.events = [...(next.events || []), {
    at: now(),
    type: command.status === 'failed' ? 'command.failed' : 'command.created',
    payload: { id: command.id, type: command.type, group: commandGroup(command.type), status: command.status },
  }];
  saveState(next);
  return command;
}

async function mobileApi(req, res, url) {
  if (!requireToken(req, res, MOBILE_TOKEN, 'Mobile')) return;
  const next = state();
  if (req.method === 'GET' && url.pathname === '/api/dashboard') {
    json(res, 200, buildDashboardPayload(next));
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/files') {
    const snapshot = buildDashboardSnapshot(providersConfig(), next);
    json(res, 200, {
      ok: true,
      roots: snapshot.files?.roots || [],
      entries: [],
      lastResult: (next.commands || []).map(publicCommand).reverse().find((command) => String(command.type || '').startsWith('file.')) || null,
    });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/tasks') {
    const snapshot = buildDashboardSnapshot(providersConfig(), next);
    json(res, 200, {
      ok: true,
      snapshot: snapshot.tasks || {},
      lastResult: (next.commands || []).map(publicCommand).reverse().find((command) => ['task.snapshot', 'codex.exec', 'codex.provider.switch'].includes(command.type)) || null,
    });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/ticproxy') {
    const config = providersConfig();
    json(res, 200, {
      ok: true,
      snapshot: { management: buildTicProxyManagement(config, next) },
      lastResult: (next.commands || []).map(publicCommand).reverse().find((command) => String(command.type || '').startsWith('ticproxy.')) || null,
    });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/oauth/status') {
    const oauthState = url.searchParams.get('state') || url.searchParams.get('authId') || url.searchParams.get('id') || '';
    const flow = next.oauthStatus?.[oauthState];
    if (!oauthState || !flow) {
      json(res, 404, { ok: false, error: `OAuth state ${oauthState || '<missing>'} was not found.` });
      return;
    }
    json(res, 200, { ok: true, flow: publicOAuthStatus(flow) });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/codex-chat') {
    const snapshot = buildDashboardSnapshot(providersConfig(), next);
    const commands = (next.commands || []).map(publicCommand);
    json(res, 200, {
      ok: true,
      threads: snapshot.codex.threads || [],
      messagesByThread: snapshot.codex.messagesByThread || {},
      recentCommands: commands.filter((command) => String(command.type || '').startsWith('codex.thread.') || String(command.type || '').startsWith('codex.desktop.')).slice(-80),
      runningCommands: commands.filter((command) => (String(command.type || '').startsWith('codex.thread.') || String(command.type || '').startsWith('codex.desktop.')) && ['pending', 'running'].includes(command.status)),
      lastResult: commands.reverse().find((command) => String(command.type || '').startsWith('codex.thread.') || String(command.type || '').startsWith('codex.desktop.')) || null,
    });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/commands') {
    json(res, 200, { ok: true, commands: commandsForApi(next, url) });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/threads') {
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 40)));
    const snapshot = buildDashboardSnapshot(providersConfig(), next);
    json(res, 200, {
      ok: true,
      syncedAt: snapshot.codex.threadSync?.syncedAt || snapshot.updatedAt || '',
      error: snapshot.codex.threadSync?.error || '',
      threads: (snapshot.codex.threads || []).slice(0, limit),
    });
    return;
  }
  const threadMatch = url.pathname.match(/^\/api\/threads\/([^/]+)$/);
  if (req.method === 'GET' && threadMatch) {
    const threadId = decodeURIComponent(threadMatch[1]);
    const snapshot = buildDashboardSnapshot(providersConfig(), next);
    const thread = (snapshot.codex.threads || []).find((item) => item.id === threadId);
    if (!thread) {
      json(res, 404, { ok: false, error: 'Thread not found. Start or refresh the Windows bridge snapshot first.' });
      return;
    }
    json(res, 200, {
      ok: true,
      syncedAt: snapshot.codex.threadSync?.syncedAt || snapshot.updatedAt || '',
      thread,
      messages: snapshot.codex.messagesByThread?.[threadId] || [],
    });
    return;
  }
  const threadSendMatch = url.pathname.match(/^\/api\/threads\/([^/]+)\/send$/);
  if (req.method === 'POST' && threadSendMatch) {
    const threadId = decodeURIComponent(threadSendMatch[1]);
    const payload = await jsonBody(req);
    const message = String(payload.message || payload.prompt || '').trim();
    if (!message) throw httpError(400, 'Message is required.');
    const command = await createMobileCommand(next, 'codex.thread.send', { threadId, message, attachmentIds: payload.attachmentIds || [] });
    json(res, 200, { ok: true, command: publicCommand(command) });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/uploads') {
    const payload = await jsonBody(req);
    const files = Array.isArray(payload.files) ? payload.files : [];
    const attachments = files.map((file) => ({
      id: id('att'),
      kind: /^image\//.test(file.type || '') ? 'image' : 'file',
      name: String(file.name || 'attachment'),
      type: String(file.type || 'application/octet-stream'),
      size: Number(file.size || 0),
      createdAt: now(),
    }));
    json(res, 200, { ok: true, attachments });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/commands') {
    const payload = await jsonBody(req);
    const command = await createMobileCommand(next, String(payload.type || 'note'), payload.payload || {});
    json(res, 200, { ok: true, command: publicCommand(command) });
    return;
  }
  const commandMatch = url.pathname.match(/^\/api\/commands\/([^/]+)$/);
  if (req.method === 'GET' && commandMatch) {
    const commandId = decodeURIComponent(commandMatch[1]);
    const command = (next.commands || []).find((item) => item.id === commandId);
    if (!command) {
      json(res, 404, { ok: false, error: 'Command not found.' });
      return;
    }
    json(res, 200, { ok: true, command: publicCommand(command) });
    return;
  }
  json(res, 404, { ok: false, error: 'Not found.' });
}

async function agentApi(req, res, url) {
  if (!requireToken(req, res, AGENT_TOKEN, 'Agent')) return;
  const next = state();
  if (req.method === 'POST' && url.pathname === '/agent/heartbeat') {
    const payload = await jsonBody(req);
    const agentId = String(payload.agentId || 'windows-bridge');
    next.agents[agentId] = { ...payload, agentId, lastSeenAt: now() };
    saveState(next);
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/agent/snapshot') {
    next.snapshot = { ...(await jsonBody(req)), updatedAt: now() };
    saveState(next);
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/agent/oauth-callback') {
    const payload = await jsonBody(req);
    const { account, flow } = await completeOAuthRedirect(payload);
    json(res, 200, publicCallbackResult(account, flow));
    return;
  }
  if (req.method === 'POST' && url.pathname === '/agent/ticproxy/api-one-key/material') {
    const payload = await jsonBody(req);
    const config = providersConfig();
    const result = apiOneKeyMaterial(config, next, payload);
    saveState(next);
    json(res, 200, { ok: true, ...result });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/agent/commands/claim') {
    const command = (next.commands || []).find((item) => item.status === 'pending');
    if (!command) {
      json(res, 200, { ok: true, command: null });
      return;
    }
    command.status = 'running';
    command.updatedAt = now();
    command.claimedAt = now();
    saveState(next);
    json(res, 200, { ok: true, command });
    return;
  }
  const resultMatch = url.pathname.match(/^\/agent\/commands\/([^/]+)\/result$/);
  if (req.method === 'POST' && resultMatch) {
    const command = (next.commands || []).find((item) => item.id === decodeURIComponent(resultMatch[1]));
    if (!command) {
      json(res, 404, { ok: false, error: 'Command not found.' });
      return;
    }
    const payload = await jsonBody(req);
    command.status = payload.status || 'completed';
    command.result = payload.result || null;
    command.error = payload.error || '';
    command.updatedAt = now();
    next.events = [...(next.events || []), { at: now(), type: 'command.result', payload: { id: command.id, status: command.status } }];
    saveState(next);
    json(res, 200, { ok: true });
    return;
  }
  json(res, 404, { ok: false, error: 'Not found.' });
}

function createPkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function applySearchParams(url, params) {
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
}

function buildAuthorizationUrl(provider, pending, payload = {}) {
  const oauth = provider.oauth;
  const authUrl = new URL(oauth.authorizationUrl);
  applySearchParams(authUrl, {
    response_type: 'code',
    client_id: oauth.clientId,
    redirect_uri: pending.callbackUrl,
    state: pending.state,
    code_challenge: pending.challenge,
    code_challenge_method: 'S256',
    ...oauth.authorizationParams,
    ...objectOrEmpty(payload.authorizationParams || payload.authorization_params),
  });
  const scopes = normalizeStringList(payload.scopes || payload.scope || oauth.scopes);
  if (scopes.length) {
    const scopeParam = oauth.scopeParam || 'scope';
    if (oauth.scopeSeparator === 'repeat') {
      for (const scope of scopes) authUrl.searchParams.append(scopeParam, scope);
    } else {
      authUrl.searchParams.set(scopeParam, scopes.join(oauth.scopeSeparator || ' '));
    }
  }
  return authUrl;
}

async function exchangeAuthorizationCode(provider, pending, code) {
  const oauth = provider.oauth;
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: pending.callbackUrl,
    client_id: oauth.clientId,
    code_verifier: pending.verifier,
    ...oauth.tokenParams,
    ...objectOrEmpty(pending.tokenParams),
  });
  const headers = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', ...oauth.headers };
  applyClientAuth(oauth, params, headers);
  const response = await fetch(oauth.tokenUrl, { method: 'POST', headers, body: params });
  const rawBody = await response.text();
  const payload = parseTokenResponse(rawBody);
  if (!response.ok || !payload.access_token) {
    throw httpError(502, tokenExchangeError(provider, response.status, payload, rawBody), 'authentication_error');
  }
  return payload;
}

function parseTokenResponse(rawBody) {
  const textValue = String(rawBody || '').trim();
  if (!textValue) return {};
  try {
    return JSON.parse(textValue);
  } catch {
    return { raw: textValue.slice(0, 1000) };
  }
}

function tokenExchangeError(provider, status, payload, rawBody) {
  const details = firstString(
    payload.error_description,
    typeof payload.error === 'string' ? payload.error : '',
    payload.error?.message,
    payload.message,
    payload.raw,
    String(rawBody || '').slice(0, 1000),
    'empty token response',
  );
  return `Token exchange failed for ${provider.id} with status ${status}: ${details}`;
}

function valueAtPath(source, pathValue) {
  if (!pathValue) return '';
  return String(pathValue).split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), source) || '';
}

async function fetchOAuthProfile(provider, accessToken) {
  const oauth = provider.oauth;
  if (!oauth?.profileUrl) return {};
  const response = await fetch(oauth.profileUrl, {
    headers: { authorization: `Bearer ${accessToken}`, ...oauth.profileHeaders },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { error: `Profile fetch failed: ${JSON.stringify(payload).slice(0, 300)}` };
  const map = oauth.profileFieldMap || {};
  return {
    id: valueAtPath(payload, map.id) || payload.id || payload.sub || '',
    sub: valueAtPath(payload, map.sub) || payload.sub || '',
    email: valueAtPath(payload, map.email) || payload.email || '',
    name: valueAtPath(payload, map.name) || payload.name || '',
    organization: valueAtPath(payload, map.organization) || payload.organization || '',
    team: valueAtPath(payload, map.team) || payload.team || '',
  };
}

function oauthProfileFromToken(provider, tokenPayload, profile = {}) {
  const enriched = enrichProfileFromTokenPayload(profile, tokenPayload);
  const map = provider.oauth?.profileFieldMap || {};
  return {
    id: valueAtPath(enriched, map.id) || enriched.id || enriched.sub || '',
    sub: valueAtPath(enriched, map.sub) || enriched.sub || '',
    email: valueAtPath(enriched, map.email) || enriched.email || '',
    name: valueAtPath(enriched, map.name) || enriched.name || '',
    organization: valueAtPath(enriched, map.organization) || enriched.organization || '',
    team: valueAtPath(enriched, map.team) || enriched.team || '',
    accountId: enriched.accountId || '',
    planType: enriched.planType || '',
  };
}

function oauthAccountLabel(provider, pending, profile) {
  return pending.accountLabel || profile.email || profile.name || `${provider.label || provider.id} account`;
}

function adminAliasPath(pathname) {
  const aliases = new Set([
    '/codex-auth-url',
    '/gemini-cli-auth-url',
    '/antigravity-auth-url',
    '/get-auth-status',
    '/oauth/status',
    '/oauth-callback',
    '/auth-files',
  ]);
  return aliases.has(pathname) ? `/admin${pathname}` : '';
}

function providerForPlatform(config, platform) {
  const normalized = String(platform || '').trim().toLowerCase();
  return config.providers.find((provider) => String(provider.routing?.platform || '').toLowerCase() === normalized)
    || config.providers.find((provider) => String(provider.id || '').toLowerCase().includes(normalized));
}

function markOAuthStatus(next, oauthState, patch) {
  const existing = next.oauthStatus?.[oauthState] || {};
  next.oauthStatus = {
    ...(next.oauthStatus || {}),
    [oauthState]: {
      ...existing,
      ...patch,
      state: oauthState,
      updatedAt: now(),
    },
  };
}

function startOAuthFlow(provider, payload = {}) {
  const readiness = oauthReadiness(provider);
  if (!readiness.ready) throw httpError(400, `Provider OAuth is not configured. Missing: ${readiness.missing.join(', ')}`);
  const pkce = createPkce();
  const oauthState = id('oauth');
  const callbackUrl = normalizeCallbackUrl(payload.callbackUrl || payload.callback_url || payload.redirectUri || payload.redirect_uri || provider.oauth.callbackUrl || `${PUBLIC_BASE_URL}/oauth/callback`);
  const pending = {
    state: oauthState,
    providerId: provider.id,
    verifier: pkce.verifier,
    challenge: pkce.challenge,
    callbackUrl,
    accountLabel: String(payload.accountLabel || payload.account_label || '').trim(),
    models: normalizeStringList(payload.models || payload.modelAllowlist || payload.model_allowlist || provider.oauth.accountModels),
    tokenParams: objectOrEmpty(payload.tokenParams || payload.token_params),
    createdAt: now(),
  };
  const next = state();
  next.oauth = {
    ...(next.oauth || {}),
    [oauthState]: pending,
  };
  const authUrl = buildAuthorizationUrl(provider, pending, payload);
  markOAuthStatus(next, oauthState, {
    providerId: provider.id,
    platform: provider.routing?.platform || '',
    status: 'waiting',
    accountLabel: pending.accountLabel,
    callbackUrl,
    authUrl: authUrl.toString(),
    createdAt: pending.createdAt,
  });
  saveState(next);
  return { authUrl: authUrl.toString(), state: oauthState, callbackUrl, adapter: provider.oauth.adapter };
}

function normalizeCallbackUrl(value) {
  const textValue = String(value || '').trim();
  if (/[\r\n]/.test(textValue)) throw httpError(400, 'OAuth callback URL is invalid.');
  let parsed;
  try {
    parsed = new URL(textValue);
  } catch {
    throw httpError(400, 'OAuth callback URL is invalid.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw httpError(400, 'OAuth callback URL must be http or https.');
  return parsed.toString();
}

function callbackWantsJson(req, url) {
  return url.searchParams.get('format') === 'json' || String(req.headers.accept || '').toLowerCase().includes('application/json');
}

function publicCallbackResult(account, flow) {
  return {
    ok: true,
    status: 'ok',
    message: 'OAuth login saved.',
    state: flow.state,
    providerId: flow.providerId,
    account: {
      id: account.id,
      providerId: account.providerId,
      label: account.label,
      type: account.type,
      status: account.status,
      models: account.models,
      profile: sanitizeProfile(account.profile),
      expiresAt: account.expiresAt,
      refreshConfigured: Boolean(account.refreshToken),
    },
    flow: publicOAuthStatus(flow),
  };
}

function readOAuthParamsFromUrl(rawUrl) {
  const textValue = String(rawUrl || '').trim();
  if (!textValue) return {};
  let parsed;
  try {
    parsed = new URL(textValue);
  } catch {
    try {
      const normalized = textValue.startsWith('?')
        ? `http://localhost/oauth-callback${textValue}`
        : textValue.includes('://')
          ? textValue
          : textValue.includes('=')
            ? `http://localhost/oauth-callback?${textValue.replace(/^\?/, '')}`
            : `http://${textValue}`;
      parsed = new URL(normalized);
    } catch {
      throw httpError(400, 'OAuth redirect URL is invalid.');
    }
  }
  const params = new URLSearchParams(parsed.search);
  const hashValue = parsed.hash.replace(/^#\??/, '');
  if (hashValue && hashValue.includes('=')) {
    const hashParams = new URLSearchParams(hashValue);
    for (const [key, value] of hashParams.entries()) {
      if (!params.has(key)) params.set(key, value);
    }
  }
  return {
    state: params.get('state') || '',
    code: params.get('code') || params.get('oauth_token') || '',
    error: params.get('error') || '',
    errorDescription: params.get('error_description') || '',
  };
}

function parseOAuthCallbackInput(input = {}) {
  const payload = typeof input === 'string' ? { redirectUrl: input } : objectOrEmpty(input);
  const redirectUrl = firstString(payload.redirect_url, payload.redirectUrl, payload.callback_url, payload.callbackUrl, payload.redirectUri, payload.redirect_uri, payload.url);
  const parsed = redirectUrl ? readOAuthParamsFromUrl(redirectUrl) : {};
  return {
    provider: firstString(payload.provider, payload.providerId, payload.provider_id, payload.platform),
    redirectUrl,
    state: firstString(parsed.state, payload.state, payload.oauthState, payload.oauth_state),
    code: firstString(parsed.code, payload.code, payload.authorizationCode, payload.authorization_code),
    error: firstString(parsed.error, payload.error),
    errorDescription: firstString(parsed.errorDescription, payload.error_description, payload.errorDescription),
  };
}

function providerMatchesOAuthValue(provider, value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  return [provider.id, provider.label, provider.routing?.platform]
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

function failOAuthState(next, oauthState, message, extra = {}) {
  if (oauthState && next.oauthStatus?.[oauthState]) {
    markOAuthStatus(next, oauthState, { status: 'failed', error: message, ...extra });
    saveState(next);
  }
}

async function completeOAuthRedirect(input = {}) {
  const callback = parseOAuthCallbackInput(input);
  const code = callback.code;
  const oauthState = callback.state;
  const next = state();
  if (!oauthState) {
    throw httpError(400, 'OAuth state is required. Paste the full redirect URL with state=... or send state/code directly.');
  }
  const pending = next.oauth?.[oauthState];
  const config = providersConfig();
  const provider = pending ? providerByIdOrPlatform(config, pending.providerId) : null;
  if (!pending) {
    const flow = next.oauthStatus?.[oauthState];
    const message = flow?.status === 'completed'
      ? `OAuth state ${oauthState} was already completed.`
      : `OAuth state ${oauthState} was not found or expired. Start OAuth again, then submit the callback from that same login flow.`;
    throw httpError(flow?.status === 'completed' ? 409 : 404, message);
  }
  if (!provider?.oauth?.tokenUrl) {
    const message = `Provider ${pending.providerId || '<missing>'} has no OAuth token URL.`;
    failOAuthState(next, oauthState, message);
    throw httpError(400, message);
  }
  if (!providerMatchesOAuthValue(provider, callback.provider)) {
    const message = `OAuth provider ${callback.provider} does not match state ${oauthState} (${provider.id}).`;
    failOAuthState(next, oauthState, message, { providerId: provider.id });
    throw httpError(400, message);
  }
  if (callback.error && !code) {
    const message = `OAuth provider returned error: ${callback.error}${callback.errorDescription ? ` - ${callback.errorDescription}` : ''}`;
    failOAuthState(next, oauthState, message, { providerId: provider.id });
    throw httpError(400, message, 'authentication_error');
  }
  if (!code) {
    const message = 'OAuth callback has no code. Paste the final localhost redirect URL that contains code=... and state=...';
    failOAuthState(next, oauthState, message, { providerId: provider.id });
    throw httpError(400, message);
  }
  let tokenPayload;
  try {
    tokenPayload = await exchangeAuthorizationCode(provider, pending, code);
  } catch (error) {
    markOAuthStatus(next, oauthState, { status: 'failed', error: error.message || String(error) });
    saveState(next);
    throw error;
  }
  const fetchedProfile = await fetchOAuthProfile(provider, tokenPayload.access_token);
  const profile = oauthProfileFromToken(provider, tokenPayload, fetchedProfile);
  const account = {
    id: id('acct'),
    providerId: provider.id,
    label: oauthAccountLabel(provider, pending, profile),
    type: 'oauth',
    status: 'active',
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token || '',
    idToken: tokenPayload.id_token || tokenPayload.idToken || '',
    expiresAt: tokenExpiry(tokenPayload),
    scopes: normalizeStringList(tokenPayload.scope || pending.scopes),
    models: pending.models || provider.oauth.accountModels || [],
    profile,
    createdAt: now(),
    updatedAt: now(),
  };
  if (!config.providers.some((item) => item.id === provider.id)) {
    config.providers = [...config.providers, provider];
  }
  config.accounts = [...(config.accounts || []), account];
  const authFile = writeOAuthAuthFile(provider, account, tokenPayload);
  saveProviders(config);
  delete next.oauth[oauthState];
  markOAuthStatus(next, oauthState, {
    status: 'completed',
    providerId: provider.id,
    platform: provider.routing?.platform || '',
    accountId: account.id,
    accountLabel: account.label,
    authFile,
    error: '',
  });
  const flow = next.oauthStatus[oauthState];
  saveState(next);
  return { account, flow };
}

async function adminApi(req, res, url) {
  if (!requireToken(req, res, ADMIN_TOKEN, 'Admin')) return;
  const config = providersConfig();
  const currentState = state();
  if (req.method === 'GET' && (url.pathname === '/admin/providers' || url.pathname === '/admin/config')) {
    json(res, 200, {
      ok: true,
      providers: config.providers.map((provider) => publicProvider(provider, config)),
      providerConfigs: config.providers.map((provider) => adminProvider(provider, config)),
      accounts: (config.accounts || []).map((account) => adminAccount(account, currentState.usage?.accounts?.[account.id])),
      routes: config.routes || {},
      usage: publicUsage(currentState.usage),
      oauthStatuses: publicOAuthStatuses(currentState.oauthStatus),
      authFiles: authFileRows(config, currentState),
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/admin/auth-files') {
    json(res, 200, { ok: true, authFiles: authFileRows(config, currentState) });
    return;
  }

  if (['POST', 'PUT'].includes(req.method) && url.pathname === '/admin/auth-files') {
    const payload = await jsonBody(req);
    const providerId = String(payload.providerId || payload.provider_id || payload.provider || '').trim();
    const provider = config.providers.find((item) => item.id === providerId);
    if (!provider) throw httpError(400, `Provider ${providerId || '<missing>'} is not configured.`);
    const tokenPayload = importedTokenPayload(payload);
    const name = safeAuthFileName(payload.name || payload.fileName || `${provider.id}-${stableHash(JSON.stringify(tokenPayload))}`);
    const account = createAccountFromTokenPayload(provider, { ...payload, content: tokenPayload, name });
    ensureDir(AUTH_DIR);
    writeJson(path.join(AUTH_DIR, name), {
      providerId: provider.id,
      accountId: account.id,
      label: account.label,
      importedAt: now(),
      tokenPayload,
    });
    config.accounts = [...(config.accounts || []).filter((item) => item.id !== account.id), account];
    saveProviders(config);
    json(res, 200, { ok: true, authFile: listAuthFiles().find((item) => item.name === name), account: adminAccount(account, currentState.usage?.accounts?.[account.id]) });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/admin/providers') {
    const payload = await jsonBody(req);
    const existing = config.providers.find((item) => item.id === String(payload.id || '').trim());
    const provider = normalizeProvider(mergeProviderSecrets(existing, payload));
    if (!provider.id || !provider.baseUrl) throw httpError(400, 'Provider id and baseUrl are required.');
    config.providers = [...config.providers.filter((item) => item.id !== provider.id), provider];
    saveProviders(config);
    const updated = providersConfig();
    json(res, 200, { ok: true, provider: adminProvider(provider, updated), providers: updated.providers.map((item) => publicProvider(item, updated)) });
    return;
  }

  const providerMatch = url.pathname.match(/^\/admin\/providers\/([^/]+)$/);
  if (providerMatch && req.method === 'DELETE') {
    const providerId = decodeURIComponent(providerMatch[1]);
    const removeAccounts = url.searchParams.get('accounts') !== 'keep';
    config.providers = config.providers.filter((provider) => provider.id !== providerId);
    if (removeAccounts) config.accounts = (config.accounts || []).filter((account) => account.providerId !== providerId);
    saveProviders(config);
    json(res, 200, { ok: true });
    return;
  }

  if (['PATCH', 'PUT', 'POST'].includes(req.method) && url.pathname === '/admin/routes') {
    const payload = await jsonBody(req);
    if (payload.routes && typeof payload.routes === 'object' && !Array.isArray(payload.routes)) {
      config.routes = payload.routes;
    } else if (payload.model) {
      config.routes = {
        ...(config.routes || {}),
        [String(payload.model)]: normalizeRoute(payload.route || payload),
      };
    } else {
      throw httpError(400, 'Routes payload must contain routes or model.');
    }
    saveProviders(config);
    json(res, 200, { ok: true, routes: providersConfig().routes });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/admin/usage') {
    json(res, 200, { ok: true, usage: publicUsage(currentState.usage) });
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/admin/oauth/status' || url.pathname === '/admin/get-auth-status')) {
    const oauthState = url.searchParams.get('state') || url.searchParams.get('authId') || url.searchParams.get('id') || '';
    const status = currentState.oauthStatus?.[oauthState];
    if (!oauthState || !status) throw httpError(404, `OAuth state ${oauthState || '<missing>'} was not found.`);
    json(res, 200, { ok: true, flow: publicOAuthStatus(status) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/admin/oauth-callback') {
    const payload = await jsonBody(req);
    const { account, flow } = await completeOAuthRedirect(payload);
    json(res, 200, publicCallbackResult(account, flow));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/admin/accounts') {
    const payload = await jsonBody(req);
    const baseAccount = {
      ...payload,
      id: payload.id || payload.accountId || id('acct'),
      providerId: payload.providerId || payload.provider_id || payload.provider,
      createdAt: payload.createdAt || now(),
      updatedAt: now(),
    };
    const existing = config.accounts.find((item) => item.id === String(baseAccount.id || '').trim());
    const account = normalizeAccount(mergeAccountSecrets(existing, baseAccount));
    if (!config.providers.some((provider) => provider.id === account.providerId)) throw httpError(400, `Provider ${account.providerId} is not configured.`);
    if (!accountToken(account)) throw httpError(400, 'Account accessToken, apiKey, or apiKeyEnv is required.');
    config.accounts = [...(config.accounts || []).filter((item) => item.id !== account.id), account];
    saveProviders(config);
    json(res, 200, { ok: true, account: adminAccount(account, currentState.usage?.accounts?.[account.id]) });
    return;
  }

  const accountMatch = url.pathname.match(/^\/admin\/accounts\/([^/]+)$/);
  if (accountMatch && ['PATCH', 'PUT'].includes(req.method)) {
    const accountId = decodeURIComponent(accountMatch[1]);
    const existing = config.accounts.find((account) => account.id === accountId);
    if (!existing) throw httpError(404, `Account ${accountId} was not found.`);
    const payload = await jsonBody(req);
    const account = normalizeAccount(mergeAccountSecrets(existing, { ...existing, ...payload, id: existing.id, providerId: payload.providerId || payload.provider_id || existing.providerId, updatedAt: now() }));
    config.accounts = config.accounts.map((item) => (item.id === accountId ? account : item));
    saveProviders(config);
    json(res, 200, { ok: true, account: adminAccount(account, currentState.usage?.accounts?.[account.id]) });
    return;
  }

  if (accountMatch && req.method === 'DELETE') {
    const accountId = decodeURIComponent(accountMatch[1]);
    config.accounts = config.accounts.filter((account) => account.id !== accountId);
    saveProviders(config);
    json(res, 200, { ok: true });
    return;
  }

  const refreshMatch = url.pathname.match(/^\/admin\/accounts\/([^/]+)\/refresh$/);
  if (refreshMatch && req.method === 'POST') {
    const accountId = decodeURIComponent(refreshMatch[1]);
    const account = config.accounts.find((item) => item.id === accountId);
    if (!account) throw httpError(404, `Account ${accountId} was not found.`);
    const provider = config.providers.find((item) => item.id === account.providerId);
    if (!provider) throw httpError(400, `Provider ${account.providerId} is not configured.`);
    account.expiresAt = new Date(Date.now() - 1000).toISOString();
    const refreshed = await refreshAccountToken(provider, account, config);
    json(res, 200, { ok: true, account: adminAccount(refreshed, currentState.usage?.accounts?.[refreshed.id]) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/admin/oauth/start') {
    const payload = await jsonBody(req);
    const provider = config.providers.find((item) => item.id === payload.providerId);
    if (!provider) throw httpError(400, `Provider ${payload.providerId || '<missing>'} is not configured.`);
    const result = startOAuthFlow(provider, payload);
    json(res, 200, { ok: true, ...result, statusUrl: `${PUBLIC_BASE_URL}/admin/oauth/status?state=${encodeURIComponent(result.state)}` });
    return;
  }

  const platformOauthMatch = url.pathname.match(/^\/admin\/(codex|gemini-cli|antigravity)-auth-url$/);
  if (platformOauthMatch && req.method === 'GET') {
    const platform = platformOauthMatch[1];
    const provider = providerByIdOrPlatform(config, platform);
    if (!provider) throw httpError(400, `No provider is configured for platform ${platform}.`);
    const result = startOAuthFlow(provider, {
      accountLabel: url.searchParams.get('accountLabel') || url.searchParams.get('label') || '',
      models: url.searchParams.get('models') || '',
      scopes: url.searchParams.get('scopes') || '',
      callbackUrl: url.searchParams.get('callbackUrl') || url.searchParams.get('callback_url') || url.searchParams.get('redirect_uri') || '',
    });
    json(res, 200, {
      ok: true,
      platform,
      providerId: provider.id,
      url: result.authUrl,
      authUrl: result.authUrl,
      state: result.state,
      callbackUrl: result.callbackUrl,
      statusUrl: `${PUBLIC_BASE_URL}/admin/get-auth-status?state=${encodeURIComponent(result.state)}`,
      adapter: result.adapter,
    });
    return;
  }
  json(res, 404, { ok: false, error: 'Not found.' });
}

async function oauthCallback(req, res, url) {
  let result;
  try {
    result = await completeOAuthRedirect(url.toString());
  } catch (error) {
    if (callbackWantsJson(req, url)) {
      json(res, error.status || 502, { ok: false, status: 'error', error: error.message || String(error) });
      return;
    }
    text(res, error.status || 502, error.message || String(error));
    return;
  }
  if (callbackWantsJson(req, url)) {
    json(res, 200, publicCallbackResult(result.account, result.flow));
    return;
  }
  text(res, 200, 'OAuth login saved. You can close this tab.');
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(STATIC_DIR, `.${pathname}`);
  if (!file.startsWith(path.resolve(STATIC_DIR))) {
    text(res, 403, 'Forbidden');
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    text(res, 404, 'Not found');
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
  };
  const cacheControl = ['.html', '.css', '.js'].includes(ext) ? 'no-store' : 'public, max-age=3600';
  res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'cache-control': cacheControl });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, { ok: true, service: 'Codex Mobile App', publicBaseUrl: PUBLIC_BASE_URL });
      return;
    }
    if (url.pathname.startsWith('/v1/')) {
      await proxy(req, res, url);
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      await mobileApi(req, res, url);
      return;
    }
    if (url.pathname.startsWith('/agent/')) {
      await agentApi(req, res, url);
      return;
    }
    if (url.pathname.startsWith('/admin/')) {
      await adminApi(req, res, url);
      return;
    }
    const aliasPath = adminAliasPath(url.pathname);
    if (aliasPath) {
      const aliasUrl = new URL(url.toString());
      aliasUrl.pathname = aliasPath;
      await adminApi(req, res, aliasUrl);
      return;
    }
    if (url.pathname === '/oauth/callback') {
      await oauthCallback(req, res, url);
      return;
    }
    return serveStatic(req, res, url);
  } catch (error) {
    const status = error.status || 500;
    if (url.pathname.startsWith('/v1/')) {
      json(res, status, { error: { message: error.message || String(error), type: error.type || 'server_error' } });
      return;
    }
    json(res, status, { ok: false, error: error.message || String(error) });
  }
});

ensureDir(DATA_DIR);
if (!fs.existsSync(PROVIDERS_PATH)) writeJson(PROVIDERS_PATH, { providers: [], accounts: [], routes: {} });
server.listen(PORT, HOST, () => {
  console.log(`[server] listening on ${HOST}:${PORT}`);
  console.log(`[server] public base URL ${PUBLIC_BASE_URL}`);
});
