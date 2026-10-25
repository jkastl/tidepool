// One simulated day of slide-scanner events: a partitioned log, a consumer
// group reading it live with hourly event-time windows, and a nightly batch
// job reading the same log at 02:00. Pure logic, no DOM.

export const DAY_START = 6 * 60;       // the clock starts at 06:00
export const SCAN_FROM = 7 * 60;       // scanners run 07:00 to 19:00
export const SCAN_TO = 19 * 60;
export const BATCH_AT = 26 * 60;       // 02:00 the next morning
export const DAY_END = 26 * 60 + 30;
export const HOURS = [];
for (let h = 7; h < 19; h++) HOURS.push(h);

export const SCANNERS = [
  { id: "SC-1", site: "A", part: 0 },
  { id: "SC-2", site: "A", part: 1 },
  { id: "SC-3", site: "B", part: 2 },
  { id: "SC-4", site: "B", part: 0 },
];
export const PARTITIONS = 3;
export const CAPACITY = 1;            // events one consumer handles per minute
export const REBALANCE_MIN = 2;        // minutes everyone stops during a rebalance
export const COMMIT_EVERY = 15;        // minutes between offset commits

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clock = (m) => {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.floor(m % 60);
  return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
};

export function createSim(opts = {}) {
  const s = {
    t: DAY_START,
    rate: opts.rate ?? 12,          // scans per scanner per hour
    delay: opts.delay ?? 15,        // watermark delay, minutes
    dedupe: opts.dedupe ?? false,
    rand: rng(opts.seed ?? 42),
    nextId: 1,
    inFlight: [],
    siteBCut: false,
    cutUntil: null,
    buffered: [],
    rushUntil: null,
    parts: Array.from({ length: PARTITIONS }, (_, i) => ({ i, log: [], committed: 0, position: 0, owner: null })),
    consumers: [],
    nextConsumer: 1,
    rebalanceUntil: null,
    truth: {},
    stream: {},
    late: {},
    finalAt: {},
    seen: new Set(),
    dupes: 0,
    skipped: 0,
    written: 0,
    maxEventTime: null,
    watermark: null,
    batch: null,
    log: [],
    logCount: 0,
    produced: {},
  };
  for (const h of HOURS) { s.truth[h] = 0; s.stream[h] = 0; s.late[h] = 0; }
  const n = opts.consumers ?? 2;
  for (let i = 0; i < n; i++) s.consumers.push({ id: "C" + s.nextConsumer++, alive: true });
  assign(s);
  return s;
}

function note(s, text) {
  s.logCount++;
  s.log.push({ t: s.t, text });
  if (s.log.length > 60) s.log.shift();
}

function poisson(rand, lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}

// Hand partitions out in turn to the consumers still running.
function assign(s) {
  const live = s.consumers.filter((c) => c.alive);
  s.parts.forEach((p, i) => { p.owner = live.length ? live[i % live.length].id : null; });
}

function startRebalance(s, why) {
  // Running consumers commit what they have done before giving partitions up.
  for (const p of s.parts) {
    const owner = s.consumers.find((c) => c.id === p.owner);
    if (owner && owner.alive) p.committed = p.position;
    else if (p.position > p.committed) {
      // A crashed owner's uncommitted work will be read again.
      note(s, `P${p.i} goes back to offset ${p.committed}: ${p.position - p.committed} event${p.position - p.committed === 1 ? "" : "s"} will be read a second time.`);
      p.position = p.committed;
    }
    p.owner = null;
  }
  s.rebalanceUntil = s.t + REBALANCE_MIN;
  note(s, `Rebalance (${why}): every consumer pauses while partitions are handed out again.`);
}

export function addConsumer(s) {
  if (s.consumers.filter((c) => c.alive).length >= 4) return;
  const c = { id: "C" + s.nextConsumer++, alive: true };
  s.consumers.push(c);
  startRebalance(s, `${c.id} joined`);
}

export function removeConsumer(s) {
  const live = s.consumers.filter((c) => c.alive);
  if (live.length <= 1) return;
  const c = live[live.length - 1];
  // Rebalance while the leaver is still in the group, so it commits its work first.
  startRebalance(s, `${c.id} left cleanly`);
  s.consumers = s.consumers.filter((x) => x !== c);
}

export function crashConsumer(s) {
  const live = s.consumers.filter((c) => c.alive);
  if (!live.length) return;
  // Crash the one holding the most uncommitted work.
  const work = (c) => s.parts.filter((p) => p.owner === c.id).reduce((a, p) => a + p.position - p.committed, 0);
  const c = [...live].sort((a, b) => work(b) - work(a))[0];
  const lost = work(c);
  c.alive = false;
  note(s, `${c.id} crashed with ${lost} event${lost === 1 ? "" : "s"} processed but not committed.`);
  startRebalance(s, `${c.id} gone`);
  s.consumers = s.consumers.filter((x) => x.alive);
  if (!s.consumers.length) note(s, "The group is empty: nobody is reading. Add a consumer to start again.");
}

export function cutSiteB(s, minutes) {
  if (s.siteBCut) return;
  s.siteBCut = true;
  s.cutUntil = minutes ? s.t + minutes : null;
  note(s, "Site B's network link is down. Its scanners keep scanning and hold their events.");
}

export function restoreSiteB(s) {
  if (!s.siteBCut) return;
  s.siteBCut = false;
  s.cutUntil = null;
  const n = s.buffered.length;
  for (const e of s.buffered) s.inFlight.push({ ...e, arrive: s.t });
  s.buffered = [];
  note(s, `Site B's link is back. ${n} held event${n === 1 ? "" : "s"} arrive at once, with old event times.`);
}

export function rush(s, minutes = 60) {
  s.rushUntil = s.t + minutes;
  note(s, "Rush: scan rate tripled for an hour.");
}

function windowOf(t) { return Math.floor(t / 60); }

function process(s, e) {
  if (s.seen.has(e.id)) {
    if (s.dedupe) {
      if (s.skipped++ === 0) note(s, `${e.id} came round again; its event_id was already seen, so it is skipped.`);
      return;
    }
    if (s.dupes++ === 0) note(s, `${e.id} came round again and was counted twice.`);
  }
  s.seen.add(e.id);
  s.written++;
  const h = windowOf(e.t);
  if (s.finalAt[h] !== undefined) {
    s.late[h] = (s.late[h] || 0) + 1;
    if (s.late[h] === 1) note(s, `An event from ${clock(e.t)} arrived after the ${clock(h * 60)} window was published. It is dropped as too late.`);
  }
  else s.stream[h] = (s.stream[h] || 0) + 1;
  if (s.maxEventTime === null || e.t > s.maxEventTime) s.maxEventTime = e.t;
  s.watermark = s.maxEventTime - s.delay;
  for (const hh of HOURS) {
    if (s.finalAt[hh] === undefined && (hh + 1) * 60 <= s.watermark) {
      s.finalAt[hh] = s.t;
      note(s, `Watermark passed ${clock((hh + 1) * 60)}: the ${clock(hh * 60)} window is published with ${s.stream[hh]} scans.`);
    }
  }
}

// Advance the clock by one minute.
export function tick(s) {
  if (s.t >= DAY_END) return false;
  const t = s.t;

  // 1. Scanners produce events.
  s.produced = {};
  if (t >= SCAN_FROM && t < SCAN_TO) {
    const factor = s.rushUntil !== null && t < s.rushUntil ? 3 : 1;
    for (const sc of SCANNERS) {
      const k = poisson(s.rand, (s.rate * factor) / 60);
      for (let i = 0; i < k; i++) {
        const e = { id: "e" + String(s.nextId++).padStart(4, "0"), scanner: sc.id, site: sc.site, part: sc.part, t: t + s.rand() };
        s.truth[windowOf(e.t)]++;
        s.produced[sc.id] = (s.produced[sc.id] || 0) + 1;
        if (sc.site === "B" && s.siteBCut) s.buffered.push(e);
        else s.inFlight.push({ ...e, arrive: t + (s.rand() < 0.5 ? 0 : 1) });
      }
    }
  }
  if (s.rushUntil !== null && t >= s.rushUntil) s.rushUntil = null;
  if (s.siteBCut && s.cutUntil !== null && t >= s.cutUntil) restoreSiteB(s);

  // 2. Events reach the log, in arrival order, keyed by scanner.
  const arriving = s.inFlight.filter((e) => e.arrive <= t).sort((a, b) => a.arrive - b.arrive || a.t - b.t);
  s.inFlight = s.inFlight.filter((e) => e.arrive > t);
  for (const e of arriving) {
    const p = s.parts[e.part];
    p.log.push({ ...e, offset: p.log.length, arrivedAt: t });
  }

  // 3. Rebalance finishes, or consumers read.
  if (s.rebalanceUntil !== null) {
    if (t >= s.rebalanceUntil) {
      s.rebalanceUntil = null;
      assign(s);
      const idle = s.consumers.filter((c) => !s.parts.some((p) => p.owner === c.id));
      note(s, "Rebalance done: " + s.parts.map((p) => `P${p.i}→${p.owner ?? "nobody"}`).join(", ") +
        (idle.length ? `. ${idle.map((c) => c.id).join(", ")} idle: more consumers than partitions.` : "."));
    }
  } else {
    for (const c of s.consumers) {
      if (!c.alive) continue;
      const mine = s.parts.filter((p) => p.owner === c.id);
      let budget = CAPACITY;
      let progress = true;
      while (budget > 0 && progress) {
        progress = false;
        for (const p of mine) {
          if (budget > 0 && p.position < p.log.length) {
            process(s, p.log[p.position]);
            p.position++;
            budget--;
            progress = true;
          }
        }
      }
    }
    if (t % COMMIT_EVERY === 0) for (const p of s.parts) if (p.owner) p.committed = p.position;
  }

  // 4. The nightly batch job.
  if (t === BATCH_AT) {
    const counts = {};
    for (const h of HOURS) counts[h] = 0;
    const ids = new Set();
    for (const p of s.parts) for (const e of p.log) {
      if (ids.has(e.id)) continue;
      ids.add(e.id);
      const h = windowOf(e.t);
      if (counts[h] !== undefined) counts[h]++;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const missing = s.buffered.length + s.inFlight.length;
    s.batch = { at: t, counts, total };
    note(s, `02:00 batch job read the whole day's log: ${total} scans` + (missing ? `, ${missing} still had not arrived and are missing.` : ", matching the true count."));
  }

  s.t++;
  return true;
}

export function lag(s) {
  return s.parts.map((p) => p.log.length - p.position);
}

export function totals(s) {
  const sum = (o) => HOURS.reduce((a, h) => a + (o[h] || 0), 0);
  return { truth: sum(s.truth), stream: sum(s.stream), late: sum(s.late) };
}
