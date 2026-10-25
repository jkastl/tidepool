import {
  createSim, tick, addConsumer, removeConsumer, crashConsumer, cutSiteB, restoreSiteB, rush,
  lag, totals, clock, SCANNERS, HOURS, BATCH_AT, DAY_END, PARTITIONS,
} from "./sim.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const settings = { rate: 12, delay: 15, dedupe: false, consumers: 2 };
let sim = createSim(settings);
let playing = false;
let speed = 8; // simulated minutes per second
let carry = 0;
let last = null;

// ---------- drawing ----------

function drawScanners() {
  for (const sc of SCANNERS) {
    const chip = $("sc-" + sc.id);
    const n = sim.produced[sc.id] || 0;
    chip.classList.toggle("blink", n > 0);
    chip.querySelector(".held").textContent = sc.site === "B" && sim.buffered.length
      ? `${sim.buffered.filter((e) => e.scanner === sc.id).length} held` : "";
  }
  const cut = sim.siteBCut;
  $("linkB").classList.toggle("down", cut);
  $("linkB").textContent = cut ? "link down" : "link up";
  $("cutBtn").textContent = cut ? "Restore site B's link" : "Cut site B's link for 90 minutes";
}

function cellsThatFit() {
  // Leave room for the "…" labels at either end.
  const w = $("tapes").clientWidth - 120;
  return Math.max(6, Math.floor(w / 25));
}

function drawTapes() {
  const host = $("tapes");
  const fit = cellsThatFit();
  const lags = lag(sim);
  host.innerHTML = "";
  sim.parts.forEach((p, i) => {
    const row = el("div", "tape-row");
    const head = el("div", "tape-head");
    const keys = SCANNERS.filter((s) => s.part === i).map((s) => s.id).join(", ");
    head.append(el("b", null, "P" + i), el("span", "keys", "keys " + keys));
    const owner = sim.rebalanceUntil !== null ? "paused" : p.owner ? "read by " + p.owner : "no reader";
    head.append(el("span", "owner", owner));
    head.append(el("span", "lagnum" + (lags[i] > 20 ? " high" : ""), `lag ${lags[i]}`));
    row.append(head);

    const len = p.log.length;
    // Keep the read marker in view, with some unread tape after it.
    let start = Math.max(0, len - fit);
    if (p.position < start + 3) start = Math.max(0, p.position - 3);
    const end = Math.min(len, start + fit);
    const tape = el("div", "tape");
    if (start > 0) tape.append(el("span", "more", `${start}…`));
    for (let k = start; k < end; k++) {
      const e = p.log[k];
      const c = el("span", "cell sc" + e.scanner.slice(-1));
      if (k < p.committed) c.classList.add("committed");
      else if (k < p.position) c.classList.add("read");
      else c.classList.add("unread");
      if (k === p.committed) c.classList.add("mark-commit");
      if (k === p.position) c.classList.add("mark-read");
      c.textContent = k;
      c.title = `offset ${k} · ${e.id} · ${e.scanner} · scanned ${clock(e.t)} · arrived ${clock(e.arrivedAt)}`;
      tape.append(c);
    }
    if (end < len) tape.append(el("span", "more", `…${len - end} more`));
    if (!len) tape.append(el("span", "more", "empty"));
    row.append(tape);
    host.append(row);
  });
}

function drawConsumers() {
  const host = $("consumers");
  host.innerHTML = "";
  for (const c of sim.consumers) {
    const mine = sim.parts.filter((p) => p.owner === c.id).map((p) => "P" + p.i);
    const chip = el("div", "consumer");
    chip.append(el("b", null, c.id));
    let status;
    if (sim.rebalanceUntil !== null) status = "paused: rebalancing";
    else if (mine.length) status = "reading " + mine.join(", ");
    else status = "idle: no partition left";
    chip.append(el("span", null, status));
    if (!mine.length && sim.rebalanceUntil === null) chip.classList.add("idle");
    host.append(chip);
  }
  $("addC").disabled = sim.consumers.length >= 4;
  $("remC").disabled = sim.consumers.length <= 1;
  $("crashC").disabled = !sim.consumers.length;
}

const NS = "http://www.w3.org/2000/svg";
function svg(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") n.textContent = v; else n.setAttribute(k, v);
  }
  parent.append(n);
  return n;
}

function drawTally() {
  const g = $("tally");
  [...g.children].forEach((c) => { if (c.tagName !== "defs") c.remove(); });
  // Draw at the panel's own width so the labels stay a readable size.
  const W = Math.max(300, Math.min(560, g.clientWidth || 480)), H = 230, left = 30, bottom = 196, top = 22;
  g.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const colW = (W - left - 8) / HOURS.length;
  const maxV = Math.max(10, ...HOURS.map((h) => Math.max(sim.truth[h], sim.stream[h] + sim.late[h], sim.batch ? sim.batch.counts[h] : 0)));
  const Y = (v) => bottom - (v / maxV) * (bottom - top);
  // grid
  const stepV = maxV > 120 ? 50 : maxV > 60 ? 20 : 10;
  for (let v = 0; v <= maxV; v += stepV) {
    svg("line", { x1: left, x2: W - 4, y1: Y(v), y2: Y(v), class: "grid" }, g);
    svg("text", { x: left - 4, y: Y(v) + 4, "text-anchor": "end", class: "axis", text: v }, g);
  }
  HOURS.forEach((h, i) => {
    const x = left + i * colW + 3;
    const w = colW - 6;
    const published = sim.finalAt[h] !== undefined;
    // the truth: every scan made in that hour
    svg("rect", { x, y: Y(sim.truth[h]), width: w, height: bottom - Y(sim.truth[h]), class: "truth" }, g);
    // the stream's count
    const sv = sim.stream[h];
    svg("rect", { x: x + 2, y: Y(sv), width: w - 4, height: bottom - Y(sv), class: published ? "stream final" : "stream open" }, g);
    if (sim.late[h]) {
      svg("rect", { x: x + 2, y: Y(sv + sim.late[h]), width: w - 4, height: Y(sv) - Y(sv + sim.late[h]), class: "late" }, g);
    }
    if (sim.batch) {
      const bv = sim.batch.counts[h];
      svg("line", { x1: x - 1, x2: x + w + 1, y1: Y(bv), y2: Y(bv), class: "batch" }, g);
    }
    svg("text", { x: x + w / 2, y: bottom + 14, "text-anchor": "middle", class: "axis", text: String(h).padStart(2, "0") }, g);
    if (published) svg("text", { x: x + w / 2, y: Y(Math.max(sv + sim.late[h], sim.truth[h])) - 4, "text-anchor": "middle", class: "val", text: sv }, g);
  });
  svg("text", { x: left, y: H - 6, class: "axis", text: "hour of the scan (event time)" }, g);
  if (sim.watermark !== null) {
    const wmH = sim.watermark / 60;
    if (wmH >= 7 && wmH <= 19) {
      const x = left + (wmH - 7) * colW;
      svg("line", { x1: x, x2: x, y1: top - 8, y2: bottom, class: "wm" }, g);
      svg("text", { x: Math.min(x + 3, W - 70), y: top - 10, class: "wmtext", text: "watermark " + clock(sim.watermark) }, g);
    }
  }
}

function drawReadout() {
  const T = totals(sim);
  $("clock").textContent = clock(sim.t);
  $("dayhint").textContent = sim.t >= 24 * 60 ? "next morning" : sim.t < 7 * 60 ? "before the scanners start" : sim.t < 19 * 60 ? "scanners running" : "scanning done for the day";
  $("r-truth").textContent = T.truth;
  $("r-stream").textContent = T.stream;
  $("r-late").textContent = T.late;
  $("r-dupes").textContent = sim.dedupe ? `${sim.skipped} skipped` : `${sim.dupes} counted twice`;
  $("r-wm").textContent = sim.watermark === null ? "not yet" : clock(sim.watermark);
  const pub = HOURS.filter((h) => sim.finalAt[h] !== undefined);
  $("r-pub").textContent = pub.length ? `${clock(pub[pub.length - 1] * 60)} window, at ${clock(sim.finalAt[pub[pub.length - 1]])}` : "none yet";
  $("r-batch").textContent = sim.batch ? `${sim.batch.total} scans, at 02:00` : `runs at 02:00 (in ${fmtWait(BATCH_AT - sim.t)})`;
  $("r-lag").textContent = lag(sim).reduce((a, b) => a + b, 0);
  $("play").textContent = playing ? "Pause" : sim.t >= DAY_END ? "Day over" : "Play";
  $("play").disabled = sim.t >= DAY_END;
  $("skip").disabled = sim.t >= DAY_END;
}

function fmtWait(m) {
  if (m <= 0) return "now";
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} min` : `${m} min`;
}

let logShown = 0;
function drawLog() {
  const host = $("log");
  if (sim.log === lastLog && sim.logCount === logShown) return;
  host.innerHTML = "";
  for (const l of sim.log.slice(-8).reverse()) {
    const li = el("li");
    li.append(el("time", null, clock(l.t)), document.createTextNode(" " + l.text));
    host.append(li);
  }
  lastLog = sim.log;
  logShown = sim.logCount;
}
let lastLog = null;

function draw() {
  drawScanners();
  drawTapes();
  drawConsumers();
  drawTally();
  drawReadout();
  drawLog();
}

// ---------- running ----------

function frame(now) {
  if (!playing) { last = null; return; }
  if (last !== null) {
    carry += ((now - last) / 1000) * speed;
    let n = Math.floor(carry);
    carry -= n;
    while (n-- > 0) {
      if (!tick(sim)) { playing = false; break; }
    }
    draw();
  }
  last = now;
  frameId = requestAnimationFrame(frame);
}

let frameId = null;
function setPlaying(on) {
  playing = on && sim.t < DAY_END;
  if (frameId !== null) { cancelAnimationFrame(frameId); frameId = null; }
  if (playing) { last = null; frameId = requestAnimationFrame(frame); }
  drawReadout();
}

function reset() {
  sim = createSim({ ...settings, seed: 42 });
  playing = false;
  lastLog = null;
  draw();
}

// ---------- controls ----------

$("play").addEventListener("click", () => setPlaying(!playing));
$("step").addEventListener("click", () => { for (let i = 0; i < 10; i++) tick(sim); draw(); });
$("reset").addEventListener("click", reset);
$("skip").addEventListener("click", () => {
  while (sim.t <= BATCH_AT && tick(sim)) { /* run on */ }
  draw();
});
document.querySelectorAll("[data-speed]").forEach((b) => {
  b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    document.querySelectorAll("[data-speed]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  });
});
$("addC").addEventListener("click", () => { addConsumer(sim); draw(); });
$("remC").addEventListener("click", () => { removeConsumer(sim); draw(); });
$("crashC").addEventListener("click", () => { crashConsumer(sim); draw(); });
$("cutBtn").addEventListener("click", () => { sim.siteBCut ? restoreSiteB(sim) : cutSiteB(sim, 90); draw(); });
$("rushBtn").addEventListener("click", () => { rush(sim, 60); draw(); });

const rate = $("rate");
rate.addEventListener("input", () => {
  settings.rate = +rate.value; sim.rate = settings.rate;
  $("ratev").textContent = `${rate.value} / scanner / hour`;
});
const delay = $("delay");
delay.addEventListener("input", () => {
  settings.delay = +delay.value; sim.delay = settings.delay;
  $("delayv").textContent = `${delay.value} min`;
});
$("dedupe").addEventListener("change", (e) => { settings.dedupe = e.target.checked; sim.dedupe = settings.dedupe; draw(); });
window.addEventListener("resize", () => { drawTapes(); drawTally(); });

$("ratev").textContent = `${rate.value} / scanner / hour`;
$("delayv").textContent = `${delay.value} min`;
$("parts").textContent = PARTITIONS;
draw();
