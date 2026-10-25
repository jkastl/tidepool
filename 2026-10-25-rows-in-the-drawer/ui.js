import { TABLES, QUERIES, runVariant, tablesSql, isNull } from "./lab.js";

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage off: nothing to keep */ } },
};

// ---------- cards ----------

const ALIAS = { c: "cases", s: "slides", sc: "scans" };

function fieldRow(k, v, opts = {}) {
  const row = el("div", "f" + (opts.added ? " f-added" : ""));
  const dot = k.indexOf(".");
  const key = el("span", "k");
  if (dot > 0) {
    const a = k.slice(0, dot);
    const tag = el("span", "alias alias-" + a, a);
    tag.title = ALIAS[a] || a;
    key.append(tag, k.slice(dot + 1));
  } else key.textContent = k;
  const val = el("span", "v" + (isNull(v) ? " null" : ""), isNull(v) ? "NULL" : String(v));
  row.append(key, val);
  return row;
}

function card(row, cols, extra = {}) {
  const c = el("div", "card");
  if (row.nullfill) c.classList.add("nullfill");
  if (extra.verdict !== undefined) c.classList.add(extra.verdict === true ? "v-true" : extra.verdict === false ? "v-false" : "v-unknown");
  if (extra.summary) c.classList.add("summary");
  for (const k of cols(row)) c.append(fieldRow(k, row.v[k], { added: row.added && row.added.includes(k) }));
  if (row.copies > 1) c.append(el("div", "badge", `one of ${row.copies} copies`));
  if (row.nullfill) c.append(el("div", "badge badge-null", "no match: NULLs"));
  if (extra.verdict !== undefined) {
    const word = extra.verdict === true ? "TRUE" : extra.verdict === false ? "FALSE" : "UNKNOWN";
    c.append(el("div", "stamp", word));
    if (extra.why) c.append(el("div", "why", extra.why));
  }
  return c;
}

// ---------- drawers ----------

function renderDrawers() {
  const host = $("#drawers");
  for (const [name, t] of Object.entries(TABLES)) {
    const d = el("details", "drawer");
    if (name === "slides") d.open = true;
    const sum = el("summary", "drawer-front");
    const plate = el("span", "plate");
    plate.append(el("span", "plate-name", name), el("span", "plate-count", `${t.rows.length} cards`));
    sum.append(plate, el("span", "pull"));
    d.append(sum);
    const body = el("div", "drawer-body");
    t.rows.forEach((r) => {
      const v = {};
      t.cols.forEach((c, i) => (v[c] = r[i]));
      body.append(card({ v }, () => t.cols));
    });
    d.append(body);
    host.append(d);
  }
}

// ---------- the stepper ----------

const state = { q: 0, variant: 0, step: 0, runs: null };

function loadState() {
  const saved = store.get("ritd-stepper");
  if (!saved) return;
  try {
    const s = JSON.parse(saved);
    if (QUERIES[s.q]) state.q = s.q;
    if (s.variant === 0 || s.variant === 1) state.variant = s.variant;
  } catch { /* ignore a bad saved value */ }
}
const saveState = () => store.set("ritd-stepper", JSON.stringify({ q: state.q, variant: state.variant }));

function computeRuns() {
  state.runs = QUERIES[state.q].variants.map(runVariant);
}

function renderTabs() {
  const host = $("#qtabs");
  host.innerHTML = "";
  QUERIES.forEach((q, i) => {
    const b = el("button", "qtab", q.title);
    b.type = "button";
    b.setAttribute("aria-pressed", String(i === state.q));
    b.addEventListener("click", () => {
      state.q = i; state.variant = 0; state.step = 0;
      computeRuns(); saveState(); renderAll();
    });
    host.append(b);
  });
}

function renderVariantToggle() {
  const q = QUERIES[state.q];
  const host = $("#variants");
  host.innerHTML = "";
  q.variants.forEach((v, i) => {
    const b = el("button", "vbtn");
    b.type = "button";
    b.setAttribute("aria-pressed", String(i === state.variant));
    b.append(el("span", "vletter", i === 0 ? "Version A" : "Version B"), el("code", null, v.label));
    b.addEventListener("click", () => {
      if (state.variant === i) return;
      // Keep the same clause in view when flipping, if the other version has it.
      const clause = state.runs[state.variant][state.step]?.clause;
      state.variant = i;
      const idx = state.runs[i].findIndex((s) => s.clause === clause);
      state.step = idx >= 0 ? idx : Math.min(state.step, state.runs[i].length - 1);
      saveState(); renderAll();
      $("#variants").children[i].focus();
    });
    host.append(b);
  });
}

function renderSql() {
  const v = QUERIES[state.q].variants[state.variant];
  const step = state.runs[state.variant][state.step];
  const pre = $("#sql");
  pre.innerHTML = "";
  const hl = step.hl;
  const at = hl ? v.sql.indexOf(hl) : -1;
  if (at < 0) { pre.textContent = v.sql; return; }
  pre.append(document.createTextNode(v.sql.slice(0, at)));
  pre.append(el("mark", null, hl));
  pre.append(document.createTextNode(v.sql.slice(at + hl.length)));
}

function renderRail() {
  const run = state.runs[state.variant];
  const host = $("#rail");
  host.innerHTML = "";
  run.forEach((s, i) => {
    const li = el("li", i === state.step ? "on" : i < state.step ? "done" : "");
    const b = el("button", null, s.clause);
    b.type = "button";
    if (i === state.step) b.setAttribute("aria-current", "step");
    b.addEventListener("click", () => { state.step = i; renderAll(); $("#rail").children[i].firstChild.focus(); });
    li.append(b);
    host.append(li);
  });
}

function colsFor(step, postSelect, q) {
  return (row) => {
    const keys = Object.keys(row.v);
    if (postSelect) return keys;
    return keys.filter((k) => q.show.includes(k) || (row.added && row.added.includes(k)));
  };
}

function renderView() {
  const q = QUERIES[state.q];
  const run = state.runs[state.variant];
  const step = run[state.step];
  const firstSelect = run.findIndex((s) => s.clause === "SELECT");
  const postSelect = firstSelect >= 0 && state.step >= firstSelect;
  const cols = colsFor(step, postSelect, q);
  const view = step.view;
  const host = $("#view");
  host.innerHTML = "";
  host.className = "view view-" + view.kind;

  const head = el("div", "view-head");
  head.append(el("span", "view-clause", step.clause === "result" ? "Result" : step.clause));
  const count = view.kind === "aside" ? `${view.values.length} values` : `${step.rows.length} row${step.rows.length === 1 ? "" : "s"}`;
  head.append(el("span", "view-count", view.kind === "error" ? "stopped" : count));
  host.append(head);

  if (view.kind === "list" || view.kind === "join") {
    const grid = el("div", "cards");
    step.rows.forEach((r) => grid.append(card(r, cols)));
    if (!step.rows.length) grid.append(el("p", "empty", "No cards left in the tray."));
    host.append(grid);
  } else if (view.kind === "filter") {
    const grid = el("div", "cards");
    view.judged.forEach((r) => grid.append(card(r, cols, { verdict: r.verdict, why: r.why })));
    host.append(grid);
  } else if (view.kind === "piles" || view.kind === "partitions") {
    const wrap = el("div", "piles");
    view.groups.forEach((g, gi) => {
      const p = el("div", "pile pile-" + (gi % 4));
      p.append(el("div", "pile-key", (view.kind === "piles" ? "pile: " : "partition: ") + g.key));
      if (view.kind === "piles") {
        p.append(card(g.summary, (row) => Object.keys(row.v), { summary: true }));
        const under = el("div", "cards under");
        g.members.forEach((m) => under.append(card(m, cols)));
        p.append(under);
      } else {
        const line = el("div", "cards line");
        g.members.forEach((m) => line.append(card(m, cols)));
        p.append(line);
      }
      wrap.append(p);
    });
    host.append(wrap);
  } else if (view.kind === "aside") {
    host.append(el("p", "aside-label", view.label + ":"));
    const chips = el("div", "chips");
    view.values.forEach((v) => chips.append(el("span", "chip" + (isNull(v) ? " null" : ""), isNull(v) ? "NULL" : String(v))));
    host.append(chips);
    const keep = el("p", "aside-keep", `The ${step.rows.length} slide cards wait for WHERE.`);
    host.append(keep);
  } else if (view.kind === "error") {
    const slip = el("div", "error-slip");
    slip.append(el("strong", null, "Query refused"), el("code", null, view.message));
    host.append(slip);
  }

  $("#note").textContent = view.note || "";
  $("#stepno").textContent = `Clause ${state.step + 1} of ${run.length}`;
  $("#back").disabled = state.step === 0;
  $("#next").disabled = state.step === run.length - 1;
  $("#end").disabled = state.step === run.length - 1;
}

function renderAll() {
  const q = QUERIES[state.q];
  [...$("#qtabs").children].forEach((b, i) => b.setAttribute("aria-pressed", String(i === state.q)));
  $("#ask").textContent = q.ask;
  renderVariantToggle();
  renderSql();
  renderRail();
  renderView();
}

function stepBy(d) {
  const n = state.runs[state.variant].length;
  const s = Math.max(0, Math.min(n - 1, state.step + d));
  if (s !== state.step) { state.step = s; renderAll(); }
}

// ---------- scratchpad ----------

const SQLJS = "https://cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/";
let db = null;

function setPadStatus(text, bad) {
  const s = $("#padstatus");
  s.textContent = text;
  s.classList.toggle("bad", !!bad);
}

function loadSqlJs() {
  setPadStatus("Loading SQLite from jsDelivr…");
  $("#load").disabled = true;
  const tag = document.createElement("script");
  tag.src = SQLJS + "sql-wasm.js";
  tag.onload = async () => {
    try {
      const SQL = await window.initSqlJs({ locateFile: (f) => SQLJS + f });
      db = new SQL.Database();
      db.run(tablesSql());
      setPadStatus("SQLite is ready, with the three drawers loaded as tables.");
      $("#run").disabled = false;
      $("#reset").disabled = false;
      $("#load").hidden = true;
    } catch (e) {
      setPadStatus("SQLite downloaded but would not start (" + e.message + "). The stepper above still works.", true);
      $("#load").disabled = false;
    }
  };
  tag.onerror = () => {
    setPadStatus("SQLite could not be fetched from jsDelivr. The stepper above still works, and the tables can be downloaded below to try in any SQLite.", true);
    $("#load").disabled = false;
  };
  document.head.append(tag);
}

function runPad() {
  if (!db) return;
  const out = $("#padout");
  out.innerHTML = "";
  const text = $("#pad").value;
  store.set("ritd-pad", text);
  try {
    const results = db.exec(text);
    if (!results.length) { out.append(el("p", "empty", "Ran. No rows came back.")); return; }
    for (const r of results) {
      const t = el("table");
      const tr = el("tr");
      r.columns.forEach((c) => tr.append(el("th", null, c)));
      const thead = el("thead"); thead.append(tr); t.append(thead);
      const tb = el("tbody");
      const CAP = 200;
      r.values.slice(0, CAP).forEach((row) => {
        const tr2 = el("tr");
        row.forEach((v) => tr2.append(el("td", isNull(v) ? "null" : "", isNull(v) ? "NULL" : String(v))));
        tb.append(tr2);
      });
      t.append(tb);
      const wrap = el("div", "tablewrap"); wrap.append(t);
      const n = r.values.length;
      out.append(wrap, el("p", "rowcount", `${n} row${n === 1 ? "" : "s"}` + (n > CAP ? `, showing the first ${CAP}` : "")));
    }
  } catch (e) {
    out.append(el("p", "padError", e.message));
  }
}

function resetDb() {
  if (!db) return;
  db.run("DROP TABLE IF EXISTS cases; DROP TABLE IF EXISTS slides; DROP TABLE IF EXISTS scans;");
  db.run(tablesSql());
  setPadStatus("Tables put back the way they started.");
}

function download(name, text) {
  const blob = new Blob([text], { type: "application/sql" });
  const a = el("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

function initPad() {
  const saved = store.get("ritd-pad");
  $("#pad").value = saved || QUERIES[0].variants[1].sql;
  $("#load").addEventListener("click", loadSqlJs);
  $("#run").addEventListener("click", runPad);
  $("#reset").addEventListener("click", resetDb);
  $("#pad").addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runPad(); }
  });
  $("#pad").addEventListener("input", () => store.set("ritd-pad", $("#pad").value));
  $("#copyq").addEventListener("click", () => {
    $("#pad").value = QUERIES[state.q].variants[state.variant].sql;
    store.set("ritd-pad", $("#pad").value);
    $("#pad").focus();
  });
  $("#dl").addEventListener("click", () => {
    download("pathology-lab.sql", "-- Made-up tables from 'Rows in the Drawer'.\n\n" + tablesSql() + "-- Scratchpad query\n" + $("#pad").value + "\n");
  });
  $("#openfile").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $("#pad").value = await f.text();
    store.set("ritd-pad", $("#pad").value);
    e.target.value = "";
  });
}

// ---------- start ----------

renderDrawers();
loadState();
computeRuns();
renderTabs();
renderAll();
$("#back").addEventListener("click", () => stepBy(-1));
$("#next").addEventListener("click", () => stepBy(1));
$("#end").addEventListener("click", () => stepBy(99));
$("#stepper").addEventListener("keydown", (e) => {
  if (e.target.closest("textarea")) return;
  if (e.key === "ArrowRight") { e.preventDefault(); stepBy(1); }
  if (e.key === "ArrowLeft") { e.preventDefault(); stepBy(-1); }
});
initPad();
