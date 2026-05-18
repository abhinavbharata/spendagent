// SpendAgent v4 — app.js
// BofA CSV:      pure JS, no API key
// SoFi CSV:      pure JS, no API key
// Notifications: pure JS rule-based parser, no API key
// Stock prices:  CORS-safe via allorigins proxy
// AI Insights:   API key required (optional only)

'use strict';

const STORAGE_KEY = 'spendagent-txns';
const SAVINGS_KEY = 'spendagent-savings';
const INVEST_KEY  = 'spendagent-investments';
const GOAL_KEY    = 'spendagent-goal';
const API_KEY_KEY = 'spendagent-apikey';
const PIN_KEY     = 'spendagent-pin';
const SESSION_KEY = 'spendagent-unlocked';

const MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CAT_COLORS = ['#7c6dfa','#4ecdc4','#fbbf24','#f87171','#4ade80','#fb923c','#e879f9','#38bdf8'];
const CAT_ICONS  = {
  Dining:'🍽', Groceries:'🛒', Transport:'⛽', Shopping:'📦',
  Health:'💊', Utilities:'💡', Entertainment:'🎬',
  Transfer:'💸', Reimbursement:'🤝', Income:'💰', Other:'💳'
};

let transactions  = [];
let savingsTxns   = [];
let investments   = [];
let selectedMonth = null;

// ── Storage ───────────────────────────────────────────────────────────────────

function loadData() {
  try { transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) { transactions = []; }
  try { savingsTxns  = JSON.parse(localStorage.getItem(SAVINGS_KEY) || '[]'); } catch(e) { savingsTxns  = []; }
  try { investments  = JSON.parse(localStorage.getItem(INVEST_KEY)  || '[]'); } catch(e) { investments  = []; }
  renderAll();
  loadApiKeyStatus();
}

function saveAll() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    localStorage.setItem(SAVINGS_KEY, JSON.stringify(savingsTxns));
    localStorage.setItem(INVEST_KEY,  JSON.stringify(investments));
  } catch(e) { showToast('Storage full — export a backup first', true); }
}

// ── API Key (only for AI Insights) ────────────────────────────────────────────

function getApiKey() { return localStorage.getItem(API_KEY_KEY) || ''; }

function saveApiKey() {
  const k = document.getElementById('api-key-input').value.trim();
  if (!k.startsWith('sk-ant-')) { showToast('Key must start with sk-ant-', true); return; }
  localStorage.setItem(API_KEY_KEY, k);
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
  const k  = getApiKey();
  const el = document.getElementById('key-status');
  if (!el) return;
  el.textContent = k ? '✓ Key saved: ' + k.slice(0, 14) + '…' : 'No key saved — only needed for AI Insights.';
  el.style.color  = k ? '#4ade80' : '#6b6b7a';
}

// ── Months ────────────────────────────────────────────────────────────────────

function getAvailableMonths() {
  const s = new Set();
  transactions.forEach(t => { if (t.date) s.add(t.date.slice(0, 7)); });
  return [...s].sort().reverse();
}

function filteredTxns() {
  if (!selectedMonth) return transactions;
  return transactions.filter(t => t.date && t.date.startsWith(selectedMonth));
}

function selectMonth(m, el) {
  selectedMonth = m;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderDashboard();
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderAll() {
  renderMonthChips();
  renderDashboard();
  renderSavings();
  renderInvestments();
  updateBadge();
  updateSavedCount();
}

function updateBadge() {
  const el = document.getElementById('tx-badge');
  if (el) el.textContent = transactions.length + ' transaction' + (transactions.length !== 1 ? 's' : '');
}

function updateSavedCount() {
  const el = document.getElementById('saved-count');
  if (el) el.textContent = transactions.length + ' transactions · ' + savingsTxns.length + ' savings entries · ' + investments.length + ' holdings';
}

function renderMonthChips() {
  const months = getAvailableMonths();
  const el     = document.getElementById('month-chips');
  if (!el) return;
  if (!months.length) { el.innerHTML = ''; return; }
  if (!selectedMonth || !months.includes(selectedMonth)) selectedMonth = months[0];
  el.innerHTML = months.map(m => {
    const [y, mo] = m.split('-');
    return `<button class="chip ${m === selectedMonth ? 'active' : ''}" onclick="selectMonth('${m}',this)">${MONTHS[parseInt(mo) - 1]} ${y}</button>`;
  }).join('');
}

function renderDashboard() {
  const txns    = filteredTxns();
  const debits  = txns.filter(t => t.type === 'debit');
  const credits = txns.filter(t => t.type === 'credit');
  const spent   = debits.reduce((s, t)  => s + (t.amount || 0), 0);
  const rcvd    = credits.reduce((s, t) => s + (t.amount || 0), 0);
  const net     = rcvd - spent;

  const savBal   = savingsTxns.length ? (savingsTxns[savingsTxns.length - 1].balance || 0) : 0;
  const portVal  = investments.reduce((s, i) => s + (i.shares * (i.currentPrice || 0)), 0);
  const portCost = investments.reduce((s, i) => s + (i.shares * (i.costBasis    || 0)), 0);
  const pnl      = portVal - portCost;

  setText('m-total',   fmt(spent));
  setText('m-credit',  fmt(rcvd));
  setText('m-net',     (net >= 0 ? '+' : '') + fmt(Math.abs(net)));
  setColor('m-net',    net >= 0 ? '#4ade80' : '#f87171');
  setText('m-count',   txns.length);
  setText('m-savings', fmt(savBal));
  setText('m-invest',  fmt(portVal));
  setText('m-idelta',  (pnl >= 0 ? '▲ +' : '▼ ') + fmt(Math.abs(pnl)) + (portCost > 0 ? ' (' + ((pnl / portCost) * 100).toFixed(1) + '%)' : ''));
  setColor('m-idelta', pnl >= 0 ? '#4ade80' : '#f87171');

  // Category bars
  const cats = {};
  debits.forEach(t => { const c = t.category || 'Other'; cats[c] = (cats[c] || 0) + (t.amount || 0); });
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const barsEl = document.getElementById('cat-bars');
  if (!sorted.length) {
    barsEl.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><p>No expenses yet.<br>Upload your BofA CSV to get started.</p></div>';
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
  const txnEl  = document.getElementById('txn-list');
  const recent = [...txns].reverse().slice(0, 15);
  if (!recent.length) {
    txnEl.innerHTML = '<div class="empty"><div class="empty-icon">🧾</div><p>Transactions will appear here.</p></div>';
  } else {
    txnEl.innerHTML = recent.map(t => {
      const isCr = t.type === 'credit';
      return `<div class="txn">
        <div class="txn-icon">${CAT_ICONS[t.category] || '💳'}</div>
        <div style="flex:1;min-width:0">
          <div class="txn-name">${esc(t.merchant || 'Unknown')}</div>
          <div class="txn-meta">${t.date || ''} · ${isCr ? 'Credit' : 'Debit'}</div>
        </div>
        <div class="txn-right">
          <div class="txn-cat">${esc(t.category || 'Other')}</div>
          <div class="txn-amt" style="color:${isCr ? '#4ade80' : '#f87171'}">${isCr ? '+' : '-'}$${(t.amount || 0).toFixed(2)}</div>
        </div>
      </div>`;
    }).join('');
  }
}

function renderSavings() {
  const deposits = savingsTxns.filter(t => t.type === 'deposit').reduce((s, t)  => s + (t.amount || 0), 0);
  const interest = savingsTxns.filter(t => t.type === 'interest').reduce((s, t) => s + (t.amount || 0), 0);
  const balance  = savingsTxns.length ? (savingsTxns[savingsTxns.length - 1].balance || 0) : 0;

  setText('s-balance',  fmt(balance));
  setText('s-interest', fmt(interest));
  setText('s-deposits', fmt(deposits));

  const listEl = document.getElementById('savings-list');
  if (!savingsTxns.length) {
    listEl.innerHTML = '<div class="empty"><div class="empty-icon">🏦</div><p>Upload your SoFi CSV to see savings activity.</p></div>';
  } else {
    listEl.innerHTML = [...savingsTxns].reverse().slice(0, 10).map(t => `
      <div class="txn">
        <div class="txn-icon">${t.type === 'interest' ? '💹' : t.type === 'deposit' ? '⬆️' : '⬇️'}</div>
        <div style="flex:1;min-width:0">
          <div class="txn-name">${esc(t.description || t.type)}</div>
          <div class="txn-meta">${t.date || ''}</div>
        </div>
        <div class="txn-right">
          <div class="txn-cat">${t.type}</div>
          <div class="txn-amt" style="color:#4ade80">+$${(t.amount || 0).toFixed(2)}</div>
        </div>
      </div>`).join('');
  }

  // Savings goal bar
  const goal  = parseFloat(localStorage.getItem(GOAL_KEY) || 0);
  if (goal > 0) {
    const pct   = Math.min(100, Math.round(balance / goal * 100));
    const barEl = document.getElementById('savings-goal-bar');
    if (barEl) {
      barEl.style.display = 'block';
      setText('goal-label', fmt(balance) + ' of ' + fmt(goal));
      setText('goal-pct',   pct + '%');
      const fill = document.getElementById('goal-fill');
      if (fill) fill.style.width = pct + '%';
    }
    const inp = document.getElementById('savings-goal');
    if (inp && !inp.value) inp.value = goal;
  }
}

function saveSavingsGoal() {
  const v = parseFloat(document.getElementById('savings-goal').value);
  if (!v || v <= 0) { showToast('Enter a valid goal amount', true); return; }
  localStorage.setItem(GOAL_KEY, v);
  renderSavings();
  showToast('Savings goal set to ' + fmt(v));
}

function renderInvestments() {
  const portVal  = investments.reduce((s, i) => s + (i.shares * (i.currentPrice || 0)), 0);
  const portCost = investments.reduce((s, i) => s + (i.shares * (i.costBasis    || 0)), 0);
  const pnl      = portVal - portCost;
  const pct      = portCost > 0 ? ((pnl / portCost) * 100).toFixed(1) : '0';

  setText('i-value', fmt(portVal));
  setText('i-cost',  fmt(portCost));
  setText('i-pl',    (pnl >= 0 ? '+' : '') + fmt(pnl));
  setColor('i-pl',   pnl >= 0 ? '#4ade80' : '#f87171');
  setText('i-pct',   (pnl >= 0 ? '▲ ' : '▼ ') + pct + '% total return');
  setColor('i-pct',  pnl >= 0 ? '#4ade80' : '#f87171');

  const listEl = document.getElementById('holdings-list');
  const plEl   = document.getElementById('pl-bars');

  if (!investments.length) {
    listEl.innerHTML = '<div class="empty"><div class="empty-icon">📈</div><p>Add your holdings above.</p></div>';
    plEl.innerHTML   = '<div class="empty"><div class="empty-icon">💹</div><p>Add holdings to see P&L.</p></div>';
    return;
  }

  listEl.innerHTML = investments.map((inv, idx) => {
    const val        = inv.shares * (inv.currentPrice || 0);
    const cost       = inv.shares * (inv.costBasis    || 0);
    const pl         = val - cost;
    const p          = cost > 0 ? ((pl / cost) * 100).toFixed(1) : '0';
    const priceLabel = inv.currentPrice ? '$' + inv.currentPrice.toFixed(2) : 'fetching…';
    return `<div class="holding">
      <div style="flex:1;min-width:0">
        <div class="holding-ticker">${esc(inv.ticker)}</div>
        <div class="holding-detail">${inv.shares} sh · avg $${(inv.costBasis || 0).toFixed(2)} · now ${priceLabel}</div>
      </div>
      <div class="holding-right">
        <div class="holding-val">${fmt(val)}</div>
        <div class="holding-pl" style="color:${pl >= 0 ? '#4ade80' : '#f87171'}">${pl >= 0 ? '+' : ''}$${pl.toFixed(2)} (${p}%)</div>
      </div>
      <button onclick="removeHolding(${idx})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;padding:0 4px;margin-left:6px">×</button>
    </div>`;
  }).join('');

  const maxAbs = Math.max(...investments.map(i => Math.abs((i.shares * (i.currentPrice || 0)) - (i.shares * (i.costBasis || 0)))), 1);
  plEl.innerHTML = investments.map(inv => {
    const pl    = (inv.shares * (inv.currentPrice || 0)) - (inv.shares * (inv.costBasis || 0));
    const w     = Math.round(Math.abs(pl) / maxAbs * 100);
    const color = pl >= 0 ? '#4ade80' : '#f87171';
    return `<div class="bar-row">
      <div class="bar-cat">${esc(inv.ticker)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${color}"></div></div>
      <div class="bar-amt" style="color:${color}">${pl >= 0 ? '+' : ''}$${pl.toFixed(0)}</div>
    </div>`;
  }).join('');
}

// ── Investments — add / remove / price ────────────────────────────────────────

function addInvestment() {
  const ticker = (document.getElementById('i-ticker').value || '').trim().toUpperCase();
  const shares = parseFloat(document.getElementById('i-shares').value);
  const cost   = parseFloat(document.getElementById('i-cost-basis').value);
  if (!ticker || !shares || isNaN(shares) || !cost || isNaN(cost)) {
    showToast('Fill in all fields', true); return;
  }
  const holding = { ticker, shares, costBasis: cost, currentPrice: cost, id: Date.now() };
  investments.push(holding);
  saveAll();
  renderInvestments();
  ['i-ticker','i-shares','i-cost-basis'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  showToast('✓ ' + ticker + ' added — fetching live price…');
  fetchCurrentPrice(ticker).then(price => {
    if (price !== null) {
      holding.currentPrice = price;
      saveAll(); renderInvestments();
      showToast('✓ ' + ticker + ' price: $' + price.toFixed(2));
    }
  });
}

function removeHolding(idx) {
  if (!confirm('Remove this holding?')) return;
  investments.splice(idx, 1);
  saveAll(); renderInvestments();
  showToast('Holding removed');
}

async function fetchCurrentPrice(ticker) {
  if (!ticker) return null;
  try {
    const yUrl  = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?interval=1d&range=1d';
    const proxy = 'https://api.allorigins.win/get?url=' + encodeURIComponent(yUrl);
    const res   = await fetch(proxy, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const outer = await res.json();
    const data  = JSON.parse(outer.contents);
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' ? price : null;
  } catch(e) { return null; }
}

async function refreshPrices() {
  if (!investments.length) return;
  let changed = false;
  for (const inv of investments) {
    const p = await fetchCurrentPrice(inv.ticker);
    if (p !== null && inv.currentPrice !== p) { inv.currentPrice = p; changed = true; }
  }
  if (changed) { saveAll(); renderInvestments(); }
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const cols = []; let cur = '', inQ = false;
  for (let c = 0; c < line.length; c++) {
    if (line[c] === '"') { inQ = !inQ; }
    else if (line[c] === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
    else cur += line[c];
  }
  cols.push(cur.trim());
  return cols;
}

function parseAmt(s) {
  if (!s) return null;
  const n = parseFloat(String(s).replace(/[",\s]/g, ''));
  return isNaN(n) ? null : n;
}

function fmtDate(d) {
  const m = d.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}` : d;
}

function cleanMerchant(desc) {
  return desc
    .replace(/\d{2}\/\d{2}(\s+(PURCHASE|MOBILE PURCHASE|PMNT SENT|WITHDRWL))?/gi, '')
    .replace(/\b(PURCHASE|MOBILE|PMNT SENT|WITHDRWL|WEB|PPD|ACH|POS)\b/gi, '')
    .replace(/DES:.*$/i,'').replace(/ID:.*$/i,'').replace(/INDN:.*$/i,'')
    .replace(/CO ID:.*$/i,'').replace(/Conf#\s*\S+/gi,'').replace(/XXXXX\w*/gi,'')
    .replace(/\s{2,}/g,' ').trim();
}

function categorize(desc, isCredit) {
  const d = desc.toLowerCase();
  if (isCredit) {
    if (/zelle.*from|payment.*from|sent.*you/i.test(d)) return 'Reimbursement';
    if (/payroll|salary|l&t|direct dep|wages/i.test(d))  return 'Income';
    if (/refund|reversal|cashback|rebate/i.test(d))       return 'Other';
    if (/transfer|sofi|zolve/i.test(d))                   return 'Transfer';
    return 'Other';
  }
  if (/restaurant|food|pizza|burger|taco|sushi|grill|cafe|coffee|starbucks|dunkin|donut|bakery|diner|kitchen|bistro|bbq|wings|chicken|wingstop|mcdonalds|subway|chipotle|chick|raising cane|zaxby|cava|beyond dosai|salsaritas|huey|nekter|mama birria|chuy|waffle|ihop|denny|applebee|olive garden|cheesecake/i.test(d)) return 'Dining';
  if (/walmart|wal-mart|target|costco|kroger|aldi|grocery|grocer|patel|indian|halal|holyland|radha|whole food|trader joe|publix|food lion|fresh market|sprout|heb|wegman/i.test(d)) return 'Groceries';
  if (/shell|exxon|chevron|bp |mobil|gas station|spinx|qt |costco gas|fuel|lyft|uber|parking|7-eleven|circle k|marathon|sunoco/i.test(d)) return 'Transport';
  if (/amazon|best buy|macy|old navy|lowe|home depot|dollar|apple store|remitly|lemfi|ebay|etsy|ikea/i.test(d)) return 'Shopping';
  if (/health|pharmacy|cvs|walgreen|doctor|dental|medical|hospital|clinic|vagaro|regis|salon|hair|urgent care|labcorp|quest/i.test(d)) return 'Health';
  if (/t-mobile|tmobile|at&t|verizon|sprint|internet|comcast|xfinity|electric|water |utility|wuvisaaft|duke energy|dominion/i.test(d)) return 'Utilities';
  if (/netflix|spotify|hulu|disney|movie|theater|cinema|ticket|concert|apple cash|youtube|twitch|gaming/i.test(d)) return 'Entertainment';
  if (/zelle|transfer|sofi|discover|launch serv|wells fargo|robinhood|zolve|remit|lemfi|wire/i.test(d)) return 'Transfer';
  return 'Other';
}

// ── BofA CSV — pure JS ────────────────────────────────────────────────────────

function handleBofaCSV(input) {
  const file = input.files[0]; if (!file) return;
  const loader = document.getElementById('csv-loader');
  loader.classList.add('active');
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const lines     = e.target.result.split(/\r?\n/);
      let headerIdx   = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^"?date"?[,\t]/i.test(lines[i].trim())) { headerIdx = i; break; }
      }
      if (headerIdx === -1) { showToast('Could not find header row in CSV', true); loader.classList.remove('active'); return; }

      const headers = parseCSVLine(lines[headerIdx]).map(h => h.replace(/"/g,'').toLowerCase());
      const dateCol = headers.findIndex(h => h === 'date');
      const descCol = headers.findIndex(h => h.includes('description') || h.includes('desc'));
      const amtCol  = headers.findIndex(h => h === 'amount');
      const balCol  = headers.findIndex(h => h.includes('running') || h.includes('bal'));

      if (dateCol === -1 || descCol === -1 || amtCol === -1) {
        showToast('CSV columns not recognised — expected Date, Description, Amount', true);
        loader.classList.remove('active'); return;
      }

      const rows = [];
      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line    = lines[i].trim(); if (!line) continue;
        const cols    = parseCSVLine(line);
        const dateRaw = (cols[dateCol] || '').replace(/"/g,'');
        const descRaw = (cols[descCol] || '').replace(/"/g,'');
        const amtRaw  =  cols[amtCol]  || '';
        const balRaw  =  cols[balCol]  || '';
        if (!dateRaw.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) continue;
        if (/beginning balance|ending balance|opening balance/i.test(descRaw)) continue;
        const amt = parseAmt(amtRaw);
        if (amt === null || amt === 0) continue;
        const isCredit = amt > 0;
        rows.push({
          id:       Date.now() + '-' + Math.random().toString(36).slice(2),
          date:     fmtDate(dateRaw),
          merchant: cleanMerchant(descRaw) || descRaw.slice(0, 40) || 'Unknown',
          amount:   Math.abs(amt),
          type:     isCredit ? 'credit' : 'debit',
          category: categorize(descRaw, isCredit),
          balance:  parseAmt(balRaw) || 0
        });
      }

      if (!rows.length) { showToast('No transactions found — check CSV format', true); }
      else {
        const existing = new Set(transactions.map(t => t.date + '|' + t.merchant + '|' + t.amount));
        const fresh    = rows.filter(t => !existing.has(t.date + '|' + t.merchant + '|' + t.amount));
        transactions   = [...transactions, ...fresh];
        saveAll(); renderAll();
        const d = fresh.filter(t => t.type === 'debit').length;
        const c = fresh.filter(t => t.type === 'credit').length;
        showToast(`✓ ${fresh.length} imported: ${d} debits · ${c} credits`);
      }
    } catch(err) { showToast('CSV error: ' + (err.message || 'check file format'), true); }
    loader.classList.remove('active');
    input.value = '';
  };
  reader.onerror = () => { showToast('Could not read file', true); loader.classList.remove('active'); };
  reader.readAsText(file);
}

// ── SoFi CSV — pure JS ────────────────────────────────────────────────────────

function handleSofiCSV(input) {
  const file = input.files[0]; if (!file) return;
  const loader = document.getElementById('sofi-loader');
  loader.classList.add('active');
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const lines   = e.target.result.split(/\r?\n/);
      let headerIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/date/i.test(lines[i]) && /amount/i.test(lines[i])) { headerIdx = i; break; }
      }
      if (headerIdx === -1) { showToast('Could not read SoFi CSV format', true); loader.classList.remove('active'); return; }

      const headers = parseCSVLine(lines[headerIdx]).map(h => h.replace(/"/g,'').toLowerCase());
      const dateCol = headers.findIndex(h => h.includes('date'));
      const descCol = headers.findIndex(h => h.includes('desc') || h.includes('transaction') || h.includes('memo'));
      const amtCol  = headers.findIndex(h => h.includes('amount'));
      const balCol  = headers.findIndex(h => h.includes('balance') || h.includes('bal'));

      const rows = [];
      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line    = lines[i].trim(); if (!line) continue;
        const cols    = parseCSVLine(line);
        const dateRaw = (cols[dateCol] || '').replace(/"/g,'');
        const descRaw = (cols[descCol] || '').replace(/"/g,'');
        const amtRaw  =  cols[amtCol]  || '';
        const balRaw  =  cols[balCol]  || '';
        const amt     = parseAmt(amtRaw);
        if (!dateRaw || amt === null) continue;
        const dl = descRaw.toLowerCase();
        let type = 'other';
        if (/interest/i.test(dl))                              type = 'interest';
        else if (amt > 0 || /deposit|transfer in/i.test(dl))  type = 'deposit';
        else if (amt < 0 || /withdraw|transfer out/i.test(dl)) type = 'withdrawal';
        rows.push({
          id:          Date.now() + '-' + Math.random().toString(36).slice(2),
          date:        fmtDate(dateRaw) || dateRaw,
          description: descRaw || type,
          amount:      Math.abs(amt),
          type,
          balance:     parseAmt(balRaw) || 0
        });
      }

      if (!rows.length) { showToast('No data found in SoFi CSV', true); }
      else {
        savingsTxns = [...savingsTxns, ...rows];
        saveAll(); renderSavings();
        showToast(`✓ ${rows.length} savings entries imported`);
      }
    } catch(err) { showToast('SoFi CSV error: ' + (err.message || 'check file format'), true); }
    loader.classList.remove('active');
    input.value = '';
  };
  reader.onerror = () => { showToast('Could not read file', true); loader.classList.remove('active'); };
  reader.readAsText(file);
}

// ── Manual notification parser — pure JS ─────────────────────────────────────

function parseNotifications() {
  const text = document.getElementById('notif-input').value.trim();
  if (!text) { showToast('Paste some notifications first', true); return; }

  const results = [];
  const lines   = text.split(/\n+/).filter(l => l.trim());

  for (const line of lines) {
    const l = line.trim();
    const amtMatch = l.match(/\$\s*([\d,]+\.?\d*)/);
    if (!amtMatch) continue;
    const amount = parseFloat(amtMatch[1].replace(/,/g, ''));
    if (!amount || isNaN(amount)) continue;

    const isCredit = /sent you|received|payment from|deposited|credited|refund|reimbur/i.test(l);
    const type     = isCredit ? 'credit' : 'debit';

    let merchant     = 'Unknown';
    const sentYou    = l.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*)\s+sent you/);
    const atMatch    = l.match(/(?:at|@)\s+([A-Za-z0-9 &'.\-]{2,30})/i);
    const forMatch   = l.match(/(?:to|for)\s+([A-Za-z0-9 &'.\-]{2,30})/i);
    if (sentYou)     merchant = sentYou[1];
    else if (atMatch)  merchant = atMatch[1].trim();
    else if (forMatch) merchant = forMatch[1].trim();

    const today  = new Date().toISOString().slice(0, 10);
    let date     = today;
    const dMatch = l.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (dMatch) {
      const yr = dMatch[3] ? (dMatch[3].length === 2 ? '20' + dMatch[3] : dMatch[3]) : new Date().getFullYear();
      date = `${yr}-${dMatch[1].padStart(2,'0')}-${dMatch[2].padStart(2,'0')}`;
    }

    results.push({
      id: Date.now() + '-' + Math.random().toString(36).slice(2),
      date, merchant, amount, type,
      category: categorize(l, isCredit)
    });
  }

  if (!results.length) { showToast('No transactions found — check the format', true); return; }
  transactions = [...transactions, ...results];
  saveAll(); renderAll();
  document.getElementById('notif-input').value = '';
  const d = results.filter(t => t.type === 'debit').length;
  const c = results.filter(t => t.type === 'credit').length;
  showToast(`✓ Saved: ${d} debit${d !== 1 ? 's' : ''} · ${c} credit${c !== 1 ? 's' : ''}`);
}

// ── AI Insights — precise, concise, stable ────────────────────────────────────

async function getInsights() {
  if (!transactions.length && !savingsTxns.length && !investments.length) {
    showToast('Add some data first', true); return;
  }
  const apiKey = getApiKey();
  if (!apiKey) {
    showToast('Add your Anthropic API key in Settings to use AI Insights', true);
    switchTab('settings', document.querySelectorAll('.nav-btn')[5]);
    return;
  }

  const loader = document.getElementById('insight-loader');
  loader.classList.add('active');
  document.getElementById('insights-body').innerHTML = '';

  const txns    = filteredTxns();
  const debits  = txns.filter(t => t.type === 'debit');
  const credits = txns.filter(t => t.type === 'credit');
  const spent   = debits.reduce((s, t)  => s + (t.amount || 0), 0);
  const rcvd    = credits.reduce((s, t) => s + (t.amount || 0), 0);
  const savBal  = savingsTxns.length ? (savingsTxns[savingsTxns.length - 1].balance || 0) : 0;
  const portVal = investments.reduce((s, i) => s + (i.shares * (i.currentPrice || 0)), 0);
  const portCost= investments.reduce((s, i) => s + (i.shares * (i.costBasis    || 0)), 0);

  // Category totals
  const cats = {};
  debits.forEach(t => { const c = t.category || 'Other'; cats[c] = (cats[c] || 0) + (t.amount || 0); });
  const catStr = Object.entries(cats).sort((a,b) => b[1]-a[1]).map(([c,a]) => `${c}:$${a.toFixed(2)}`).join(', ');

  // Top 5 merchants
  const merchants = {};
  debits.forEach(t => { merchants[t.merchant] = (merchants[t.merchant] || 0) + (t.amount || 0); });
  const topStr = Object.entries(merchants).sort((a,b) => b[1]-a[1]).slice(0,5).map(([m,a]) => `${m}:$${a.toFixed(2)}`).join(', ');

  const reimb    = credits.filter(t => t.category === 'Reimbursement').reduce((s,t) => s+(t.amount||0),0);
  const holdStr  = investments.map(i => `${i.ticker}:${i.shares}sh@${i.costBasis},now ${i.currentPrice||0},pl:${((i.shares*((i.currentPrice||0)-i.costBasis)).toFixed(2))}`).join(' | ');
  const period   = selectedMonth ? MONTHS[parseInt(selectedMonth.split('-')[1])-1]+' '+selectedMonth.split('-')[0] : 'all time';

  const prompt = [
    `Period: ${period}`,
    `Spent: $${spent.toFixed(2)} | Received: $${rcvd.toFixed(2)} | Net: $${(rcvd-spent).toFixed(2)}`,
    `Categories: ${catStr || 'none'}`,
    `Top merchants: ${topStr || 'none'}`,
    `Reimbursements received: $${reimb.toFixed(2)}`,
    `SoFi savings: $${savBal.toFixed(2)}`,
    `Portfolio: $${portVal.toFixed(2)} value / $${portCost.toFixed(2)} cost / P&L $${(portVal-portCost).toFixed(2)}`,
    holdStr ? `Holdings: ${holdStr}` : ''
  ].filter(Boolean).join('\n');

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
        max_tokens: 600,
        system: `You are a concise personal finance analyst. Return exactly 5 insights as a valid JSON array. No markdown. No text outside the array.

Each element: { "color": string, "text": string }

color rules:
- "#4ade80" — positive finding
- "#f87171" — warning or high spend
- "#fbbf24" — actionable tip
- "#4ecdc4" — savings or investment
- "#7c6dfa" — general observation

text rules:
- Exactly one sentence, maximum 18 words
- Include exactly one number in <strong> tags
- Be specific — use real figures from the data
- No filler words like "it seems" or "you might want to"

Cover these 5 topics in order:
1. Biggest spending category with amount
2. Net cash flow (positive or negative)
3. Savings balance or savings rate vs spending
4. Top merchant or reimbursements received
5. Investment P&L or one actionable saving tip`,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'API error ' + res.status);
    }

    const data     = await res.json();
    const raw      = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    const insights = safeJsonParse(raw);

    if (!Array.isArray(insights) || !insights.length) throw new Error('Invalid response — try again');

    document.getElementById('insights-body').innerHTML = insights.slice(0, 5).map(i =>
      `<div class="insight">
        <div class="insight-dot" style="background:${esc(i.color || '#7c6dfa')}"></div>
        <div class="insight-text">${i.text || ''}</div>
      </div>`
    ).join('');

  } catch(e) {
    document.getElementById('insights-body').innerHTML =
      `<div class="empty"><p style="color:#f87171;font-size:13px">Error: ${esc(e.message || 'Try again')}</p></div>`;
  }

  loader.classList.remove('active');
}

// ── Export / Clear ────────────────────────────────────────────────────────────

function exportCSV() {
  const rows = [
    ['Date','Type','Merchant','Amount','Category'],
    ...transactions.map(t => [t.date, t.type, t.merchant, t.amount, t.category])
  ];
  const csv = rows.map(r => r.map(v => `"${String(v || '').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a   = document.createElement('a');
  a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'spendagent-backup.csv';
  a.click();
}

function clearAll() {
  if (!confirm('Delete ALL data — transactions, savings and investments? Cannot be undone.')) return;
  transactions = []; savingsTxns = []; investments = []; selectedMonth = null;
  [STORAGE_KEY, SAVINGS_KEY, INVEST_KEY, GOAL_KEY].forEach(k => localStorage.removeItem(k));
  renderAll();
  showToast('All data cleared');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmt(n) {
  return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function setText(id, v)  { const el = document.getElementById(id); if (el) el.textContent = v; }
function setColor(id, c) { const el = document.getElementById(id); if (el) el.style.color  = c; }
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function safeJsonParse(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try { return JSON.parse(raw); } catch(e) {}
  // Try to extract JSON array from response
  const start = raw.indexOf('[');
  const end   = raw.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch(e) {}
  }
  return null;
}
function showToast(msg, isError = false) {
  const t         = document.getElementById('toast');
  t.textContent   = msg;
  t.style.borderColor = isError ? '#f87171' : '#4ade80';
  t.style.color       = isError ? '#f87171' : '#4ade80';
  t.style.display     = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.display = 'none'; }, 3500);
}
function switchTab(name, el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const p = document.getElementById('tab-' + name);
  if (p) p.classList.add('active');
  if (el) el.classList.add('active');
}

// ── PIN ───────────────────────────────────────────────────────────────────────

const PIN_LEN = 4;
let pinBuffer = '';
let pinMode   = 'verify';

function initPin() {
  if (sessionStorage.getItem(SESSION_KEY) === '1') { unlockApp(); return; }
  const saved = localStorage.getItem(PIN_KEY);
  if (!saved) {
    pinMode = 'set';
    document.getElementById('pin-sub').textContent  = 'Create a 4-digit PIN';
    document.getElementById('pin-hint').textContent = 'You\'ll use this every time you open the app.';
  } else {
    pinMode = 'verify';
    document.getElementById('pin-sub').textContent  = 'Enter your PIN to continue';
  }
  document.getElementById('pin-screen').style.display = 'flex';
}
function pinKey(d) {
  if (pinBuffer.length >= PIN_LEN) return;
  pinBuffer += d; updateDots();
  if (pinBuffer.length === PIN_LEN) setTimeout(() => handlePinComplete(), 120);
}
function pinDel()    { pinBuffer = pinBuffer.slice(0, -1); updateDots(); clearPinError(); }
function updateDots() {
  for (let i = 0; i < PIN_LEN; i++) {
    const d = document.getElementById('d' + i);
    d.classList.toggle('filled', i < pinBuffer.length);
    d.classList.remove('shake');
  }
}
function handlePinComplete() {
  if (pinMode === 'set') {
    localStorage.setItem(PIN_KEY, simpleHash(pinBuffer));
    pinBuffer = ''; updateDots(); pinMode = 'verify';
    document.getElementById('pin-sub').textContent = 'PIN set! Enter it again to unlock';
    showPinError('PIN saved ✓', '#4ade80');
    setTimeout(() => clearPinError(), 1200);
  } else {
    if (simpleHash(pinBuffer) === localStorage.getItem(PIN_KEY)) {
      sessionStorage.setItem(SESSION_KEY, '1'); unlockApp();
    } else {
      pinBuffer = ''; updateDots();
      showPinError('Incorrect PIN — try again'); shakeDots();
    }
  }
}
function unlockApp() {
  document.getElementById('pin-screen').style.display = 'none';
  document.getElementById('main-app').style.display   = 'block';
}
function showPinError(m, c) { const el = document.getElementById('pin-error'); el.textContent = m; el.style.color = c || 'var(--red)'; }
function clearPinError()    { document.getElementById('pin-error').textContent = ''; }
function shakeDots() {
  const el = document.getElementById('pin-dots'); el.classList.add('shaking');
  for (let i = 0; i < PIN_LEN; i++) document.getElementById('d' + i).classList.add('shake');
  setTimeout(() => {
    el.classList.remove('shaking');
    for (let i = 0; i < PIN_LEN; i++) document.getElementById('d' + i).classList.remove('shake');
  }, 500);
}
function simpleHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}
function resetPin() {
  if (!confirm('Reset PIN? You\'ll set a new one on next reload.')) return;
  localStorage.removeItem(PIN_KEY); sessionStorage.removeItem(SESSION_KEY);
  showToast('PIN reset — reload to set a new one');
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initPin();
  // Refresh stock prices silently in background after app loads
  setTimeout(() => refreshPrices(), 3000);
});
