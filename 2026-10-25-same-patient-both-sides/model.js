// Made-up tiles, two ways of splitting them, and a k-nearest-neighbours
// model. Pure functions, no DOM.

// Small seeded random numbers, so a draw can be repeated.
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    let u = 0;
    while (u === 0) u = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  const shuffle = (arr) => {
    const a2 = [...arr];
    for (let i = a2.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [a2[i], a2[j]] = [a2[j], a2[i]];
    }
    return a2;
  };
  return { next, normal, shuffle };
}

// Each tile is two numbers. x carries the disease signal; both x and y
// carry the patient's own look (and, in the site version, the site's).
//   patients: how many; tiles: per patient
//   signal: distance between the two classes' centres along x
//   patientSpread: how far one patient's look sits from another's
//   noise: how much tiles of one patient vary
//   sites: optional { shift, mix } for two sites. mix is the share of
//          tumour patients at site A (site B gets the mirror).
export function makeTiles(opts, seed) {
  const { patients = 24, tiles = 30, signal = 1, patientSpread = 1, noise = 0.35, sites = null } = opts;
  const r = rng(seed);
  const out = [];
  const people = [];
  for (let p = 0; p < patients; p++) {
    let site = null;
    let tumour;
    if (sites) {
      site = p < patients / 2 ? 0 : 1;
      const idx = site === 0 ? p : p - patients / 2;
      const nTumour = Math.round((patients / 2) * (site === 0 ? sites.mix : 1 - sites.mix));
      tumour = idx < nTumour;
    } else {
      tumour = p % 2 === 0;
    }
    const ox = r.normal() * patientSpread;
    const oy = r.normal() * patientSpread;
    const sy = sites ? (site === 0 ? -sites.shift / 2 : sites.shift / 2) : 0;
    const cx = (tumour ? signal / 2 : -signal / 2) + ox;
    const cy = oy + sy;
    people.push({ id: p, tumour, site, cx, cy });
    for (let t = 0; t < tiles; t++) {
      out.push({ i: out.length, patient: p, site, tumour, x: cx + r.normal() * noise, y: cy + r.normal() * noise });
    }
  }
  return { tiles: out, people };
}

// Splits return a Set of tile indices that are in the test set.
export function splitByTile(data, share, seed) {
  const r = rng(seed ^ 0x9e3779b9);
  const n = Math.round(data.tiles.length * share);
  return new Set(r.shuffle(data.tiles.map((t) => t.i)).slice(0, n));
}

export function splitByPatient(data, share, seed) {
  const r = rng(seed ^ 0x85ebca6b);
  // Keep the classes balanced in the test set: half tumour, half benign patients.
  const nTest = Math.max(2, Math.round(data.people.length * share));
  const tum = r.shuffle(data.people.filter((p) => p.tumour).map((p) => p.id));
  const ben = r.shuffle(data.people.filter((p) => !p.tumour).map((p) => p.id));
  const held = new Set([...tum.slice(0, Math.ceil(nTest / 2)), ...ben.slice(0, Math.floor(nTest / 2))]);
  return new Set(data.tiles.filter((t) => held.has(t.patient)).map((t) => t.i));
}

export function splitBySite(data, testSite) {
  return new Set(data.tiles.filter((t) => t.site === testSite).map((t) => t.i));
}

// k-nearest neighbours: each test tile takes the majority vote of the k
// closest training tiles.
export function knn(data, testSet, k = 5) {
  const train = data.tiles.filter((t) => !testSet.has(t.i));
  const results = [];
  for (const t of data.tiles) {
    if (!testSet.has(t.i)) continue;
    const best = [];
    for (const u of train) {
      const d = (t.x - u.x) ** 2 + (t.y - u.y) ** 2;
      if (best.length < k || d < best[best.length - 1].d) {
        best.push({ u, d });
        best.sort((a, b) => a.d - b.d);
        if (best.length > k) best.pop();
      }
    }
    const votes = best.filter((b) => b.u.tumour).length;
    const pred = votes * 2 > k;
    results.push({
      tile: t,
      pred,
      right: pred === t.tumour,
      neighbours: best.map((b) => b.u),
      samePatient: best.filter((b) => b.u.patient === t.patient).length,
    });
  }
  return results;
}

export function score(results) {
  const n = results.length;
  const right = results.filter((r) => r.right).length;
  const nb = results.reduce((s, r) => s + r.neighbours.length, 0);
  const same = results.reduce((s, r) => s + r.samePatient, 0);
  // Patient level: a patient is called tumour if most of their test tiles are.
  const byPatient = new Map();
  for (const r of results) {
    const p = r.tile.patient;
    if (!byPatient.has(p)) byPatient.set(p, { tumour: r.tile.tumour, yes: 0, n: 0 });
    const e = byPatient.get(p);
    e.n++;
    if (r.pred) e.yes++;
  }
  let pRight = 0;
  for (const e of byPatient.values()) if ((e.yes * 2 > e.n) === e.tumour) pRight++;
  return {
    tiles: n,
    accuracy: n ? right / n : 0,
    sameShare: nb ? same / nb : 0,
    patients: byPatient.size,
    patientAccuracy: byPatient.size ? pRight / byPatient.size : 0,
  };
}
