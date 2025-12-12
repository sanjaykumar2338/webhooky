import logger from '../utils/logger.js';
import config from '../config.js';
import { getTemplates, saveTemplates, resetTemplatesToDefault } from '../services/templateStore.js';

const parseTemplatesFromRequest = (req) => {
  if (req.body?.templates) {
    if (typeof req.body.templates === 'string') {
      try {
        return JSON.parse(req.body.templates);
      } catch (error) {
        throw new Error('templates must be valid JSON');
      }
    }
    return req.body.templates;
  }

  // If the client posted the object directly
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  throw new Error('Missing templates payload');
};

export const listTemplates = async (_req, res) => {
  const templates = await getTemplates();
  return res.status(200).json({ templates });
};

export const replaceTemplates = async (req, res) => {
  try {
    const templates = parseTemplatesFromRequest(req);
    await saveTemplates(templates);
    logger.info('Templates replaced', { source: req.originalUrl });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
};

export const upsertSingleTemplate = async (req, res) => {
  const { key } = req.params;
  if (!key) {
    return res.status(400).json({ ok: false, error: 'Template key is required' });
  }

  const { body } = req.body || {};
  if (!body || typeof body !== 'string') {
    return res
      .status(400)
      .json({ ok: false, error: 'Template body must be provided as a string in { "body": "..." }' });
  }

  const templates = await getTemplates();
  templates[key] = body;

  try {
    await saveTemplates(templates);
    logger.info('Template upserted', { key });
    return res.status(200).json({ ok: true, key, length: body.length });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
};

export const resetTemplates = async (_req, res) => {
  try {
    const defaults = await resetTemplatesToDefault();
    logger.info('Templates reset to defaults');
    return res.status(200).json({ ok: true, templates: defaults });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
};

export const renderAdminUI = async (_req, res) => {
  const templates = await getTemplates();
  const keys = Object.keys(templates);
  const visibleKeys = keys.filter((key) => {
    const spaced = key.replace(/_/g, ' ');
    return !(key.includes('_') && keys.includes(spaced));
  });
  const options = visibleKeys.map((key) => `<option value="${key}">${key}</option>`).join('');
  const storageLabel =
    (config.templateStore.store || 'local').toLowerCase() === 'local'
      ? `Storage: Local file (${config.templateStore.file})`
      : `Storage: Shopify metafield (${config.shopify.templatesMetafield.namespace}.${config.shopify.templatesMetafield.key})`;

  return res
    .status(200)
    .type('html')
    .send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SMS Templates</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; background: #f5f6fa; color: #111827; }
    header { padding: 18px 24px; background: #1e3a8a; color: #fff; }
    h1 { margin: 0; font-size: 22px; }
    main { display: flex; gap: 16px; padding: 16px; }
    .sidebar { width: 240px; background: #fff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.08); padding: 12px; }
    .content { flex: 1; background: #fff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.08); padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    select, textarea { width: 100%; font-size: 14px; }
    textarea { min-height: 260px; resize: vertical; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-family: monospace; background: #f8fafc; }
    button { padding: 10px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .primary { background: #2563eb; color: #fff; }
    .ghost { background: #e2e8f0; color: #111827; }
    .status { min-height: 18px; font-size: 13px; }
    .status.ok { color: #065f46; }
    .status.err { color: #b91c1c; }
    .row { display: flex; gap: 12px; align-items: center; }
    .label { font-weight: 600; font-size: 13px; margin-bottom: 4px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
    pre { white-space: pre-wrap; word-break: break-word; background: #0f172a; color: #e2e8f0; padding: 10px; border-radius: 6px; font-size: 13px; }
    @media (max-width: 900px) { main { flex-direction: column; } .sidebar { width: 100%; } }
  </style>
</head>
<body>
  <header>
    <h1>SMS Templates Editor</h1>
    <div style="font-size: 13px; opacity: 0.9;">Protected admin interface (Basic Auth). ${storageLabel}.</div>
  </header>
  <main>
    <div class="sidebar">
      <div class="label">Template Key</div>
      <select id="templateKey" size="12" style="height: 420px;">${options}</select>
      <div class="label" style="margin-top: 10px;">Add / Rename Key</div>
      <input id="newKey" type="text" placeholder="optional new key" style="width: 100%; padding: 8px; border:1px solid #cbd5e1; border-radius:6px;" />
      <div class="card" style="margin-top: 12px; font-size: 12px;">
        <div style="font-weight:700; margin-bottom:6px;">Placeholders</div>
        <div>{{order_number}} | {{name}} | {{tracking}} | {{remaining_balance}}</div>
        <div style="margin-top:6px;">Unmatched placeholders stay as-is.</div>
      </div>
    </div>
    <div class="content">
      <div class="label">Template Body</div>
      <textarea id="templateBody" spellcheck="false"></textarea>
      <div class="row" style="justify-content: space-between;">
        <div id="charCount" class="label" style="font-weight:400; color:#334155;"></div>
        <div class="row" style="gap:8px;">
          <button id="resetBtn" class="ghost" type="button">Reset to Default</button>
          <button id="saveBtn" class="primary" type="button">Save</button>
        </div>
      </div>
      <div class="card">
        <div class="label">Preview (sample data)</div>
        <pre id="preview"></pre>
      </div>
      <div id="status" class="status"></div>
    </div>
  </main>
<script>
const templates = ${JSON.stringify(templates)};
const selectEl = document.getElementById('templateKey');
const newKeyEl = document.getElementById('newKey');
const bodyEl = document.getElementById('templateBody');
const statusEl = document.getElementById('status');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const charCountEl = document.getElementById('charCount');
const previewEl = document.getElementById('preview');
const sampleData = { order_number: '12345', name: 'Jane Doe', tracking: 'https://example.com/tracking', remaining_balance: '$100.00' };

function renderTemplate(str, data) {
  return str.replace(/{{\\s*([\\w.]+)\\s*}}/g, (_, key) => data[key] ?? '{{'+key+'}}');
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = 'status ' + (isError ? 'err' : 'ok');
}

function loadSelected(key) {
  const value = templates[key] || '';
  bodyEl.value = value;
  updateCharCount();
  updatePreview();
  setStatus('');
}

function updateCharCount() {
  charCountEl.textContent = bodyEl.value.length + ' chars';
}

function updatePreview() {
  previewEl.textContent = renderTemplate(bodyEl.value, sampleData);
}

selectEl.addEventListener('change', (e) => {
  loadSelected(e.target.value);
});

bodyEl.addEventListener('input', () => {
  updateCharCount();
  updatePreview();
});

saveBtn.addEventListener('click', async () => {
  const key = (newKeyEl.value || selectEl.value || '').trim();
  const body = bodyEl.value;
  if (!key) {
    setStatus('Template key is required', true);
    return;
  }
  templates[key] = body;
  saveBtn.disabled = true;
  setStatus('Saving...');
  try {
    const resp = await fetch('/admin/templates/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) throw new Error(data.error || 'Failed to save');
    if (!Array.from(selectEl.options).some((o) => o.value === key)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key;
      selectEl.appendChild(opt);
    }
    selectEl.value = key;
    newKeyEl.value = '';
    setStatus('Saved "' + key + '" (' + body.length + ' chars)');
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    saveBtn.disabled = false;
  }
});

resetBtn.addEventListener('click', async () => {
  if (!confirm('Reset all templates to defaults?')) return;
  resetBtn.disabled = true;
  setStatus('Resetting...');
  try {
    const resp = await fetch('/admin/templates/reset', { method: 'POST' });
    const data = await resp.json();
    if (!resp.ok || !data.ok) throw new Error(data.error || 'Failed to reset');
    Object.keys(templates).forEach((k) => delete templates[k]);
    Object.assign(templates, data.templates || {});
    const current = selectEl.value;
    selectEl.innerHTML = Object.keys(templates)
      .map((k) => '<option value=\"' + k + '\">' + k + '</option>')
      .join('');
    selectEl.value = current && templates[current] ? current : Object.keys(templates)[0];
    loadSelected(selectEl.value);
    setStatus('Reset to defaults');
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    resetBtn.disabled = false;
  }
});

// init
loadSelected(selectEl.value);
</script>
</body>
</html>`);
};

export default {
  listTemplates,
  replaceTemplates,
  upsertSingleTemplate,
  resetTemplates,
  renderAdminUI,
};
