// SpendAgent v3 — app.js
// Supports: BofA CSV, SoFi savings CSV, manual notifications, investments P&L

const STORAGE_KEY   = 'spendagent-txns';
const SAVINGS_KEY   = 'spendagent-savings';
const INVEST_KEY    = 'spendagent-investments';
const GOAL_KEY      = 'spendagent-goal';
const API_KEY_KEY   = 'spendagent-apikey';
const PIN_KEY       = 'spendagent-pin';
const SESSION_KEY   = 'spendagent-unlocked';
const MONTHS        = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CAT_COLORS    = ['#7c6dfa','#4ecdc4','#fbbf24','#f87171','#4ade80','#fb923c','#e879f9','#38bdf8'];
const CAT_ICONS     = {
  Dining:'🍽',Groceries:'🛒',Transport:'⛽',Shopping:'📦',
  Health:'💊',Utilities:'💡',Entertainment:'🎬',
  Transfer:'💸',Reimbursement:'🤝',Income:'💰',Other:'💳'
};

let transactions = [];
let savingsTxns  = [];
let investments  = [];
let selectedMonth = null;

// ── Storage ───────────────────────────────────────────────────────────────────
function loadData() {
  try { transactions = JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); } catch(e){transactions=[];}
  try { savingsTxns  = JSON.parse(localStorage.getItem(SAVINGS_KEY)||'[]'); } catch(e){savingsTxns=[];}
  try { investments  = JSON.parse(localStorage.getItem(INVEST_KEY)||'[]');  } catch(e){investments=[];}
  renderAll();
  loadApiKeyStatus();
}

function saveAll() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  localStorage.setItem(SAVINGS_KEY, JSON.stringify(savingsTxns));
  localStorage.setItem(INVEST_KEY,  JSON.stringify(investments));
}

// ── API Key ───────────────────────────────────────────────────────────────────
function getApiKey(){return localStorage.getItem(API_KEY_KEY)||'';}
function saveApiKey(){
  const k=document.getElementById('api-key-input').value.trim();
  if(!k.startsWith('sk-ant-')){showToast('Key must start with sk-ant-',true);return;}
  localStorage.setItem(API_KEY_KEY,k);
  document.getElementById('api-key-input').value='';
  loadApiKeyStatus(); showToast('API key saved');
}
function clearApiKey(){
  localStorage.removeItem(API_KEY_KEY);
  document.getElementById('api-key-input').value='';
  loadApiKeyStatus(); showToast('API key cleared');
}
function loadApiKeyStatus(){
  const k=getApiKey(), el=document.getElementById('key-status');
  if(!el)return;
  el.textContent=k?'✓ Key saved: '+k.slice(0,14)+'…':'No key saved yet.';
  el.style.color=k?'#4ade80':'#6b6b7a';
}

// ── Months ────────────────────────────────────────────────────────────────────
function getAvailableMonths(){
  const s=new Set();
  transactions.forEach(t=>{if(t.date)s.add(t.date.slice(0,7));});
  return [...s].sort().reverse();
}
function filteredTxns(){
  if(!selectedMonth)return transactions;
  return transactions.filter(t=>t.date&&t.date.startsWith(selectedMonth));
}
function selectMonth(m,el){
  selectedMonth=m;
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
  if(el)el.classList.add('active');
  renderDashboard();
}

// ── Render All ────────────────────────────────────────────────────────────────
function renderAll(){
  renderMonthChips();
  renderDashboard();
  renderSavings();
  renderInvestments();
  updateBadge();
  updateSavedCount();
}

function updateBadge(){
  const el=document.getElementById('tx-badge');
  if(el) el.textContent=transactions.length+' transaction'+(transactions.length!==1?'s':'');
}
function updateSavedCount(){
  const el=document.getElementById('saved-count');
  if(el) el.textContent=transactions.length+' transactions · '+savingsTxns.length+' savings entries · '+investments.length+' holdings';
}

function renderMonthChips(){
  const months=getAvailableMonths(), el=document.getElementById('month-chips');
  if(!el)return;
  if(!months.length){el.innerHTML='';return;}
  if(!selectedMonth||!months.includes(selectedMonth))selectedMonth=months[0];
  el.innerHTML=months.map(m=>{
    const[y,mo]=m.split('-');
    return`<button class="chip ${m===selectedMonth?'active':''}" onclick="selectMonth('${m}',this)">${MONTHS[parseInt(mo)-1]} ${y}</button>`;
  }).join('');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard(){
  const txns   = filteredTxns();
  const debits = txns.filter(t=>t.type==='debit');
  const credits= txns.filter(t=>t.type==='credit');
  const spent  = debits.reduce((s,t)=>s+(t.amount||0),0);
  const rcvd   = credits.reduce((s,t)=>s+(t.amount||0),0);
  const net    = rcvd-spent;

  // savings balance = last entry
  const savBal = savingsTxns.length ? savingsTxns[savingsTxns.length-1].balance||0 : 0;
  // investment portfolio value
  const portVal= investments.reduce((s,i)=>s+(i.shares*(i.currentPrice||0)),0);
  const portCost=investments.reduce((s,i)=>s+(i.shares*(i.costBasis||0)),0);

  setText('m-total',  fmt(spent));
  setText('m-credit', fmt(rcvd));
  setText('m-net',    (net>=0?'+':'')+fmt(Math.abs(net)));
  document.getElementById('m-net').style.color=net>=0?'#4ade80':'#f87171';
  setText('m-count',  txns.length);
  setText('m-savings',fmt(savBal));
  setText('m-invest', fmt(portVal));

  const pnl=portVal-portCost;
  const pct=portCost>0?((pnl/portCost)*100).toFixed(1)+'%':'—';
  setText('m-idelta', (pnl>=0?'▲ +':' ▼ ')+fmt(Math.abs(pnl))+' ('+pct+')');
  document.getElementById('m-idelta').style.color=pnl>=0?'#4ade80':'#f87171';

  // Category bars
  const cats={};
  debits.forEach(t=>{const c=t.category||'Other';cats[c]=(cats[c]||0)+(t.amount||0);});
  const sorted=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const barsEl=document.getElementById('cat-bars');
  if(!sorted.length){
    barsEl.innerHTML='<div class="empty"><div class="empty-icon">📊</div><p>No expenses yet.<br>Upload your BofA CSV to get started.</p></div>';
  } else {
    setText('m-top',   sorted[0][0]);
    setText('m-tdelta','$'+sorted[0][1].toFixed(2));
    const max=sorted[0][1];
    barsEl.innerHTML=sorted.map(([cat,amt],i)=>`
      <div class="bar-row">
        <div class="bar-cat">${cat}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(amt/max*100)}%;background:${CAT_COLORS[i%CAT_COLORS.length]}"></div></div>
        <div class="bar-amt">$${amt.toFixed(0)}</div>
      </div>`).join('');
  }

  // Recent transactions
  const txnEl=document.getElementById('txn-list');
  const recent=[...txns].reverse().slice(0,12);
  if(!recent.length){
    txnEl.innerHTML='<div class="empty"><div class="empty-icon">🧾</div><p>Transactions will appear here.</p></div>';
  } else {
    txnEl.innerHTML=recent.map(t=>{
      const isCr=t.type==='credit';
      return`<div class="txn">
        <div class="txn-icon">${CAT_ICONS[t.category]||'💳'}</div>
        <div style="flex:1;min-width:0">
          <div class="txn-name">${esc(t.merchant||'Unknown')}</div>
          <div class="txn-meta">${t.date||''} · ${isCr?'Credit':'Debit'}</div>
        </div>
        <div class="txn-right">
          <div class="txn-cat">${esc(t.category||'Other')}</div>
          <div class="txn-amt" style="color:${isCr?'#4ade80':'#f87171'}">${isCr?'+':'-'}$${(t.amount||0).toFixed(2)}</div>
        </div>
      </div>`;
    }).join('');
  }
}

// ── Savings ───────────────────────────────────────────────────────────────────
function renderSavings(){
  const deposits  = savingsTxns.filter(t=>t.type==='deposit').reduce((s,t)=>s+(t.amount||0),0);
  const interest  = savingsTxns.filter(t=>t.type==='interest').reduce((s,t)=>s+(t.amount||0),0);
  const balance   = savingsTxns.length ? savingsTxns[savingsTxns.length-1].balance||0 : 0;

  setText('s-balance',  fmt(balance));
  setText('s-interest', fmt(interest));
  setText('s-deposits', fmt(deposits));

  const listEl=document.getElementById('savings-list');
  if(!savingsTxns.length){
    listEl.innerHTML='<div class="empty"><div class="empty-icon">🏦</div><p>Upload your SoFi CSV to see savings activity.</p></div>';
  } else {
    listEl.innerHTML=[...savingsTxns].reverse().slice(0,10).map(t=>`
      <div class="txn">
        <div class="txn-icon">${t.type==='interest'?'💹':t.type==='deposit'?'⬆️':'⬇️'}</div>
        <div style="flex:1;min-width:0">
          <div class="txn-name">${esc(t.description||t.type)}</div>
          <div class="txn-meta">${t.date||''}</div>
        </div>
        <div class="txn-right">
          <div class="txn-cat">${t.type}</div>
          <div class="txn-amt" style="color:#4ade80">+$${(t.amount||0).toFixed(2)}</div>
        </div>
      </div>`).join('');
  }

  // Goal bar
  const goal=parseFloat(localStorage.getItem(GOAL_KEY)||0);
  if(goal>0){
    const pct=Math.min(100,Math.round(balance/goal*100));
    const barEl=document.getElementById('savings-goal-bar');
    if(barEl){
      barEl.style.display='block';
      setText('goal-label',fmt(balance)+' of '+fmt(goal));
      setText('goal-pct',pct+'%');
      const fill=document.getElementById('goal-fill');
      if(fill)fill.style.width=pct+'%';
    }
    // pre-fill input
    const inp=document.getElementById('savings-goal');
    if(inp&&!inp.value)inp.value=goal;
  }
}

function saveSavingsGoal(){
  const v=parseFloat(document.getElementById('savings-goal').value);
  if(!v||v<=0){showToast('Enter a valid goal amount',true);return;}
  localStorage.setItem(GOAL_KEY,v);
  renderSavings();
  showToast('Savings goal set to '+fmt(v));
}

// ── Investments ───────────────────────────────────────────────────────────────
function renderInvestments(){
  const portVal  = investments.reduce((s,i)=>s+(i.shares*(i.currentPrice||0)),0);
  const portCost = investments.reduce((s,i)=>s+(i.shares*(i.costBasis||0)),0);
  const pnl      = portVal-portCost;
  const pct      = portCost>0?((pnl/portCost)*100).toFixed(1):'0';

  setText('i-value', fmt(portVal));
  setText('i-cost',  fmt(portCost));
  setText('i-pl',    (pnl>=0?'+':'')+fmt(pnl));
  document.getElementById('i-pl').style.color=pnl>=0?'#4ade80':'#f87171';
  setText('i-pct',   (pnl>=0?'▲':' ▼')+' '+pct+'% total return');
  document.getElementById('i-pct').style.color=pnl>=0?'#4ade80':'#f87171';

  const listEl=document.getElementById('holdings-list');
  const plEl  =document.getElementById('pl-bars');
  if(!investments.length){
    listEl.innerHTML='<div class="empty"><div class="empty-icon">📈</div><p>Add your holdings above.</p></div>';
    plEl.innerHTML  ='<div class="empty"><div class="empty-icon">💹</div><p>Add holdings to see P&L.</p></div>';
    return;
  }

  listEl.innerHTML=investments.map((inv,idx)=>{
    const val=(inv.shares*(inv.currentPrice||0));
    const cost=(inv.shares*(inv.costBasis||0));
    const pl=val-cost;
    const pct=cost>0?((pl/cost)*100).toFixed(1):'0';
    return`<div class="holding">
      <div>
        <div class="holding-ticker">${esc(inv.ticker)}</div>
        <div class="holding-detail">${inv.shares} shares @ $${(inv.costBasis||0).toFixed(2)} avg</div>
      </div>
      <div class="holding-right">
        <div class="holding-val">${fmt(val)}</div>
        <div class="holding-pl" style="color:${pl>=0?'#4ade80':'#f87171'}">${pl>=0?'+':''} $${pl.toFixed(2)} (${pct}%)</div>
      </div>
      <button onclick="removeHolding(${idx})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;margin-left:8px">×</button>
    </div>`;
  }).join('');

  // P&L bars
  const maxAbs=Math.max(...investments.map(i=>Math.abs((i.shares*(i.currentPrice||0))-(i.shares*(i.costBasis||0)))),1);
  plEl.innerHTML=investments.map(inv=>{
    const pl=(inv.shares*(inv.currentPrice||0))-(inv.shares*(inv.costBasis||0));
    const w=Math.round(Math.abs(pl)/maxAbs*100);
    const color=pl>=0?'#4ade80':'#f87171';
    return`<div class="bar-row">
      <div class="bar-cat">${esc(inv.ticker)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${color}"></div></div>
      <div class="bar-amt" style="color:${color}">${pl>=0?'+':''}$${pl.toFixed(0)}</div>
    </div>`;
  }).join('');
}

function addInvestment(){
  const ticker=(document.getElementById('i-ticker').value||'').trim().toUpperCase();
  const shares=parseFloat(document.getElementById('i-shares').value);
  const cost  =parseFloat(document.getElementById('i-cost-basis').value);
  const curr  =parseFloat(document.getElementById('i-current').value);
  if(!ticker||!shares||!cost||!curr){showToast('Fill in all fields',true);return;}
  investments.push({ticker,shares,costBasis:cost,currentPrice:curr,id:Date.now()});
  saveAll(); renderInvestments();
  ['i-ticker','i-shares','i-cost-basis','i-current'].forEach(id=>document.getElementById(id).value='');
  showToast('✓ '+ticker+' added');
}

function removeHolding(idx){
  if(!confirm('Remove this holding?'))return;
  investments.splice(idx,1);
  saveAll(); renderInvestments();
  showToast('Holding removed');
}

// ── BofA CSV Parser ───────────────────────────────────────────────────────────
async function handleBofaCSV(input){
  const file=input.files[0]; if(!file)return;
  const text=await file.text();
  const apiKey=getApiKey();
  if(!apiKey){showToast('Add your API key in Settings first',true);return;}

  const loader=document.getElementById('csv-loader');
  loader.classList.add('active');

  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:4000,
        system:`You are a bank CSV parser for Bank of America statements. Parse ALL rows and return ONLY a JSON array — no markdown, no explanation.

Each transaction object:
- merchant: string (clean description, remove codes/numbers)
- amount: number (positive float)
- date: string YYYY-MM-DD
- type: "debit" (money out — purchases, payments, withdrawals) or "credit" (money in — deposits, refunds, Zelle received, transfers in)
- category: for debits: Dining/Groceries/Transport/Shopping/Health/Utilities/Entertainment/Transfer/Other. For credits: Reimbursement/Income/Transfer/Other

BofA CSV columns are typically: Date, Description, Amount, Running Bal.
Negative amounts = debit (money out). Positive amounts = credit (money in).
Return [] if no transactions found.`,
        messages:[{role:'user',content:`Parse this BofA CSV:\n\n${text.slice(0,12000)}`}]
      })
    });
    if(!res.ok)throw new Error('API error '+res.status);
    const data=await res.json();
    const raw=(data.content?.[0]?.text||'[]').replace(/```json|```/g,'').trim();
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)||!parsed.length){showToast('No transactions found in CSV',true);}
    else{
      parsed.forEach(t=>{t.id=Date.now()+'-'+Math.random().toString(36).slice(2);});
      transactions=[...transactions,...parsed];
      saveAll(); renderAll();
      const d=parsed.filter(t=>t.type==='debit').length;
      const c=parsed.filter(t=>t.type==='credit').length;
      showToast(`✓ ${parsed.length} transactions: ${d} debits, ${c} credits`);
    }
  }catch(e){showToast('Error: '+(e.message||'Try again'),true);}
  loader.classList.remove('active');
  input.value='';
}

// ── SoFi CSV Parser ───────────────────────────────────────────────────────────
async function handleSofiCSV(input){
  const file=input.files[0]; if(!file)return;
  const text=await file.text();
  const apiKey=getApiKey();
  if(!apiKey){showToast('Add your API key in Settings first',true);return;}

  const loader=document.getElementById('sofi-loader');
  loader.classList.add('active');

  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:4000,
        system:`You are a SoFi savings account CSV parser. Parse all rows and return ONLY a JSON array — no markdown.

Each entry:
- date: YYYY-MM-DD
- description: string (clean description)
- amount: number (positive)
- type: "deposit" / "withdrawal" / "interest" / "other"
- balance: number (running balance if available, else 0)

Return [] if nothing found.`,
        messages:[{role:'user',content:`Parse this SoFi CSV:\n\n${text.slice(0,12000)}`}]
      })
    });
    if(!res.ok)throw new Error('API error '+res.status);
    const data=await res.json();
    const raw=(data.content?.[0]?.text||'[]').replace(/```json|```/g,'').trim();
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)||!parsed.length){showToast('No data found in SoFi CSV',true);}
    else{
      parsed.forEach(t=>{t.id=Date.now()+'-'+Math.random().toString(36).slice(2);});
      savingsTxns=[...savingsTxns,...parsed];
      saveAll(); renderSavings();
      showToast(`✓ ${parsed.length} savings entries imported`);
    }
  }catch(e){showToast('Error: '+(e.message||'Try again'),true);}
  loader.classList.remove('active');
  input.value='';
}

// ── Manual notification parser ────────────────────────────────────────────────
async function parseNotifications(){
  const text=document.getElementById('notif-input').value.trim();
  if(!text){showToast('Paste some notifications first',true);return;}
  const apiKey=getApiKey();
  if(!apiKey){showToast('Add your API key in Settings first',true);return;}

  const loader=document.getElementById('parse-loader');
  loader.classList.add('active');

  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:1500,
        system:`Parse bank notifications and return ONLY a JSON array — no markdown.
Each object: merchant(string), amount(number), date(YYYY-MM-DD, year ${new Date().getFullYear()} if missing), type("debit" or "credit"), category(Dining/Groceries/Transport/Shopping/Health/Utilities/Entertainment/Transfer/Reimbursement/Income/Other).
Credits = money received (Zelle in, refunds, deposits). Debits = money spent.
Return [].`,
        messages:[{role:'user',content:text}]
      })
    });
    if(!res.ok)throw new Error('API error '+res.status);
    const data=await res.json();
    const raw=(data.content?.[0]?.text||'[]').replace(/```json|```/g,'').trim();
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)||!parsed.length){showToast('No transactions found',true);}
    else{
      parsed.forEach(t=>{t.id=Date.now()+'-'+Math.random().toString(36).slice(2);});
      transactions=[...transactions,...parsed];
      saveAll(); renderAll();
      document.getElementById('notif-input').value='';
      const d=parsed.filter(t=>t.type==='debit').length;
      const c=parsed.filter(t=>t.type==='credit').length;
      showToast(`✓ Saved: ${d} debit${d!==1?'s':''}, ${c} credit${c!==1?'s':''}`);
    }
  }catch(e){showToast('Error: '+(e.message||'Try again'),true);}
  loader.classList.remove('active');
}

// ── AI Insights ───────────────────────────────────────────────────────────────
async function getInsights(){
  if(!transactions.length&&!savingsTxns.length&&!investments.length){showToast('Add some data first',true);return;}
  const apiKey=getApiKey();
  if(!apiKey){showToast('Add your API key in Settings first',true);return;}

  const loader=document.getElementById('insight-loader');
  loader.classList.add('active');
  document.getElementById('insights-body').innerHTML='';

  const txns   =filteredTxns();
  const spent  =txns.filter(t=>t.type==='debit').reduce((s,t)=>s+(t.amount||0),0);
  const rcvd   =txns.filter(t=>t.type==='credit').reduce((s,t)=>s+(t.amount||0),0);
  const savBal =savingsTxns.length?savingsTxns[savingsTxns.length-1].balance||0:0;
  const portVal=investments.reduce((s,i)=>s+(i.shares*(i.currentPrice||0)),0);
  const portCost=investments.reduce((s,i)=>s+(i.shares*(i.costBasis||0)),0);
  const txSummary=txns.slice(-30).map(t=>`${t.date}|${t.type}|${t.merchant}|$${t.amount}|${t.category}`).join('\n');
  const invSummary=investments.map(i=>`${i.ticker}: ${i.shares}sh @ $${i.costBasis} avg, now $${i.currentPrice}`).join('\n');

  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:1500,
        system:`You are a personal finance advisor. Analyze spending, savings, and investments holistically. Return ONLY a JSON array — no markdown.
Each: { "color": one of "#7c6dfa","#4ecdc4","#fbbf24","#f87171","#4ade80", "text": "insight with <strong>key figure</strong> highlighted" }
Give 6 insights covering: top spending categories, savings rate vs spending, investment P&L highlights, reimbursements received, net cash flow, and one actionable tip. Be specific with real numbers.`,
        messages:[{role:'user',content:`Spending: $${spent.toFixed(2)} out, $${rcvd.toFixed(2)} in.\nSoFi savings balance: $${savBal.toFixed(2)}.\nPortfolio: $${portVal.toFixed(2)} value vs $${portCost.toFixed(2)} invested.\n\nTransactions:\n${txSummary}\n\nHoldings:\n${invSummary}`}]
      })
    });
    if(!res.ok)throw new Error('API error '+res.status);
    const data=await res.json();
    const raw=(data.content?.[0]?.text||'[]').replace(/```json|```/g,'').trim();
    const insights=JSON.parse(raw);
    document.getElementById('insights-body').innerHTML=insights.map(i=>
      `<div class="insight"><div class="insight-dot" style="background:${esc(i.color)}"></div><div class="insight-text">${i.text}</div></div>`
    ).join('');
  }catch(e){
    document.getElementById('insights-body').innerHTML='<div class="empty"><p>Could not load insights. Check your API key.</p></div>';
  }
  loader.classList.remove('active');
}

// ── Export ────────────────────────────────────────────────────────────────────
function exportCSV(){
  const rows=[['Date','Type','Merchant','Amount','Category'],...transactions.map(t=>[t.date,t.type,t.merchant,t.amount,t.category])];
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='spendagent-backup.csv'; a.click();
}

function clearAll(){
  if(!confirm('Delete ALL data — transactions, savings and investments? This cannot be undone.'))return;
  transactions=[]; savingsTxns=[]; investments=[]; selectedMonth=null;
  [STORAGE_KEY,SAVINGS_KEY,INVEST_KEY,GOAL_KEY].forEach(k=>localStorage.removeItem(k));
  renderAll(); showToast('All data cleared');
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function fmt(n){return '$'+(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function showToast(msg,isError=false){
  const t=document.getElementById('toast');
  t.textContent=msg; t.style.borderColor=isError?'#f87171':'#4ade80'; t.style.color=isError?'#f87171':'#4ade80';
  t.style.display='block'; clearTimeout(t._timer); t._timer=setTimeout(()=>t.style.display='none',3000);
}
function switchTab(name,el){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const p=document.getElementById('tab-'+name); if(p)p.classList.add('active'); if(el)el.classList.add('active');
}

// ── PIN ───────────────────────────────────────────────────────────────────────
const PIN_LEN=4; let pinBuffer=''; let pinMode='verify';
function initPin(){
  if(sessionStorage.getItem(SESSION_KEY)==='1'){unlockApp();return;}
  const saved=localStorage.getItem(PIN_KEY);
  if(!saved){pinMode='set';document.getElementById('pin-sub').textContent='Create a 4-digit PIN';document.getElementById('pin-hint').textContent='You\'ll use this every time you open the app.';}
  else{pinMode='verify';document.getElementById('pin-sub').textContent='Enter your PIN to continue';}
  document.getElementById('pin-screen').style.display='flex';
}
function pinKey(d){if(pinBuffer.length>=PIN_LEN)return;pinBuffer+=d;updateDots();if(pinBuffer.length===PIN_LEN)setTimeout(()=>handlePinComplete(),120);}
function pinDel(){pinBuffer=pinBuffer.slice(0,-1);updateDots();clearPinError();}
function updateDots(){for(let i=0;i<PIN_LEN;i++){const d=document.getElementById('d'+i);d.classList.toggle('filled',i<pinBuffer.length);d.classList.remove('shake');}}
function handlePinComplete(){
  if(pinMode==='set'){localStorage.setItem(PIN_KEY,simpleHash(pinBuffer));pinBuffer='';updateDots();pinMode='verify';document.getElementById('pin-sub').textContent='PIN set! Enter it again to unlock';showPinError('PIN saved ✓','#4ade80');setTimeout(()=>clearPinError(),1200);}
  else{if(simpleHash(pinBuffer)===localStorage.getItem(PIN_KEY)){sessionStorage.setItem(SESSION_KEY,'1');unlockApp();}else{pinBuffer='';updateDots();showPinError('Incorrect PIN — try again');shakeDots();}}
}
function unlockApp(){document.getElementById('pin-screen').style.display='none';document.getElementById('main-app').style.display='block';}
function showPinError(m,c){const el=document.getElementById('pin-error');el.textContent=m;el.style.color=c||'var(--red)';}
function clearPinError(){document.getElementById('pin-error').textContent='';}
function shakeDots(){const el=document.getElementById('pin-dots');el.classList.add('shaking');for(let i=0;i<PIN_LEN;i++)document.getElementById('d'+i).classList.add('shake');setTimeout(()=>{el.classList.remove('shaking');for(let i=0;i<PIN_LEN;i++)document.getElementById('d'+i).classList.remove('shake');},500);}
function simpleHash(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16);}
function resetPin(){if(!confirm('Reset PIN?'))return;localStorage.removeItem(PIN_KEY);sessionStorage.removeItem(SESSION_KEY);showToast('PIN reset — reload to set a new one');}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{loadData();initPin();});
