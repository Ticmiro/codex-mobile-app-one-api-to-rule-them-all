const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_ZALO_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const DEFAULT_CONFIRM_TTL_MS = 2 * 60 * 1000;
const MAX_EVENTS = 120;
const MAX_REPLY_CHARS = 1800;
const MAX_MIRRORED_COMMANDS = 240;
const WATCH_INTERVAL_MS = 5000;
const WATCH_TIMEOUT_MS = 30 * 60 * 1000;
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'rejected']);
const QR_SOFT_PATCH_MARKER = 'ticproxy-zalo-qr-soft-userinfo-v1';

const DEFAULT_CONFIG = {
  allowedSenderIds: [],
  allowedThreadIds: [],
  allowLinkCommand: true,
  syncWebappToZalo: true,
};

function nowIso() {
  return new Date().toISOString();
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function uniqueStrings(value) {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,;]+/)
      : [];
  return Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean)));
}

function randomCode(length = 8) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let index = 0; index < length; index += 1) out += alphabet[bytes[index] % alphabet.length];
  return out;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function truncateReply(text) {
  const value = String(text || '').trim();
  if (value.length <= MAX_REPLY_CHARS) return value;
  return `${value.slice(0, MAX_REPLY_CHARS)}\n...[rut gon]`;
}

function shortText(text, max = 160) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 12)}...[rut gon]`;
}

function cookieKey(cookie) {
  return asString(cookie?.key || cookie?.name);
}

function cookieDomain(cookie) {
  return asString(cookie?.domain).replace(/^\./, '');
}

function normalizeZaloCookies(cookies) {
  if (!Array.isArray(cookies)) return cookies;
  const hasChatSessionKey = cookies.some((cookie) => cookieKey(cookie) === 'zpw_sek' && cookieDomain(cookie) === 'chat.zalo.me');
  if (!hasChatSessionKey) return cookies;
  return cookies.filter((cookie) => !(cookieKey(cookie) === 'zpw_sek' && cookieDomain(cookie) === 'zalo.me'));
}

function normalizeCredentials(credentials) {
  const value = asObject(credentials);
  return {
    ...value,
    cookie: normalizeZaloCookies(value.cookie),
    userAgent: asString(value.userAgent, DEFAULT_ZALO_USER_AGENT),
  };
}

function normalizeThreadType(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function contextKey(context) {
  return `${context.threadId || ''}:${normalizeThreadType(context.threadType)}`;
}

function normalizeReplyContext(value) {
  const context = asObject(value);
  const threadId = asString(context.threadId);
  if (!threadId) return null;
  return {
    threadId,
    threadType: normalizeThreadType(context.threadType),
    senderId: asString(context.senderId),
    displayName: asString(context.displayName),
    updatedAt: asString(context.updatedAt),
  };
}

function messageText(message) {
  const content = message?.data?.content;
  if (typeof content === 'string') return content.trim();
  if (content && typeof content.title === 'string') return content.title.trim();
  if (message && typeof message.text === 'string') return message.text.trim();
  return '';
}

function normalizeMessage(message) {
  const threadId = asString(message?.threadId || message?.data?.idTo || message?.data?.uidFrom);
  const senderId = asString(message?.data?.uidFrom || message?.data?.userId || message?.userId);
  const displayName = asString(message?.data?.dName || message?.displayName || message?.name);
  const threadType = Number.isFinite(Number(message?.type)) ? Number(message.type) : 0;
  return {
    raw: message,
    text: messageText(message),
    threadId,
    senderId,
    displayName,
    threadType,
    isSelf: Boolean(message?.isSelf),
  };
}

function commandPayload(command) {
  const raw = command?.payload || command?.result?.payload || {};
  if (raw && typeof raw === 'object') return raw;
  const preview = String(command?.payloadPreview || '').trim();
  if (!preview || preview.startsWith('[')) return {};
  try {
    return JSON.parse(preview);
  } catch {
    return {};
  }
}

function extractTextFromPart(part) {
  if (typeof part === 'string') return part;
  if (!part || typeof part !== 'object') return '';
  return asString(
    part.text,
    asString(
      part.content,
      asString(part.value, asString(part.summary, '')),
    ),
  );
}

function extractMessageText(message) {
  if (!message) return '';
  if (typeof message === 'string') return message;
  if (typeof message.text === 'string') return message.text;
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) return message.content.map(extractTextFromPart).filter(Boolean).join('\n');
  if (Array.isArray(message.parts)) return message.parts.map(extractTextFromPart).filter(Boolean).join('\n');
  if (typeof message.summary === 'string') return message.summary;
  return '';
}

function messageRole(message) {
  return asString(message?.role || message?.author?.role || message?.from || '');
}

function summarizeCodexCommand(command) {
  if (!command) return 'Khong tim thay lenh Codex.';
  if (command.status === 'failed') {
    return `Codex bi loi:\n${asString(command.error, 'unknown error')}`;
  }
  const result = asObject(command.result);
  const messages = Array.isArray(result.messages) ? result.messages : [];
  const assistant = [...messages].reverse().find((message) => /assistant|codex/i.test(messageRole(message)) && extractMessageText(message));
  const userVisible = assistant ? extractMessageText(assistant) : '';
  const fallback = asString(result.summary, asString(command.summary, asString(result.outputText, asString(result.stdout, asString(result.stderr)))));
  const body = userVisible || fallback || 'Codex da xu ly xong.';
  return body;
}

function threadTitle(thread) {
  return asString(thread?.title, asString(thread?.id, 'Codex thread'));
}

function formatThreadList(threads) {
  const rows = threads.slice(0, 10).map((thread, index) => [
    `${index + 1}. ${threadTitle(thread)}`,
    `   ${thread.id || '-'}`,
    `   ${[thread.modelProvider, thread.model, thread.updatedAt].filter(Boolean).join(' | ')}`,
  ].filter(Boolean).join('\n'));
  return rows.length
    ? ['Cac thread Codex gan day:', ...rows, '', 'Gui /use <so thu tu> de lien ket chat Zalo nay vao thread.'].join('\n')
    : 'Chua co thread Codex trong snapshot. Hay mo Codex Desktop va bam Sync truoc.';
}

function parseCommand(text) {
  const raw = String(text || '').trim();
  if (!raw) return { action: 'ignore' };
  if (!raw.startsWith('/')) return { action: 'send', text: raw };
  const [command, ...restParts] = raw.split(/\s+/);
  const rest = restParts.join(' ').trim();
  const name = command.toLowerCase();
  if (name === '/help') return { action: 'help' };
  if (name === '/link') return { action: 'link', code: rest };
  if (name === '/threads') return { action: 'threads' };
  if (name === '/use') return { action: 'use', target: rest };
  if (name === '/unlink') return { action: 'unlink' };
  if (name === '/status') return { action: 'status' };
  return { action: 'unknown', command: name };
}

async function ensureZaloQrSoftUserInfoPatch(baseDir) {
  const entry = require.resolve('zalo-api-final', { paths: [baseDir, __dirname, path.join(__dirname, '..', '..', '..')] });
  const packageRoot = entry.includes(`${path.sep}dist${path.sep}`)
    ? entry.slice(0, entry.indexOf(`${path.sep}dist${path.sep}`))
    : path.dirname(entry);
  const loginQrFile = path.join(packageRoot, 'dist', 'cjs', 'apis', 'loginQR.cjs');
  let source = '';
  try {
    source = await fs.readFile(loginQrFile, 'utf8');
  } catch (error) {
    return { patched: false, skipped: true, loginQrFile, error: error.message || String(error) };
  }
  if (source.includes(QR_SOFT_PATCH_MARKER)) return { patched: false, loginQrFile };
  const needle = `            if (!userInfo.data.logged)
                return reject(new ZaloApiError.ZaloApiError("Can't login"));
            clearTimeout(timeout);
            resolve({
                cookies: ctx.cookie.toJSON().cookies,
                userInfo: userInfo.data.info,
            });`;
  const replacement = `            if (!userInfo.data.logged) {
                if (ctx.options && ctx.options.allowQrLoginWithUnverifiedUserInfo) {
                    // ${QR_SOFT_PATCH_MARKER}: some QR sessions pass checksession but report logged=false here.
                    clearTimeout(timeout);
                    return resolve({
                        cookies: ctx.cookie.toJSON().cookies,
                        userInfo: userInfo.data.info || null,
                    });
                }
                return reject(new ZaloApiError.ZaloApiError("Can't login"));
            }
            clearTimeout(timeout);
            resolve({
                cookies: ctx.cookie.toJSON().cookies,
                userInfo: userInfo.data.info,
            });`;
  if (!source.includes(needle)) return { patched: false, skipped: true, loginQrFile };
  source = source.replace(needle, replacement);
  await fs.writeFile(loginQrFile, source, 'utf8');
  return { patched: true, loginQrFile };
}

class ZaloBridge {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '..', '..', '..', 'runtime', 'server');
    this.stateFile = process.env.ZALO_BRIDGE_STATE_FILE || path.join(this.dataDir, 'zalo', 'state.json');
    this.getSnapshot = typeof options.getSnapshot === 'function' ? options.getSnapshot : () => ({ threads: [] });
    this.createCommand = typeof options.createCommand === 'function' ? options.createCommand : async () => null;
    this.listCommands = typeof options.listCommands === 'function' ? options.listCommands : () => [];
    this.zaloModule = null;
    this.zalo = null;
    this.api = null;
    this.loginPromise = null;
    this.loginStatus = 'idle';
    this.listenerRunning = false;
    this.ownId = '';
    this.lastError = '';
    this.qr = null;
    this.scannedBy = null;
    this.watchTargets = new Map();
    this.watchTimer = null;
    this.manualStopRequested = false;
    this.initialized = false;
    this.state = {
      config: clone(DEFAULT_CONFIG),
      credentials: null,
      setupCode: '',
      defaultCodexThreadId: '',
      links: {},
      mirroredCommandIds: [],
      events: [],
    };
  }

  async init() {
    if (this.initialized) return;
    await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
    try {
      const raw = await fs.readFile(this.stateFile, 'utf8');
      const parsed = JSON.parse(raw);
      this.state = {
        ...this.state,
        ...asObject(parsed),
        config: { ...DEFAULT_CONFIG, ...asObject(parsed.config) },
        links: asObject(parsed.links),
        mirroredCommandIds: uniqueStrings(parsed.mirroredCommandIds).slice(-MAX_MIRRORED_COMMANDS),
        events: Array.isArray(parsed.events) ? parsed.events.slice(-MAX_EVENTS) : [],
      };
    } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error;
    }
    if (!this.state.setupCode) this.state.setupCode = randomCode(8);
    await this.writeState();
    this.initialized = true;
  }

  async bootstrap() {
    await this.init();
    if (String(process.env.ZALO_BRIDGE_AUTO_START || '1') === '0') {
      this.appendEvent('bootstrap.skip', 'Zalo bridge auto start disabled.');
      await this.writeState();
      return this.getStatus();
    }
    if (this.state.credentials) {
      this.startFromSavedCredentials().catch((error) => {
        this.loginStatus = 'error';
        this.lastError = error instanceof Error ? error.message : String(error);
        this.appendEvent('bootstrap.error', this.lastError);
        this.writeState().catch(() => undefined);
      });
    }
    return this.getStatus();
  }

  async writeState() {
    const serializable = {
      config: this.state.config,
      credentials: this.state.credentials,
      setupCode: this.state.setupCode,
      defaultCodexThreadId: this.state.defaultCodexThreadId,
      links: this.state.links,
      mirroredCommandIds: uniqueStrings(this.state.mirroredCommandIds).slice(-MAX_MIRRORED_COMMANDS),
      events: (this.state.events || []).slice(-MAX_EVENTS),
    };
    await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
    const tmp = `${this.stateFile}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(serializable, null, 2), 'utf8');
    await fs.rename(tmp, this.stateFile);
  }

  appendEvent(kind, message, extra = {}) {
    this.state.events.push({
      id: `zalo_evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
      kind,
      message: asString(message),
      createdAt: nowIso(),
      ...asObject(extra),
    });
    this.state.events = this.state.events.slice(-MAX_EVENTS);
  }

  async loadZaloModule() {
    if (this.zaloModule) return this.zaloModule;
    try {
      const patch = await ensureZaloQrSoftUserInfoPatch(path.dirname(this.stateFile));
      if (patch.patched) this.appendEvent('library.patch', 'Applied Zalo QR compatibility patch.');
      if (patch.skipped) this.appendEvent('library.patch.skip', 'Zalo QR patch pattern was not found; package may have changed.');
      // eslint-disable-next-line global-require, import/no-dynamic-require
      this.zaloModule = require('zalo-api-final');
      return this.zaloModule;
    } catch (error) {
      const hint = 'Missing dependency zalo-api-final. Install server dependencies first.';
      const wrapped = new Error(`${hint} ${error instanceof Error ? error.message : String(error)}`);
      wrapped.code = 'ZALO_DEPENDENCY_MISSING';
      throw wrapped;
    }
  }

  async getStatus(options = {}) {
    await this.init();
    const includeQr = options.includeQr !== false;
    const snapshot = this.getSnapshot() || {};
    return {
      ok: true,
      stateFile: this.stateFile,
      status: this.loginStatus,
      listenerRunning: this.listenerRunning,
      ownId: this.ownId,
      lastError: this.lastError,
      credentialsSaved: Boolean(this.state.credentials),
      setupCode: this.state.setupCode,
      scannedBy: this.scannedBy,
      qr: includeQr ? this.qr : this.qr ? {
        generatedAt: this.qr.generatedAt,
        expiresAt: this.qr.expiresAt,
        hasImage: Boolean(this.qr.dataUrl),
      } : null,
      config: {
        allowedSenderIds: this.state.config.allowedSenderIds || [],
        allowedThreadIds: this.state.config.allowedThreadIds || [],
        allowLinkCommand: this.state.config.allowLinkCommand !== false,
        syncWebappToZalo: this.state.config.syncWebappToZalo !== false,
      },
      defaultCodexThreadId: this.state.defaultCodexThreadId || '',
      links: Object.values(this.state.links || {}),
      linkedCount: Object.keys(this.state.links || {}).length,
      watchCount: this.watchTargets.size,
      threads: (snapshot.threads || []).slice(0, 24),
      recentEvents: (this.state.events || []).slice(-20).reverse(),
    };
  }

  async updateConfig(input = {}) {
    await this.init();
    this.state.config = {
      ...this.state.config,
      allowedSenderIds: Object.prototype.hasOwnProperty.call(input, 'allowedSenderIds')
        ? uniqueStrings(input.allowedSenderIds)
        : this.state.config.allowedSenderIds,
      allowedThreadIds: Object.prototype.hasOwnProperty.call(input, 'allowedThreadIds')
        ? uniqueStrings(input.allowedThreadIds)
        : this.state.config.allowedThreadIds,
      allowLinkCommand: Object.prototype.hasOwnProperty.call(input, 'allowLinkCommand')
        ? Boolean(input.allowLinkCommand)
        : this.state.config.allowLinkCommand !== false,
      syncWebappToZalo: Object.prototype.hasOwnProperty.call(input, 'syncWebappToZalo')
        ? Boolean(input.syncWebappToZalo)
        : this.state.config.syncWebappToZalo !== false,
    };
    if (Object.prototype.hasOwnProperty.call(input, 'defaultCodexThreadId')) {
      this.state.defaultCodexThreadId = asString(input.defaultCodexThreadId);
    }
    this.appendEvent('config.updated', 'Zalo bridge config updated.');
    await this.writeState();
    return this.getStatus();
  }

  async rotateSetupCode() {
    await this.init();
    this.state.setupCode = randomCode(8);
    this.appendEvent('setup.rotate', 'Zalo setup code rotated.');
    await this.writeState();
    return this.getStatus();
  }

  async startLoginQr(options = {}) {
    await this.init();
    if (this.loginPromise) return this.getStatus();
    this.manualStopRequested = false;
    const { Zalo } = await this.loadZaloModule();
    const qrPath = path.join(path.dirname(this.stateFile), 'zalo-login-qr.png');
    const userAgent = asString(options.userAgent || this.state.credentials?.userAgent || process.env.ZALO_BRIDGE_USER_AGENT, DEFAULT_ZALO_USER_AGENT);
    this.zalo = new Zalo({
      selfListen: false,
      checkUpdate: false,
      logging: String(process.env.ZALO_BRIDGE_DEBUG || '') === '1',
      allowQrLoginWithUnverifiedUserInfo: true,
    });
    this.api = null;
    this.ownId = '';
    this.scannedBy = null;
    this.lastError = '';
    this.loginStatus = 'qr_starting';
    this.appendEvent('login.qr.start', 'Zalo QR login started.');
    await this.writeState();

    this.loginPromise = this.zalo.loginQR({ userAgent, language: 'vi', qrPath }, (event) => {
      this.handleLoginEvent(event, qrPath).catch(() => undefined);
    }).then(async (api) => {
      this.api = api;
      this.ownId = await this.safeGetOwnId();
      this.loginStatus = 'online';
      this.loginPromise = null;
      this.appendEvent('login.success', 'Zalo account connected.');
      await this.writeState();
      this.startListener();
      return api;
    }).catch(async (error) => {
      const rawError = error instanceof Error ? error.message : String(error);
      if (this.state.credentials?.cookie && this.state.credentials?.imei) {
        this.loginPromise = null;
        this.appendEvent('login.qr.fallback', 'QR flow returned an error; retrying saved credentials.');
        await this.writeState();
        return this.startFromSavedCredentials();
      }
      this.loginStatus = 'error';
      this.lastError = rawError || 'Zalo login failed.';
      this.loginPromise = null;
      this.appendEvent('login.error', this.lastError);
      await this.writeState();
      throw error;
    });
    this.loginPromise.catch(() => undefined);
    return this.getStatus();
  }

  async handleLoginEvent(event, qrPath) {
    await this.init();
    const type = Number(event?.type);
    if (type === 0) {
      const image = asString(event?.data?.image);
      this.qr = {
        code: asString(event?.data?.code),
        dataUrl: image ? `data:image/png;base64,${image.replace(/^data:image\/png;base64,/, '')}` : '',
        generatedAt: nowIso(),
        expiresAt: new Date(Date.now() + 100000).toISOString(),
        qrPath,
      };
      this.loginStatus = 'qr_waiting';
      if (event?.actions?.saveToFile) event.actions.saveToFile(qrPath).catch(() => undefined);
      this.appendEvent('login.qr.generated', 'QR login code generated.');
    } else if (type === 1) {
      this.loginStatus = 'qr_expired';
      this.appendEvent('login.qr.expired', 'QR login expired.');
    } else if (type === 2) {
      this.loginStatus = 'qr_scanned';
      this.scannedBy = asObject(event.data);
      this.appendEvent('login.qr.scanned', 'QR scanned from Zalo mobile.');
    } else if (type === 3) {
      this.loginStatus = 'qr_declined';
      this.appendEvent('login.qr.declined', 'QR login declined.');
    } else if (type === 4) {
      this.state.credentials = normalizeCredentials({
        cookie: event?.data?.cookie,
        imei: event?.data?.imei,
        userAgent: event?.data?.userAgent,
        savedAt: nowIso(),
      });
      this.appendEvent('login.credentials.saved', 'Zalo credentials saved in runtime state.');
    }
    await this.writeState();
  }

  async startFromSavedCredentials() {
    await this.init();
    if (!this.state.credentials) {
      const error = new Error('No saved Zalo credentials. Start QR login first.');
      error.statusCode = 400;
      throw error;
    }
    this.manualStopRequested = false;
    const credentials = normalizeCredentials(this.state.credentials);
    this.state.credentials = credentials;
    const { Zalo } = await this.loadZaloModule();
    this.zalo = new Zalo({
      selfListen: false,
      checkUpdate: false,
      logging: String(process.env.ZALO_BRIDGE_DEBUG || '') === '1',
    });
    this.loginStatus = 'connecting';
    this.lastError = '';
    this.appendEvent('login.cookie.start', 'Starting Zalo bridge from saved credentials.');
    await this.writeState();
    this.api = await this.zalo.login({
      cookie: credentials.cookie,
      imei: credentials.imei,
      userAgent: credentials.userAgent,
      language: 'vi',
    });
    this.ownId = await this.safeGetOwnId();
    this.loginStatus = 'online';
    this.appendEvent('login.cookie.success', 'Zalo bridge online from saved credentials.');
    await this.writeState();
    this.startListener();
    return this.getStatus();
  }

  async safeGetOwnId() {
    try {
      return asString(await this.api?.getOwnId?.());
    } catch {
      return '';
    }
  }

  startListener() {
    if (!this.api?.listener || this.listenerRunning) return;
    this.api.listener.on('message', (message) => {
      this.handleIncomingMessage(message).catch((error) => {
        this.lastError = error instanceof Error ? error.message : String(error);
        this.appendEvent('message.error', this.lastError);
        this.writeState().catch(() => undefined);
      });
    });
    this.api.listener.on('error', (error) => {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.appendEvent('listener.error', this.lastError);
      this.writeState().catch(() => undefined);
    });
    this.api.listener.on('closed', (reason) => {
      this.listenerRunning = false;
      this.appendEvent('listener.closed', `Zalo listener closed: ${asString(reason, 'unknown')}.`);
      this.writeState().catch(() => undefined);
    });
    this.api.listener.start({ retryOnClose: true });
    this.listenerRunning = true;
    this.appendEvent('listener.started', 'Zalo listener started.');
    this.writeState().catch(() => undefined);
  }

  async stopListener() {
    await this.init();
    this.manualStopRequested = true;
    if (this.api?.listener?.stop) this.api.listener.stop();
    this.listenerRunning = false;
    this.appendEvent('listener.stopped', 'Zalo listener stopped.');
    await this.writeState();
    return this.getStatus();
  }

  async logout() {
    await this.stopListener().catch(() => undefined);
    this.api = null;
    this.zalo = null;
    this.loginPromise = null;
    this.ownId = '';
    this.loginStatus = 'idle';
    this.lastError = '';
    this.qr = null;
    this.scannedBy = null;
    this.state.credentials = null;
    this.appendEvent('logout', 'Zalo credentials cleared.');
    await this.writeState();
    return this.getStatus();
  }

  isAllowed(context) {
    const config = this.state.config;
    return uniqueStrings(config.allowedSenderIds).includes(context.senderId)
      || uniqueStrings(config.allowedThreadIds).includes(context.threadId);
  }

  codexThreads() {
    const snapshot = this.getSnapshot() || {};
    return Array.isArray(snapshot.threads) ? snapshot.threads : [];
  }

  threadByTarget(target) {
    const threads = this.codexThreads();
    const value = asString(target);
    if (!value) return null;
    const index = Number(value);
    if (Number.isInteger(index) && index > 0 && threads[index - 1]) return threads[index - 1];
    return threads.find((thread) => thread.id === value || thread.title === value) || null;
  }

  linkKey(context) {
    return contextKey(context);
  }

  linkedThread(context) {
    const link = this.state.links[this.linkKey(context)];
    const threadId = asString(link?.codexThreadId || this.state.defaultCodexThreadId);
    if (!threadId) return null;
    const thread = this.codexThreads().find((item) => item.id === threadId);
    return { id: threadId, title: threadTitle(thread || link), link };
  }

  async setLink(context, thread) {
    const normalized = normalizeReplyContext({ ...context, updatedAt: nowIso() });
    this.state.links[this.linkKey(context)] = {
      ...normalized,
      codexThreadId: thread.id,
      codexThreadTitle: threadTitle(thread),
      createdAt: this.state.links[this.linkKey(context)]?.createdAt || nowIso(),
      updatedAt: nowIso(),
      lastCommandId: '',
    };
    this.state.defaultCodexThreadId = thread.id;
    await this.writeState();
  }

  async linkController(context, code) {
    if (this.state.config.allowLinkCommand === false) {
      await this.reply(context, 'Lenh /link dang tat trong cau hinh bridge.');
      return;
    }
    if (!code || code.toUpperCase() !== String(this.state.setupCode || '').toUpperCase()) {
      await this.reply(context, 'Ma lien ket khong dung.');
      return;
    }
    this.state.config.allowedSenderIds = uniqueStrings([...this.state.config.allowedSenderIds, context.senderId]);
    this.state.config.allowedThreadIds = uniqueStrings([...this.state.config.allowedThreadIds, context.threadId]);
    this.state.setupCode = randomCode(8);
    const defaultThread = this.threadByTarget(this.state.defaultCodexThreadId) || this.codexThreads()[0] || null;
    if (defaultThread) await this.setLink(context, defaultThread);
    this.appendEvent('controller.linked', 'Linked a Zalo chat to Codex Mobile.');
    await this.writeState();
    await this.reply(context, [
      'Da lien ket Zalo voi Codex Mobile.',
      defaultThread ? `Thread hien tai: ${threadTitle(defaultThread)}` : 'Chua gan thread Codex. Gui /threads roi /use <so thu tu>.',
      'Gui /help de xem lenh.',
    ].join('\n'));
  }

  async handleIncomingMessage(message) {
    await this.init();
    const context = normalizeMessage(message);
    if (context.isSelf || !context.text) return;
    this.appendEvent('message.received', 'Received a Zalo message.');
    const parsed = parseCommand(context.text);
    if (parsed.action === 'ignore') return;
    if (parsed.action === 'link') {
      await this.linkController(context, parsed.code);
      return;
    }
    if (!this.isAllowed(context)) {
      await this.reply(context, [
        'Zalo nay chua duoc cap quyen dieu khien Codex Mobile.',
        'Mo tab Zalo Link, quet QR, roi gui /link <ma> tu chat Zalo nay.',
      ].join('\n'));
      return;
    }
    await this.handleAllowedMessage(context, parsed);
  }

  async handleAllowedMessage(context, parsed) {
    if (parsed.action === 'help') {
      await this.reply(context, [
        'Lenh Zalo Link:',
        '/threads - xem thread Codex gan day',
        '/use <so|threadId> - lien ket chat Zalo nay vao thread',
        '/unlink - bo lien ket chat hien tai',
        '/status - xem trang thai bridge',
        'Text thuong = gui vao thread dang link.',
      ].join('\n'));
      return;
    }
    if (parsed.action === 'threads') {
      await this.reply(context, formatThreadList(this.codexThreads()));
      return;
    }
    if (parsed.action === 'use') {
      const thread = this.threadByTarget(parsed.target);
      if (!thread) {
        await this.reply(context, 'Khong tim thay thread. Gui /threads de xem danh sach moi nhat.');
        return;
      }
      await this.setLink(context, thread);
      await this.reply(context, `Da lien ket chat nay vao thread:\n${threadTitle(thread)}\n${thread.id}`);
      return;
    }
    if (parsed.action === 'unlink') {
      delete this.state.links[this.linkKey(context)];
      await this.writeState();
      await this.reply(context, 'Da bo lien ket chat Zalo nay khoi thread Codex.');
      return;
    }
    if (parsed.action === 'status') {
      const linked = this.linkedThread(context);
      await this.reply(context, [
        `Zalo listener: ${this.listenerRunning ? 'online' : 'offline'}`,
        `Dang nhap: ${this.loginStatus}`,
        `Linked thread: ${linked ? `${linked.title} (${linked.id})` : 'chua co'}`,
        `Watcher: ${this.watchTargets.size}`,
        this.lastError ? `Last error: ${this.lastError}` : '',
      ].filter(Boolean).join('\n'));
      return;
    }
    if (parsed.action === 'unknown') {
      await this.reply(context, `Chua ho tro ${parsed.command}. Gui /help de xem lenh.`);
      return;
    }
    if (parsed.action === 'send') {
      await this.forwardToCodex(context, parsed.text);
    }
  }

  async forwardToCodex(context, text) {
    const linked = this.linkedThread(context);
    if (!linked?.id) {
      await this.reply(context, 'Chat Zalo nay chua link vao thread Codex. Gui /threads roi /use <so thu tu>.');
      return;
    }
    const command = await this.createCommand('codex.thread.send', {
      threadId: linked.id,
      message: text,
      attachmentIds: [],
      source: 'zalo',
      zalo: {
        threadId: context.threadId,
        threadType: context.threadType,
        senderId: context.senderId,
      },
    });
    const publicId = command?.id || '';
    const key = this.linkKey(context);
    if (this.state.links[key]) {
      this.state.links[key].lastCommandId = publicId;
      this.state.links[key].updatedAt = nowIso();
      await this.writeState();
    }
    await this.reply(context, `Da gui vao Codex: ${shortText(text, 120)}\nCommand: ${publicId || '-'}`);
    if (publicId) this.watchCommandResult(publicId, context);
  }

  async afterCommandCreated(command) {
    await this.init();
    if (!command || command.type !== 'codex.thread.send') return;
    if (this.state.config.syncWebappToZalo === false) return;
    if (!this.api?.sendMessage) return;
    const payload = commandPayload(command);
    if (payload.source === 'zalo') return;
    const threadId = asString(payload.threadId);
    if (!threadId) return;
    if (this.state.mirroredCommandIds.includes(command.id)) return;
    const targets = Object.values(this.state.links || {})
      .filter((link) => link.codexThreadId === threadId)
      .map(normalizeReplyContext)
      .filter(Boolean);
    if (!targets.length) return;
    this.state.mirroredCommandIds = uniqueStrings([...this.state.mirroredCommandIds, command.id]).slice(-MAX_MIRRORED_COMMANDS);
    await this.writeState();
    for (const target of targets) {
      await this.reply(target, [
        'Tin moi tu Codex Mobile:',
        shortText(payload.message || command.payloadPreview || '', 700),
        `Command: ${command.id}`,
      ].join('\n'));
      this.watchCommandResult(command.id, target);
    }
  }

  watchCommandResult(commandId, context) {
    const target = normalizeReplyContext(context);
    if (!commandId || !target) return;
    this.watchTargets.set(`${commandId}:${contextKey(target)}`, {
      commandId,
      context: target,
      startedAt: Date.now(),
    });
    if (!this.watchTimer) {
      this.watchTimer = setInterval(() => {
        this.flushCommandResults().catch((error) => {
          this.lastError = error instanceof Error ? error.message : String(error);
        });
      }, WATCH_INTERVAL_MS);
      this.watchTimer.unref?.();
    }
  }

  async flushCommandResults() {
    if (!this.watchTargets.size) {
      if (this.watchTimer) clearInterval(this.watchTimer);
      this.watchTimer = null;
      return;
    }
    const commands = this.listCommands() || [];
    const byId = new Map(commands.map((command) => [command.id, command]));
    for (const [key, target] of this.watchTargets.entries()) {
      const command = byId.get(target.commandId);
      const ageMs = Date.now() - target.startedAt;
      if (!command && ageMs > 10 * 60 * 1000) {
        this.watchTargets.delete(key);
        continue;
      }
      if (!command) continue;
      if (TERMINAL_STATUSES.has(command.status)) {
        this.watchTargets.delete(key);
        await this.reply(target.context, truncateReply(summarizeCodexCommand(command)));
      } else if (ageMs > WATCH_TIMEOUT_MS) {
        this.watchTargets.delete(key);
        await this.reply(target.context, `Lenh ${command.type} van dang ${command.status}. Hay xem tiep trong Codex Mobile.`);
      }
    }
  }

  async reply(context, text) {
    if (!this.api?.sendMessage || !context.threadId) return;
    const { ThreadType } = await this.loadZaloModule();
    const type = normalizeThreadType(context.threadType) === 1 ? ThreadType.Group : ThreadType.User;
    await this.api.sendMessage(truncateReply(text), context.threadId, type);
  }
}

function createZaloBridge(options) {
  return new ZaloBridge(options);
}

module.exports = { createZaloBridge };
