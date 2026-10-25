import { makeTiles, splitByTile, splitByPatient, knn, score } from "./model.js";

const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
const pct = (v) => Math.round(v * 100) + "%";
function svg(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style") n.setAttribute("style", v);
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v);
  }
  if (parent) parent.append(n);
  return n;
}
const INK = "var(--ink)";
const ACC = "var(--accent)";

// ---------- Fig. 1: a slide cut into tiles ----------

function drawFig1() {
  const g = $("fig1");
  g.textContent = "";
  // On a phone the table goes under the slide, so its text stays readable.
  const narrow = g.parentNode.clientWidth < 600;
  g.setAttribute("viewBox", narrow ? "0 0 360 430" : "0 0 720 230");
  svg("title", { id: "fig1t", text: "A slide cut into a grid of tiles. Tiles over tissue are kept; tiles over empty glass are dropped. Each kept tile becomes one row in a table, carrying the patient it came from." }, g);
  // the slide
  svg("rect", { x: 14, y: 22, width: 330, height: 180, rx: 4, style: `fill:var(--paper);stroke:${INK};stroke-width:1.2` }, g);
  svg("rect", { x: 14, y: 22, width: 70, height: 180, rx: 4, style: "fill:var(--faint);stroke:none" }, g);
  svg("text", { x: 49, y: 116, "text-anchor": "middle", style: "font-size:11px;fill:var(--muted)", transform: "rotate(-90 49 112)", text: "label" }, g);
  // tissue: two overlapping ellipses
  const blobs = [
    { cx: 190, cy: 105, rx: 70, ry: 52 },
    { cx: 262, cy: 128, rx: 52, ry: 40 },
  ];
  const inTissue = (x, y) => blobs.some((b) => ((x - b.cx) / b.rx) ** 2 + ((y - b.cy) / b.ry) ** 2 <= 1);
  for (const b of blobs) svg("ellipse", { ...b, style: "fill:var(--accent-soft);stroke:none" }, g);
  // tiles
  const size = 20;
  let kept = 0, dropped = 0;
  for (let x = 96; x + size <= 340; x += size) {
    for (let y = 30; y + size <= 198; y += size) {
      const keep = inTissue(x + size / 2, y + size / 2);
      keep ? kept++ : dropped++;
      svg("rect", {
        x, y, width: size, height: size,
        style: keep ? `fill:none;stroke:${INK};stroke-width:1` : "fill:none;stroke:var(--faint);stroke-width:0.8;stroke-dasharray:2 2",
      }, g);
    }
  }
  svg("text", { x: 179, y: 220, "text-anchor": "middle", style: "font-size:12px;fill:var(--ink-soft)", text: narrow ? `${kept} kept, ${dropped} dropped (a real slide gives thousands)` : `${kept} tiles kept, ${dropped} dropped (drawn coarse; a real slide gives thousands)` }, g);
  // arrow
  svg("path", { d: narrow ? "M179 230 V258 M172 250 L179 260 L186 250" : "M356 112 H396 M388 105 L398 112 L388 119", style: `fill:none;stroke:${INK};stroke-width:1.4` }, g);
  // the table
  const cols = ["tile", "slide", "patient", "site", "label"];
  const rows = [
    ["t-0001", "SL-31", "P-07", "A", "tumour"],
    ["t-0002", "SL-31", "P-07", "A", "tumour"],
    ["t-0003", "SL-31", "P-07", "A", "tumour"],
    ["…", "", "", "", ""],
    ["t-2210", "SL-44", "P-12", "B", "no tumour"],
  ];
  const x0 = narrow ? 14 : 410, colW = [58, 52, 58, 36, 96], y0 = narrow ? 284 : 46, rowH = narrow ? 22 : 26;
  let cx = x0;
  cols.forEach((c, i) => {
    svg("text", { x: cx + 4, y: y0, style: "font-size:12px;font-style:italic", text: c }, g);
    cx += colW[i];
  });
  svg("line", { x1: x0, x2: x0 + 300, y1: y0 + 7, y2: y0 + 7, style: `stroke:${INK}` }, g);
  rows.forEach((r, j) => {
    let cx2 = x0;
    r.forEach((v, i) => {
      svg("text", { x: cx2 + 4, y: y0 + 26 + j * rowH, style: "font-size:12.5px" + (i === 2 && v ? `;fill:${ACC}` : ""), text: v }, g);
      cx2 += colW[i];
    });
  });
  svg("text", { x: x0 + 4, y: narrow ? 418 : 214, style: "font-size:12px;fill:var(--ink-soft)", text: "one row per tile; the patient column decides the split" }, g);
}

// ---------- shared scatter drawing ----------

// The plotted range grows with the data, so no tile is pinned to an edge.
let LIM = 3.6;
const fitRange = (tiles) => { LIM = Math.max(3.6, ...tiles.map((t) => Math.max(Math.abs(t.x), Math.abs(t.y)) + 0.3)); };
const toPx = (v) => 20 + ((v + LIM) / (2 * LIM)) * 400;
const toPy = (v) => 420 - ((v + LIM) / (2 * LIM)) * 400;

function axes(g, xLabel, yLabel) {
  svg("line", { x1: 20, x2: 420, y1: 420, y2: 420, style: `stroke:${INK}` }, g);
  svg("line", { x1: 20, x2: 20, y1: 20, y2: 420, style: `stroke:${INK}` }, g);
  svg("text", { x: 416, y: 434, "text-anchor": "end", style: "font-size:12px;font-style:italic", text: xLabel }, g);
  svg("text", { x: 26, y: 32, style: "font-size:12px;font-style:italic", text: yLabel }, g);
}

// ---------- Fig. 2: the leak ----------

const st = {
  split: "tile",
  spread: 1,
  signal: 1,
  seed: 7,
  picked: 0,
  data: null,
  results: null,
};

function run() {
  st.data = makeTiles({ patientSpread: st.spread, signal: st.signal, noise: 0.2 }, st.seed);
  const test = st.split === "tile" ? splitByTile(st.data, 0.2, st.seed) : splitByPatient(st.data, 0.2, st.seed);
  st.results = knn(st.data, test, 5);
  st.picked = Math.min(st.picked, st.results.length - 1);
}

function drawFig2() {
  const g = $("fig2");
  g.textContent = "";
  axes(g, "measurement 1 (carries the disease signal)", "measurement 2");
  const { tiles } = st.data;
  fitRange(tiles);
  const testIdx = new Set(st.results.map((r) => r.tile.i));
  const pick = st.results[st.picked];
  const layerBack = svg("g", {}, g);
  const layerLines = svg("g", {}, g);
  const layerFront = svg("g", {}, g);

  for (const t of tiles) {
    if (testIdx.has(t.i)) continue;
    const own = pick && t.patient === pick.tile.patient;
    svg("circle", {
      cx: toPx(t.x), cy: toPy(t.y), r: own ? 3.6 : 3,
      style: `fill:${t.tumour ? INK : "var(--paper-2)"};stroke:${own ? ACC : INK};stroke-width:${own ? 1.6 : 0.8};opacity:${own ? 1 : 0.5}`,
    }, layerBack);
  }
  if (pick) {
    for (const n of pick.neighbours) {
      const same = n.patient === pick.tile.patient;
      svg("line", {
        x1: toPx(pick.tile.x), y1: toPy(pick.tile.y), x2: toPx(n.x), y2: toPy(n.y),
        style: `stroke:${same ? ACC : INK};stroke-width:${same ? 1.8 : 1.2};${same ? "" : "stroke-dasharray:3 3"}`,
      }, layerLines);
    }
  }
  st.results.forEach((r, i) => {
    const t = r.tile;
    const x = toPx(t.x), y = toPy(t.y);
    const isPick = i === st.picked;
    const sq = svg("rect", {
      x: x - 4, y: y - 4, width: 8, height: 8,
      style: `fill:${t.tumour ? INK : "var(--paper-2)"};stroke:${isPick ? ACC : INK};stroke-width:${isPick ? 2.5 : 1};cursor:pointer`,
    }, layerFront);
    // a larger invisible target for fingers
    const hit = svg("circle", { cx: x, cy: y, r: $("fig2").clientWidth < 400 ? 14 : 9, style: "fill:transparent;cursor:pointer" }, layerFront);
    const choose = () => { st.picked = i; drawFig2(); describePick(); };
    sq.addEventListener("click", choose);
    hit.addEventListener("click", choose);
    if (!r.right) svg("path", { d: `M${x - 6} ${y - 6}L${x + 6} ${y + 6}M${x + 6} ${y - 6}L${x - 6} ${y + 6}`, style: `stroke:${ACC};stroke-width:1.6;pointer-events:none` }, layerFront);
  });
  if (pick) svg("circle", { cx: toPx(pick.tile.x), cy: toPy(pick.tile.y), r: 13, style: `fill:none;stroke:${ACC};stroke-width:1.2;pointer-events:none` }, layerFront);
}

function describePick() {
  const r = st.results[st.picked];
  if (!r) { $("picked").textContent = ""; return; }
  const votes = r.neighbours.filter((n) => n.tumour).length;
  $("picked").textContent =
    `Picked: a test tile from patient ${r.tile.patient + 1} (${r.tile.tumour ? "tumour" : "no tumour"}). ` +
    `Of its 5 nearest training tiles, ${r.samePatient} ${r.samePatient === 1 ? "is" : "are"} from the same patient (solid lines). ` +
    `${votes} of 5 say tumour, so it is called ${votes >= 3 ? "tumour" : "no tumour"}: ${r.right ? "right" : "wrong"}.`;
}

function readout() {
  const s = score(st.results);
  $("acc").textContent = pct(s.accuracy);
  $("same").textContent = pct(s.sameShare);
  $("npat").textContent = String(s.patients);
  $("pacc").textContent = pct(s.patientAccuracy);
  $("splitnote").textContent = st.split === "tile"
    ? "20% of tiles go to test at random, so every patient ends up with tiles on both sides."
    : "20% of patients go to test with all their tiles; no patient is on both sides.";
  const k = s.patients;
  if (st.split === "patient") {
    const steps = [];
    for (let i = 0; i <= k; i++) steps.push(Math.round((i / k) * 100) + "%");
    $("samples").textContent = `The current draw in Fig. 2 tests ${s.tiles} tiles but only ${k} patients. Scored per patient, its accuracy can only land on ${steps.join(", ")}.`;
  } else {
    $("samples").textContent = `Split by tile, the current draw in Fig. 2 tests ${s.tiles} tiles from all ${k} patients, and every one of those patients also has tiles in training. Switch it to "by patient" to see how many people a fair test set actually holds.`;
  }
}

// 30 draws at the current settings, both splits.
function drawDots() {
  const g = $("dots");
  g.textContent = "";
  const acc = { tile: [], patient: [] };
  for (let i = 0; i < 30; i++) {
    const seed = 1000 + st.seed * 31 + i;
    const d = makeTiles({ patientSpread: st.spread, signal: st.signal, noise: 0.2 }, seed);
    acc.tile.push(score(knn(d, splitByTile(d, 0.2, seed), 5)).accuracy);
    acc.patient.push(score(knn(d, splitByPatient(d, 0.2, seed), 5)).accuracy);
  }
  // A narrower drawing on phones, so the labels stay readable.
  const W = g.parentNode.clientWidth < 600 ? 400 : 720;
  g.setAttribute("viewBox", `0 0 ${W} 120`);
  const left = W < 600 ? 78 : 110;
  const X = (v) => left + ((v - 0.2) / 0.8) * (W - left - 20);
  const step = W < 600 ? 0.2 : 0.1;
  for (let v = 0.2; v <= 1.0001; v += step) {
    svg("line", { x1: X(v), x2: X(v), y1: 14, y2: 96, style: "stroke:var(--faint);stroke-width:0.8" }, g);
    svg("text", { x: X(v), y: 112, "text-anchor": "middle", class: "tick-label", style: "font-size:12px;fill:var(--muted)", text: Math.round(v * 100) + "%" }, g);
  }
  svg("line", { x1: X(0.5), x2: X(0.5), y1: 10, y2: 98, style: `stroke:${INK};stroke-dasharray:4 3` }, g);
  svg("text", { x: X(0.5) + 4, y: 12, style: "font-size:11px;fill:var(--muted)", text: "coin toss" }, g);
  const rows = [["by tile", acc.tile, 36], ["by patient", acc.patient, 76]];
  const means = {};
  for (const [label, vals, y] of rows) {
    svg("text", { x: 4, y: y + 4, style: "font-size:14px;font-style:italic", text: label }, g);
    vals.forEach((v, i) => {
      const jitter = ((i * 7) % 11) - 5;
      svg("circle", { cx: X(Math.max(0.2, v)), cy: y + jitter, r: 3.4, style: `fill:${label === "by tile" ? ACC : INK};opacity:0.75` }, g);
    });
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    means[label] = m;
    svg("line", { x1: X(m), x2: X(m), y1: y - 12, y2: y + 12, style: `stroke:${INK};stroke-width:2.5` }, g);
    svg("text", { x: X(m) + 6, y: y - 8, style: "font-size:12px", text: "avg " + pct(m) }, g);
  }
  const gap = Math.round((means["by tile"] - means["by patient"]) * 100);
  $("gaptext").textContent = gap > 0
    ? `At these settings the split by tile averages ${gap} points higher than the split by patient.`
    : "At these settings the two splits score about the same.";
}

// ---------- Fig. 3: sites ----------

const site = { shift: 2, seed: 11 };

function drawFig3() {
  const g = $("fig3");
  g.textContent = "";
  axes(g, "measurement 1 (carries the disease signal)", "measurement 2");
  const d = makeTiles({ patientSpread: 0.5, signal: 0.6, noise: 0.2, sites: { shift: site.shift, mix: 0.8 } }, site.seed);
  fitRange(d.tiles);
  for (const t of d.tiles) {
    const col = t.site === 0 ? INK : ACC;
    svg("circle", { cx: toPx(t.x), cy: toPy(t.y), r: 3, style: `fill:${t.tumour ? col : "var(--paper-2)"};stroke:${col};stroke-width:0.9;opacity:0.7` }, g);
  }
  svg("text", { x: 412, y: 40, "text-anchor": "end", style: `font-size:13px;fill:${ACC}`, text: "site B: mostly no tumour" }, g);
  svg("text", { x: 412, y: 408, "text-anchor": "end", style: "font-size:13px", text: "site A: mostly tumour" }, g);
}

function siteBars() {
  const avg = (shift) => {
    let sum = 0;
    for (let i = 0; i < 30; i++) {
      const seed = 500 + i;
      const d = makeTiles({ patientSpread: 0.5, signal: 0.6, noise: 0.2, sites: { shift, mix: 0.8 } }, seed);
      sum += score(knn(d, splitByPatient(d, 0.25, seed), 5)).accuracy;
    }
    return sum / 30;
  };
  const withLook = avg(site.shift);
  const without = avg(0);
  $("b1").style.width = pct(withLook);
  $("b0").style.width = pct(without);
  $("b1v").textContent = pct(withLook);
  $("b0v").textContent = pct(without);
}

// ---------- wiring ----------

function refresh(dots = true) {
  run();
  drawFig2();
  describePick();
  readout();
  if (dots) drawDots();
}

const timers = new Map();
const later = (fn) => { clearTimeout(timers.get(fn)); timers.set(fn, setTimeout(fn, 120)); };

document.querySelectorAll('input[name="split"]').forEach((r) =>
  r.addEventListener("change", () => { st.split = r.value; st.picked = 0; refresh(false); }));
for (const [id, key] of [["spread", "spread"], ["signal", "signal"]]) {
  const inp = $(id);
  const out = $(id + "v");
  const set = () => { st[key] = +inp.value; out.textContent = (+inp.value).toFixed(1); };
  set();
  inp.addEventListener("input", () => { set(); refresh(false); later(drawDots); });
}
$("redraw").addEventListener("click", () => { st.seed = (st.seed * 48271 + 11) % 2147483647; st.picked = 0; refresh(); });
$("nexttile").addEventListener("click", () => {
  st.picked = (st.picked + 1) % st.results.length;
  drawFig2();
  describePick();
});
const ss = $("siteshift");
const setShift = () => { site.shift = +ss.value; $("siteshiftv").textContent = (+ss.value).toFixed(1); };
setShift();
ss.addEventListener("input", () => { setShift(); drawFig3(); later(siteBars); });

let lastWide = null;
window.addEventListener("resize", () => {
  const wide = $("dots").parentNode.clientWidth >= 600;
  if (wide !== lastWide) { lastWide = wide; drawDots(); drawFig1(); }
});

drawFig1();
refresh();
drawFig3();
siteBars();
