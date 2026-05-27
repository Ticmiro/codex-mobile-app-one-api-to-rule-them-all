const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..', '..');
loadEnv(path.join(ROOT, '.env.local'));

const SERVER_URL = String(process.env.TICMIRO_SERVER_URL || '').replace(/\/+$/, '');
const AGENT_TOKEN = String(process.env.TICMIRO_AGENT_TOKEN || '').trim();
const BRIDGE_ID = process.env.TICMIRO_BRIDGE_ID || `${os.hostname()}-bridge`;
const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const POLL_MS = Number(process.env.TICMIRO_BRIDGE_POLL_MS || 3000);
const SNAPSHOT_MS = Number(process.env.TICMIRO_BRIDGE_SNAPSHOT_MS || 10000);
const CODEX_TIMEOUT_MS = Number(process.env.TICMIRO_CODEX_COMMAND_TIMEOUT_MS || 30 * 60 * 1000);
const THREAD_SYNC_LIMIT = Number(process.env.TICMIRO_THREAD_SYNC_LIMIT || 30);
const THREAD_MESSAGE_LIMIT = Number(process.env.TICMIRO_THREAD_MESSAGE_LIMIT || 40);
const THREAD_TAIL_BYTES = Number(process.env.TICMIRO_THREAD_TAIL_BYTES || 6 * 1024 * 1024);
const THREAD_SEND_TIMEOUT_MS = Number(process.env.TICMIRO_THREAD_SEND_TIMEOUT_MS || 2 * 60 * 60 * 1000);
const THREAD_SNAPSHOT_WAIT_MS = Number(process.env.TICMIRO_THREAD_SNAPSHOT_WAIT_MS || 15000);
const THREAD_PROGRESS_SNAPSHOT_MS = Number(process.env.TICMIRO_THREAD_PROGRESS_SNAPSHOT_MS || 3000);
const DEFAULT_APP_SERVER_MODE = process.platform === 'win32' ? 'per-command' : 'managed';
const APP_SERVER_MODE = String(process.env.TICMIRO_CODEX_APP_SERVER_MODE || DEFAULT_APP_SERVER_MODE).trim().toLowerCase();
const DESKTOP_RESTART_TIMEOUT_MS = Number(process.env.TICMIRO_CODEX_DESKTOP_RESTART_TIMEOUT_MS || 30 * 1000);
const CALLBACK_RELAY_ENABLED = process.env.TICMIRO_CALLBACK_RELAY !== '0';
const CALLBACK_RELAYS = [
  { provider: 'codex', port: 1455 },
  { provider: 'gemini-cli', port: 8085 },
  { provider: 'antigravity', port: 51121 },
];

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
    if (!match) continue;
    if (!process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim();
  }
}

function log(message) {
  console.log(`[bridge] ${new Date().toISOString()} ${message}`);
}

async function request(method, apiPath, payload) {
  if (!SERVER_URL) throw new Error('TICMIRO_SERVER_URL is required.');
  if (!AGENT_TOKEN) throw new Error('TICMIRO_AGENT_TOKEN is required.');
  const response = await fetch(`${SERVER_URL}${apiPath}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-control-token': AGENT_TOKEN,
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { ok: false, error: text };
  }
  if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function hasOAuthCallbackResult(localUrl) {
  try {
    const parsed = new URL(localUrl);
    return Boolean(parsed.searchParams.get('state') && (parsed.searchParams.get('code') || parsed.searchParams.get('oauth_token') || parsed.searchParams.get('error')));
  } catch {
    return false;
  }
}

function callbackRelayPage(title, detail) {
  return `<!doctype html><html lang="vi"><meta charset="utf-8"><title>${title}</title><body style="font-family:system-ui;margin:32px;line-height:1.5;background:#1b1b1b;color:#f4f0e8"><h1>${title}</h1><p>${detail}</p><p>Ban co the dong tab nay.</p></body></html>`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function startCallbackRelay() {
  if (!CALLBACK_RELAY_ENABLED) {
    log('OAuth callback relay disabled by TICMIRO_CALLBACK_RELAY=0');
    return;
  }
  for (const relay of CALLBACK_RELAYS) {
    const server = http.createServer(async (req, res) => {
      const localUrl = `http://localhost:${relay.port}${req.url || '/'}`;
      if (!hasOAuthCallbackResult(localUrl)) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(callbackRelayPage('TicProxy callback san sang', 'Bridge dang lang nghe callback OAuth tren may nay.'));
        return;
      }
      try {
        const result = await request('POST', '/agent/oauth-callback', {
          provider: relay.provider,
          redirectUrl: localUrl,
          bridgeId: BRIDGE_ID,
        });
        log(`OAuth callback relayed for ${relay.provider}: ${result.account?.label || result.account?.id || 'account'}`);
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(callbackRelayPage('Da xac nhan dang nhap TicProxy', 'Callback da duoc gui ve VPS va account da duoc luu.'));
      } catch (error) {
        log(`OAuth callback relay failed for ${relay.provider}: ${error.message || error}`);
        res.writeHead(502, { 'content-type': 'text/html; charset=utf-8' });
        res.end(callbackRelayPage('Khong the xac nhan TicProxy', error.message || String(error)));
      }
    });
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        log(`OAuth callback relay port ${relay.port} is already in use; manual callback paste may be needed for ${relay.provider}.`);
      } else {
        log(`OAuth callback relay port ${relay.port} failed: ${error.message || error}`);
      }
    });
    server.listen(relay.port, '127.0.0.1', () => {
      log(`OAuth callback relay listening on http://localhost:${relay.port} for ${relay.provider}`);
    });
  }
}

function codexConfigPath() {
  return path.join(CODEX_HOME, 'config.toml');
}

function readCodexConfigText() {
  const config = codexConfigPath();
  if (!fs.existsSync(config)) return '';
  return fs.readFileSync(config, 'utf8').replace(/^\uFEFF/, '');
}

function stripInlineComment(value) {
  let quoted = false;
  let quote = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && value[index - 1] !== '\\') {
      if (!quoted) {
        quoted = true;
        quote = char;
      } else if (quote === char) {
        quoted = false;
        quote = '';
      }
    }
    if (!quoted && char === '#') return value.slice(0, index).trim();
  }
  return value.trim();
}

function decodeTomlValue(value) {
  const trimmed = stripInlineComment(String(value || ''));
  if (!trimmed) return '';
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  return trimmed;
}

function tomlTopLevelValue(text, key) {
  for (const line of String(text || '').split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) return '';
    const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`));
    if (match) return decodeTomlValue(match[1]);
  }
  return '';
}

function tomlBlockValue(text, header, key) {
  let inBlock = false;
  for (const line of String(text || '').split(/\r?\n/)) {
    const table = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (table) {
      inBlock = table[1] === header;
      continue;
    }
    if (!inBlock) continue;
    const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`));
    if (match) return decodeTomlValue(match[1]);
  }
  return '';
}

function tomlString(value) {
  return JSON.stringify(String(value || ''));
}

function setTopLevelTomlString(text, key, value) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  let firstTableIndex = lines.findIndex((line) => /^\s*\[/.test(line));
  if (firstTableIndex === -1) firstTableIndex = lines.length;
  const nextLine = `${key} = ${tomlString(value)}`;
  for (let index = 0; index < firstTableIndex; index += 1) {
    if (new RegExp(`^\\s*${key}\\s*=`).test(lines[index])) {
      lines[index] = nextLine;
      return lines.join('\n');
    }
  }
  lines.splice(firstTableIndex, 0, nextLine);
  return lines.join('\n').replace(/^\n+/, '');
}

function upsertTomlBlock(text, header, block) {
  const blockLines = String(block || '').trim().split(/\r?\n/);
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const start = lines.findIndex((line) => line.match(/^\s*\[([^\]]+)\]\s*$/)?.[1] === header);
  if (start >= 0) {
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      if (/^\s*\[/.test(lines[index])) {
        end = index;
        break;
      }
    }
    lines.splice(start, end - start, ...blockLines);
    return lines.join('\n');
  }
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  if (lines.length) lines.push('');
  lines.push(...blockLines);
  return lines.join('\n');
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function persistTicProxyEnv(proxyBaseUrl, proxyApiKey) {
  process.env.TICPROXY_BASE_URL = proxyBaseUrl;
  process.env.TICPROXY_API_KEY = proxyApiKey;
  if (process.env.TICMIRO_API_ONE_KEY_PERSIST_ENV === '0') {
    return { persisted: false, reason: 'disabled' };
  }
  if (process.platform !== 'win32') {
    return { persisted: false, reason: 'not-windows' };
  }
  const script = [
    '$ErrorActionPreference = "Stop"',
    '[Environment]::SetEnvironmentVariable("TICPROXY_BASE_URL", $env:TICPROXY_BASE_URL, "User")',
    '[Environment]::SetEnvironmentVariable("TICPROXY_API_KEY", $env:TICPROXY_API_KEY, "User")',
  ].join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
    env: {
      ...process.env,
      TICPROXY_BASE_URL: proxyBaseUrl,
      TICPROXY_API_KEY: proxyApiKey,
    },
  });
  return {
    persisted: result.status === 0,
    code: result.status ?? 0,
    error: result.status === 0 ? '' : String(result.stderr || result.stdout || '').trim().slice(-800),
  };
}

function codexConfigSummary() {
  const text = readCodexConfigText();
  return {
    modelProvider: tomlTopLevelValue(text, 'model_provider'),
    model: tomlTopLevelValue(text, 'model'),
    ticproxyBaseUrl: tomlBlockValue(text, 'model_providers.ticproxy', 'base_url'),
    ticproxyWireApi: tomlBlockValue(text, 'model_providers.ticproxy', 'wire_api'),
    ticproxyEnvKey: tomlBlockValue(text, 'model_providers.ticproxy', 'env_key'),
  };
}

function configureCodexApiOneKey(payload = {}) {
  const proxyBaseUrl = String(payload.proxyBaseUrl || '').replace(/\/+$/, '');
  const proxyApiKey = String(payload.proxyApiKey || '').trim();
  const model = String(payload.model || 'gpt-5.5').trim();
  const setDefault = payload.setDefault !== false;
  if (!proxyBaseUrl || !proxyApiKey) throw new Error('Missing TicProxy base URL or proxy API key.');
  ensureDir(CODEX_HOME);
  const config = codexConfigPath();
  const existed = fs.existsSync(config);
  const original = readCodexConfigText();
  const backupPath = existed ? `${config}.bak-api-one-key-${timestampForFile()}.toml` : '';
  if (existed) fs.copyFileSync(config, backupPath);
  let nextText = original;
  if (setDefault) {
    nextText = setTopLevelTomlString(nextText, 'model_provider', 'ticproxy');
    nextText = setTopLevelTomlString(nextText, 'model', model);
  }
  nextText = upsertTomlBlock(nextText, 'model_providers.ticproxy', [
    '[model_providers.ticproxy]',
    'name = "TicProxy"',
    `base_url = ${tomlString(proxyBaseUrl)}`,
    'env_key = "TICPROXY_API_KEY"',
    'wire_api = "responses"',
  ].join('\n'));
  fs.writeFileSync(config, `${nextText.trim()}\n`, 'utf8');
  const envResult = persistTicProxyEnv(proxyBaseUrl, proxyApiKey);
  return {
    ok: true,
    configPath: config,
    backupPath,
    configExisted: existed,
    setDefault,
    modelProvider: 'ticproxy',
    model,
    proxyBaseUrl,
    proxyKeyRedacted: payload.proxyKeyRedacted || '',
    envPersisted: envResult.persisted,
    envError: envResult.error || '',
    summary: 'API ONE KEY configured Codex Desktop to use TicProxy.',
  };
}

function codexSnapshot() {
  const config = codexConfigPath();
  const sessions = path.join(CODEX_HOME, 'sessions');
  const threads = codexThreadSnapshot();
  const configSummary = codexConfigSummary();
  return {
    codexHome: CODEX_HOME,
    codexHomeExists: fs.existsSync(CODEX_HOME),
    configExists: fs.existsSync(config),
    sessionsExists: fs.existsSync(sessions),
    modelProvider: configSummary.modelProvider,
    model: configSummary.model,
    providerBaseUrl: process.env.TICPROXY_BASE_URL || configSummary.ticproxyBaseUrl || '',
    ticproxyWireApi: configSummary.ticproxyWireApi,
    ticproxyEnvKey: configSummary.ticproxyEnvKey,
    proxyKeyPresent: Boolean(process.env.TICPROXY_API_KEY),
    codexBin: resolveCodexCommand().display,
    threadCount: threads.threads.length,
    threadSyncError: threads.error || '',
  };
}

function readTail(file, maxBytes = THREAD_TAIL_BYTES) {
  const stat = fs.statSync(file);
  const start = Math.max(0, stat.size - maxBytes);
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buffer, 0, buffer.length, start);
    let text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    if (start > 0) text = text.slice(text.indexOf('\n') + 1);
    return text;
  } finally {
    fs.closeSync(fd);
  }
}

function listJsonlFiles(dir, limit = THREAD_SYNC_LIMIT * 8) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  const visit = (current) => {
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.jsonl')) {
        try {
          const stat = fs.statSync(full);
          files.push({ path: full, mtimeMs: stat.mtimeMs, birthtimeMs: stat.birthtimeMs, size: stat.size });
        } catch {}
      }
    }
  };
  visit(dir);
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit);
}

function parseJsonlTail(file) {
  const lines = readTail(file).split(/\r?\n/).filter(Boolean);
  const entries = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {}
  }
  return entries;
}

function extractText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join('\n');
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (typeof value.input_text === 'string') return value.input_text;
    if (typeof value.output_text === 'string') return value.output_text;
    if (typeof value.message === 'string') return value.message;
    if (value.content) return extractText(value.content);
  }
  return '';
}

function shorten(value, max = 4000) {
  const text = String(value || '').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function redactTranscriptSecrets(value) {
  return String(value || '')
    .replace(/((?:TICMIRO_AGENT_TOKEN|TICMIRO_ADMIN_TOKEN|TICMIRO_MOBILE_TOKEN|TICPROXY_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY)\s*=\s*)[^\s\r\n"']+/gi, '$1[redacted]')
    .replace(/((?:authorization|x-control-token)\s*:\s*(?:bearer\s+)?)[^\s\r\n"']+/gi, '$1[redacted]')
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token)\s*[:=]\s*)[^\s\r\n"']+/gi, '$1[redacted]');
}

function stripInternalBlocks(value) {
  return String(value || '')
    .replace(/<environment_context>[\s\S]*?<\/environment_context>/gi, '')
    .replace(/<tools?>[\s\S]*?<\/tools?>/gi, '')
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    .replace(/<tool_result>[\s\S]*?<\/tool_result>/gi, '')
    .trim();
}

function internalPayloadType(entry, payload, item) {
  return String(entry.type || payload.type || item.type || item.name || payload.name || '').toLowerCase();
}

function shouldSkipTranscriptMessage(entry, payload, item, text) {
  const type = internalPayloadType(entry, payload, item);
  if (/\b(tool|function)_?(call|result|output)\b/.test(type)) return true;
  if (/exec_command|apply_patch|write_stdin|screenshot|view_image|turn_context|environment_context/.test(type)) return true;
  const trimmed = String(text || '').trim();
  if (!trimmed) return true;
  if (/^<environment_context>[\s\S]*<\/environment_context>$/i.test(trimmed)) return true;
  if (/^\*\*\* Begin Patch[\s\S]*\*\*\* End Patch\s*$/i.test(trimmed)) return true;
  if (/^(Exit code|Output|Wall time|Process exited|Chunk ID):/m.test(trimmed) && /(?:Original token count|Output:|Exit code:)/m.test(trimmed)) return true;
  return false;
}

function cleanTranscriptText(value) {
  return redactTranscriptSecrets(stripInternalBlocks(value));
}

function messageFromEntry(entry) {
  const payload = entry.payload || entry;
  const item = payload.item || payload.message || payload;
  const type = String(entry.type || payload.type || item.type || '').toLowerCase();
  let role = String(item.role || payload.role || '').toLowerCase();
  let text = cleanTranscriptText(extractText(item.content || payload.content || item.text || payload.text || payload.message));
  if (!role && /user/.test(type)) role = 'user';
  if (!role && /assistant|response/.test(type)) role = 'assistant';
  if (!text && typeof payload.input === 'string') {
    role = role || 'user';
    text = cleanTranscriptText(payload.input);
  }
  if (shouldSkipTranscriptMessage(entry, payload, item, text)) return null;
  if (!['user', 'assistant', 'system'].includes(role) || !text) return null;
  const timestamp = entry.timestamp || payload.timestamp || payload.created_at || null;
  return {
    id: String(payload.id || item.id || `${role}-${entry.timestamp || Date.now()}-${text.length}`),
    role,
    text: shorten(text),
    timestamp,
    at: timestamp,
  };
}

function parseTranscript(file, limit = THREAD_MESSAGE_LIMIT) {
  const entries = parseJsonlTail(file);
  const messages = [];
  for (const entry of entries) {
    const message = messageFromEntry(entry);
    if (message) messages.push(message);
  }
  return messages.slice(-limit);
}

function threadIdFrom(file, entries) {
  for (const entry of entries) {
    if (entry.type === 'session_meta' && entry.payload?.id) return String(entry.payload.id);
    if (entry.session_id) return String(entry.session_id);
    if (entry.threadId) return String(entry.threadId);
    if (entry.payload?.threadId) return String(entry.payload.threadId);
  }
  const name = path.basename(file, '.jsonl');
  const uuid = name.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return uuid ? uuid[0] : name;
}

function threadMetaFrom(fileInfo) {
  const entries = parseJsonlTail(fileInfo.path);
  const messages = [];
  let cwd = '';
  let model = '';
  let modelProvider = '';
  let source = 'sessions-jsonl';
  for (const entry of entries) {
    const payload = entry.payload || {};
    if (entry.type === 'session_meta') {
      cwd = cwd || payload.cwd || payload.working_dir || '';
      model = model || payload.model || '';
      modelProvider = modelProvider || payload.model_provider || payload.modelProvider || '';
      source = payload.source || source;
    }
    if (entry.type === 'turn_context') {
      cwd = cwd || payload.cwd || '';
      model = model || payload.model || '';
      modelProvider = modelProvider || payload.model_provider || payload.modelProvider || '';
    }
    const message = messageFromEntry(entry);
    if (message) messages.push(message);
  }
  const firstUser = messages.find((item) => item.role === 'user');
  const lastMessage = messages[messages.length - 1];
  return {
    id: threadIdFrom(fileInfo.path, entries),
    title: shorten(firstUser?.text || lastMessage?.text || path.basename(fileInfo.path), 90),
    cwd,
    model,
    modelProvider,
    source,
    rolloutPath: fileInfo.path,
    rolloutExists: true,
    updatedAt: new Date(fileInfo.mtimeMs).toISOString(),
    createdAt: new Date(fileInfo.birthtimeMs || fileInfo.mtimeMs).toISOString(),
    messageCount: messages.length,
  };
}

function codexThreadSnapshot() {
  try {
    const sessionsDir = path.join(CODEX_HOME, 'sessions');
    const files = listJsonlFiles(sessionsDir);
    const threads = files.map(threadMetaFrom).filter((thread) => thread.id).slice(0, THREAD_SYNC_LIMIT);
    const messagesByThread = {};
    for (const thread of threads) {
      messagesByThread[thread.id] = parseTranscript(thread.rolloutPath);
    }
    return { threads, messagesByThread, syncedAt: new Date().toISOString() };
  } catch (error) {
    return { threads: [], messagesByThread: {}, syncedAt: new Date().toISOString(), error: error.message || String(error) };
  }
}

function splitPathList(value) {
  return String(value || '')
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitCliArgs(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item)).filter(Boolean);
    } catch {}
  }
  const args = [];
  let current = '';
  let quote = '';
  let escaping = false;
  for (const char of text) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === '\\') {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = '';
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (escaping) current += '\\';
  if (current) args.push(current);
  return args;
}

function codexDesktopBinCandidates() {
  if (process.platform !== 'win32') return [];
  const root = path.join(os.homedir(), 'AppData', 'Local', 'OpenAI', 'Codex', 'bin');
  try {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(root, entry.name, 'codex.exe'))
      .filter((candidate) => fs.existsSync(candidate))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  } catch {
    return [];
  }
}

function resolveCodexCommand() {
  const explicit = String(process.env.TICMIRO_CODEX_BIN || '').trim();
  const candidates = [];
  if (explicit) candidates.push(explicit);
  if (process.platform === 'win32') {
    const home = os.homedir();
    candidates.push(
      ...codexDesktopBinCandidates(),
      path.join(home, '.local', 'bin', 'codex.exe'),
    );
    const where = spawnSync('where.exe', ['codex'], { encoding: 'utf8', windowsHide: true });
    if (where.status === 0) {
      candidates.push(...String(where.stdout || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean));
    }
    candidates.push(path.join(home, 'AppData', 'Roaming', 'npm', 'codex.cmd'));
  }
  candidates.push('codex');

  for (const candidate of candidates) {
    if (!candidate) continue;
    const lower = candidate.toLowerCase();
    const isBareCommand = !path.isAbsolute(candidate) && !candidate.includes(path.sep) && !candidate.includes('/');
    const exists = isBareCommand || fs.existsSync(candidate);
    if (!exists) continue;
    if (process.platform === 'win32' && lower.endsWith('.cmd')) {
      return { command: 'cmd.exe', prefixArgs: ['/d', '/s', '/c', candidate], display: candidate };
    }
    if (isBareCommand || exists) {
      return { command: candidate, prefixArgs: [], display: candidate };
    }
  }
  return { command: 'codex', prefixArgs: [], display: 'codex' };
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    let child;
    const { timeoutMs: timeoutOption, ...spawnOptions } = options;
    try {
      child = spawn(command, args, {
        windowsHide: true,
        shell: false,
        ...spawnOptions,
      });
    } catch (error) {
      resolve({ code: -1, stdout: '', stderr: error.message || String(error) });
      return;
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeoutMs = Number(timeoutOption || DESKTOP_RESTART_TIMEOUT_MS);
    const finish = (code, extra = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr: `${stderr}${extra}` });
    };
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {}
      finish(-2, `Timed out after ${timeoutMs}ms`);
    }, timeoutMs);
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => finish(-1, error.message || String(error)));
    child.on('close', (code) => finish(code || 0));
  });
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function resolveAllowedCwd(input) {
  const raw = String(input || '').trim();
  if (!raw) return process.cwd();
  const cwd = path.resolve(raw);
  const roots = splitPathList(process.env.TICMIRO_ALLOWED_ROOTS);
  if (!roots.length) return cwd;
  const allowed = roots.map((root) => path.resolve(root)).some((root) => isInside(cwd, root));
  if (!allowed) throw new Error(`CWD is outside TICMIRO_ALLOWED_ROOTS: ${cwd}`);
  return cwd;
}

function allowedRoots() {
  return splitPathList(process.env.TICMIRO_ALLOWED_ROOTS).map((root, index) => ({
    id: `root-${index + 1}`,
    label: root,
    path: path.resolve(root),
  }));
}

function resolveAllowedFilePath(rootId, inputPath = '.') {
  const roots = allowedRoots();
  const root = roots.find((item) => item.id === rootId) || roots[0];
  if (!root) throw new Error('No TICMIRO_ALLOWED_ROOTS folder is configured.');
  const target = path.resolve(root.path, String(inputPath || '.'));
  if (!isInside(target, root.path)) throw new Error(`Path is outside allowed root: ${inputPath}`);
  return { root, target };
}

function fileEntry(root, fullPath, match = '') {
  const stat = fs.statSync(fullPath);
  return {
    name: path.basename(fullPath),
    path: path.relative(root.path, fullPath) || '.',
    relativePath: path.relative(root.path, fullPath) || '.',
    type: stat.isDirectory() ? 'dir' : 'file',
    size: stat.size,
    updatedAt: stat.mtime.toISOString(),
    match,
  };
}

function listFiles(payload = {}) {
  const { root, target } = resolveAllowedFilePath(payload.root, payload.path || '.');
  const entries = fs.readdirSync(target, { withFileTypes: true })
    .map((entry) => path.join(target, entry.name))
    .map((entryPath) => fileEntry(root, entryPath))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : (a.type === 'dir' ? -1 : 1)))
    .slice(0, 250);
  return { root, path: path.relative(root.path, target) || '.', entries };
}

function searchFiles(payload = {}) {
  const query = String(payload.query || '').toLowerCase().trim();
  if (!query) return { query, results: [] };
  const { root, target } = resolveAllowedFilePath(payload.root, payload.path || '.');
  const results = [];
  const visit = (dir, depth = 0) => {
    if (depth > 8 || results.length >= 200) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name.toLowerCase().includes(query)) {
        results.push(fileEntry(root, fullPath, 'name'));
        if (results.length >= 200) return;
      }
      if (entry.isDirectory()) visit(fullPath, depth + 1);
    }
  };
  visit(target);
  return { root, path: path.relative(root.path, target) || '.', query, results };
}

function readFileText(payload = {}) {
  const { root, target } = resolveAllowedFilePath(payload.root, payload.path || '.');
  const stat = fs.statSync(target);
  if (stat.isDirectory()) throw new Error('Selected path is a folder.');
  const maxBytes = Number(process.env.TICMIRO_FILE_READ_MAX_BYTES || 512 * 1024);
  const buffer = fs.readFileSync(target).subarray(0, maxBytes);
  return {
    root,
    path: path.relative(root.path, target) || '.',
    name: path.basename(target),
    size: stat.size,
    truncated: stat.size > maxBytes,
    text: buffer.toString('utf8'),
  };
}

function taskSnapshot() {
  return {
    service: {
      startupInstalled: false,
      envFilePresent: fs.existsSync(path.join(ROOT, '.env.local')),
      logPresent: false,
      scheduledTask: {},
      pid: process.pid,
      node: process.version,
      appServerHost: codexHostStatus(),
      progressSnapshotMs: THREAD_PROGRESS_SNAPSHOT_MS,
      desktopRestartConfigured: Boolean(process.env.TICMIRO_CODEX_DESKTOP_RESTART_COMMAND || process.env.TICMIRO_CODEX_DESKTOP_BIN),
    },
    processes: [{
      role: 'windows-bridge',
      name: 'node',
      pid: process.pid,
      command: 'apps/windows-bridge/src/index.js',
      createdAt: new Date().toISOString(),
    }],
  };
}

function desktopRestartScript() {
  return String.raw`
$ErrorActionPreference = "SilentlyContinue"
$Killed = @()
$Started = ""

$Processes = Get-CimInstance Win32_Process | Where-Object {
  (($_.Name -match "Codex|OpenAI") -or ($_.CommandLine -match "Codex|OpenAI\.Codex")) -and
  ($_.ProcessId -ne $PID) -and
  ($_.CommandLine -notmatch "apps\\windows-bridge\\src\\index\.js") -and
  ($_.CommandLine -notmatch "apps/windows-bridge/src/index\.js") -and
  ($_.CommandLine -notmatch "codex-mobile-app-one-api-to-rule-them-all") -and
  ($_.CommandLine -notmatch "\bcodex(\.exe)?\s+app-server\b") -and
  ($_.CommandLine -notmatch "\bcodex(\.exe)?\s+exec\b")
}
foreach ($Process in $Processes) {
  try {
    Stop-Process -Id $Process.ProcessId -Force
    $Killed += "$($Process.Name):$($Process.ProcessId)"
  } catch {}
}

Start-Sleep -Milliseconds 900

$Candidates = @(
  $env:TICMIRO_CODEX_DESKTOP_BIN,
  (Join-Path $env:LOCALAPPDATA "Programs\Codex\Codex.exe"),
  (Join-Path $env:LOCALAPPDATA "Programs\OpenAI Codex\Codex.exe"),
  (Join-Path $env:LOCALAPPDATA "OpenAI\Codex\Codex.exe"),
  (Join-Path $env:LOCALAPPDATA "OpenAI.Codex\Codex.exe"),
  (Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\Codex.exe")
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

if ($Candidates.Count -gt 0) {
  Start-Process -FilePath $Candidates[0]
  $Started = $Candidates[0]
} else {
  $StartFolders = @(
    (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"),
    (Join-Path $env:PROGRAMDATA "Microsoft\Windows\Start Menu\Programs")
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  $Link = $StartFolders |
    ForEach-Object { Get-ChildItem -LiteralPath $_ -Recurse -Filter "*Codex*.lnk" -ErrorAction SilentlyContinue } |
    Select-Object -First 1
  if ($Link) {
    Start-Process -FilePath $Link.FullName
    $Started = $Link.FullName
  }
}

if (-not $Started) {
  $CodexApp = Get-StartApps |
    Where-Object { $_.Name -eq "Codex" -or $_.Name -match "OpenAI.*Codex" -or $_.AppID -match "Codex" } |
    Select-Object -First 1
  if ($CodexApp) {
    $AppTarget = "shell:AppsFolder\$($CodexApp.AppID)"
    Start-Process $AppTarget
    $Started = $AppTarget
  }
}

if (-not $Started) {
  Write-Output (@{ ok = $false; killed = $Killed; started = ""; error = "Cannot find Codex Desktop launcher. Set TICMIRO_CODEX_DESKTOP_BIN or TICMIRO_CODEX_DESKTOP_RESTART_COMMAND." } | ConvertTo-Json -Compress)
  exit 2
}

Write-Output (@{ ok = $true; killed = $Killed; started = $Started; error = "" } | ConvertTo-Json -Compress)
exit 0
`;
}

function parseJsonOutput(text) {
  try {
    return JSON.parse(String(text || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{}');
  } catch {
    return {};
  }
}

async function restartCodexDesktop(payload = {}) {
  const customCommand = String(process.env.TICMIRO_CODEX_DESKTOP_RESTART_COMMAND || '').trim();
  if (customCommand) {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'sh';
    const args = process.platform === 'win32'
      ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', customCommand]
      : ['-lc', customCommand];
    const result = await runProcess(shell, args, { timeoutMs: DESKTOP_RESTART_TIMEOUT_MS });
    return {
      ...result,
      ok: result.code === 0,
      method: 'custom-command',
      summary: result.code === 0 ? 'Codex Desktop restart command completed.' : 'Codex Desktop restart command failed.',
      reason: payload.reason || '',
    };
  }
  if (process.platform !== 'win32') {
    return {
      ok: false,
      code: 1,
      stdout: '',
      stderr: 'codex.desktop.restart is implemented for Windows bridge hosts. Set TICMIRO_CODEX_DESKTOP_RESTART_COMMAND for this platform.',
      method: 'unsupported-platform',
      summary: 'Codex Desktop restart is not configured for this platform.',
      reason: payload.reason || '',
    };
  }
  const result = await runProcess('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', desktopRestartScript()], { timeoutMs: DESKTOP_RESTART_TIMEOUT_MS });
  const parsed = parseJsonOutput(result.stdout);
  return {
    ...result,
    ok: result.code === 0 && parsed.ok !== false,
    method: 'windows-discovery',
    killed: parsed.killed || [],
    started: parsed.started || '',
    summary: result.code === 0 && parsed.ok !== false
      ? 'Codex Desktop restarted.'
      : (parsed.error || 'Codex Desktop restart failed.'),
    reason: payload.reason || '',
  };
}

function runCodexExec(payload = {}) {
  return new Promise((resolve) => {
    const prompt = String(payload.prompt || payload.message || '').trim();
    if (!prompt) {
      resolve({ code: 1, stdout: '', stderr: 'Missing prompt.' });
      return;
    }
    let cwd;
    try {
      cwd = resolveAllowedCwd(payload.cwd);
    } catch (error) {
      resolve({ code: 1, stdout: '', stderr: error.message || String(error) });
      return;
    }
    const codex = resolveCodexCommand();
    const extraArgs = splitCliArgs(process.env.TICMIRO_CODEX_EXEC_EXTRA_ARGS || '');
    const args = [...(codex.prefixArgs || []), 'exec', '--skip-git-repo-check', ...extraArgs, prompt];
    const child = spawn(codex.command, args, {
      cwd,
      env: {
        ...process.env,
        CODEX_HOME,
      },
      windowsHide: true,
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (code, extra = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr: `${stderr}${extra}` });
    };
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {}
      finish(-2, `Timed out after ${CODEX_TIMEOUT_MS}ms`);
    }, CODEX_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => finish(-1, error.message || String(error)));
    child.on('close', (code) => finish(code || 0));
  });
}

function writeJsonLine(stream, payload) {
  stream.write(`${JSON.stringify(payload)}\n`);
}

function tailText(text, max = 20000) {
  const value = String(text || '');
  return value.length > max ? value.slice(-max) : value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function threadById(snapshot, threadId) {
  return (snapshot.threads || []).find((item) => item.id === threadId) || null;
}

async function waitForThreadSnapshot(threadId, before = {}, timeoutMs = THREAD_SNAPSHOT_WAIT_MS) {
  const start = Date.now();
  let latest = codexThreadSnapshot();
  while (Date.now() - start <= timeoutMs) {
    const thread = threadById(latest, threadId);
    const messages = latest.messagesByThread?.[threadId] || [];
    const updatedChanged = thread?.updatedAt && thread.updatedAt !== before.updatedAt;
    const countChanged = Number(thread?.messageCount || 0) > Number(before.messageCount || 0);
    const hasNewMessages = messages.length > Number(before.messagesLength || 0);
    if (thread && (updatedChanged || countChanged || hasNewMessages)) {
      return { ...latest, thread, messages, changed: true };
    }
    await sleep(500);
    latest = codexThreadSnapshot();
  }
  const thread = threadById(latest, threadId);
  return {
    ...latest,
    thread,
    messages: latest.messagesByThread?.[threadId] || [],
    changed: false,
  };
}

function commandLabel(codex) {
  return [codex.command, ...(codex.prefixArgs || []), 'app-server'].join(' ');
}

class ManagedCodexAppServer {
  constructor() {
    this.codex = resolveCodexCommand();
    this.child = null;
    this.buffer = '';
    this.stdout = '';
    this.stderr = '';
    this.pending = new Map();
    this.turnWaiter = null;
    this.startPromise = null;
    this.startedAt = '';
    this.lastUsedAt = '';
    this.lastError = '';
    this.requestSeq = 0;
    this.restarts = 0;
  }

  status() {
    return {
      mode: APP_SERVER_MODE,
      running: Boolean(this.child && !this.child.killed),
      pid: this.child?.pid || null,
      command: commandLabel(this.codex),
      startedAt: this.startedAt,
      lastUsedAt: this.lastUsedAt,
      lastError: this.lastError,
      pending: this.pending.size + (this.turnWaiter ? 1 : 0),
      restarts: this.restarts,
    };
  }

  async ensureStarted() {
    if (APP_SERVER_MODE === 'per-command') throw new Error('Managed app-server is disabled by TICMIRO_CODEX_APP_SERVER_MODE=per-command.');
    if (this.child && !this.child.killed) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.start();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async start() {
    this.codex = resolveCodexCommand();
    const args = [...(this.codex.prefixArgs || []), 'app-server'];
    try {
      this.child = spawn(this.codex.command, args, {
        cwd: process.cwd(),
        env: { ...process.env, CODEX_HOME },
        windowsHide: true,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      this.lastError = error.message || String(error);
      throw error;
    }
    this.buffer = '';
    this.stdout = '';
    this.stderr = '';
    this.startedAt = new Date().toISOString();
    this.restarts += 1;
    this.child.stdout.on('data', (chunk) => this.handleStdout(chunk));
    this.child.stderr.on('data', (chunk) => {
      this.stderr = tailText(`${this.stderr}${chunk.toString()}`);
    });
    this.child.on('error', (error) => this.failAll(error.message || String(error)));
    this.child.on('close', (code) => {
      this.failAll(`codex app-server exited with code ${code}`);
      this.child = null;
    });
    try {
      await this.request('initialize', {
        clientInfo: { name: 'codex-mobile-app-one-api-to-rule-them-all', version: '0.1.0' },
        capabilities: { experimentalApi: true },
      }, { idPrefix: 'host-initialize', timeoutMs: 30000 });
    } catch (error) {
      this.lastError = error.message || String(error);
      this.stop();
      this.child = null;
      throw error;
    }
  }

  handleStdout(chunk) {
    const text = chunk.toString();
    this.stdout = tailText(`${this.stdout}${text}`);
    this.buffer += text;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let data;
      try {
        data = JSON.parse(line);
      } catch {
        continue;
      }
      if (data.id && this.pending.has(data.id)) {
        const pending = this.pending.get(data.id);
        this.pending.delete(data.id);
        clearTimeout(pending.timer);
        if (data.error) {
          pending.reject(new Error(`${pending.method} failed: ${JSON.stringify(data.error)}`));
        } else {
          pending.resolve(data.result ?? data);
        }
        continue;
      }
      const completedThreadId = data.params?.threadId || data.params?.thread_id || '';
      if (this.turnWaiter && data.method === 'turn/completed' && (!completedThreadId || completedThreadId === this.turnWaiter.threadId)) {
        const waiter = this.turnWaiter;
        this.turnWaiter = null;
        clearTimeout(waiter.timer);
        waiter.resolve(data.params || {});
      }
    }
  }

  failAll(message) {
    this.lastError = message;
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(message));
      this.pending.delete(id);
    }
    if (this.turnWaiter) {
      clearTimeout(this.turnWaiter.timer);
      this.turnWaiter.reject(new Error(message));
      this.turnWaiter = null;
    }
  }

  request(method, params, options = {}) {
    const id = `${options.idPrefix || method}-${Date.now()}-${this.requestSeq += 1}`;
    const timeoutMs = Number(options.timeoutMs || THREAD_SEND_TIMEOUT_MS);
    return new Promise((resolve, reject) => {
      if (!this.child?.stdin?.writable) {
        reject(new Error('codex app-server is not writable.'));
        return;
      }
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
      writeJsonLine(this.child.stdin, { id, method, params });
    });
  }

  waitForTurn(threadId, timeoutMs = THREAD_SEND_TIMEOUT_MS) {
    if (this.turnWaiter) return Promise.reject(new Error(`Another turn is already running for ${this.turnWaiter.threadId}.`));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.turnWaiter = null;
        reject(new Error(`turn/start for ${threadId} did not complete after ${timeoutMs}ms`));
      }, timeoutMs);
      this.turnWaiter = { threadId, resolve, reject, timer };
    });
  }

  clearTurnWaiter(error) {
    if (!this.turnWaiter) return;
    clearTimeout(this.turnWaiter.timer);
    this.turnWaiter.reject(error);
    this.turnWaiter = null;
  }

  async sendThreadMessage(thread, message) {
    await this.ensureStarted();
    this.lastUsedAt = new Date().toISOString();
    await this.request('thread/resume', {
      threadId: thread.id,
      cwd: thread.cwd || process.cwd(),
      model: null,
      modelProvider: null,
      approvalPolicy: null,
      approvalsReviewer: null,
      sandbox: null,
      config: null,
      baseInstructions: null,
      developerInstructions: null,
      personality: null,
      serviceTier: null,
    }, { idPrefix: 'host-thread-resume' });
    const turnDone = this.waitForTurn(thread.id);
    try {
      await this.request('turn/start', {
        threadId: thread.id,
        input: [{ type: 'text', text: message, text_elements: [] }],
        cwd: thread.cwd || process.cwd(),
        approvalPolicy: null,
        approvalsReviewer: null,
        sandboxPolicy: null,
        model: null,
        effort: null,
        summary: 'none',
        personality: null,
        outputSchema: null,
        serviceTier: null,
      }, { idPrefix: 'host-turn-start' });
    } catch (error) {
      this.clearTurnWaiter(error);
      throw error;
    }
    await turnDone;
    return {
      code: 0,
      stdout: this.stdout,
      stderr: this.stderr,
      host: this.status(),
    };
  }

  stop() {
    if (!this.child) return;
    try {
      this.child.kill();
    } catch {}
  }
}

let managedCodexHost = null;

function codexHostStatus() {
  if (APP_SERVER_MODE === 'per-command') return { mode: APP_SERVER_MODE, running: false, disabled: true };
  if (!managedCodexHost) return { mode: APP_SERVER_MODE, running: false };
  return managedCodexHost.status();
}

async function runCodexThreadSendManaged(thread, message) {
  if (!managedCodexHost) managedCodexHost = new ManagedCodexAppServer();
  try {
    return await managedCodexHost.sendThreadMessage(thread, message);
  } catch (error) {
    const errorMessage = error.message || String(error);
    managedCodexHost?.stop();
    const failedHost = managedCodexHost;
    managedCodexHost = null;
    return { code: 1, stdout: failedHost?.stdout || '', stderr: errorMessage, host: failedHost?.status() || null };
  }
}

function runCodexThreadSendOneShot(thread, message) {
  return new Promise((resolve) => {
    const codex = resolveCodexCommand();
    const args = [...(codex.prefixArgs || []), 'app-server'];
    let child;
    try {
      child = spawn(codex.command, args, {
        cwd: thread.cwd || process.cwd(),
        env: { ...process.env, CODEX_HOME },
        windowsHide: true,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({ code: -1, stdout: '', stderr: error.message || String(error) });
      return;
    }
    let stdout = '';
    let stderr = '';
    let buffer = '';
    let settled = false;
    let turnStarted = false;
    const finish = (code, extra = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill();
      } catch {}
      resolve({ code, stdout, stderr: `${stderr}${extra}` });
    };
    const timer = setTimeout(() => {
      finish(-2, turnStarted
        ? `turn/start for ${thread.id} did not complete after ${THREAD_SEND_TIMEOUT_MS}ms`
        : `turn/start for ${thread.id} did not start after ${THREAD_SEND_TIMEOUT_MS}ms`);
    }, THREAD_SEND_TIMEOUT_MS);
    const sendResume = () => writeJsonLine(child.stdin, {
      id: 'mobile-thread-resume',
      method: 'thread/resume',
      params: {
        threadId: thread.id,
        cwd: thread.cwd || process.cwd(),
        model: null,
        modelProvider: null,
        approvalPolicy: null,
        approvalsReviewer: null,
        sandbox: null,
        config: null,
        baseInstructions: null,
        developerInstructions: null,
        personality: null,
        serviceTier: null,
      },
    });
    const sendTurn = () => writeJsonLine(child.stdin, {
      id: 'mobile-turn-start',
      method: 'turn/start',
      params: {
        threadId: thread.id,
        input: [{ type: 'text', text: message, text_elements: [] }],
        cwd: thread.cwd || process.cwd(),
        approvalPolicy: null,
        approvalsReviewer: null,
        sandboxPolicy: null,
        model: null,
        effort: null,
        summary: 'none',
        personality: null,
        outputSchema: null,
        serviceTier: null,
      },
    });
    const handlePayload = (data) => {
      if (data.id === 'mobile-initialize') {
        if (data.error) return finish(1, `initialize failed: ${JSON.stringify(data.error)}`);
        sendResume();
        return;
      }
      if (data.id === 'mobile-thread-resume') {
        if (data.error) return finish(1, `thread/resume failed: ${JSON.stringify(data.error)}`);
        sendTurn();
        return;
      }
      if (data.id === 'mobile-turn-start') {
        if (data.error) return finish(1, `turn/start failed: ${JSON.stringify(data.error)}`);
        turnStarted = true;
        return;
      }
      const completedThreadId = data.params?.threadId || data.params?.thread_id || '';
      if (data.method === 'turn/completed' && (!completedThreadId || completedThreadId === thread.id)) finish(0);
    };
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      buffer += text;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          handlePayload(JSON.parse(line));
        } catch {}
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => finish(-1, error.message || String(error)));
    child.on('close', (code) => finish(code || (turnStarted ? 0 : 1)));
    writeJsonLine(child.stdin, {
      id: 'mobile-initialize',
      method: 'initialize',
      params: {
        clientInfo: { name: 'codex-mobile-app-one-api-to-rule-them-all', version: '0.1.0' },
        capabilities: { experimentalApi: true },
      },
    });
  });
}

async function runCodexThreadSend(payload = {}) {
  const threadId = String(payload.threadId || '').trim();
  const message = String(payload.message || payload.prompt || '').trim();
  if (!threadId || !message) {
    return { code: 1, stdout: '', stderr: 'Missing threadId or message.' };
  }
  const beforeSnapshot = codexThreadSnapshot();
  const thread = threadById(beforeSnapshot, threadId);
  if (!thread) {
    return { code: 1, stdout: '', stderr: `Thread ${threadId} was not found in CODEX_HOME=${CODEX_HOME}` };
  }
  const beforeMessages = beforeSnapshot.messagesByThread?.[threadId] || [];
  const result = APP_SERVER_MODE === 'per-command'
    ? await runCodexThreadSendOneShot(thread, message)
    : await runCodexThreadSendManaged(thread, message);
  if (result.code !== 0) return result;
  const nextSnapshot = await waitForThreadSnapshot(threadId, {
    updatedAt: thread.updatedAt,
    messageCount: thread.messageCount,
    messagesLength: beforeMessages.length,
  });
  return {
    ...result,
    snapshotChanged: nextSnapshot.changed,
    thread: nextSnapshot.thread || thread,
    messages: nextSnapshot.messages || beforeMessages,
    syncedAt: nextSnapshot.syncedAt,
  };
}

async function heartbeat() {
  await request('POST', '/agent/heartbeat', {
    agentId: BRIDGE_ID,
    host: os.hostname(),
    platform: process.platform,
    version: process.version,
    capabilities: ['bridge.snapshot', 'snapshot.refresh', 'codex.exec', 'codex.thread.sync', 'codex.thread.read', 'codex.thread.send', 'codex.host.appServer', 'codex.desktop.restart', 'oauth.callback.relay', 'ticproxy.apiOneKey.configure', 'file.list', 'file.search', 'file.read', 'task.snapshot'],
  });
}

async function publishSnapshot() {
  const threadSync = codexThreadSnapshot();
  await request('POST', '/agent/snapshot', {
    agentId: BRIDGE_ID,
    host: os.hostname(),
    codex: codexSnapshot(),
    threads: threadSync.threads,
    messagesByThread: threadSync.messagesByThread,
    threadSync: {
      syncedAt: threadSync.syncedAt,
      error: threadSync.error || '',
    },
    tasks: taskSnapshot(),
    files: {
      roots: allowedRoots(),
    },
    env: {
      allowedRoots: process.env.TICMIRO_ALLOWED_ROOTS || '',
      localAttachmentsDir: process.env.TICMIRO_LOCAL_ATTACHMENTS_DIR || '',
    },
  });
}

async function runWithProgressSnapshots(work) {
  if (!THREAD_PROGRESS_SNAPSHOT_MS || THREAD_PROGRESS_SNAPSHOT_MS < 500) return work();
  let inFlight = false;
  const timer = setInterval(() => {
    if (inFlight) return;
    inFlight = true;
    publishSnapshot()
      .catch((error) => log(`progress snapshot failed: ${error.message || error}`))
      .finally(() => {
        inFlight = false;
      });
  }, THREAD_PROGRESS_SNAPSHOT_MS);
  try {
    return await work();
  } finally {
    clearInterval(timer);
  }
}

async function handleCommand(command) {
  if (!command) return;
  if (command.type === 'bridge.snapshot' || command.type === 'snapshot.refresh' || command.type === 'codex.thread.read') {
    await publishSnapshot();
    let result = { summary: 'Snapshot published.' };
    if (command.type === 'codex.thread.read') {
      const snapshot = codexThreadSnapshot();
      const threadId = String(command.payload?.threadId || '');
      result = {
        summary: 'Thread transcript refreshed.',
        thread: snapshot.threads.find((item) => item.id === threadId) || null,
        messages: snapshot.messagesByThread[threadId] || [],
      };
    }
    await request('POST', `/agent/commands/${encodeURIComponent(command.id)}/result`, {
      status: 'completed',
      result,
    });
    return;
  }
  if (command.type === 'task.snapshot') {
    const result = taskSnapshot();
    await publishSnapshot();
    await request('POST', `/agent/commands/${encodeURIComponent(command.id)}/result`, {
      status: 'completed',
      result: { ...result, summary: 'Task snapshot collected.' },
    });
    return;
  }
  if (command.type === 'file.list' || command.type === 'file.search' || command.type === 'file.read') {
    let result;
    if (command.type === 'file.list') result = listFiles(command.payload || {});
    if (command.type === 'file.search') result = searchFiles(command.payload || {});
    if (command.type === 'file.read') result = readFileText(command.payload || {});
    await request('POST', `/agent/commands/${encodeURIComponent(command.id)}/result`, {
      status: 'completed',
      result: { ...result, summary: `${command.type} completed.` },
    });
    return;
  }
  if (command.type === 'codex.exec') {
    const result = await runCodexExec(command.payload || {});
    await request('POST', `/agent/commands/${encodeURIComponent(command.id)}/result`, {
      status: result.code === 0 ? 'completed' : 'failed',
      result: {
        code: result.code,
        stdout: String(result.stdout || '').trim().slice(-12000),
        stderr: String(result.stderr || '').trim().slice(-4000),
        summary: result.code === 0 ? 'Codex exec completed.' : 'Codex exec failed.',
      },
      error: result.code === 0 ? '' : String(result.stderr || '').trim().slice(-1000),
    });
    return;
  }
  if (command.type === 'codex.desktop.restart') {
    const result = await restartCodexDesktop({ ...(command.payload || {}), reason: command.payload?.reason || 'manual-command' });
    await request('POST', `/agent/commands/${encodeURIComponent(command.id)}/result`, {
      status: result.ok ? 'completed' : 'failed',
      result: {
        code: result.code,
        method: result.method,
        killed: result.killed || [],
        started: result.started || '',
        stdout: String(result.stdout || '').trim().slice(-4000),
        stderr: String(result.stderr || '').trim().slice(-2000),
        summary: result.summary,
      },
      error: result.ok ? '' : String(result.stderr || result.summary || '').trim().slice(-1000),
    });
    await publishSnapshot();
    return;
  }
  if (command.type === 'ticproxy.apiOneKey.configure') {
    try {
      const material = await request('POST', '/agent/ticproxy/api-one-key/material', {
        model: command.payload?.model || '',
        setDefault: command.payload?.setDefault !== false,
      });
      const result = configureCodexApiOneKey(material);
      await publishSnapshot();
      await request('POST', `/agent/commands/${encodeURIComponent(command.id)}/result`, {
        status: 'completed',
        result: {
          ...result,
          generatedProxyKey: Boolean(material.generated),
          proxyKeyRedacted: material.proxyKeyRedacted || result.proxyKeyRedacted || '',
        },
      });
    } catch (error) {
      await request('POST', `/agent/commands/${encodeURIComponent(command.id)}/result`, {
        status: 'failed',
        result: {
          summary: 'API ONE KEY failed to configure Codex Desktop.',
        },
        error: error.message || String(error),
      });
    }
    return;
  }
  if (command.type === 'codex.thread.send') {
    const result = await runWithProgressSnapshots(() => runCodexThreadSend(command.payload || {}));
    await request('POST', `/agent/commands/${encodeURIComponent(command.id)}/result`, {
      status: result.code === 0 ? 'completed' : 'failed',
      result: {
        code: result.code,
        stdout: String(result.stdout || '').trim().slice(-12000),
        stderr: String(result.stderr || '').trim().slice(-4000),
        host: result.host || codexHostStatus(),
        snapshotChanged: Boolean(result.snapshotChanged),
        syncedAt: result.syncedAt || '',
        thread: result.thread || null,
        messages: result.messages || [],
        summary: result.code === 0 ? 'Desktop thread turn completed.' : 'Desktop thread send failed.',
      },
      error: result.code === 0 ? '' : String(result.stderr || '').trim().slice(-1000),
    });
    await publishSnapshot();
    return;
  }
  await request('POST', `/agent/commands/${encodeURIComponent(command.id)}/result`, {
    status: 'failed',
    error: `Unsupported command type: ${command.type}`,
  });
}

async function loop() {
  await heartbeat();
  await publishSnapshot();
  let lastSnapshot = Date.now();
  while (true) {
    try {
      const claim = await request('POST', '/agent/commands/claim', { agentId: BRIDGE_ID });
      await handleCommand(claim.command);
      if (Date.now() - lastSnapshot > SNAPSHOT_MS) {
        await heartbeat();
        await publishSnapshot();
        lastSnapshot = Date.now();
      }
    } catch (error) {
      log(`error: ${error.message || error}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

startCallbackRelay();

loop().catch((error) => {
  log(`fatal: ${error.message || error}`);
  process.exit(1);
});
