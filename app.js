alert("app.js loaded");
console.log("app.js loaded");

const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "backtestLabTrades_v1";
const SYMBOL_KEY = "backtestLabSymbols_v1";
const DEFAULT_SYMBOLS = ["XAUUSD", "USDJPY", "EURUSD", "GBPUSD", "BTCUSD"];

let trades = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let symbols = JSON.parse(localStorage.getItem(SYMBOL_KEY) || "null") || DEFAULT_SYMBOLS;
let currentUser = null;
let sb = null;
let syncing = false;

const isSupabaseReady = () =>
  typeof SUPABASE_URL !== "undefined" &&
  typeof SUPABASE_ANON_KEY !== "undefined" &&
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  window.supabase;

function initSupabase(){

  console.log("URL:", SUPABASE_URL);
  console.log("KEY exists:", !!SUPABASE_ANON_KEY);
  console.log("Supabase:", window.supabase);

  console.log(
    typeof SUPABASE_URL !== "undefined",
    typeof SUPABASE_ANON_KEY !== "undefined",
    !!SUPABASE_URL,
    !!SUPABASE_ANON_KEY,
    !!window.supabase
  );

  if(!isSupabaseReady()){
    setStatus("Local mode：config.js にSupabase情報を入れると同期できる");
    return;
  }

  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  sb.auth.getSession().then(({data}) => {
    currentUser = data.session?.user || null;
    updateAuthUI();
    if(currentUser) syncAll();
  });

  sb.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    updateAuthUI();
    if(currentUser) syncAll();
  });
}

function setStatus(text){ $("syncStatus").textContent = text; }

function updateAuthUI(){
  if(!sb){
    $("authForm").classList.remove("hidden");
    $("userPanel").classList.add("hidden");
    $("syncBtn").disabled = true;
    return;
  }

  $("syncBtn").disabled = false;

  if(currentUser){
    $("authForm").classList.add("hidden");
    $("userPanel").classList.remove("hidden");
    $("userEmail").textContent = currentUser.email;
    setStatus("Logged in：同期できます");
  }else{
    $("authForm").classList.remove("hidden");
    $("userPanel").classList.add("hidden");
    setStatus("Not logged in：ローカル保存中");
  }
}

function todayISO(){
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}

function saveLocal(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

function saveSymbolsLocal(){
  symbols = [...new Set(symbols.map(s => s.trim().toUpperCase()).filter(Boolean))].sort();
  localStorage.setItem(SYMBOL_KEY, JSON.stringify(symbols));
  renderSymbols();
}

function renderSymbols(){
  $("symbolOptions").innerHTML = symbols.map(s => `<option value="${escapeHtml(s)}"></option>`).join("");
}

async function addSymbol(value, sync = true){
  const symbol = String(value || $("symbol").value || "").trim().toUpperCase();
  if(!symbol) return;
  symbols.push(symbol);
  saveSymbolsLocal();
  $("symbol").value = symbol;

  if(sync && currentUser && sb){
    await sb.from("symbols").upsert({
      user_id: currentUser.id,
      name: symbol,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,name" });
  }
}

function getChecked(name){ return document.querySelector(`input[name="${name}"]:checked`)?.value; }
function getSetups(){ return [...document.querySelectorAll(".chips input:checked")].map(x => x.value); }

function setRadio(name, value){
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if(el) el.checked = true;
}

function setSetups(values){
  document.querySelectorAll(".chips input").forEach(x => x.checked = values.includes(x.value));
}

function formatR(n){
  const v = Number(n || 0);
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`;
}

function maxLossStreak(list){
  let max = 0, cur = 0;
  list.forEach(t => {
    if(t.result === "Loss"){ cur++; max = Math.max(max, cur); }
    else cur = 0;
  });
  return max;
}

function stats(list){
  const total = list.length;
  const wins = list.filter(t => t.result === "Win").length;
  const totalR = list.reduce((sum,t) => sum + Number(t.rr || 0), 0);
  return { total, wins, winRate: total ? wins / total * 100 : 0, totalR, avgR: total ? totalR / total : 0, maxLoss: maxLossStreak(list) };
}

function renderDashboard(){
  const s = stats(trades);
  $("totalR").textContent = formatR(s.totalR);
  $("winRate").textContent = `${s.winRate.toFixed(0)}%`;
  $("avgR").textContent = `${s.avgR.toFixed(2)}R`;
  $("maxLossStreak").textContent = `${s.maxLoss}L`;
  $("tradeCount").textContent = s.total;
}

function resultClass(result){ return result === "Win" ? "win" : result === "Loss" ? "loss" : "be"; }

function renderHistory(){
  const box = $("historyList");
  if(!trades.length){
    box.className = "history-list empty";
    box.textContent = "No trades yet.";
    return;
  }

  box.className = "history-list";
  box.innerHTML = trades.slice().sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).map(t => {
    const cls = resultClass(t.result);
    const tags = [...(t.setups || []), t.fib].filter(Boolean);
    return `
      <div class="trade ${cls}">
        <div class="trade-top">
          <div>
            <div class="trade-title ${cls}">${t.result.toUpperCase()} ${formatR(t.rr)}</div>
            <div class="trade-meta">${escapeHtml(t.symbol)}・${t.htf}→${t.ltf}・${t.direction}・${t.date || ""}</div>
          </div>
          <div class="trade-actions">
            <button class="icon-btn" onclick="editTrade('${t.id}')">Edit</button>
            <button class="icon-btn" onclick="deleteTrade('${t.id}')">Delete</button>
          </div>
        </div>
        <div class="trade-tags">${tags.map(x => `<span>${escapeHtml(x)}</span>`).join("")}</div>
        ${t.memo ? `<div class="trade-memo">${escapeHtml(t.memo)}</div>` : ""}
      </div>
    `;
  }).join("");
}

function renderAnalysis(){
  const box = $("analysisList");

  if(!trades.length){
    box.className = "analysis-list empty";
    box.textContent = "No data yet.";
    return;
  }

  const individualKeys = ["Liquidity Sweep", "CHoCH", "BOS", "FVG", "OB"];
  const individual = individualKeys
    .map(key => {
      const list = trades.filter(t => (t.setups || []).includes(key));
      return { key: key === "Liquidity Sweep" ? "Sweep" : key, ...stats(list) };
    })
    .filter(x => x.total > 0);

  const comboMap = {};
  trades.forEach(t => {
    const setups = (t.setups || []).slice().sort();
    if(setups.length < 2) return;
    const key = setups.map(x => x === "Liquidity Sweep" ? "Sweep" : x).join(" + ");
    if(!comboMap[key]) comboMap[key] = [];
    comboMap[key].push(t);
  });

  const combos = Object.entries(comboMap)
    .map(([key, list]) => ({ key, ...stats(list) }))
    .sort((a,b) => b.winRate - a.winRate || b.total - a.total)
    .slice(0, 8);

  if(!individual.length && !combos.length){
    box.className = "analysis-list empty";
    box.textContent = "SMC条件が入った記録がまだない。";
    return;
  }

  box.className = "analysis-list";
  box.innerHTML = `
    ${individual.length ? `<h3 class="analysis-section-title">Individual</h3>` : ""}
    ${individual.map(analysisRow).join("")}
    ${combos.length ? `<h3 class="analysis-section-title">Top Combinations</h3>` : ""}
    ${combos.map(analysisRow).join("")}
  `;
}

function analysisRow(r){
  return `
    <div class="analysis-row">
      <div class="analysis-row-top">
        <strong>${escapeHtml(r.key)}</strong>
        <span>${r.winRate.toFixed(0)}% / ${r.avgR.toFixed(2)}R avg / ${r.total}</span>
      </div>
      <div class="bar"><span style="width:${Math.min(r.winRate,100)}%"></span></div>
    </div>
  `;
}

function render(){
  renderSymbols();
  renderDashboard();
  renderHistory();
  renderAnalysis();
}

function resetForm(){
  $("tradeForm").reset();
  $("editingId").value = "";
  $("date").value = todayISO();
  $("symbol").value = symbols.includes("XAUUSD") ? "XAUUSD" : (symbols[0] || "");
  $("saveBtn").textContent = "Save Trade";
  document.querySelectorAll(".quick-pairs button").forEach(b => b.classList.remove("active"));
}

function editTrade(id){
  const t = trades.find(x => x.id === id);
  if(!t) return;

  $("editingId").value = t.id;
  $("symbol").value = t.symbol;
  $("date").value = t.date;
  $("htf").value = t.htf;
  $("ltf").value = t.ltf;
  $("rr").value = t.rr;
  $("memo").value = t.memo || "";
  setRadio("direction", t.direction);
  setRadio("fib", t.fib);
  setRadio("result", t.result);
  setSetups(t.setups || []);
  $("saveBtn").textContent = "Update Trade";
  window.scrollTo({top:0, behavior:"smooth"});
}

async function deleteTrade(id){
  if(!confirm("この記録を削除する？")) return;
  trades = trades.filter(t => t.id !== id);
  saveLocal();
  render();

  if(currentUser && sb){
    const { error } = await sb.from("trades").delete().eq("id", id).eq("user_id", currentUser.id);
    if(error) alert("Supabase側の削除に失敗: " + error.message);
  }
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function toDbTrade(t){
  return {
    id: t.id,
    user_id: currentUser.id,
    symbol: t.symbol,
    trade_date: t.date || null,
    htf: t.htf,
    ltf: t.ltf,
    direction: t.direction,
    setups: t.setups || [],
    fib: t.fib,
    result: t.result,
    rr: Number(t.rr || 0),
    memo: t.memo || "",
    created_at: t.createdAt || new Date().toISOString(),
    updated_at: t.updatedAt || new Date().toISOString()
  };
}

function fromDbTrade(t){
  return {
    id: t.id,
    symbol: t.symbol,
    date: t.trade_date || "",
    htf: t.htf,
    ltf: t.ltf,
    direction: t.direction,
    setups: t.setups || [],
    fib: t.fib,
    result: t.result,
    rr: Number(t.rr || 0),
    memo: t.memo || "",
    createdAt: t.created_at,
    updatedAt: t.updated_at
  };
}

async function syncAll(){
  if(syncing || !currentUser || !sb) return;
  syncing = true;
  setStatus("Syncing...");

  try{
    const { data: remoteTrades, error: tradeErr } = await sb.from("trades").select("*").order("created_at", { ascending:false });
    if(tradeErr) throw tradeErr;

    const merged = new Map();

    trades.forEach(t => merged.set(t.id, t));
    (remoteTrades || []).map(fromDbTrade).forEach(rt => {
      const lt = merged.get(rt.id);
      if(!lt || new Date(rt.updatedAt || 0) > new Date(lt.updatedAt || 0)) merged.set(rt.id, rt);
    });

    trades = [...merged.values()];
    saveLocal();

    if(trades.length){
      const { error: upsertErr } = await sb.from("trades").upsert(trades.map(toDbTrade), { onConflict: "id" });
      if(upsertErr) throw upsertErr;
    }

    const { data: remoteSymbols, error: symErr } = await sb.from("symbols").select("name");
    if(symErr) throw symErr;

    symbols = [...symbols, ...(remoteSymbols || []).map(x => x.name)];
    saveSymbolsLocal();

    if(symbols.length){
      const rows = symbols.map(name => ({ user_id: currentUser.id, name, updated_at: new Date().toISOString() }));
      const { error: symUpsertErr } = await sb.from("symbols").upsert(rows, { onConflict: "user_id,name" });
      if(symUpsertErr) throw symUpsertErr;
    }

    setStatus(`Synced：${trades.length} trades`);
    render();
  }catch(err){
    console.error(err);
    setStatus("Sync failed");
    alert("Sync失敗: " + err.message);
  }finally{
    syncing = false;
  }
}

async function exportCSV(){
  if(!trades.length){ alert("Exportするデータがないよ。"); return; }

  const headers = ["date","symbol","htf","ltf","direction","setups","fib","result","rr","memo"];
  const rows = trades.map(t => [t.date,t.symbol,t.htf,t.ltf,t.direction,(t.setups||[]).join(" | "),t.fib,t.result,t.rr,t.memo || ""]);
  const csv = [headers, ...rows].map(row => row.map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backtest-lab-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

$("tradeForm").addEventListener("submit", async e => {
  e.preventDefault();

  const now = new Date().toISOString();
  const symbol = $("symbol").value.trim().toUpperCase() || "XAUUSD";
  await addSymbol(symbol, false);

  const id = $("editingId").value || crypto.randomUUID();
  const old = trades.find(t => t.id === id);

  const trade = {
    id,
    symbol,
    date: $("date").value,
    htf: $("htf").value,
    ltf: $("ltf").value,
    direction: getChecked("direction"),
    setups: getSetups(),
    fib: getChecked("fib"),
    result: getChecked("result"),
    rr: Number($("rr").value),
    memo: $("memo").value.trim(),
    createdAt: old?.createdAt || now,
    updatedAt: now
  };

  trades = old ? trades.map(t => t.id === id ? trade : t) : [...trades, trade];
  saveLocal();
  resetForm();
  render();

  if(currentUser && sb){
    const { error } = await sb.from("trades").upsert(toDbTrade(trade), { onConflict: "id" });
    if(error) alert("Supabase保存に失敗: " + error.message);
    else await syncAll();
  }
});

$("addSymbolBtn").addEventListener("click", () => addSymbol());
$("syncBtn").addEventListener("click", syncAll);
$("exportBtn").addEventListener("click", exportCSV);
$("resetBtn").addEventListener("click", resetForm);

$("loginBtn").addEventListener("click", async () => {
  if(!sb) return alert("config.js にSupabase情報を入れてね。");
  const email = $("email").value.trim();
  const password = $("password").value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if(error) alert("Login失敗: " + error.message);
});

$("signupBtn").addEventListener("click", async () => {
  if(!sb) return alert("config.js にSupabase情報を入れてね。");
  const email = $("email").value.trim();
  const password = $("password").value;
  const { error } = await sb.auth.signUp({ email, password });
  if(error) alert("Sign up失敗: " + error.message);
  else alert("確認メールが来る場合は、メールを確認してからLoginしてね。");
});

$("logoutBtn").addEventListener("click", async () => {
  if(sb) await sb.auth.signOut();
});

$("clearBtn").addEventListener("click", async () => {
  if(!trades.length) return;
  if(!confirm("全部削除する？Supabaseログイン中ならクラウド側も削除されるよ。")) return;

  const ids = trades.map(t => t.id);
  trades = [];
  saveLocal();
  render();

  if(currentUser && sb && ids.length){
    const { error } = await sb.from("trades").delete().in("id", ids).eq("user_id", currentUser.id);
    if(error) alert("Supabase側の全削除に失敗: " + error.message);
  }
});

document.querySelectorAll(".quick-pairs button").forEach(btn => {
  btn.addEventListener("click", () => {
    $("htf").value = btn.dataset.htf;
    $("ltf").value = btn.dataset.ltf;
    document.querySelectorAll(".quick-pairs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

initSupabase();
resetForm();
render();
