const TOKEN_KEY = 'codexMobileControlToken';
const API = '/api';
const AUTO_REFRESH_MS = 5000;

const els = {
  tokenInput: document.getElementById('tokenInput'),
  saveTokenBtn: document.getElementById('saveTokenBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  snapshotBtn: document.getElementById('snapshotBtn'),
  activeTitle: document.getElementById('activeTitle'),
  subtitle: document.getElementById('subtitle'),
  livePill: document.getElementById('livePill'),
  toast: document.getElementById('toast'),
  agentCard: document.getElementById('agentCard'),
  codexCard: document.getElementById('codexCard'),
  ticproxyCard: document.getElementById('ticproxyCard'),
  residentCard: document.getElementById('residentCard'),
  threads: document.getElementById('threads'),
  commands: document.getElementById('commands'),
  events: document.getElementById('events'),
  signals: document.getElementById('signals'),
  providerSelect: document.getElementById('providerSelect'),
  modelInput: document.getElementById('modelInput'),
  switchProviderBtn: document.getElementById('switchProviderBtn'),
  ticproxyStatusBtn: document.getElementById('ticproxyStatusBtn'),
  ticproxyApiOneKeyBtn: document.getElementById('ticproxyApiOneKeyBtn'),
  ticproxyApiOneKeyShortcutBtn: document.getElementById('ticproxyApiOneKeyShortcutBtn'),
  ticproxyDesktopRefreshBtn: document.getElementById('ticproxyDesktopRefreshBtn'),
  ticproxyApiOneKeyStatus: document.getElementById('ticproxyApiOneKeyStatus'),
  ticproxyConnectionAccountSelect: document.getElementById('ticproxyConnectionAccountSelect'),
  ticproxyConnectionModelInput: document.getElementById('ticproxyConnectionModelInput'),
  ticproxyConnectionPromptInput: document.getElementById('ticproxyConnectionPromptInput'),
  ticproxyConnectionTestBtn: document.getElementById('ticproxyConnectionTestBtn'),
  ticproxyConnectionResult: document.getElementById('ticproxyConnectionResult'),
  modelList: document.getElementById('modelList'),
  chatThreads: document.getElementById('chatThreads'),
  chatMessages: document.getElementById('chatMessages'),
  chatThreadTitle: document.getElementById('chatThreadTitle'),
  chatThreadMeta: document.getElementById('chatThreadMeta'),
  threadDrawerTopBtn: document.getElementById('threadDrawerTopBtn'),
  threadDrawerBtn: document.getElementById('threadDrawerBtn'),
  threadDrawerCloseBtn: document.getElementById('threadDrawerCloseBtn'),
  threadDrawerBackdrop: document.getElementById('threadDrawerBackdrop'),
  threadRefreshBtn: document.getElementById('threadRefreshBtn'),
  desktopRefreshBtn: document.getElementById('desktopRefreshBtn'),
  threadReadBtn: document.getElementById('threadReadBtn'),
  codexThreadMessageInput: document.getElementById('codexThreadMessageInput'),
  codexThreadFiles: document.getElementById('codexThreadFiles'),
  codexThreadFileInput: document.getElementById('codexThreadFileInput'),
  codexThreadAttachBtn: document.getElementById('codexThreadAttachBtn'),
  codexThreadSendBtn: document.getElementById('codexThreadSendBtn'),
  ticproxyManagementMeta: document.getElementById('ticproxyManagementMeta'),
  ticproxyBasicForm: document.getElementById('ticproxyBasicForm'),
  ticproxyProxyUrlInput: document.getElementById('ticproxyProxyUrlInput'),
  ticproxyRoutingSelect: document.getElementById('ticproxyRoutingSelect'),
  ticproxyRequestRetryInput: document.getElementById('ticproxyRequestRetryInput'),
  ticproxyMaxRetryInput: document.getElementById('ticproxyMaxRetryInput'),
  ticproxyLogsMaxInput: document.getElementById('ticproxyLogsMaxInput'),
  ticproxySaveBasicBtn: document.getElementById('ticproxySaveBasicBtn'),
  ticproxyApiKeyMeta: document.getElementById('ticproxyApiKeyMeta'),
  ticproxyApiKeyInput: document.getElementById('ticproxyApiKeyInput'),
  ticproxyAddApiKeyBtn: document.getElementById('ticproxyAddApiKeyBtn'),
  ticproxyApiKeys: document.getElementById('ticproxyApiKeys'),
  ticproxyYamlEditor: document.getElementById('ticproxyYamlEditor'),
  ticproxySaveYamlBtn: document.getElementById('ticproxySaveYamlBtn'),
  ticproxyProviderStrip: document.getElementById('ticproxyProviderStrip'),
  ticproxyProviderEditor: document.getElementById('ticproxyProviderEditor'),
  ticproxyProviderEntries: document.getElementById('ticproxyProviderEntries'),
  ticproxySaveProviderBtn: document.getElementById('ticproxySaveProviderBtn'),
  ticproxyAuthNameInput: document.getElementById('ticproxyAuthNameInput'),
  ticproxyAuthSearchInput: document.getElementById('ticproxyAuthSearchInput'),
  ticproxyAuthTextInput: document.getElementById('ticproxyAuthTextInput'),
  ticproxyUploadAuthBtn: document.getElementById('ticproxyUploadAuthBtn'),
  ticproxyDeleteAllAuthBtn: document.getElementById('ticproxyDeleteAllAuthBtn'),
  ticproxyAuthFiles: document.getElementById('ticproxyAuthFiles'),
  ticproxyAuthPreview: document.getElementById('ticproxyAuthPreview'),
  ticproxyAuthPreviewTitle: document.getElementById('ticproxyAuthPreviewTitle'),
  ticproxyOauthProviderSelect: document.getElementById('ticproxyOauthProviderSelect'),
  ticproxyOauthProjectInput: document.getElementById('ticproxyOauthProjectInput'),
  ticproxyOauthStartBtn: document.getElementById('ticproxyOauthStartBtn'),
  ticproxyOauthPollBtn: document.getElementById('ticproxyOauthPollBtn'),
  ticproxyOauthLink: document.getElementById('ticproxyOauthLink'),
  ticproxyOauthShortUrl: document.getElementById('ticproxyOauthShortUrl'),
  ticproxyOauthCopyShortBtn: document.getElementById('ticproxyOauthCopyShortBtn'),
  ticproxyOauthUrlInput: document.getElementById('ticproxyOauthUrlInput'),
  ticproxyOauthCopyBtn: document.getElementById('ticproxyOauthCopyBtn'),
  ticproxyOauthStateInput: document.getElementById('ticproxyOauthStateInput'),
  ticproxyOauthCopyStateBtn: document.getElementById('ticproxyOauthCopyStateBtn'),
  ticproxyOauthCallbackBase: document.getElementById('ticproxyOauthCallbackBase'),
  ticproxyOauthCallbackInput: document.getElementById('ticproxyOauthCallbackInput'),
  ticproxyOauthCopyCallbackBtn: document.getElementById('ticproxyOauthCopyCallbackBtn'),
  ticproxyOauthCallbackBtn: document.getElementById('ticproxyOauthCallbackBtn'),
  ticproxyOauthAutoCallbackInput: document.getElementById('ticproxyOauthAutoCallbackInput'),
  ticproxyOauthStatus: document.getElementById('ticproxyOauthStatus'),
  ticproxyOauthResult: document.getElementById('ticproxyOauthResult'),
  ticproxyOauthExcludedEditor: document.getElementById('ticproxyOauthExcludedEditor'),
  ticproxyOauthAliasEditor: document.getElementById('ticproxyOauthAliasEditor'),
  ticproxySaveOauthModelsBtn: document.getElementById('ticproxySaveOauthModelsBtn'),
  ticproxyUsageCountInput: document.getElementById('ticproxyUsageCountInput'),
  ticproxyUsageQueueBtn: document.getElementById('ticproxyUsageQueueBtn'),
  ticproxyUsageQueue: document.getElementById('ticproxyUsageQueue'),
  ticproxyApiKeyUsage: document.getElementById('ticproxyApiKeyUsage'),
  ticproxyQuotaCards: document.getElementById('ticproxyQuotaCards'),
  ticproxyQuotaCheckAllBtn: document.getElementById('ticproxyQuotaCheckAllBtn'),
  ticproxyLoadLogsBtn: document.getElementById('ticproxyLoadLogsBtn'),
  ticproxyClearLogsBtn: document.getElementById('ticproxyClearLogsBtn'),
  ticproxyLogSearchInput: document.getElementById('ticproxyLogSearchInput'),
  ticproxyLogs: document.getElementById('ticproxyLogs'),
  ticproxyErrorLogs: document.getElementById('ticproxyErrorLogs'),
  ticproxyInfoMeta: document.getElementById('ticproxyInfoMeta'),
  ticproxyInfo: document.getElementById('ticproxyInfo'),
  residentMessageInput: document.getElementById('residentMessageInput'),
  residentChatBtn: document.getElementById('residentChatBtn'),
  residentStatusBtn: document.getElementById('residentStatusBtn'),
  residentWakeBtn: document.getElementById('residentWakeBtn'),
  residentDetails: document.getElementById('residentDetails'),
  fileRootSelect: document.getElementById('fileRootSelect'),
  filePathInput: document.getElementById('filePathInput'),
  fileListBtn: document.getElementById('fileListBtn'),
  fileSearchInput: document.getElementById('fileSearchInput'),
  fileSearchBtn: document.getElementById('fileSearchBtn'),
  fileEntries: document.getElementById('fileEntries'),
  filePreview: document.getElementById('filePreview'),
  filePreviewTitle: document.getElementById('filePreviewTitle'),
  taskSnapshotBtn: document.getElementById('taskSnapshotBtn'),
  codexExecInput: document.getElementById('codexExecInput'),
  codexExecBtn: document.getElementById('codexExecBtn'),
  serviceStatus: document.getElementById('serviceStatus'),
  processes: document.getElementById('processes'),
  workbenchLinks: document.querySelectorAll('[data-workbench-link]'),
};

const searchParams = new URLSearchParams(location.search);
let token = searchParams.get('token') || localStorage.getItem(TOKEN_KEY) || '';
let state = {
  dashboard: null,
  files: null,
  tasks: null,
  ticproxy: null,
  codexChat: null,
  selectedThreadId: '',
  selectedProvider: 'codex',
  ticproxyTab: 'oauth',
  lastQuotaResults: {},
  lastConnectionTest: null,
  lastUsageQueue: [],
  oauthAutoSubmitted: {},
  oauthPollingState: '',
  oauthPollTimer: null,
  oauthFinishedStates: {},
  selectedFiles: [],
  chatStickToBottom: false,
};

if (token) {
  els.tokenInput.value = token;
  localStorage.setItem(TOKEN_KEY, token);
}
document.body.classList.toggle('has-token', Boolean(token));

function syncViewportHeight() {
  const viewport = window.visualViewport;
  const height = Math.round(viewport?.height || window.innerHeight || 0);
  if (height > 0) document.documentElement.style.setProperty('--mobile-vh', `${height}px`);
  const keyboardOffset = viewport
    ? Math.max(0, Math.round((window.innerHeight || height) - viewport.height - viewport.offsetTop))
    : 0;
  document.documentElement.style.setProperty('--mobile-keyboard-offset', `${keyboardOffset}px`);
}

syncViewportHeight();
window.addEventListener('resize', syncViewportHeight, { passive: true });
window.visualViewport?.addEventListener('resize', syncViewportHeight, { passive: true });
window.visualViewport?.addEventListener('scroll', syncViewportHeight, { passive: true });

function syncWorkbenchLinks() {
  const suffix = token ? `?token=${encodeURIComponent(token)}` : '';
  els.workbenchLinks.forEach((link) => {
    link.href = `/workbench.html${suffix}`;
  });
}

syncWorkbenchLinks();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function timeAgo(value) {
  if (!value) return '-';
  const ms = Date.now() - Date.parse(value);
  if (!Number.isFinite(ms)) return String(value);
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

function bytes(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function prettyJson(value) {
  return JSON.stringify(value ?? {}, null, 2);
}

function safeJsonParse(value, fallback) {
  try {
    const text = String(value || '').trim();
    return text ? JSON.parse(text) : fallback;
  } catch (error) {
    throw new Error(`JSON không hợp lệ: ${error.message}`);
  }
}

function parseCommandPayloadPreview(command) {
  try {
    const text = String(command?.payloadPreview || '').trim();
    if (!text || text === '[secret payload redacted]') return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function commandSendStatusLabel(command) {
  if (!command) return '';
  if (command.status === 'pending' && command.deferUntil) return 'chờ thread rảnh';
  if (command.status === 'pending') return 'đang chờ gửi';
  if (command.status === 'running') return 'đang gửi';
  if (command.status === 'sent' || command.status === 'completed') return 'đã giao Codex';
  if (command.status === 'failed') return 'lỗi gửi';
  return command.status || '';
}

function normalizeChatText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function transcriptHasUserMessage(transcriptTexts, text) {
  const normalized = normalizeChatText(text);
  if (!normalized) return false;
  return transcriptTexts.some((item) => {
    const existing = normalizeChatText(item);
    return existing === normalized || existing.startsWith(`${normalized}\n\n[Codex Mobile attachments]`);
  });
}

function timestampMs(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : 0;
}

function chatMessageTimestamp(message) {
  return message?.timestamp || message?.at || message?.createdAt || message?.updatedAt || '';
}

function chatMessageTimestampMs(message) {
  return timestampMs(chatMessageTimestamp(message));
}

function normalizeChatMessage(message, order = 0) {
  return {
    ...message,
    timestamp: chatMessageTimestamp(message),
    _order: order,
  };
}

function compareChatMessages(left, right) {
  const leftMs = chatMessageTimestampMs(left);
  const rightMs = chatMessageTimestampMs(right);
  if (leftMs && rightMs && leftMs !== rightMs) return leftMs - rightMs;
  if (leftMs && !rightMs) return -1;
  if (!leftMs && rightMs) return 1;
  return Number(left?._order || 0) - Number(right?._order || 0);
}

function commandCreatedMs(command) {
  return timestampMs(command?.createdAt) || timestampMs(command?.updatedAt);
}

async function copyText(value, label = 'Copied') {
  const text = String(value || '').trim();
  if (!text) {
    toast('Nothing to copy', 'warn');
    return false;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    toast(label, 'ok');
    return true;
  } catch (error) {
    toast(`Copy failed: ${error.message || error}`, 'bad');
    return false;
  }
}

function hasOAuthCallbackResult(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    if (!text.includes('=')) return false;
    try {
      parsed = new URL(`http://localhost/oauth-callback?${text.replace(/^\?/, '')}`);
    } catch {
      return false;
    }
  }
  const params = new URLSearchParams(parsed.search);
  const hashValue = parsed.hash.replace(/^#\??/, '');
  if (hashValue && hashValue.includes('=')) {
    const hashParams = new URLSearchParams(hashValue);
    for (const [key, item] of hashParams.entries()) {
      if (!params.has(key)) params.set(key, item);
    }
  }
  return Boolean(params.get('state') && (params.get('code') || params.get('oauth_token') || params.get('error')));
}

function findOAuthCallbackUrl(value, depth = 0) {
  if (!value || depth > 5) return '';
  if (typeof value === 'string') {
    const text = value.trim();
    if (hasOAuthCallbackResult(text)) return text;
    return '';
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findOAuthCallbackUrl(item, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof value === 'object') {
    for (const key of ['redirect_url', 'redirectUrl', 'callback_url', 'callbackUrl', 'callback', 'url']) {
      const found = findOAuthCallbackUrl(value[key], depth + 1);
      if (found) return found;
    }
    for (const item of Object.values(value)) {
      const found = findOAuthCallbackUrl(item, depth + 1);
      if (found) return found;
    }
  }
  return '';
}

function updateOAuthStatus(text, tone = '') {
  els.ticproxyOauthStatus.textContent = text;
  els.ticproxyOauthStatus.className = `tm-oauth-status ${tone}`.trim();
}

function defaultOAuthCallbackUrl(providerId) {
  const provider = String(providerId || '').toLowerCase();
  if (provider.includes('gemini')) return 'http://localhost:8085/oauth2callback';
  if (provider.includes('antigravity')) return 'http://localhost:51121/oauth-callback';
  return 'http://localhost:1455/auth/callback';
}

function oauthAccountLabel(result = {}) {
  return result.account?.profile?.email
    || result.account?.label
    || result.flow?.accountLabel
    || result.flow?.accountId
    || '';
}

function setOAuthCallbackBase(value) {
  const callbackUrl = String(value || '').trim();
  els.ticproxyOauthCallbackBase.textContent = callbackUrl || 'Tự động theo provider';
  els.ticproxyOauthCallbackBase.title = callbackUrl;
}

function clearOAuthPolling() {
  if (state.oauthPollTimer) clearInterval(state.oauthPollTimer);
  state.oauthPollTimer = null;
  state.oauthPollingState = '';
}

async function pollOAuthStatusOnce(oauthState, options = {}) {
  const flowState = String(oauthState || '').trim();
  if (!flowState) return null;
  const result = await api(`${API}/oauth/status?state=${encodeURIComponent(flowState)}`);
  const flow = result.flow || {};
  if (flow.status === 'completed') {
    state.oauthFinishedStates[flowState] = flow;
    clearOAuthPolling();
    updateOAuthStatus(`Đã xác nhận đăng nhập${flow.accountLabel ? `: ${flow.accountLabel}` : ''}.`, 'ok');
    await refresh();
  } else if (flow.status === 'failed') {
    state.oauthFinishedStates[flowState] = flow;
    clearOAuthPolling();
    updateOAuthStatus(flow.error || 'OAuth thất bại. Tạo link mới rồi thử lại.', 'bad');
  } else if (!options.silent) {
    updateOAuthStatus('Đang chờ provider redirect về Windows bridge...', 'warn');
  }
  return flow;
}

function scheduleOAuthPolling(oauthState) {
  const flowState = String(oauthState || '').trim();
  if (!flowState) return;
  if (state.oauthFinishedStates[flowState]) return;
  if (state.oauthPollingState === flowState && state.oauthPollTimer) return;
  clearOAuthPolling();
  state.oauthPollingState = flowState;
  let attempts = 0;
  state.oauthPollTimer = setInterval(async () => {
    attempts += 1;
    try {
      await pollOAuthStatusOnce(flowState, { silent: true });
    } catch (error) {
      if (attempts % 5 === 0) updateOAuthStatus(error.message || String(error), 'warn');
    }
    if (attempts >= 120) {
      clearOAuthPolling();
      updateOAuthStatus('Hết thời gian chờ tự động. Nếu browser đang ở localhost, dán URL callback thủ công.', 'warn');
    }
  }, 2500);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN', { timeZone: 'Asia/Saigon' });
}

function shortText(value, max = 58) {
  const text = String(value || '').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function short(value, max = 120) {
  return shortText(value, max);
}

function fileIcon(name = '', type = '') {
  const ext = String(name).split('.').pop().toLowerCase();
  if (/^image\//.test(type) || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'IMG';
  if (ext === 'pdf') return 'PDF';
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) return 'JS';
  if (['ts', 'tsx'].includes(ext)) return 'TS';
  if (['css', 'scss'].includes(ext)) return 'CSS';
  if (['html', 'htm'].includes(ext)) return 'HTML';
  if (ext === 'json') return 'JSON';
  if (['md', 'markdown'].includes(ext)) return 'MD';
  if (['doc', 'docx'].includes(ext)) return 'DOC';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'XLS';
  if (['zip', 'rar', '7z'].includes(ext)) return 'ZIP';
  return 'FILE';
}

function basenameFromPath(filePath = '') {
  return String(filePath || '').split(/[\\/]/).filter(Boolean).pop() || String(filePath || '');
}

function parseLocalPathTarget(target, label = '') {
  let value = String(target || '').trim().replace(/^<|>$/g, '');
  if (!/^[A-Za-z]:[\\/]/.test(value)) return null;
  let line = '';
  const lineMatch = value.match(/^(.*):(\d+)$/);
  if (lineMatch && /[\\/]/.test(lineMatch[1])) {
    value = lineMatch[1];
    line = lineMatch[2];
  }
  const name = String(label || '').trim() || basenameFromPath(value);
  return { kind: 'local_path', path: value, line, name, label: name, canRequest: true };
}

function uniqueAttachments(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items.filter(Boolean)) {
    const key = item.path
      ? `path:${String(item.path).toLowerCase()}:${item.line || ''}`
      : item.url
        ? `url:${item.url}`
        : `file:${item.name || item.label || ''}:${item.type || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function prepareMessageContent(text) {
  let source = String(text || '');
  const extracted = [];
  source = source.replace(/<oai-mem-citation>[\s\S]*?<\/oai-mem-citation>/gi, '').trim();
  source = source.replace(/^\s*[-*]\s+\[([^\]]{1,180})\]\(([^)\r\n]+)\)\s*$/gim, (raw, label, target) => {
    const fileRef = parseLocalPathTarget(target, label);
    if (!fileRef) return raw;
    extracted.push(fileRef);
    return '';
  });
  source = source.replace(/\[([^\]]{1,180})\]\(([^)\r\n]+)\)/g, (raw, label, target) => {
    const fileRef = parseLocalPathTarget(target, label);
    if (!fileRef) return raw;
    extracted.push(fileRef);
    return label;
  });
  source = source
    .replace(/^\s*[-*]\s+(apps\/[^\r\n]+)$/gim, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text: source, attachments: extracted };
}

function renderTextWithLinks(container, text) {
  const source = String(text || '');
  const tokenRegex = /(\[([^\]]{1,180})\]\(([^)\r\n]+)\)|https?:\/\/[^\s<>"'`]+)/g;
  let lastIndex = 0;
  let match;
  while ((match = tokenRegex.exec(source))) {
    if (match.index > lastIndex) {
      container.appendChild(document.createTextNode(source.slice(lastIndex, match.index)));
    }
    const raw = match[0];
    const markdownLabel = match[2] || '';
    const markdownTarget = match[3] || '';
    const localRef = markdownTarget ? parseLocalPathTarget(markdownTarget, markdownLabel) : null;
    if (localRef) {
      const pill = document.createElement('span');
      pill.className = 'tm-inline-file-ref';
      pill.textContent = shortText(localRef.name, 48);
      pill.title = localRef.line ? `${localRef.path}:${localRef.line}` : localRef.path;
      container.appendChild(pill);
    } else {
      const label = markdownTarget ? markdownLabel || markdownTarget : raw.replace(/^https?:\/\//i, '');
      const url = (markdownTarget || raw).replace(/[),.;!?]+$/g, '');
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      anchor.textContent = shortText(label, 72);
      container.appendChild(anchor);
    }
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < source.length) {
    container.appendChild(document.createTextNode(source.slice(lastIndex)));
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',').pop() : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Cannot read file.'));
    reader.readAsDataURL(file);
  });
}

function renderSelectedFiles() {
  els.codexThreadFiles.innerHTML = '';
  if (!state.selectedFiles.length) {
    els.codexThreadFiles.hidden = true;
    return;
  }
  els.codexThreadFiles.hidden = false;
  state.selectedFiles.forEach((file, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tm-file-chip';
    button.title = 'Bỏ file này';
    button.textContent = `${fileIcon(file.name, file.type)} ${short(file.name, 34)}${file.size ? ` · ${bytes(file.size)}` : ''}`;
    button.addEventListener('click', () => {
      state.selectedFiles = state.selectedFiles.filter((_, itemIndex) => itemIndex !== index);
      renderSelectedFiles();
    });
    els.codexThreadFiles.appendChild(button);
  });
}

async function uploadSelectedFiles(threadId) {
  if (!state.selectedFiles.length) return [];
  const attachments = [];
  for (const file of state.selectedFiles) {
    const result = await api(`${API}/uploads`, {
      method: 'POST',
      body: JSON.stringify({
        threadId,
        files: [{
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          dataBase64: await fileToBase64(file),
        }],
      }),
    });
    attachments.push(...(result.attachments || []));
  }
  return attachments;
}

function readOptionalNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.endsWith('%') ? trimmed.slice(0, -1) : trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatCompactNumber(value) {
  const numeric = readOptionalNumber(value);
  if (numeric === null) return '-';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(numeric);
}

function percentFromValue(value) {
  const numeric = readOptionalNumber(value);
  if (numeric === null) return null;
  const raw = typeof value === 'string' && value.trim().endsWith('%') ? numeric : numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, raw));
}

function remainingPercentFromUsed(value) {
  const used = percentFromValue(value);
  if (used === null) return null;
  return Math.max(0, Math.min(100, 100 - used));
}

function codexPercentFromValue(value) {
  const numeric = readOptionalNumber(value);
  if (numeric === null) return null;
  return Math.max(0, Math.min(100, numeric));
}

function codexRemainingPercentFromUsed(value) {
  const used = codexPercentFromValue(value);
  if (used === null) return null;
  return Math.max(0, Math.min(100, 100 - used));
}

function formatPercent(value) {
  const numeric = readOptionalNumber(value);
  if (numeric === null) return '-';
  return `${Math.round(numeric)}%`;
}

function formatResetLabel(value) {
  if (!value) return '-';
  const numeric = readOptionalNumber(value);
  if (numeric !== null) {
    const input = numeric > 100000000000 ? numeric : numeric > 1000000000 ? numeric * 1000 : Date.now() + (numeric * 1000);
    return formatDate(input);
  }
  return formatDate(value);
}

function formatCodexReset(window) {
  const resetAt = readOptionalNumber(window?.reset_at ?? window?.resetAt);
  if (resetAt && resetAt > 0) return formatResetLabel(resetAt);
  const resetAfter = readOptionalNumber(window?.reset_after_seconds ?? window?.resetAfterSeconds);
  if (resetAfter && resetAfter > 0) return formatResetLabel(resetAfter);
  return '-';
}

function inferAuthProvider(item) {
  const haystack = [
    item?.type,
    item?.provider,
    item?.channel,
    item?.name,
    item?.filename,
    item?.id,
    item?.label,
    item?.account,
    item?.email,
  ].filter(Boolean).join(' ').toLowerCase();
  if (haystack.includes('codex') || haystack.includes('openai')) return 'codex';
  if (haystack.includes('claude') || haystack.includes('anthropic')) return 'anthropic';
  if (haystack.includes('gemini')) return 'gemini-cli';
  if (haystack.includes('antigravity')) return 'antigravity';
  if (haystack.includes('kimi')) return 'kimi';
  return 'unknown';
}

function quotaProvider(item) {
  const provider = inferAuthProvider(item);
  return provider === 'claude' ? 'anthropic' : provider;
}

function authFileName(item) {
  return String(item?.name || item?.filename || item?.file || item?.id || item?.account || item?.email || '');
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

function authEmail(item, result = null) {
  return [
    result?.email,
    result?.profile?.email,
    result?.displayName,
    result?.display_name,
    item?.email,
    item?.profile?.email,
    item?.label,
    item?.displayName,
    item?.display_name,
    item?.account,
    authFileName(item),
  ].map(emailFromText).find(Boolean) || '';
}

function isGenericAuthDisplay(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return true;
  if (text.includes('@')) return false;
  return [
    'account',
    'auth-file',
    'codex / chatgpt account',
    'codex / chatgpt',
    'codex account',
    'chatgpt account',
  ].includes(text);
}

function authDisplayName(item, result = null) {
  const email = authEmail(item, result);
  if (email) return email;
  const candidates = [
    result?.displayName,
    result?.display_name,
    item?.displayName,
    item?.display_name,
    item?.label,
    item?.account,
    authFileName(item),
  ].map((value) => String(value || '').trim()).filter(Boolean);
  return candidates.find((value) => !isGenericAuthDisplay(value)) || candidates[0] || '';
}

function authIndex(item) {
  return String(item?.auth_index ?? item?.authIndex ?? item?.auth_id ?? item?.authId ?? '').trim();
}

function authQuotaMeta(item, result = null, provider = '') {
  const email = authEmail(item, result);
  const fileName = authFileName(item);
  return [
    provider,
    email ? `email=${email}` : '',
    fileName && fileName !== authDisplayName(item, result) ? `file=${fileName}` : '',
    `authIndex=${authIndex(item) || '-'}`,
    result?.checkedAt ? formatDate(result.checkedAt) : 'not checked',
  ].filter(Boolean).join(' · ');
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function unwrapQuotaPayload(result) {
  const response = result?.response ?? result?.result ?? result;
  if (!response || typeof response !== 'object') return parseMaybeJson(response);
  const body = response.body ?? response.bodyText ?? response.text ?? response.data;
  if (body !== undefined) return parseMaybeJson(body);
  return response;
}

function makeQuotaRow({ id, label, percent = null, mode = 'remaining', reset = '-', amount = '', meta = '' }) {
  return { id: id || label, label: label || 'Quota', percent, mode, reset, amount, meta };
}

function pickCodexWindows(rateLimit, options = {}) {
  const allowOrderFallback = options.allowOrderFallback !== false;
  const primaryWindow = rateLimit?.primary_window ?? rateLimit?.primaryWindow ?? null;
  const secondaryWindow = rateLimit?.secondary_window ?? rateLimit?.secondaryWindow ?? null;
  const windows = [primaryWindow, secondaryWindow];
  let fiveHourWindow = null;
  let weeklyWindow = null;
  windows.forEach((window) => {
    const seconds = readOptionalNumber(window?.limit_window_seconds ?? window?.limitWindowSeconds);
    if (seconds === 18000 && !fiveHourWindow) fiveHourWindow = window;
    if (seconds === 604800 && !weeklyWindow) weeklyWindow = window;
  });
  if (allowOrderFallback) {
    if (!fiveHourWindow) fiveHourWindow = primaryWindow && primaryWindow !== weeklyWindow ? primaryWindow : null;
    if (!weeklyWindow) weeklyWindow = secondaryWindow && secondaryWindow !== fiveHourWindow ? secondaryWindow : null;
  }
  return { fiveHourWindow, weeklyWindow, primaryWindow, secondaryWindow };
}

function buildCodexQuotaRows(payload) {
  const rows = [];
  const addWindow = (id, label, window, rateLimit) => {
    if (!window || typeof window !== 'object') return;
    const reset = formatCodexReset(window);
    const isLimitReached = Boolean(rateLimit?.limit_reached ?? rateLimit?.limitReached) || rateLimit?.allowed === false;
    const usedPercent = codexPercentFromValue(window.used_percent ?? window.usedPercent);
    const remainingPercent = usedPercent === null ? (isLimitReached && reset !== '-' ? 0 : null) : codexRemainingPercentFromUsed(usedPercent);
    rows.push(makeQuotaRow({
      id,
      label,
      percent: remainingPercent,
      mode: 'remaining',
      reset,
      meta: [usedPercent !== null ? `used ${Math.round(usedPercent)}%` : '', isLimitReached ? 'limit reached' : ''].filter(Boolean).join(' · '),
    }));
  };
  const addStandardLimit = (prefix, rateLimit) => {
    if (!rateLimit || typeof rateLimit !== 'object') return;
    const { fiveHourWindow, weeklyWindow } = pickCodexWindows(rateLimit);
    addWindow(`${prefix}-five-hour`, prefix === 'Code' ? '5-hour limit' : 'Code review 5-hour limit', fiveHourWindow, rateLimit);
    addWindow(`${prefix}-weekly`, prefix === 'Code' ? 'Weekly limit' : 'Code review weekly limit', weeklyWindow, rateLimit);
  };
  addStandardLimit('Code', payload?.rate_limit ?? payload?.rateLimit);
  addStandardLimit('Review', payload?.code_review_rate_limit ?? payload?.codeReviewRateLimit);
  const additional = payload?.additional_rate_limits ?? payload?.additionalRateLimits;
  if (Array.isArray(additional)) {
    additional.forEach((item, index) => {
      const name = item?.limit_name || item?.limitName || item?.metered_feature || item?.meteredFeature || `Additional ${index + 1}`;
      const rateLimit = item?.rate_limit ?? item?.rateLimit;
      const { primaryWindow, secondaryWindow } = pickCodexWindows(rateLimit, { allowOrderFallback: false });
      const prefix = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `additional-${index + 1}`;
      addWindow(`${prefix}-five-hour`, `${name} 5-hour limit`, primaryWindow, rateLimit);
      addWindow(`${prefix}-weekly`, `${name} weekly limit`, secondaryWindow, rateLimit);
    });
  }
  return rows;
}

function buildClaudeQuotaRows(payload) {
  const labels = {
    five_hour: '5h',
    seven_day: '7d',
    seven_day_oauth_apps: 'OAuth apps',
    seven_day_opus: 'Opus',
    seven_day_sonnet: 'Sonnet',
    seven_day_cowork: 'Cowork',
  };
  const rows = Object.entries(labels).flatMap(([key, label]) => {
    const window = payload?.[key];
    if (!window) return [];
    return [makeQuotaRow({ id: key, label, percent: percentFromValue(window.utilization), mode: 'used', reset: formatResetLabel(window.resets_at) })];
  });
  const extra = payload?.extra_usage;
  if (extra?.is_enabled) {
    const used = readOptionalNumber(extra.used_credits);
    const limit = readOptionalNumber(extra.monthly_limit);
    rows.push(makeQuotaRow({
      id: 'extra_usage',
      label: 'Extra usage',
      percent: limit ? Math.max(0, Math.min(100, ((used || 0) / limit) * 100)) : percentFromValue(extra.utilization),
      mode: 'used',
      amount: used !== null && limit !== null ? `$${(used / 100).toFixed(2)} / $${(limit / 100).toFixed(2)}` : '',
    }));
  }
  return rows;
}

function buildGeminiQuotaRows(payload) {
  const buckets = Array.isArray(payload?.buckets) ? payload.buckets : [];
  return buckets.map((bucket, index) => makeQuotaRow({
    id: `${bucket.modelId ?? bucket.model_id ?? index}-${bucket.tokenType ?? bucket.token_type ?? index}`,
    label: bucket.modelId ?? bucket.model_id ?? `Bucket ${index + 1}`,
    percent: percentFromValue(bucket.remainingFraction ?? bucket.remaining_fraction),
    mode: 'remaining',
    reset: formatResetLabel(bucket.resetTime ?? bucket.reset_time),
    amount: bucket.remainingAmount ?? bucket.remaining_amount ? `${formatCompactNumber(bucket.remainingAmount ?? bucket.remaining_amount)} left` : '',
    meta: bucket.tokenType ?? bucket.token_type ? `token: ${bucket.tokenType ?? bucket.token_type}` : '',
  }));
}

function buildAntigravityQuotaRows(payload) {
  const models = payload?.models && typeof payload.models === 'object' ? payload.models : payload;
  if (!models || typeof models !== 'object' || Array.isArray(models)) return [];
  return Object.entries(models).flatMap(([modelId, entry]) => {
    const info = entry?.quotaInfo ?? entry?.quota_info;
    if (!info || typeof info !== 'object') return [];
    const percent = percentFromValue(info.remainingFraction ?? info.remaining_fraction ?? info.remaining);
    if (percent === null && !info.resetTime && !info.reset_time) return [];
    return [makeQuotaRow({
      id: modelId,
      label: entry?.displayName || modelId,
      percent,
      mode: 'remaining',
      reset: formatResetLabel(info.resetTime ?? info.reset_time),
      meta: modelId,
    })];
  });
}

function buildKimiQuotaRows(payload) {
  const rows = [];
  const append = (id, label, source) => {
    if (!source || typeof source !== 'object') return;
    const used = readOptionalNumber(source.used);
    const limit = readOptionalNumber(source.limit);
    const remaining = readOptionalNumber(source.remaining);
    rows.push(makeQuotaRow({
      id,
      label: label || source.title || source.name || id,
      percent: limit ? Math.max(0, Math.min(100, ((used || 0) / limit) * 100)) : percentFromValue(source.utilization),
      mode: 'used',
      reset: formatResetLabel(source.resetAt ?? source.reset_at ?? source.resetTime ?? source.reset_time ?? source.resetIn ?? source.reset_in ?? source.ttl),
      amount: [used !== null && limit !== null ? `${formatCompactNumber(used)} / ${formatCompactNumber(limit)}` : '', remaining !== null ? `${formatCompactNumber(remaining)} left` : ''].filter(Boolean).join(' · '),
    }));
  };
  append('usage', payload?.usage?.title || payload?.usage?.name || 'Usage', payload?.usage);
  (Array.isArray(payload?.limits) ? payload.limits : []).forEach((item, index) => append(`limit-${index}`, item.title || item.name || item.scope || `Limit ${index + 1}`, item.detail || item));
  return rows;
}

function buildGenericQuotaRows(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const rows = [];
  const scan = (value, path = []) => {
    if (!value || typeof value !== 'object' || rows.length >= 12) return;
    if (Array.isArray(value)) {
      value.slice(0, 20).forEach((item, index) => scan(item, [...path, index + 1]));
      return;
    }
    const label = value.label || value.name || value.model || value.modelId || value.model_id || path.join(' / ') || 'Quota';
    const rawPercent = value.used_percent ?? value.usedPercent ?? value.utilization ?? value.remainingFraction ?? value.remaining_fraction ?? value.remaining;
    const percent = percentFromValue(rawPercent);
    if (percent !== null) {
      rows.push(makeQuotaRow({
        id: path.join('-') || String(rows.length),
        label: String(label),
        percent,
        mode: rawPercent === value.remaining || rawPercent === value.remainingFraction || rawPercent === value.remaining_fraction ? 'remaining' : 'used',
        reset: formatResetLabel(value.resetTime ?? value.reset_time ?? value.resets_at ?? value.resetAt ?? value.reset_at),
      }));
    }
    Object.entries(value).forEach(([key, child]) => {
      if (child && typeof child === 'object') scan(child, [...path, key]);
    });
  };
  scan(payload);
  return rows;
}

function buildQuotaRows(provider, result) {
  if (!result || result.status === 'loading' || result.ok === false) return [];
  const payload = unwrapQuotaPayload(result);
  if (!payload || typeof payload !== 'object') return [];
  const builders = {
    codex: buildCodexQuotaRows,
    anthropic: buildClaudeQuotaRows,
    'gemini-cli': buildGeminiQuotaRows,
    antigravity: buildAntigravityQuotaRows,
    kimi: buildKimiQuotaRows,
  };
  const rows = (builders[provider] || buildGenericQuotaRows)(payload);
  return rows.length ? rows : buildGenericQuotaRows(payload);
}

function quotaLevel(percent, mode) {
  if (percent === null || percent === undefined) return 'is-neutral';
  if (mode === 'used') {
    if (percent >= 90) return 'is-danger';
    if (percent >= 70) return 'is-warn';
    return 'is-ok';
  }
  if (percent <= 10) return 'is-danger';
  if (percent <= 30) return 'is-warn';
  return 'is-ok';
}

function quotaRowsHtml(rows) {
  if (!rows.length) return '<p class="tm-quota-empty">Chưa có dữ liệu quota trực quan cho payload này.</p>';
  return `<div class="tm-quota-rows">${rows.map((row) => {
    const level = quotaLevel(row.percent, row.mode);
    const width = row.percent === null || row.percent === undefined ? 0 : Math.max(0, Math.min(100, row.percent));
    return `
      <div class="tm-quota-row">
        <div class="tm-quota-row-head"><strong>${escapeHtml(row.label)}</strong><span class="${level}">${escapeHtml(formatPercent(row.percent))}</span></div>
        <div class="tm-quota-bar"><span class="${level}" style="width:${Math.round(width)}%"></span></div>
        <div class="tm-quota-meta">
          <span>${row.mode === 'used' ? 'Đã dùng' : 'Còn lại'}</span>
          ${row.amount ? `<span>${escapeHtml(row.amount)}</span>` : ''}
          ${row.reset && row.reset !== '-' ? `<span>Reset ${escapeHtml(row.reset)}</span>` : ''}
          ${row.meta ? `<span>${escapeHtml(row.meta)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('')}</div>`;
}

function headers() {
  return token ? { 'x-control-token': token } : {};
}

function toast(message, tone = 'ok') {
  els.toast.hidden = false;
  els.toast.className = `tm-toast ${tone}`;
  els.toast.textContent = message;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2200);
}

async function api(path, options = {}) {
  if (!token) throw new Error('Missing access token.');
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...headers(),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload = text;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { payload: { ok: false, error: text } };
  }
  if (!response.ok || payload?.payload?.ok === false) {
    throw new Error(payload?.payload?.error || payload?.error || `HTTP ${response.status}`);
  }
  return payload.payload || payload;
}

function itemHtml(title, lines = [], tone = '') {
  return `
    <div class="tm-item ${tone}">
      <strong>${escapeHtml(title)}</strong>
      ${lines.filter(Boolean).map((line) => `<small>${escapeHtml(line)}</small>`).join('')}
    </div>
  `;
}

function statusCard(label, value, meta, ok) {
  const tone = ok === true ? 'ok' : ok === false ? 'bad' : '';
  return `
    <span class="tm-status-label">${escapeHtml(label)}</span>
    <strong class="${tone}">${escapeHtml(value || '-')}</strong>
    <small>${escapeHtml(meta || '')}</small>
  `;
}

function commandTone(status) {
  if (status === 'completed' || status === 'sent') return 'ok';
  if (status === 'failed' || status === 'cancelled' || status === 'rejected') return 'bad';
  if (status === 'running' || status === 'pending' || status === 'queued') return 'warn';
  return '';
}

function scrollIntoViewOnMobile(selector) {
  if (!window.matchMedia('(max-width: 720px)').matches) return;
  window.requestAnimationFrame(() => {
    document.querySelector(selector)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
}

function setChatComposing(active) {
  const enabled = Boolean(active && window.matchMedia('(max-width: 720px)').matches);
  document.body.classList.toggle('is-chat-composing', enabled);
  syncViewportHeight();
}

function setThreadDrawer(open) {
  const enabled = Boolean(open && window.matchMedia('(max-width: 720px)').matches);
  document.body.classList.toggle('is-thread-drawer-open', enabled);
  if (els.threadDrawerBackdrop) els.threadDrawerBackdrop.hidden = !enabled;
}

function setActiveTab(tab, options = {}) {
  const shouldScroll = options.scroll !== false;
  document.body.dataset.activeTab = tab;
  if (tab !== 'chat') {
    setChatComposing(false);
    setThreadDrawer(false);
  }
  const agentTabs = new Set(['agent', 'queue', 'resident', 'files', 'tasks']);
  const railTab = agentTabs.has(tab) ? 'agent' : tab;
  document.querySelectorAll('.tm-rail-item').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tab === railTab);
  });
  document.querySelectorAll('.tm-tab').forEach((panel) => {
    panel.classList.toggle('is-active', panel.id === `tab-${tab}`);
  });
  const labels = {
    dashboard: 'Mobile Control',
    chat: 'Codex Chat',
    agent: 'Agent PC',
    queue: 'Agent PC / Command Queue',
    ticproxy: 'TicProxy',
    resident: 'Agent PC / IDE Agent',
    files: 'Agent PC / File Controls',
    tasks: 'Agent PC / Task Controls',
  };
  els.activeTitle.textContent = labels[tab] || 'Mobile Control';
  if (shouldScroll && tab === 'chat') scrollIntoViewOnMobile('#tab-chat');
  if (shouldScroll && agentTabs.has(tab)) scrollIntoViewOnMobile(`#tab-${tab}`);
}

function selectTicProxyTab(tab, options = {}) {
  state.ticproxyTab = tab || 'oauth';
  document.querySelectorAll('[data-ticproxy-tab]').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.ticproxyTab === state.ticproxyTab);
  });
  document.querySelectorAll('[data-ticproxy-panel]').forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.ticproxyPanel === state.ticproxyTab);
  });
  if (options.scroll !== false) scrollIntoViewOnMobile('[data-ticproxy-panel].is-active');
}

function renderStatus(dashboard) {
  const status = dashboard.status || {};
  const snapshot = dashboard.snapshot || {};
  const codex = snapshot.codex || {};
  const ticproxy = snapshot.ticproxy || {};
  const resident = snapshot.residentAgent || {};
  const tasks = snapshot.tasks || {};
  const agentOnline = status.agent?.status === 'online';
  els.livePill.textContent = agentOnline ? 'online' : 'offline';
  els.livePill.className = `tm-live-pill ${agentOnline ? 'ok' : 'bad'}`;
  els.subtitle.textContent = `snapshot ${timeAgo(snapshot.updatedAt || status.snapshotUpdatedAt)}`;
  els.agentCard.innerHTML = statusCard('PC Agent', status.agent?.host || status.agent?.id, `seen ${timeAgo(status.agent?.lastSeenAt)} · ${status.pendingCount || 0} pending`, agentOnline);
  els.codexCard.innerHTML = statusCard('Codex', codex.config?.modelProvider || status.codex?.provider, `${codex.config?.model || status.codex?.model || '-'} · ${codex.threads?.length || 0} threads`, Boolean(codex.config?.exists));
  els.ticproxyCard.innerHTML = statusCard('TicProxy', ticproxy.healthy ? 'healthy' : 'attention', `${ticproxy.modelCount || 0} models · ${ticproxy.keyPresent ? 'key present' : 'missing key'}`, Boolean(ticproxy.healthy));
  els.residentCard.innerHTML = statusCard('Resident', resident.online ? 'online' : 'offline', `${resident.source || '-'} · ${resident.processCount || 0} process`, Boolean(resident.online));
  renderSignals(status, snapshot, tasks);
}

function renderSignals(status, snapshot, tasks) {
  const codex = snapshot.codex || {};
  const ticproxy = snapshot.ticproxy || {};
  const resident = snapshot.residentAgent || {};
  const rows = [
    ['Codex home', codex.config?.codexHome || '-'],
    ['Relay queue', `${status.pendingCount || 0} pending · ${status.runningCount || 0} running`],
    ['TicProxy route', ticproxy.baseUrl || '-'],
    ['Resident API', resident.apiConfigured ? (resident.apiReachable ? 'reachable' : 'configured') : 'process only'],
    ['PC Agent PID', String(tasks.pid || '-')],
  ];
  els.signals.innerHTML = rows.map(([title, value]) => `
    <div class="tm-signal">
      <strong>${escapeHtml(title)}</strong>
      <small>${escapeHtml(value)}</small>
    </div>
  `).join('');
}

function renderThreads(threads = []) {
  els.threads.innerHTML = threads.slice(0, 16).map((thread) => itemHtml(
    thread.title || thread.id,
    [
      thread.id,
      `${thread.modelProvider || '-'} · ${thread.model || '-'} · ${timeAgo(thread.updatedAt)}`,
      thread.cwd || '',
    ],
  )).join('') || itemHtml('No threads', ['Snapshot has no Codex threads.']);
}

function queuedMessagesForThread(thread, messages = [], codexChat = {}) {
  if (!thread?.id) return [];
  const transcriptTexts = messages
    .filter((item) => item.role === 'user')
    .map((item) => normalizeChatText(item.text))
    .filter(Boolean);
  const transcriptNewestMs = messages.reduce((max, item) => Math.max(max, chatMessageTimestampMs(item)), 0);
  const commands = [
    ...(codexChat.recentCommands || []),
    ...(codexChat.runningCommands || []),
  ];
  const seen = new Set();
  const out = [];
  for (const command of commands) {
    if (!command || command.type !== 'codex.thread.send' || seen.has(command.id)) continue;
    seen.add(command.id);
    const payload = parseCommandPayloadPreview(command);
    if (payload.threadId && payload.threadId !== thread.id) continue;
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    const text = String(payload.message || '').trim() || (attachments.length ? 'Please inspect the attached file(s).' : '');
    if (!text && !attachments.length) continue;
    if (['sent', 'completed'].includes(command.status) && transcriptHasUserMessage(transcriptTexts, text)) continue;
    if (['sent', 'completed', 'failed'].includes(command.status) && transcriptNewestMs && commandCreatedMs(command) < transcriptNewestMs) continue;
    out.push({
      id: command.id,
      role: 'user',
      timestamp: command.createdAt,
      text,
      error: command.error || '',
      sendStatus: command.status === 'completed' ? 'sent' : command.status,
      sendStatusLabel: commandSendStatusLabel(command),
      attachments: attachments.map((item) => ({ ...item, kind: 'file' })),
    });
  }
  return out.sort(compareChatMessages);
}

function renderAttachments(container, item) {
  const attachments = uniqueAttachments([
    ...(item.attachments || []),
    ...(item.links || []),
  ]);
  if (!attachments.length) return;
  const list = document.createElement('div');
  list.className = 'attachment-list';
  for (const attachment of attachments) {
    if (attachment.kind === 'link' && attachment.url) {
      if (String(item.text || '').includes(attachment.url)) continue;
      const link = document.createElement('a');
      link.className = 'attachment-card link-card';
      link.href = attachment.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = shortText(attachment.label || attachment.url.replace(/^https?:\/\//i, ''), 80);
      list.appendChild(link);
      continue;
    }
    if (attachment.kind === 'image' && attachment.url) {
      const image = document.createElement('img');
      image.className = 'attachment-image';
      image.src = attachment.url;
      image.alt = attachment.name || 'image';
      list.appendChild(image);
      continue;
    }
    const card = document.createElement('div');
    card.className = 'attachment-card file-card';
    const badge = document.createElement('span');
    badge.className = 'file-badge';
    badge.textContent = fileIcon(attachment.name || attachment.path, attachment.type);
    const body = document.createElement('div');
    body.className = 'file-body';
    const name = document.createElement('strong');
    const displayName = attachment.label || attachment.name || attachment.path || 'attachment';
    name.textContent = shortText(attachment.line ? `${displayName}:${attachment.line}` : displayName, 82);
    const meta = document.createElement('span');
    meta.textContent = attachment.path
      ? shortText(attachment.path, 96)
      : [attachment.type, attachment.size ? bytes(attachment.size) : ''].filter(Boolean).join(' · ');
    body.append(name, meta);
    card.append(badge, body);
    list.appendChild(card);
  }
  if (list.childElementCount) container.appendChild(list);
}

function renderChatMessage(message) {
  const node = document.createElement('article');
  node.className = `tm-chat-message ${message.role === 'user' ? 'is-user' : 'is-assistant'} ${message.sendStatus ? `is-${message.sendStatus}` : ''}`;
  const head = document.createElement('div');
  head.className = 'tm-chat-message-head';
  const role = document.createElement('strong');
  role.textContent = `${message.role === 'user' ? 'Bạn' : 'Codex'}${message.sendStatus ? ` · ${message.sendStatusLabel || message.sendStatus}` : ''}`;
  const time = document.createElement('small');
  time.textContent = formatDate(chatMessageTimestamp(message));
  head.append(role, time);
  const prepared = prepareMessageContent(message.error ? `${message.text}\n\n${message.error}` : message.text);
  node.append(head);
  if (prepared.text) {
    const text = document.createElement('p');
    text.className = 'message-text';
    renderTextWithLinks(text, prepared.text);
    node.append(text);
  }
  renderAttachments(node, {
    ...message,
    text: prepared.text,
    attachments: uniqueAttachments([...(prepared.attachments || []), ...(message.attachments || [])]),
  });
  return node;
}

function renderChat(codexChat = {}, dashboard = state.dashboard) {
  const snapshot = dashboard?.snapshot?.codex || {};
  const threads = codexChat.threads || snapshot.threads || [];
  const messagesByThread = {
    ...(snapshot.messagesByThread || {}),
    ...(codexChat.messagesByThread || {}),
  };
  const last = codexChat.lastResult;
  if (last?.result?.thread?.id) {
    messagesByThread[last.result.thread.id] = last.result.messages || messagesByThread[last.result.thread.id] || [];
  }
  if (!state.selectedThreadId && threads[0]) state.selectedThreadId = threads[0].id;
  const selected = threads.find((thread) => thread.id === state.selectedThreadId) || threads[0] || null;
  if (selected && state.selectedThreadId !== selected.id) state.selectedThreadId = selected.id;
  const previousThreadId = els.chatMessages.dataset.threadId || '';
  const isThreadChanged = selected?.id && previousThreadId !== selected.id;
  const messageBottomGap = els.chatMessages.scrollHeight - els.chatMessages.scrollTop - els.chatMessages.clientHeight;
  const shouldStickToBottom = state.chatStickToBottom || isThreadChanged || messageBottomGap < 96;
  const threadListScrollTop = els.chatThreads.scrollTop;
  els.chatThreads.innerHTML = threads.slice(0, 24).map((thread) => `
    <button class="tm-thread-item ${thread.id === state.selectedThreadId ? 'is-active' : ''}" type="button" data-thread-id="${escapeHtml(thread.id)}">
      <strong>${escapeHtml(thread.title || thread.id)}</strong>
      <small>${escapeHtml(thread.modelProvider || '-')} · ${escapeHtml(thread.model || '-')} · ${timeAgo(thread.updatedAt)}</small>
      <small>${escapeHtml(thread.cwd || '')}</small>
    </button>
  `).join('') || itemHtml('No threads', ['Không thấy thread Codex trong snapshot.']);
  els.chatThreads.scrollTop = threadListScrollTop;
  els.chatThreadTitle.textContent = selected?.title || 'Thread Chat';
  els.chatThreadMeta.textContent = selected ? `${selected.id} · ${selected.modelProvider || '-'} · ${timeAgo(selected.updatedAt)}` : 'Chưa chọn thread';
  const baseMessages = selected
    ? (messagesByThread[selected.id] || []).map((message, index) => normalizeChatMessage(message, index))
    : [];
  const queuedMessages = selected
    ? queuedMessagesForThread(selected, baseMessages, codexChat)
      .map((message, index) => normalizeChatMessage(message, baseMessages.length + index))
    : [];
  const messages = selected ? [...baseMessages, ...queuedMessages].sort(compareChatMessages) : [];
  els.chatMessages.dataset.threadId = selected?.id || '';
  els.chatMessages.replaceChildren();
  if (messages.length) {
    for (const message of messages) els.chatMessages.appendChild(renderChatMessage(message));
  } else {
    els.chatMessages.innerHTML = itemHtml('No transcript', ['Bấm Read để tải lại transcript thread này.']);
  }
  if (shouldStickToBottom) els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  state.chatStickToBottom = false;
}

function renderCommands(commands = []) {
  els.commands.innerHTML = commands.map((command) => itemHtml(
    `${command.type} · ${command.status}`,
    [
      command.id,
      command.summary || command.error || command.payloadPreview || command.resultPreview || '',
      `created ${timeAgo(command.createdAt)} · updated ${timeAgo(command.updatedAt)}`,
    ],
    commandTone(command.status),
  )).join('') || itemHtml('No commands', ['Queue is empty.']);
}

function renderEvents(events = []) {
  els.events.innerHTML = events.slice(0, 12).map((event) => itemHtml(
    event.type,
    [timeAgo(event.at), JSON.stringify(event.payload || {})],
  )).join('') || itemHtml('No events', ['Relay has not recorded events yet.']);
}

function renderModels(ticproxy = {}) {
  const models = ticproxy.models || [];
  els.modelList.innerHTML = models.map((model) => `<span class="tm-chip">${escapeHtml(model)}</span>`).join('') || '<span class="tm-chip">No model snapshot</span>';
  if (ticproxy.models?.[0] && !els.modelInput.value.trim()) els.modelInput.value = ticproxy.models[0];
}

function ticproxyManagement() {
  return state.dashboard?.snapshot?.ticproxy?.management || state.ticproxy?.snapshot?.management || {};
}

function renderTicProxy(ticproxy = {}, ticproxyApi = state.ticproxy) {
  const management = ticproxy.management || ticproxyApi?.snapshot?.management || {};
  const configured = Boolean(management.configured);
  els.ticproxyManagementMeta.textContent = configured
    ? `${management.apiUrl || management.baseUrl} · ${management.authFiles?.length || 0} auth · ${management.apiKeys?.length || 0} keys`
    : `${management.apiUrl || management.baseUrl || '-'} · management key missing`;
  renderTicProxyBasic(management);
  renderTicProxyApiOneKey(ticproxyApi?.lastResult);
  renderTicProxyConnectionTest(management, ticproxyApi?.lastResult);
  renderTicProxyProviders(management);
  renderTicProxyAuth(management);
  renderTicProxyOauth(management, ticproxyApi?.lastResult);
  renderTicProxyQuota(management, ticproxyApi?.lastResult);
  renderTicProxyLogs(management, ticproxyApi?.lastResult);
  renderTicProxyInfo(management);
}

function renderTicProxyApiOneKey(lastResult) {
  if (!els.ticproxyApiOneKeyStatus) return;
  if (lastResult?.type !== 'ticproxy.apiOneKey.configure') {
    els.ticproxyApiOneKeyStatus.textContent = 'API ONE KEY sẽ tự cấu hình Codex Desktop dùng TicProxy. Sau khi hoàn tất, bấm Refresh Desktop để cấu hình có hiệu lực.';
    els.ticproxyApiOneKeyStatus.className = 'tm-oauth-status';
    return;
  }
  const result = lastResult.result || {};
  const failed = lastResult.status === 'failed' || Boolean(lastResult.error);
  const key = result.proxyKeyRedacted ? ` · key ${result.proxyKeyRedacted}` : '';
  const backup = result.backupPath ? ` · backup ${result.backupPath}` : '';
  els.ticproxyApiOneKeyStatus.textContent = failed
    ? `API ONE KEY lỗi: ${lastResult.error || result.summary || 'Không cấu hình được Codex Desktop.'}`
    : `Đã cấu hình TicProxy xong. Bấm Refresh Desktop để khởi động lại Codex và áp dụng cấu hình mới.${key}${backup}`;
  els.ticproxyApiOneKeyStatus.className = `tm-oauth-status ${failed ? 'bad' : 'ok'}`;
}

function ticproxyModelIds(management = {}) {
  const models = management.models || state.ticproxy?.snapshot?.management?.models || state.dashboard?.snapshot?.ticproxy?.models || [];
  return models.map((model) => (typeof model === 'string' ? model : model?.id)).filter(Boolean);
}

function renderTicProxyConnectionTest(management, lastResult) {
  if (!els.ticproxyConnectionResult) return;
  if (lastResult?.type === 'ticproxy.connection.test') {
    state.lastConnectionTest = lastResult.result || null;
  }

  const files = management.authFiles || [];
  const selected = els.ticproxyConnectionAccountSelect.value;
  const options = [
    '<option value="">Auto route</option>',
    ...files.map((item) => {
      const name = authFileName(item);
      const label = authDisplayName(item) || name || 'Account';
      const routeText = item.routeEligible === false ? 'not routable' : (item.disabled ? 'disabled' : 'enabled');
      const meta = [item.provider || item.providerId || 'provider', routeText].filter(Boolean).join(' · ');
      return `<option value="${escapeHtml(name)}">${escapeHtml(label)}${meta ? ` (${escapeHtml(meta)})` : ''}</option>`;
    }),
  ];
  els.ticproxyConnectionAccountSelect.innerHTML = options.join('');
  if (selected && files.some((item) => authFileName(item) === selected)) {
    els.ticproxyConnectionAccountSelect.value = selected;
  }

  if (!els.ticproxyConnectionModelInput.value.trim()) {
    els.ticproxyConnectionModelInput.value = ticproxyModelIds(management)[0] || 'gpt-5.5';
  }
  if (!els.ticproxyConnectionPromptInput.value.trim()) {
    els.ticproxyConnectionPromptInput.value = 'Reply exactly: TICPROXY_CONNECTION_OK';
  }

  const result = state.lastConnectionTest;
  if (!result) {
    els.ticproxyConnectionResult.innerHTML = itemHtml('Chưa test kết nối', ['Chọn account hoặc Auto route, nhập prompt ngắn rồi bấm Test.']);
    return;
  }
  const tone = result.ok ? 'ok' : 'bad';
  const title = result.ok
    ? `OK ${result.statusCode || 200} · ${result.accountLabel || result.provider || 'TicProxy'}`
    : `FAILED ${result.statusCode || '-'} · ${result.accountLabel || result.accountId || 'TicProxy'}`;
  const lines = [
    result.accountEmail && result.accountEmail !== result.accountLabel ? `Email: ${result.accountEmail}` : '',
    `Provider: ${result.provider || '-'} · Route: ${result.routeMode || '-'} · ${result.routing || '-'}`,
    `Model: ${result.requestedModel || '-'} → ${result.upstreamModel || '-'}`,
    `Latency: ${result.latencyMs ?? '-'} ms · ${formatDate(result.checkedAt)}`,
    result.outputText ? `Output: ${short(result.outputText, 420)}` : '',
    result.error ? `Error: ${short(result.error, 620)}` : '',
    result.upstreamUrl ? `Upstream: ${short(result.upstreamUrl, 140)}` : '',
  ].filter(Boolean);
  els.ticproxyConnectionResult.innerHTML = `
    ${itemHtml(title, lines, tone)}
    <details class="tm-raw-details">
      <summary>Raw test result</summary>
      <pre>${escapeHtml(short(prettyJson(result), 5000))}</pre>
    </details>
  `;
}

function renderTicProxyBasic(management) {
  const basic = management.basic || {};
  const toggles = [
    ['debug', 'Debug'],
    ['requestLog', 'Ghi log request'],
    ['loggingToFile', 'Ghi log ra file'],
    ['usageStatisticsEnabled', 'Thống kê sử dụng'],
    ['wsAuth', 'WebSocket auth'],
    ['switchProject', 'Quota switch project'],
    ['switchPreviewModel', 'Quota switch preview'],
    ['forceModelPrefix', 'Force model prefix'],
  ];
  els.ticproxyBasicForm.innerHTML = toggles.map(([key, label]) => `
    <label class="tm-toggle">
      <input type="checkbox" data-basic-key="${key}" ${basic[key] ? 'checked' : ''}>
      <span>${escapeHtml(label)}</span>
    </label>
  `).join('');
  els.ticproxyProxyUrlInput.value = basic.proxyUrl || '';
  els.ticproxyRoutingSelect.value = basic.routingStrategy || 'round-robin';
  els.ticproxyRequestRetryInput.value = basic.requestRetry ?? 3;
  els.ticproxyMaxRetryInput.value = basic.maxRetryInterval ?? 30;
  els.ticproxyLogsMaxInput.value = basic.logsMaxTotalSizeMb ?? 0;
  els.ticproxyApiKeyMeta.textContent = `${management.apiKeys?.length || 0} key`;
  els.ticproxyApiKeys.innerHTML = (management.apiKeys || []).map((key, index) => `
    <div class="tm-item-row tm-item">
      <div><strong>Key ${index + 1}</strong><small><code>${escapeHtml(key)}</code></small></div>
      <button type="button" data-api-key-index="${index}">Xóa</button>
    </div>
  `).join('') || itemHtml('Chưa có API key', ['Bấm Tạo key để cấp một key dùng cho Codex/Gemini/app khác.']);
  if (els.ticproxyYamlEditor !== document.activeElement) els.ticproxyYamlEditor.value = management.yaml || '';
  els.ticproxySaveYamlBtn.disabled = !management.allowYamlWrite;
}

function renderTicProxyProviders(management) {
  const endpoints = management.providerEndpoints || [];
  if (!endpoints.some((item) => item.id === state.selectedProvider)) state.selectedProvider = endpoints[0]?.id || 'codex';
  const providerItems = management.providerItems?.[state.selectedProvider] || [];
  els.ticproxyProviderStrip.innerHTML = endpoints.map((item) => {
    const count = management.providerItems?.[item.id]?.length || 0;
    return `<button type="button" class="${item.id === state.selectedProvider ? 'is-active' : ''}" data-provider-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.label)}</strong><small>${count} entries</small></button>`;
  }).join('');
  if (els.ticproxyProviderEditor !== document.activeElement) {
    els.ticproxyProviderEditor.value = prettyJson(providerItems);
  }
  els.ticproxyProviderEntries.innerHTML = providerItems.map((item, index) => `
    <div class="tm-item">
      <div class="tm-item-row">
        <div>
          <strong>${escapeHtml(item.name || item.prefix || item['base-url'] || item.baseUrl || `Entry ${index + 1}`)}</strong>
          <small>${escapeHtml(item['base-url'] || item.baseUrl || item['proxy-url'] || item.proxyUrl || '')}</small>
          <small>${Array.isArray(item.models) ? `${item.models.length} models` : '0 models'}</small>
        </div>
        <button type="button" data-provider-delete="${index}">Xóa</button>
      </div>
    </div>
  `).join('') || itemHtml('No provider entries', ['Dùng JSON editor để thêm cấu hình.']);
}

function renderTicProxyAuth(management) {
  const query = String(els.ticproxyAuthSearchInput.value || '').toLowerCase();
  const files = (management.authFiles || []).filter((item) => !query || JSON.stringify(item).toLowerCase().includes(query));
  els.ticproxyAuthFiles.innerHTML = files.map((item) => {
    const name = item.name || item.filename || item.file || item.id || item.account || item.email || '-';
    const provider = item.provider || item.type || item.channel || 'unknown';
    const disabled = Boolean(item.disabled);
    const displayName = item.displayName || item.email || item.account || item.label || name;
    return `
      <div class="tm-item">
        <div class="tm-item-row">
          <div>
            <strong>${escapeHtml(displayName)}</strong>
            <small>${escapeHtml(provider)} · ${disabled ? 'đang tắt' : 'đang bật'}</small>
            <small>${escapeHtml(name)}</small>
          </div>
        </div>
        <div class="tm-action-row inline">
          <button type="button" data-auth-view="${escapeHtml(name)}">Xem</button>
          <button type="button" data-auth-models="${escapeHtml(name)}">Models</button>
          <button type="button" data-auth-toggle="${escapeHtml(name)}" data-disabled="${disabled ? '0' : '1'}">${disabled ? 'Bật lại' : 'Tắt'}</button>
          <button type="button" data-auth-delete="${escapeHtml(name)}">Xóa</button>
        </div>
      </div>
    `;
  }).join('') || itemHtml('Chưa có tài khoản', ['Đăng nhập OAuth hoặc import auth JSON để thêm.']);
}

function renderTicProxyOauth(management, lastResult) {
  const providers = management.oauthProviders || [];
  const previousProvider = els.ticproxyOauthProviderSelect.value;
  els.ticproxyOauthProviderSelect.innerHTML = providers.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join('');
  if (previousProvider && providers.some((item) => item.id === previousProvider)) els.ticproxyOauthProviderSelect.value = previousProvider;
  const result = lastResult?.type?.startsWith('ticproxy.oauth.') ? lastResult.result : null;
  const selectedProvider = els.ticproxyOauthProviderSelect.value || providers[0]?.id || 'codex';
  const rememberedFlow = result?.state ? state.oauthFinishedStates[result.state] : null;
  if (lastResult?.type === 'ticproxy.oauth.start' && result?.url) {
    els.ticproxyOauthStateInput.value = result.state || els.ticproxyOauthStateInput.value;
    els.ticproxyOauthUrlInput.value = result.url;
    els.ticproxyOauthLink.href = result.url;
    els.ticproxyOauthLink.classList.add('is-ready');
    setOAuthCallbackBase(result.callbackUrl || defaultOAuthCallbackUrl(result.providerId || selectedProvider));
    if (!rememberedFlow) {
      scheduleOAuthPolling(result.state);
      updateOAuthStatus('Link đã sẵn sàng. Mở trên PC đang chạy Windows bridge; callback sẽ tự gửi về TicProxy.', 'ok');
    }
  }
  const oauthUrl = result?.url || els.ticproxyOauthUrlInput.value || '';
  els.ticproxyOauthShortUrl.textContent = oauthUrl ? shortText(oauthUrl.replace(/^https?:\/\//i, ''), 86) : 'Chưa tạo link';
  els.ticproxyOauthShortUrl.title = oauthUrl;
  const callbackBase = result?.callbackUrl || els.ticproxyOauthCallbackBase.title || defaultOAuthCallbackUrl(selectedProvider);
  setOAuthCallbackBase(callbackBase);
  let resultTitle = 'OAuth sẵn sàng';
  let resultLines = ['Bấm tạo link để bắt đầu đăng nhập.'];
  if (rememberedFlow?.status === 'completed') {
    resultTitle = 'Đăng nhập thành công';
    resultLines = [rememberedFlow.accountLabel || rememberedFlow.accountId || 'Account đã lưu', `Provider: ${rememberedFlow.providerId || selectedProvider}`];
    updateOAuthStatus(`Đã xác nhận đăng nhập${rememberedFlow.accountLabel ? `: ${rememberedFlow.accountLabel}` : ''}.`, 'ok');
  } else if (rememberedFlow?.status === 'failed') {
    resultTitle = 'Đăng nhập lỗi';
    resultLines = [rememberedFlow.error || 'Provider trả lỗi.'];
    updateOAuthStatus(rememberedFlow.error || 'OAuth thất bại.', 'bad');
  } else if (result) {
    const callbackUrl = findOAuthCallbackUrl(result);
    if (callbackUrl) {
      els.ticproxyOauthCallbackInput.value = callbackUrl;
      updateOAuthStatus(els.ticproxyOauthAutoCallbackInput.checked
        ? 'Đã nhận callback URL, đang gửi xác nhận...'
        : 'Đã nhận callback URL. Có thể bấm Submit nếu cần.',
      'ok');
    } else if (lastResult?.type === 'ticproxy.oauth.poll') {
      const flow = result.flow || {};
      if (flow.status === 'completed') {
        resultTitle = 'Đăng nhập thành công';
        resultLines = [flow.accountLabel || flow.accountId || 'Account đã lưu', `Provider: ${flow.providerId || selectedProvider}`];
        updateOAuthStatus(`Đã xác nhận đăng nhập${flow.accountLabel ? `: ${flow.accountLabel}` : ''}.`, 'ok');
        clearOAuthPolling();
      } else if (flow.status === 'failed') {
        resultTitle = 'Đăng nhập lỗi';
        resultLines = [flow.error || 'Provider trả lỗi.'];
        updateOAuthStatus(flow.error || 'OAuth thất bại.', 'bad');
        clearOAuthPolling();
      } else {
        resultTitle = 'Đang chờ callback';
        resultLines = ['Mở link trên PC chạy bridge. Nếu browser dừng ở localhost, dùng phần nhập callback thủ công.'];
        updateOAuthStatus('Đang chờ provider redirect về Windows bridge...', 'warn');
      }
    } else if (lastResult?.type === 'ticproxy.oauth.callback') {
      resultTitle = 'Đăng nhập thành công';
      resultLines = [oauthAccountLabel(result) || 'Account đã lưu', `Provider: ${result.providerId || selectedProvider}`];
      updateOAuthStatus(`Đã lưu account${oauthAccountLabel(result) ? `: ${oauthAccountLabel(result)}` : ''}.`, 'ok');
      clearOAuthPolling();
    } else if (lastResult?.type === 'ticproxy.oauth.start') {
      resultTitle = 'Link đăng nhập đã tạo';
      resultLines = [
        'Mở link trên PC đang chạy Windows bridge.',
        `Callback: ${result.callbackUrl || defaultOAuthCallbackUrl(selectedProvider)}`,
      ];
    }
  }
  els.ticproxyOauthResult.innerHTML = itemHtml(resultTitle, resultLines);
  if (els.ticproxyOauthExcludedEditor !== document.activeElement) {
    els.ticproxyOauthExcludedEditor.value = prettyJson(management.oauthExcludedModels || {});
  }
  if (els.ticproxyOauthAliasEditor !== document.activeElement) {
    els.ticproxyOauthAliasEditor.value = prettyJson(management.oauthModelAlias || {});
  }
}

function renderTicProxyQuota(management, lastResult) {
  if (lastResult?.type === 'ticproxy.quota.usageQueue') state.lastUsageQueue = lastResult.result?.rows || [];
  if (lastResult?.type === 'ticproxy.quota.probe' && lastResult.result?.name) {
    state.lastQuotaResults[lastResult.result.name] = lastResult.result;
  }
  if (lastResult?.type === 'ticproxy.quota.probeAll' && Array.isArray(lastResult.result?.results)) {
    for (const item of lastResult.result.results) {
      if (item?.name) state.lastQuotaResults[item.name] = item;
    }
  }
  els.ticproxyUsageQueue.innerHTML = (state.lastUsageQueue || []).map((row) => itemHtml(
    `${row.provider} · ${row.status}`,
    [`${row.model} · ${row.account}`, formatDate(row.time)],
  )).join('') || itemHtml('Chưa có usage queue', ['Bấm Tải để lấy dữ liệu mới.']);
  els.ticproxyApiKeyUsage.innerHTML = (management.apiKeyUsage || []).map((row) => itemHtml(
    row.key || row.id,
    [`requests ${row.requests ?? '-'} · tokens ${row.tokens ?? '-'}`, formatDate(row.lastUsed)],
  )).join('') || itemHtml('No API key usage', ['Bật usage statistics nếu cần.']);
  els.ticproxyQuotaCards.innerHTML = (management.authFiles || []).map((item) => {
    const name = authFileName(item);
    const provider = quotaProvider(item);
    const result = state.lastQuotaResults[name];
    const displayName = authDisplayName(item, result);
    const rows = buildQuotaRows(result?.provider || provider, result);
    return `
      <div class="tm-item">
        <div class="tm-item-row">
          <div>
            <strong>${escapeHtml(displayName || name || '-')}</strong>
            <small>${escapeHtml(authQuotaMeta(item, result, provider))}</small>
            ${result?.ok === false ? `<small class="bad">${escapeHtml(result.error || 'Quota check failed')}</small>` : ''}
          </div>
          <button type="button" data-quota-name="${escapeHtml(name)}">Check</button>
        </div>
        ${result ? quotaRowsHtml(rows) : '<p class="tm-quota-empty">Bấm Check để tải quota.</p>'}
        ${result ? `<details class="tm-raw-details"><summary>Raw response</summary><pre>${escapeHtml(short(prettyJson(result.response || result), 4000))}</pre></details>` : ''}
      </div>
    `;
  }).join('') || itemHtml('Chưa có tài khoản', ['Đăng nhập OAuth hoặc import auth JSON để check quota.']);
}

function renderTicProxyLogs(management, lastResult) {
  const query = String(els.ticproxyLogSearchInput.value || '').toLowerCase();
  const latest = lastResult?.type === 'ticproxy.logs.refresh' ? (lastResult.result?.lines || []) : null;
  const lines = latest || management.logs || [];
  els.ticproxyLogs.textContent = lines.filter((line) => {
    const text = String(line || '');
    if (/\/v0\/management|management\.html/i.test(text)) return false;
    return !query || text.toLowerCase().includes(query);
  }).join('\n') || 'Chưa có logs hoặc logging-to-file đang tắt.';
  els.ticproxyErrorLogs.innerHTML = (management.errorLogs || []).map((file) => `
    <div class="tm-item-row tm-item">
      <div><strong>${escapeHtml(file.name)}</strong><small>${bytes(file.size)} · ${formatDate(file.modified)}</small></div>
      <button type="button" data-error-log="${escapeHtml(file.name)}">Tải</button>
    </div>
  `).join('') || itemHtml('No request error logs', ['Không thấy error log.']);
}

function renderTicProxyInfo(management) {
  els.ticproxyInfoMeta.textContent = management.apiUrl || '/v0/management';
  const rows = [
    ['Management', management.configured ? 'configured' : 'missing key'],
    ['Base URL', management.baseUrl || '-'],
    ['Latest version', management.latestVersion || '-'],
    ['Secret export', management.allowSecretExport ? 'enabled' : 'redacted'],
    ['YAML write', management.allowYamlWrite ? 'enabled' : 'disabled'],
    ['Refreshed', formatDate(management.refreshedAt)],
  ];
  els.ticproxyInfo.innerHTML = rows.map(([title, value]) => `<div class="tm-signal"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(value)}</small></div>`).join('');
}

function renderResident(resident = {}) {
  const rows = [
    ['Online', resident.online ? 'yes' : 'no'],
    ['Source', resident.source || '-'],
    ['Processes', String(resident.processCount || 0)],
    ['API', resident.apiConfigured ? (resident.apiReachable ? 'reachable' : 'configured') : 'not configured'],
    ['Error', resident.error || '-'],
  ];
  els.residentDetails.innerHTML = rows.map(([title, value]) => itemHtml(title, [value])).join('');
}

function renderFileRoots(roots = []) {
  const previous = els.fileRootSelect.value;
  els.fileRootSelect.innerHTML = roots.map((root) => `<option value="${escapeHtml(root.id)}">${escapeHtml(root.label || root.path)}</option>`).join('');
  if (previous && roots.some((root) => root.id === previous)) els.fileRootSelect.value = previous;
}

function renderFileResult(files) {
  if (!files) return;
  renderFileRoots(files.roots || []);
  const last = files.lastResult;
  if (!last?.result) {
    els.fileEntries.innerHTML = itemHtml('No file result', ['Run list or search.']);
    return;
  }
  const result = last.result;
  if (Array.isArray(result.entries)) {
    els.filePathInput.value = result.path || els.filePathInput.value;
    els.fileEntries.innerHTML = result.entries.map(fileEntryHtml).join('') || itemHtml('Empty folder', [result.path || '']);
    return;
  }
  if (Array.isArray(result.results)) {
    els.fileEntries.innerHTML = result.results.map(fileEntryHtml).join('') || itemHtml('No matches', [result.query || '']);
    return;
  }
  if (result.text !== undefined) {
    els.filePreview.textContent = result.text || '';
    els.filePreviewTitle.textContent = `${result.name || result.path} ${result.truncated ? '(truncated)' : ''}`;
  }
}

function fileEntryHtml(entry) {
  const dirClass = entry.type === 'dir' ? ' is-dir' : '';
  return `
    <button class="tm-file-entry${dirClass}" type="button" data-path="${escapeHtml(entry.path)}" data-type="${escapeHtml(entry.type)}">
      <strong>${entry.type === 'dir' ? '[dir] ' : ''}${escapeHtml(entry.name)}</strong>
      <small>${escapeHtml(entry.relativePath || entry.path)} · ${entry.type === 'dir' ? 'folder' : bytes(entry.size)} · ${timeAgo(entry.updatedAt)}</small>
      ${entry.match ? `<small>${escapeHtml(entry.match)}</small>` : ''}
    </button>
  `;
}

function renderTasks(tasksPayload, lastTaskResult) {
  const snapshot = tasksPayload?.snapshot || tasksPayload || {};
  const service = snapshot.service || {};
  const appServerHost = service.appServerHost || {};
  const processes = snapshot.processes || [];
  els.serviceStatus.innerHTML = [
    ['Startup', service.startupInstalled ? 'installed' : 'missing'],
    ['Env file', service.envFilePresent ? 'present' : 'missing'],
    ['Log', service.logPresent ? `updated ${timeAgo(service.logUpdatedAt)}` : 'missing'],
    ['Scheduled task', service.scheduledTask?.State || 'not installed'],
    ['Codex host', appServerHost.disabled ? 'per-command' : `${appServerHost.running ? 'running' : 'idle'}${appServerHost.pid ? ` · pid ${appServerHost.pid}` : ''}`],
    ['Last task', lastTaskResult?.summary || lastTaskResult?.error || '-'],
  ].map(([title, value]) => itemHtml(title, [value])).join('');
  els.processes.innerHTML = processes.map((process) => `
    <div class="tm-process">
      <strong>${escapeHtml(process.role || process.name)} · ${escapeHtml(process.pid)}</strong>
      <small>${escapeHtml(process.command || process.name)}</small>
      <small>${escapeHtml(timeAgo(process.createdAt))}</small>
    </div>
  `).join('') || itemHtml('No tracked processes', ['Snapshot has no Codex/Ticmiro process rows.']);
}

async function refresh() {
  if (!token) return;
  const [dashboard, files, tasks, ticproxy, codexChat] = await Promise.all([
    api(`${API}/dashboard`),
    api(`${API}/files`),
    api(`${API}/tasks`),
    api(`${API}/ticproxy`),
    api(`${API}/codex-chat`),
  ]);
  state.dashboard = dashboard;
  state.files = files;
  state.tasks = tasks;
  state.ticproxy = ticproxy;
  state.codexChat = codexChat;
  const snapshot = dashboard.snapshot || {};
  renderStatus(dashboard);
  renderThreads(snapshot.codex?.threads || []);
  renderChat(codexChat, dashboard);
  renderCommands(dashboard.commands || []);
  renderEvents(dashboard.events || []);
  renderModels(snapshot.ticproxy || {});
  renderTicProxy(snapshot.ticproxy || {}, ticproxy);
  renderResident(snapshot.residentAgent || {});
  renderFileRoots(files.roots || snapshot.files?.roots || []);
  renderFileResult(files);
  renderTasks(tasks, tasks.lastResult);
}

async function createCommand(type, payload = {}) {
  const result = await api(`${API}/commands`, {
    method: 'POST',
    body: JSON.stringify({ type, payload }),
  });
  await refresh();
  return result.command;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCommand(commandId, group = '', maxPolls = 18) {
  for (let index = 0; index < maxPolls; index += 1) {
    const suffix = group ? `&group=${encodeURIComponent(group)}` : '';
    const result = await api(`${API}/commands?limit=80${suffix}`);
    const command = (result.commands || []).find((item) => item.id === commandId);
    if (command && !['pending', 'running', 'queued'].includes(command.status)) return command;
    await sleep(1500);
  }
  return null;
}

async function runQueued(type, payload, options = {}) {
  const command = await createCommand(type, payload);
  toast(`${type} queued`, 'ok');
  if (!options.wait) return command;
  const done = await waitForCommand(command.id, options.group || '', options.polls || 18);
  await refresh();
  if (!done) {
    toast(`${type} is still running`, 'warn');
    return command;
  }
  if (done.status === 'failed') throw new Error(done.error || `${type} failed`);
  toast(done.summary || `${type} completed`, 'ok');
  return done;
}

async function maybeAutoSubmitOAuthCallback(lastResult = state.ticproxy?.lastResult) {
  if (!els.ticproxyOauthAutoCallbackInput.checked || lastResult?.type !== 'ticproxy.oauth.poll') return;
  const callbackUrl = findOAuthCallbackUrl(lastResult.result);
  if (!callbackUrl) return;
  const provider = els.ticproxyOauthProviderSelect.value;
  const key = `${provider}:${callbackUrl}`;
  if (state.oauthAutoSubmitted[key]) return;
  state.oauthAutoSubmitted[key] = true;
  els.ticproxyOauthCallbackInput.value = callbackUrl;
  updateOAuthStatus('Poll trả về callback URL, đang auto submit callback...', 'ok');
  await runQueued('ticproxy.oauth.callback', { provider, state: els.ticproxyOauthStateInput.value.trim(), redirectUrl: callbackUrl }, { wait: true, group: 'ticproxy' });
}

function currentFilePayload() {
  return {
    root: els.fileRootSelect.value,
    path: els.filePathInput.value.trim(),
  };
}

function currentTicProxyBasicPayload() {
  const basic = {};
  els.ticproxyBasicForm.querySelectorAll('[data-basic-key]').forEach((input) => {
    basic[input.dataset.basicKey] = input.checked;
  });
  basic.proxyUrl = els.ticproxyProxyUrlInput.value.trim();
  basic.routingStrategy = els.ticproxyRoutingSelect.value;
  basic.requestRetry = Number(els.ticproxyRequestRetryInput.value || 3);
  basic.maxRetryInterval = Number(els.ticproxyMaxRetryInput.value || 30);
  basic.logsMaxTotalSizeMb = Number(els.ticproxyLogsMaxInput.value || 0);
  return basic;
}

function selectedAuthFileByName(name) {
  const files = ticproxyManagement().authFiles || [];
  return files.find((item) => (item.name || item.filename || item.file || item.id || item.account || item.email || '') === name) || null;
}

document.querySelectorAll('.tm-rail-item').forEach((button) => {
  button.addEventListener('click', () => setActiveTab(button.dataset.tab));
});

document.querySelectorAll('[data-ticproxy-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    selectTicProxyTab(button.dataset.ticproxyTab);
  });
});

document.querySelectorAll('[data-ticproxy-jump]').forEach((button) => {
  button.addEventListener('click', () => selectTicProxyTab(button.dataset.ticproxyJump));
});

document.querySelectorAll('[data-agent-open]').forEach((button) => {
  button.addEventListener('click', () => setActiveTab(button.dataset.agentOpen || 'agent'));
});

els.saveTokenBtn.addEventListener('click', () => {
  token = els.tokenInput.value.trim();
  if (token) localStorage.setItem(TOKEN_KEY, token);
  document.body.classList.toggle('has-token', Boolean(token));
  syncWorkbenchLinks();
  refresh().then(() => toast('Token saved')).catch((error) => toast(error.message, 'bad'));
});

els.refreshBtn.addEventListener('click', () => runQueued('snapshot.refresh', {}, { wait: true, polls: 10 }).catch((error) => toast(error.message, 'bad')));
els.snapshotBtn.addEventListener('click', () => runQueued('snapshot.refresh').catch((error) => toast(error.message, 'bad')));
els.ticproxyStatusBtn.addEventListener('click', () => runQueued('ticproxy.management.refresh', {}, { wait: true, group: 'ticproxy' }).catch((error) => toast(error.message, 'bad')));
async function runApiOneKeyConfigure() {
  if (els.ticproxyApiOneKeyStatus) {
    els.ticproxyApiOneKeyStatus.textContent = 'Đang gửi yêu cầu API ONE KEY tới Windows bridge...';
    els.ticproxyApiOneKeyStatus.className = 'tm-oauth-status warn';
  }
  try {
    await runQueued('ticproxy.apiOneKey.configure', {
      provider: 'ticproxy',
      model: els.modelInput.value.trim() || 'gpt-5.5',
      setDefault: true,
    }, { wait: true, group: 'ticproxy', polls: 90 });
    if (els.ticproxyApiOneKeyStatus) {
      els.ticproxyApiOneKeyStatus.textContent = 'Đã cấu hình TicProxy xong. Bấm Refresh Desktop để khởi động lại Codex và áp dụng cấu hình mới.';
      els.ticproxyApiOneKeyStatus.className = 'tm-oauth-status ok';
    }
    toast('Đã cấu hình TicProxy xong. Bấm Refresh Desktop để áp dụng.', 'ok');
  } catch (error) {
    if (els.ticproxyApiOneKeyStatus) {
      els.ticproxyApiOneKeyStatus.textContent = `API ONE KEY lỗi: ${error.message}`;
      els.ticproxyApiOneKeyStatus.className = 'tm-oauth-status bad';
    }
    toast(error.message, 'bad');
  }
}
function runDesktopRefresh(reason = 'manual-mobile-refresh') {
  return runQueued('codex.desktop.restart', {
    reason,
    threadId: state.selectedThreadId || '',
  }, { wait: true, group: 'codex-chat', polls: 30 });
}
els.ticproxyApiOneKeyBtn?.addEventListener('click', runApiOneKeyConfigure);
els.ticproxyApiOneKeyShortcutBtn?.addEventListener('click', runApiOneKeyConfigure);
els.ticproxyDesktopRefreshBtn?.addEventListener('click', () => runDesktopRefresh('ticproxy-refresh-desktop').catch((error) => toast(error.message, 'bad')));
els.ticproxyConnectionTestBtn?.addEventListener('click', () => {
  const accountName = els.ticproxyConnectionAccountSelect?.value || '';
  const model = els.ticproxyConnectionModelInput?.value?.trim() || 'gpt-5.5';
  const prompt = els.ticproxyConnectionPromptInput?.value?.trim() || 'Reply exactly: TICPROXY_CONNECTION_OK';
  els.ticproxyConnectionResult.innerHTML = itemHtml('Đang test kết nối...', [
    accountName ? `Account: ${accountName}` : 'Account: Auto route',
    `Model: ${model}`,
  ], 'warn');
  runQueued('ticproxy.connection.test', {
    name: accountName,
    model,
    prompt,
  }, { wait: true, group: 'ticproxy', polls: 90 }).catch((error) => toast(error.message, 'bad'));
});
els.switchProviderBtn.addEventListener('click', () => runQueued('codex.provider.switch', {
  provider: els.providerSelect.value,
  model: els.modelInput.value.trim() || 'gpt-5.5',
}, { wait: true, group: 'tasks' }).catch((error) => toast(error.message, 'bad')));

els.chatThreads.addEventListener('click', (event) => {
  const button = event.target.closest('[data-thread-id]');
  if (!button) return;
  state.selectedThreadId = button.dataset.threadId;
  state.selectedFiles = [];
  renderSelectedFiles();
  renderChat(state.codexChat, state.dashboard);
  setThreadDrawer(false);
  scrollIntoViewOnMobile('.chat-panel');
  runQueued('codex.thread.read', { threadId: state.selectedThreadId, limit: 160 }, { wait: true, group: 'codex-chat' }).catch((error) => toast(error.message, 'bad'));
});
els.threadDrawerBtn?.addEventListener('click', () => setThreadDrawer(true));
els.threadDrawerTopBtn?.addEventListener('click', () => setThreadDrawer(true));
els.threadDrawerCloseBtn?.addEventListener('click', () => setThreadDrawer(false));
els.threadDrawerBackdrop?.addEventListener('click', () => setThreadDrawer(false));
els.threadRefreshBtn.addEventListener('click', () => runQueued('snapshot.refresh', {}, { wait: true }).catch((error) => toast(error.message, 'bad')));
els.desktopRefreshBtn.addEventListener('click', () => runDesktopRefresh('manual-mobile-refresh').catch((error) => toast(error.message, 'bad')));
els.threadReadBtn.addEventListener('click', () => {
  if (!state.selectedThreadId) return;
  runQueued('codex.thread.read', { threadId: state.selectedThreadId, limit: 120 }, { wait: true, group: 'codex-chat' }).catch((error) => toast(error.message, 'bad'));
});
els.codexThreadAttachBtn.addEventListener('click', () => {
  els.codexThreadFileInput.click();
});
els.codexThreadFileInput.addEventListener('change', () => {
  state.selectedFiles = [...state.selectedFiles, ...Array.from(els.codexThreadFileInput.files || [])].slice(0, 8);
  els.codexThreadFileInput.value = '';
  renderSelectedFiles();
});
els.codexThreadMessageInput.addEventListener('focus', () => setChatComposing(true));
els.codexThreadMessageInput.addEventListener('pointerdown', () => setChatComposing(true));
els.codexThreadMessageInput.addEventListener('touchstart', () => setChatComposing(true), { passive: true });
els.codexThreadMessageInput.addEventListener('input', () => setChatComposing(true));
els.codexThreadMessageInput.addEventListener('blur', () => {
  window.setTimeout(() => {
    const active = document.activeElement;
    if (active === els.codexThreadAttachBtn || active === els.codexThreadSendBtn || active === els.codexThreadFileInput) return;
    setChatComposing(false);
  }, 160);
});
els.codexThreadSendBtn.addEventListener('click', async () => {
  const message = els.codexThreadMessageInput.value.trim();
  if ((!message && !state.selectedFiles.length) || !state.selectedThreadId) return;
  els.codexThreadSendBtn.disabled = true;
  els.codexThreadAttachBtn.disabled = true;
  els.codexThreadMessageInput.disabled = true;
  try {
    const attachments = await uploadSelectedFiles(state.selectedThreadId);
    const attachmentIds = attachments.map((item) => item.id).filter(Boolean);
    els.codexThreadMessageInput.value = '';
    state.selectedFiles = [];
    state.chatStickToBottom = true;
    renderSelectedFiles();
    await runQueued('codex.thread.send', {
      threadId: state.selectedThreadId,
      message,
      attachmentIds,
    }, { wait: false, group: 'codex-chat' });
  } catch (error) {
    toast(error.message, 'bad');
  } finally {
    els.codexThreadSendBtn.disabled = false;
    els.codexThreadAttachBtn.disabled = false;
    els.codexThreadMessageInput.disabled = false;
    els.codexThreadMessageInput.focus();
  }
});

els.ticproxySaveBasicBtn.addEventListener('click', () => runQueued('ticproxy.config.updateBasic', { basic: currentTicProxyBasicPayload() }, { wait: true, group: 'ticproxy' }).catch((error) => toast(error.message, 'bad')));
els.ticproxyAddApiKeyBtn.addEventListener('click', async () => {
  const key = els.ticproxyApiKeyInput.value.trim();
  els.ticproxyApiKeyInput.value = '';
  try {
    const command = await runQueued('ticproxy.apiKeys.add', key ? { key } : {}, { wait: true, group: 'ticproxy' });
    const createdKey = command.result?.key || '';
    if (createdKey) {
      els.ticproxyApiKeyInput.value = createdKey;
      toast('Đã tạo key. Key mới đang nằm trong ô nhập để bạn copy.', 'ok');
    }
  } catch (error) {
    toast(error.message, 'bad');
  }
});
els.ticproxyApiKeys.addEventListener('click', (event) => {
  const button = event.target.closest('[data-api-key-index]');
  if (!button) return;
  runQueued('ticproxy.apiKeys.delete', { index: Number(button.dataset.apiKeyIndex) }, { wait: true, group: 'ticproxy' }).catch((error) => toast(error.message, 'bad'));
});
els.ticproxySaveYamlBtn.addEventListener('click', () => runQueued('ticproxy.config.saveYaml', { yaml: els.ticproxyYamlEditor.value }, { wait: true, group: 'ticproxy' }).catch((error) => toast(error.message, 'bad')));
els.ticproxyProviderStrip.addEventListener('click', (event) => {
  const button = event.target.closest('[data-provider-id]');
  if (!button) return;
  state.selectedProvider = button.dataset.providerId;
  renderTicProxy(state.dashboard?.snapshot?.ticproxy || {}, state.ticproxy);
});
els.ticproxySaveProviderBtn.addEventListener('click', () => runQueued('ticproxy.provider.save', {
  provider: state.selectedProvider,
  items: safeJsonParse(els.ticproxyProviderEditor.value, []),
}, { wait: true, group: 'ticproxy' }).catch((error) => toast(error.message, 'bad')));
els.ticproxyProviderEntries.addEventListener('click', (event) => {
  const button = event.target.closest('[data-provider-delete]');
  if (!button) return;
  runQueued('ticproxy.provider.delete', { provider: state.selectedProvider, index: Number(button.dataset.providerDelete) }, { wait: true, group: 'ticproxy' }).catch((error) => toast(error.message, 'bad'));
});
els.ticproxyUploadAuthBtn.addEventListener('click', () => runQueued('ticproxy.auth.uploadText', {
  name: els.ticproxyAuthNameInput.value.trim() || 'auth.json',
  text: els.ticproxyAuthTextInput.value,
}, { wait: true, group: 'ticproxy' }).then(() => { els.ticproxyAuthTextInput.value = ''; }).catch((error) => toast(error.message, 'bad')));
els.ticproxyDeleteAllAuthBtn.addEventListener('click', () => {
  const confirmText = window.prompt('Gõ chính xác: delete all auth files');
  if (confirmText !== 'delete all auth files') return;
  runQueued('ticproxy.auth.deleteAll', { confirm: confirmText }, { wait: true, group: 'ticproxy' }).catch((error) => toast(error.message, 'bad'));
});
els.ticproxyAuthSearchInput.addEventListener('input', () => renderTicProxyAuth(ticproxyManagement()));
els.ticproxyAuthFiles.addEventListener('click', (event) => {
  const view = event.target.closest('[data-auth-view]');
  const models = event.target.closest('[data-auth-models]');
  const toggle = event.target.closest('[data-auth-toggle]');
  const del = event.target.closest('[data-auth-delete]');
  if (view) {
    runQueued('ticproxy.auth.view', { name: view.dataset.authView }, { wait: true, group: 'ticproxy' }).then((command) => {
      const result = state.ticproxy?.lastResult?.result || command.result;
      els.ticproxyAuthPreviewTitle.textContent = result?.name || view.dataset.authView;
      els.ticproxyAuthPreview.textContent = result?.text || '';
    }).catch((error) => toast(error.message, 'bad'));
  } else if (models) {
    runQueued('ticproxy.auth.models', { name: models.dataset.authModels }, { wait: true, group: 'ticproxy' }).catch((error) => toast(error.message, 'bad'));
  } else if (toggle) {
    runQueued('ticproxy.auth.status', { name: toggle.dataset.authToggle, disabled: toggle.dataset.disabled === '1' }, { wait: true, group: 'ticproxy' }).catch((error) => toast(error.message, 'bad'));
  } else if (del) {
    runQueued('ticproxy.auth.delete', { names: [del.dataset.authDelete] }, { wait: true, group: 'ticproxy' }).catch((error) => toast(error.message, 'bad'));
  }
});
els.ticproxyOauthProviderSelect.addEventListener('change', () => {
  setOAuthCallbackBase(defaultOAuthCallbackUrl(els.ticproxyOauthProviderSelect.value));
});
els.ticproxyOauthStartBtn.addEventListener('click', () => {
  els.ticproxyOauthUrlInput.value = '';
  els.ticproxyOauthCallbackInput.value = '';
  clearOAuthPolling();
  updateOAuthStatus('Đang tạo link OAuth...', 'warn');
  runQueued('ticproxy.oauth.start', {
    provider: els.ticproxyOauthProviderSelect.value,
    projectId: els.ticproxyOauthProjectInput.value.trim(),
  }, { wait: true, group: 'ticproxy' }).then((command) => {
    if (command.result?.state) scheduleOAuthPolling(command.result.state);
  }).catch((error) => toast(error.message, 'bad'));
});
els.ticproxyOauthCopyShortBtn.addEventListener('click', () => copyText(els.ticproxyOauthUrlInput.value || els.ticproxyOauthLink.href, 'Đã copy link OAuth'));
els.ticproxyOauthCopyBtn.addEventListener('click', () => copyText(els.ticproxyOauthUrlInput.value || els.ticproxyOauthLink.href, 'Đã copy link OAuth'));
els.ticproxyOauthCopyStateBtn.addEventListener('click', () => copyText(els.ticproxyOauthStateInput.value, 'Đã copy state'));
els.ticproxyOauthCopyCallbackBtn.addEventListener('click', () => copyText(els.ticproxyOauthCallbackBase.title || els.ticproxyOauthCallbackBase.textContent || els.ticproxyOauthCallbackInput.value, 'Đã copy callback URL'));
els.ticproxyOauthPollBtn.addEventListener('click', async () => {
  try {
    const oauthState = els.ticproxyOauthStateInput.value.trim();
    if (!oauthState) {
      toast('Tạo link OAuth trước.', 'warn');
      return;
    }
    updateOAuthStatus('Đang kiểm tra OAuth...', 'warn');
    await pollOAuthStatusOnce(oauthState);
  } catch (error) {
    toast(error.message, 'bad');
  }
});
els.ticproxyOauthCallbackBtn.addEventListener('click', () => runQueued('ticproxy.oauth.callback', {
  provider: els.ticproxyOauthProviderSelect.value,
  state: els.ticproxyOauthStateInput.value.trim(),
  redirectUrl: els.ticproxyOauthCallbackInput.value.trim(),
}, { wait: true, group: 'ticproxy' }).then(() => clearOAuthPolling()).catch((error) => toast(error.message, 'bad')));
els.ticproxySaveOauthModelsBtn.addEventListener('click', async () => {
  try {
    const models = safeJsonParse(els.ticproxyOauthExcludedEditor.value, {});
    const aliases = safeJsonParse(els.ticproxyOauthAliasEditor.value, {});
    await runQueued('ticproxy.oauth.excluded.save', { models }, { wait: true, group: 'ticproxy' });
    await runQueued('ticproxy.oauth.alias.save', { aliases }, { wait: true, group: 'ticproxy' });
    toast('OAuth model settings saved', 'ok');
  } catch (error) {
    toast(error.message, 'bad');
  }
});
els.ticproxyUsageQueueBtn.addEventListener('click', () => runQueued('ticproxy.quota.usageQueue', {
  count: Number(els.ticproxyUsageCountInput.value || 10),
}, { wait: true, group: 'ticproxy' }).catch((error) => toast(error.message, 'bad')));
els.ticproxyQuotaCheckAllBtn.addEventListener('click', () => runQueued('ticproxy.quota.probeAll', {}, { wait: true, group: 'ticproxy', polls: 90 }).catch((error) => toast(error.message, 'bad')));
els.ticproxyQuotaCards.addEventListener('click', (event) => {
  const button = event.target.closest('[data-quota-name]');
  if (!button) return;
  const authFile = selectedAuthFileByName(button.dataset.quotaName);
  runQueued('ticproxy.quota.probe', { name: button.dataset.quotaName, authFile }, { wait: true, group: 'ticproxy' }).catch((error) => toast(error.message, 'bad'));
});
els.ticproxyLoadLogsBtn.addEventListener('click', () => runQueued('ticproxy.logs.refresh', {}, { wait: true, group: 'ticproxy' }).catch((error) => toast(error.message, 'bad')));
els.ticproxyClearLogsBtn.addEventListener('click', () => runQueued('ticproxy.logs.clear', {}, { wait: true, group: 'ticproxy' }).catch((error) => toast(error.message, 'bad')));
els.ticproxyLogSearchInput.addEventListener('input', () => renderTicProxyLogs(ticproxyManagement(), state.ticproxy?.lastResult));
els.ticproxyErrorLogs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-error-log]');
  if (!button) return;
  runQueued('ticproxy.errorLog.download', { name: button.dataset.errorLog }, { wait: true, group: 'ticproxy' }).catch((error) => toast(error.message, 'bad'));
});

els.residentChatBtn.addEventListener('click', () => {
  const message = els.residentMessageInput.value.trim();
  if (!message) return;
  els.residentMessageInput.value = '';
  runQueued('resident.chat', { message }).catch((error) => toast(error.message, 'bad'));
});
els.residentStatusBtn.addEventListener('click', () => runQueued('resident.command', { commandType: 'collectStatus' }).catch((error) => toast(error.message, 'bad')));
els.residentWakeBtn.addEventListener('click', () => runQueued('resident.command', { commandType: 'wakeIdeAdmin' }).catch((error) => toast(error.message, 'bad')));

els.fileListBtn.addEventListener('click', () => runQueued('file.list', currentFilePayload(), { wait: true, group: 'files' }).catch((error) => toast(error.message, 'bad')));
els.fileSearchBtn.addEventListener('click', () => runQueued('file.search', {
  ...currentFilePayload(),
  query: els.fileSearchInput.value.trim(),
  includeContent: false,
}, { wait: true, group: 'files' }).catch((error) => toast(error.message, 'bad')));
els.fileEntries.addEventListener('click', (event) => {
  const button = event.target.closest('.tm-file-entry');
  if (!button) return;
  const targetPath = button.dataset.path || '';
  if (button.dataset.type === 'dir') {
    els.filePathInput.value = targetPath;
    runQueued('file.list', currentFilePayload(), { wait: true, group: 'files' }).catch((error) => toast(error.message, 'bad'));
    return;
  }
  runQueued('file.read', { root: els.fileRootSelect.value, path: targetPath }, { wait: true, group: 'files' }).catch((error) => toast(error.message, 'bad'));
});

els.taskSnapshotBtn.addEventListener('click', () => runQueued('task.snapshot', {}, { wait: true, group: 'tasks' }).catch((error) => toast(error.message, 'bad')));
els.codexExecBtn.addEventListener('click', () => {
  const prompt = els.codexExecInput.value.trim();
  if (!prompt) return;
  els.codexExecInput.value = '';
  runQueued('codex.exec', { prompt }, { wait: false, group: 'tasks' }).catch((error) => toast(error.message, 'bad'));
});

const initialTab = searchParams.get('tab');
if (['chat', 'ticproxy', 'agent', 'queue', 'resident', 'files', 'tasks'].includes(initialTab)) {
  setActiveTab(initialTab, { scroll: false });
  if (initialTab === 'ticproxy') selectTicProxyTab(searchParams.get('ticproxyTab') || state.ticproxyTab, { scroll: false });
} else {
  scrollIntoViewOnMobile('#tab-chat');
}

if (token) refresh().catch((error) => toast(error.message, 'bad'));
setInterval(() => {
  if (token) refresh().catch(() => undefined);
}, AUTO_REFRESH_MS);
