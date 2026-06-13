const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "backtestLabTrades_v1";
const SYMBOL_KEY = "backtestLabSymbols_v1";
const DEFAULT_SYMBOLS = ["XAUUSD", "USDJPY", "EURUSD", "GBPUSD", "BTCUSD"];

let trades = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let symbols = JSON.parse(localStorage.getItem(SYMBOL_KEY) || "null") || DEFAULT_SYMBOLS;

function todayISO(){
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

function saveSymbols(){
  symbols = [...new Set(symbols.map(s => s.trim().toUpperCase()).filter(Boolean))].sort();
  localStorage.setItem(SYMBOL_KEY, JSON.stringify(symbols));
  renderSymbols();
}

function renderSymbols(){
  $("symbolOptions").innerHTML = symbols.map(s => `<option value="${escapeHtml(s)}"></option>`).join("");
}

function addSymbol(value){
  const symbol = String(value || $("symbol").value || "").trim().toUpperCase();
  if(!symbol) return;
  symbols.push(symbol);
  saveSymbols();
  $("symbol").value = symbol;
}

function getChecked(name){
  return document.querySelector(`input[name="${name}"]:checked`)?.value;
}

function getSetups(){
  return [...document.querySelectorAll(".chips input:checked")].map(x => x.value);
}

function setRadio(name, value){
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if(el) el.checked = true;
}

function setSetups(values){
  document.querySelectorAll(".chips input").forEach(x => {
    x.checked = values.includes(x.value);
  });
}

function formatR(n){
  const v = Number(n || 0);
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`;
}

function maxLossStreak(list){
  let max = 0, cur = 0;
  list.forEach(t => {
    if(t.result === "Loss"){
      cur++;
      max = Math.max(max, cur);
    }else{
      cur = 0;
    }
  });
  return max;
}

function stats(list){
  const total = list.length;
  const wins = list.filter(t => t.result === "Win").length;
  const totalR = list.reduce((sum,t) => sum + Number(t.rr || 0), 0);
  return {
    total,
    wins,
    winRate: total ? wins / total * 100 : 0,
    totalR,
    avgR: total ? totalR / total : 0,
    maxLoss: maxLossStreak(list)
  };
}

function renderDashboard(){
  const s = stats(trades);
  $("totalR").textContent = formatR(s.totalR);
  $("winRate").textContent = `${s.winRate.toFixed(0)}%`;
  $("avgR").textContent = `${s.avgR.toFixed(2)}R`;
  $("maxLossStreak").textContent = `${s.maxLoss}L`;
  $("tradeCount").textContent = s.total;
}

function resultClass(result){
  return result === "Win" ? "win" : result === "Loss" ? "loss" : "be";
}

function renderHistory(){
  const box = $("historyList");
  if(!trades.length){
    box.className = "history-list empty";
    box.textContent = "No trades yet.";
    return;
  }

  box.className = "history-list";
  box.innerHTML = trades.slice().reverse().map(t => {
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

function deleteTrade(id){
  if(!confirm("この記録を削除する？")) return;
  trades = trades.filter(t => t.id !== id);
  save();
  render();
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function exportCSV(){
  if(!trades.length){
    alert("Exportするデータがないよ。");
    return;
  }

  const headers = ["date","symbol","htf","ltf","direction","setups","fib","result","rr","memo"];
  const rows = trades.map(t => [
    t.date,t.symbol,t.htf,t.ltf,t.direction,(t.setups||[]).join(" | "),t.fib,t.result,t.rr,t.memo || ""
  ]);

  const csv = [headers, ...rows].map(row =>
    row.map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(",")
  ).join("\n");

  const blob = new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backtest-lab-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

$("tradeForm").addEventListener("submit", e => {
  e.preventDefault();

  const symbol = $("symbol").value.trim().toUpperCase() || "XAUUSD";
  addSymbol(symbol);

  const id = $("editingId").value || crypto.randomUUID();
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
    createdAt: new Date().toISOString()
  };

  const editing = trades.some(t => t.id === id);
  trades = editing ? trades.map(t => t.id === id ? trade : t) : [...trades, trade];

  save();
  resetForm();
  render();
});

$("addSymbolBtn").addEventListener("click", () => addSymbol());

document.querySelectorAll(".quick-pairs button").forEach(btn => {
  btn.addEventListener("click", () => {
    $("htf").value = btn.dataset.htf;
    $("ltf").value = btn.dataset.ltf;
    document.querySelectorAll(".quick-pairs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

$("resetBtn").addEventListener("click", resetForm);
$("exportBtn").addEventListener("click", exportCSV);

$("clearBtn").addEventListener("click", () => {
  if(!trades.length) return;
  if(!confirm("全部削除する？戻せないよ。")) return;
  trades = [];
  save();
  render();
});

if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

resetForm();
render();
