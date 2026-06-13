const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "backtestLabTrades_v1";

let trades = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

function todayISO(){
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
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
    const tags = [...t.setups, t.fib].filter(Boolean);
    return `
      <div class="trade ${cls}">
        <div class="trade-top">
          <div>
            <div class="trade-title ${cls}">${t.result.toUpperCase()} ${formatR(t.rr)}</div>
            <div class="trade-meta">${t.symbol}・${t.htf}→${t.ltf}・${t.direction}・${t.date || ""}</div>
          </div>
          <div class="trade-actions">
            <button class="icon-btn" onclick="editTrade('${t.id}')">Edit</button>
            <button class="icon-btn" onclick="deleteTrade('${t.id}')">Delete</button>
          </div>
        </div>
        <div class="trade-tags">${tags.map(x => `<span>${x}</span>`).join("")}</div>
        ${t.memo ? `<div class="trade-memo">${escapeHtml(t.memo)}</div>` : ""}
      </div>
    `;
  }).join("");
}

function groupBy(type){
  const map = {};

  const add = (key, trade) => {
    if(!key) return;
    if(!map[key]) map[key] = [];
    map[key].push(trade);
  };

  trades.forEach(t => {
    if(type === "timeframe") add(`${t.htf} → ${t.ltf}`, t);
    if(type === "fib") add(t.fib, t);
    if(type === "direction") add(t.direction, t);
    if(type === "setup"){
      if(!t.setups.length) add("No SMC", t);
      t.setups.forEach(s => add(s, t));
    }
  });

  return map;
}

function renderAnalysis(){
  const type = $("analysisType").value;
  const box = $("analysisList");
  const groups = groupBy(type);
  const rows = Object.entries(groups)
    .map(([key, list]) => ({ key, ...stats(list) }))
    .sort((a,b) => b.total - a.total);

  if(!rows.length){
    box.className = "analysis-list empty";
    box.textContent = "No data yet.";
    return;
  }

  box.className = "analysis-list";
  box.innerHTML = rows.map(r => `
    <div class="analysis-row">
      <div class="analysis-row-top">
        <strong>${r.key}</strong>
        <span>${r.winRate.toFixed(0)}% / ${formatR(r.totalR)} / ${r.total} trades</span>
      </div>
      <div class="bar"><span style="width:${Math.min(r.winRate,100)}%"></span></div>
    </div>
  `).join("");
}

function render(){
  renderDashboard();
  renderHistory();
  renderAnalysis();
}

function resetForm(){
  $("tradeForm").reset();
  $("editingId").value = "";
  $("date").value = todayISO();
  $("symbol").value = "XAUUSD";
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

  const id = $("editingId").value || crypto.randomUUID();
  const trade = {
    id,
    symbol: $("symbol").value.trim() || "XAUUSD",
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

document.querySelectorAll(".quick-pairs button").forEach(btn => {
  btn.addEventListener("click", () => {
    $("htf").value = btn.dataset.htf;
    $("ltf").value = btn.dataset.ltf;
    document.querySelectorAll(".quick-pairs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

$("resetBtn").addEventListener("click", resetForm);
$("analysisType").addEventListener("change", renderAnalysis);
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
