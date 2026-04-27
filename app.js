// SpendAgent — app.js
// Data stored in localStorage (browser, per-device)

const STORAGE_KEY = 'spendagent-txns';
const API_KEY_KEY = 'spendagent-apikey';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CAT_COLORS = ['#7c6dfa','#4ecdc4','#fbbf24','#f87171','#4ade80','#fb923c','#e879f9','#38bdf8'];
const CAT_ICONS = {Dining:'🍽',Groceries:'🛒',Transport:'⛽',Shopping:'📦',Health:'💊',Utilities:'💡',Entertainment:'🎬',Other:'💳'};

let transactions = [];
let selectedMonth = null;

// ── Storage helpers ───────────────────────────────────────────────────────────

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : [];
  } catch(e) { transactions = []; }
  renderAll();
  loadApiKeyStatus();
}

function saveData() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); } catch(e) {
    showToast('Storage full — clear old data', true);
  }
}

// ── API key ───────────────────────────────────────────────────────────────────

function getApiKey() {
  return localStorage.getItem(API_KEY_KEY) || '';
}

function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key.startsWith('sk-ant-')) { showToast('Key must start with sk-ant-', true); return; }
  localStorage.setItem(API_KEY_KEY, key);
  document.getElementById('api-key-input').value = '';
  loadApiKeyStatus();
  showToast('API key saved');
}

function clearApiKey() {
  localStorage.removeItem(API_KEY_KEY);
  document.getElementById('api-key-input').value = '';
  loadApiKeyStatus();
  showToast('API key cleared');
}

function loadApiKeyStatus() {
  const key = getApiKey();
  const el = document.getElementById('key-status');
  if (!el) return;
  el.textContent = key ? '✓ Key saved: ' + key.slice(0, 14) + '…' : 'No key saved yet.';
  el.style.color = key ? '#4ade80' : '#6b6b7a';
}

// ── Month helpers ─────────────────────────────────────────────────────────────

function getAvailableMonths() {
  const s = new Set();
  transactions.forEach(t => { if (t.date) s.add(t.date.slice(0, 7)); });
  return [...s].sort().reverse();
}

function filteredTxns() {
  if (!selectedMonth) return transactions;
  return transactions.filter(t => t.date && t.date.startsWith(selectedMonth));
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderAll() {
  renderMonthChips();
  renderDashboard();
  updateBadge();
  updateSavedCount();
}

function updateBadge() {
  const el = document.getElementById('tx-badge');
  if (el) el.textContent = transactions.length + ' transaction' + (transactions.length !== 1 ? 's' : '');
}

function updateSavedCount() {
  const el = document.getElementById('saved-count');
  if (el) el.textContent = transactions.length + ' transactions saved in browser storage.';
}

function renderMonthChips() {
  const months = getAvailableMonths();
  const el = document.getElementById('month-chips');
  if (!el) return;
  if (!months.length) { el.innerHTML = ''; return; }
  if (!selectedMonth || !months.includes(selectedMonth)) selectedMonth = months[0];
  el.innerHTML = months.map(m => {
    const [y, mo] = m.split('-');
    const label = MONTHS[parseInt(mo) - 1] + ' ' + y;
    return `<button class="chip ${m === selectedMonth ? 'active' : ''}" onclick="selectMonth('${m}', this)">${label}</button>`;
  }).join('');
}

function selectMonth(m, el) {
  selectedMonth = m;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderDashboard();
}

function renderDashboard() {
  const txns = filteredTxns();
  const total = txns.reduce((s, t) => s + (t.amount || 0), 0);

  document.getElementById('m-total').textContent = '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('m-count').textContent = txns.length;

  const cats = {};
  txns.forEach(t => { const c = t.category || 'Other'; cats[c] = (cats[c] || 0) + (t.amount || 0); });
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);

  const topEl = document.getElementById('m-top');
  const topDelta = document.getElementById('m-tdelta');
  if (sorted.length) {
    topEl.textContent = sorted[0][0];
    topDelta.textContent = '$' + sorted[0][1].toFixed(2);
  } else {
    topEl.textContent = '—';
    topDelta.textContent = '';
  }

  document.getElementById('m-delta').textContent = '';
  document.getElementById('m-cdelta').textContent = '';

  // Category bars
  const barsEl = document.getElementById('cat-bars');
  if (!sorted.length) {
    barsEl.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><p>No transactions yet.<br>Add notifications to see your breakdown.</p></div>';
  } else {
    const max = sorted[0][1];
    barsEl.innerHTML = sorted.map(([cat, amt], i) => `
      <div class="bar-row">
        <div class="bar-cat">${cat}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(amt / max * 100)}%;background:${CAT_COLORS[i % CAT_COLORS.length]}"></div></div>
        <div class="bar-amt">$${amt.toFixed(0)}</div>
      </div>`).join('');
  }

  // Recent transactions
  const txnEl = document.getElementById('txn-list');
  const recent = [...txns].reverse().slice(0, 10);
  if (!recent.length) {
    txnEl.innerHTML = '<div class="empty"><div class="empty-icon">🧾</div><p>Your parsed transactions will appear here.</p></div>';
  } else {
    txnEl.innerHTML = recent.map(t => `
      <div class="txn">
        <div class="txn-icon">${CAT_ICONS[t.category] || '💳'}</div>
        <div style="flex:1;min-width:0">
          <div class="txn-name">${escHtml(t.merchant || 'Unknown')}</div>
          <div class="txn-meta">${t.date || ''}</div>
        </div>
        <div class="txn-right">
          <div class="txn-cat">${escHtml(t.category || 'Other')}</div>
          <div class="txn-amt">-$${(t.amount || 0).toFixed(2)}</div>
        </div>
      </div>`).join('');
  }
}

// ── Parse notifications ───────────────────────────────────────────────────────

async function parseAndSave() {
  const text = document.getElementById('notif-input').value.trim();
  if (!text) { showToast('Paste some notifications first', true); return; }

  const apiKey = getApiKey();
  if (!apiKey) { showToast('Add your API key in Settings first', true); switchTab('settings', document.querySelectorAll('.nav-btn')[4]); return; }

  const loader = document.getElementById('parse-loader');
  loader.classList.add('active');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are a bank notification parser. Extract transactions from notification text and return ONLY a valid JSON array — no markdown fences, no explanation, nothing else.
Each object must have:
- merchant: string (store or payee name, cleaned up)
- amount: number (positive float, e.g. 45.00)
- date: string in YYYY-MM-DD format (use today's year ${new Date().getFullYear()} if year is missing)
- category: one of exactly: Dining, Groceries, Transport, Shopping, Health, Utilities, Entertainment, Other

If no transactions are found, return [].`,
        messages: [{ role: 'user', content: text }]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'API error ' + res.status);
    }

    const data = await res.json();
    const raw = (data.content?.[0]?.text || '[]').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed) || !parsed.length) {
      showToast('No transactions found — check the text', true);
    } else {
      parsed.forEach(t => { t.id = Date.now() + '-' + Math.random().toString(36).slice(2); });
      transactions = [...transactions, ...parsed];
      saveData();
      renderAll();
      document.getElementById('notif-input').value = '';
      showToast(`✓ ${parsed.length} transaction${parsed.length > 1 ? 's' : ''} saved`);
    }
  } catch(e) {
    console.error(e);
    showToast('Error: ' + (e.message || 'Try again'), true);
  }

  loader.classList.remove('active');
}

async function handleFile(input) {
  const file = input.files[0];
  if (!file) return;
  const text = await file.text();
  document.getElementById('notif-input').value = text.slice(0, 8000);
  switchTab('add', document.querySelectorAll('.nav-btn')[1]);
  showToast('File loaded — tap Parse & save');
  input.value = '';
}

// ── AI Insights ───────────────────────────────────────────────────────────────

async function getInsights() {
  if (!transactions.length) { showToast('Add some transactions first', true); return; }

  const apiKey = getApiKey();
  if (!apiKey) { showToast('Add your API key in Settings first', true); switchTab('settings', document.querySelectorAll('.nav-btn')[4]); return; }

  const loader = document.getElementById('insight-loader');
  loader.classList.add('active');
  document.getElementById('insights-body').innerHTML = '';

  const txns = filteredTxns();
  const summary = txns.map(t => `${t.date} | ${t.merchant} | $${t.amount} | ${t.category}`).join('\n');
  const total = txns.reduce((s, t) => s + (t.amount || 0), 0);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: `You are a personal finance analyst. Analyze spending and return ONLY a JSON array of insight objects — no markdown, no extra text.
Each insight: { "color": one of "#7c6dfa","#4ecdc4","#fbbf24","#f87171","#4ade80", "text": "insight with <strong>key figure or merchant</strong> highlighted" }
Give 5 specific, actionable insights referencing real merchants and amounts from the data.`,
        messages: [{
          role: 'user',
          content: `Total: $${total.toFixed(2)} across ${txns.length} transactions.\n\nTransactions:\n${summary}`
        }]
      })
    });

    if (!res.ok) throw new Error('API error ' + res.status);
    const data = await res.json();
    const raw = (data.content?.[0]?.text || '[]').replace(/```json|```/g, '').trim();
    const insights = JSON.parse(raw);

    document.getElementById('insights-body').innerHTML = insights.map(i =>
      `<div class="insight">
        <div class="insight-dot" style="background:${escHtml(i.color)}"></div>
        <div class="insight-text">${i.text}</div>
      </div>`
    ).join('');
  } catch(e) {
    document.getElementById('insights-body').innerHTML = '<div class="empty"><p>Could not load insights — check your API key and try again.</p></div>';
  }

  loader.classList.remove('active');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function clearAll() {
  if (!confirm('Delete all saved transactions? This cannot be undone.')) return;
  transactions = [];
  selectedMonth = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
  renderAll();
  showToast('All data cleared');
}

function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = isError ? '#f87171' : '#4ade80';
  t.style.color = isError ? '#f87171' : '#4ade80';
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.display = 'none'; }, 3000);
}

function switchTab(name, el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');
  if (el) el.classList.add('active');
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadData();
