// The made-up lab's tables, a tiny row engine that runs a query one
// clause at a time, and the six queries the page steps through.
// No DOM here, so the engine can be checked against SQLite outside the page.

export const TABLES = {
  cases: {
    cols: ["case_id", "patient_id", "accessioned_at", "priority"],
    rows: [
      ["S26-101", "P-07", "2026-03-02 08:10", "routine"],
      ["S26-102", "P-12", "2026-03-02 09:40", "rush"],
      ["S26-103", "P-07", "2026-03-02 11:05", "routine"],
      ["S26-104", "P-21", "2026-03-02 13:30", "routine"],
    ],
  },
  slides: {
    cols: ["slide_id", "case_id", "label", "stain"],
    rows: [
      [1, "S26-101", "A1-1", "H&E"],
      [2, "S26-101", "A1-2", "IHC"],
      [3, "S26-101", "B1-1", "H&E"],
      [4, "S26-102", "A1-1", "H&E"],
      [5, "S26-102", "A2-1", "H&E"],
      [6, "S26-103", "A1-1", "H&E"],
      [7, "S26-103", "A1-2", "special"],
      [8, "S26-104", "A1-1", "H&E"],
    ],
  },
  scans: {
    cols: ["scan_id", "slide_id", "scanner", "scanned_at", "qc"],
    rows: [
      [1, 1, "SC-1", "2026-03-02 09:02", "blur"],
      [2, 2, "SC-1", "2026-03-02 09:05", "pass"],
      [3, 3, "SC-1", "2026-03-02 09:07", "pass"],
      [4, 1, "SC-2", "2026-03-02 10:15", "pass"],
      [5, 4, "SC-2", "2026-03-02 10:20", "pass"],
      [6, 5, "SC-2", "2026-03-02 10:22", "clipped"],
      [7, null, "SC-1", "2026-03-02 11:30", "pass"],
      [8, 5, "SC-1", "2026-03-02 12:40", "pass"],
      [9, 6, "SC-1", "2026-03-02 13:10", "pass"],
      [10, 8, "SC-2", "2026-03-02 14:55", null],
    ],
  },
};

const TYPES = {
  cases: ["TEXT PRIMARY KEY", "TEXT", "TEXT", "TEXT"],
  slides: ["INTEGER PRIMARY KEY", "TEXT", "TEXT", "TEXT"],
  scans: ["INTEGER PRIMARY KEY", "INTEGER", "TEXT", "TEXT", "TEXT"],
};

// The tables as a SQL script, for the scratchpad and the download.
export function tablesSql() {
  const lit = (v) => (v === null ? "NULL" : typeof v === "number" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");
  let out = "";
  for (const [name, t] of Object.entries(TABLES)) {
    out += `CREATE TABLE ${name} (\n` + t.cols.map((c, i) => `  ${c} ${TYPES[name][i]}`).join(",\n") + "\n);\n";
    out += `INSERT INTO ${name} VALUES\n` + t.rows.map((r) => "  (" + r.map(lit).join(", ") + ")").join(",\n") + ";\n\n";
  }
  return out;
}

// ---------- three-valued logic ----------

export const isNull = (v) => v === null || v === undefined;
const eq = (a, b) => (isNull(a) || isNull(b) ? null : a === b);
const and = (a, b) => (a === false || b === false ? false : a === null || b === null ? null : true);
const show = (v) => (isNull(v) ? "NULL" : typeof v === "number" ? String(v) : `'${v}'`);

// ---------- the steps ----------
// Each step takes the rows so far and returns { rows, view }. The view
// tells the page how to draw the step; rows carry on to the next one.

function rowsOf(table, alias) {
  const t = TABLES[table];
  return t.rows.map((r, i) => {
    const v = {};
    t.cols.forEach((c, j) => (v[alias ? alias + "." + c : c] = r[j]));
    const id = (alias || table) + (i + 1);
    return { id, src: id, v };
  });
}

const from = (table, alias, hl) => ({
  clause: "FROM",
  hl,
  run: () => {
    const rows = rowsOf(table, alias);
    return { rows, view: { kind: "list", note: `${rows.length} cards out of the ${table} drawer.` } };
  },
});

const join = (table, alias, on, kind, hl, why) => ({
  clause: kind === "left" ? "LEFT JOIN" : "JOIN",
  hl,
  run: (prev) => {
    const right = rowsOf(table, alias);
    const out = [];
    let unmatched = 0;
    let fanned = 0;
    for (const l of prev) {
      const hits = right.filter((r) => on({ ...l.v, ...r.v }) === true);
      // Copies are counted per incoming card: how many rows this one card became.
      if (hits.length > 1) fanned++;
      for (const r of hits) out.push({ id: l.id + "+" + r.id, src: l.src, v: { ...l.v, ...r.v }, copies: hits.length });
      if (!hits.length && kind === "left") {
        const blank = {};
        TABLES[table].cols.forEach((c) => (blank[alias + "." + c] = null));
        out.push({ id: l.id + "+none", src: l.src, v: { ...l.v, ...blank }, nullfill: true });
        unmatched++;
      }
      if (!hits.length && kind !== "left") unmatched++;
    }
    let note = `${prev.length} cards in, ${out.length} out.`;
    if (fanned) note += ` ${fanned} card${fanned > 1 ? "s" : ""} matched more than one ${table} row, so ${fanned > 1 ? "they were" : "it was"} copied once per match.`;
    if (kind === "left" && unmatched) note += ` ${unmatched} found no match and kept a row of NULLs.`;
    if (kind !== "left" && unmatched) note += ` ${unmatched} found no match and dropped out.`;
    return { rows: out, view: { kind: "join", note: why ? note + " " + why : note } };
  },
});

const where = (pred, hl, why, clause = "WHERE") => ({
  clause,
  hl,
  run: (prev) => {
    const judged = prev.map((r) => {
      const res = pred(r.v);
      return { ...r, verdict: res.t, why: res.why };
    });
    const kept = judged.filter((r) => r.verdict === true).map(({ verdict, why, ...r }) => r);
    const unknown = judged.filter((r) => r.verdict === null).length;
    let note = `${prev.length} cards in, ${kept.length} kept.`;
    if (unknown) note += ` ${unknown} came out UNKNOWN, and WHERE keeps only TRUE.`;
    return { rows: kept, view: { kind: "filter", judged, note: why ? note + " " + why : note } };
  },
});

const groupBy = (keys, aggs, hl, why) => ({
  clause: "GROUP BY",
  hl,
  run: (prev) => {
    const piles = new Map();
    for (const r of prev) {
      const k = JSON.stringify(keys.map((c) => r.v[c]));
      if (!piles.has(k)) piles.set(k, []);
      piles.get(k).push(r);
    }
    const groups = [];
    const rows = [];
    for (const [k, members] of piles) {
      const v = {};
      keys.forEach((c) => (v[c] = members[0].v[c]));
      for (const a of aggs) v[a.name] = a.fn(members.map((m) => m.v));
      const row = { id: "g" + k, src: "g" + k, v, added: aggs.map((a) => a.name) };
      rows.push(row);
      groups.push({ key: keys.map((c) => members[0].v[c]).join(" · "), members, summary: row });
    }
    const note = `${prev.length} cards in, ${rows.length} piles, one summary card each.`;
    return { rows, view: { kind: "piles", groups, note: why ? note + " " + why : note } };
  },
});

const windowFn = (partKeys, orderBy, name, compute, hl, why) => ({
  clause: "window",
  hl,
  run: (prev) => {
    const parts = new Map();
    for (const r of prev) {
      const k = JSON.stringify(partKeys.map((c) => r.v[c]));
      if (!parts.has(k)) parts.set(k, []);
      parts.get(k).push(r);
    }
    const groups = [];
    const rows = [];
    for (const [k, members] of parts) {
      const sorted = orderBy ? [...members].sort((a, b) => orderBy(a.v, b.v)) : members;
      const vals = sorted.map((r) => r.v);
      sorted.forEach((r, i) => {
        const nr = { ...r, v: { ...r.v, [name]: compute(vals, i) }, added: [name] };
        rows.push(nr);
      });
      groups.push({
        key: partKeys.length ? partKeys.map((c) => show(members[0].v[c])).join(" · ") : "all rows, one partition",
        members: rows.slice(rows.length - sorted.length),
      });
    }
    let note = `${prev.length} cards in, ${rows.length} out: a window adds a column and keeps every card.`;
    note += partKeys.length ? ` ${groups.length} partitions.` : " No PARTITION BY, so every card sits in one partition.";
    return { rows, view: { kind: "partitions", groups, note: why ? note + " " + why : note } };
  },
});

const select = (cols, hl, why, clause = "SELECT") => ({
  clause,
  hl,
  run: (prev) => {
    const rows = prev.map((r) => {
      const v = {};
      for (const [out, src] of cols) v[out] = typeof src === "function" ? src(r.v) : r.v[src];
      return { id: r.id, src: r.src, v, nullfill: r.nullfill };
    });
    const note = `Keeps ${cols.length} column${cols.length > 1 ? "s" : ""}: ${cols.map((c) => c[0]).join(", ")}.`;
    return { rows, view: { kind: "list", note: why ? note + " " + why : note } };
  },
});

const orderBy = (cmp, hl, why) => ({
  clause: "ORDER BY",
  hl,
  run: (prev) => {
    const rows = [...prev].sort(cmp);
    const note = "Same cards, sorted. This is the result.";
    return { rows, view: { kind: "list", note: why ? note + " " + why : note, final: true } };
  },
});

const aside = (clause, hl, label, valuesFn, why) => ({
  clause,
  hl,
  run: (prev) => {
    const values = valuesFn();
    return { rows: prev, view: { kind: "aside", label, values, note: why } };
  },
});

const fail = (clause, hl, message, why) => ({
  clause,
  hl,
  run: (prev) => ({ rows: prev, view: { kind: "error", message, note: why }, stop: true }),
});

const finish = (why) => ({
  clause: "result",
  hl: null,
  run: (prev) => ({ rows: prev, view: { kind: "list", note: why, final: true } }),
});

// SQLite's NULL ordering: NULLs sort first.
const cmp = (a, b) => (a === b ? 0 : isNull(a) ? -1 : isNull(b) ? 1 : a < b ? -1 : 1);
const by = (...cols) => (x, y) => {
  for (const c of cols) {
    const d = cmp((x.v || x)[c], (y.v || y)[c]);
    if (d) return d;
  }
  return 0;
};

// ---------- the six queries ----------

const SQL = {
  fan1: `SELECT c.case_id,
       COUNT(s.slide_id) AS slides,
       COUNT(sc.scan_id) AS scans
FROM cases c
JOIN slides s ON s.case_id = c.case_id
LEFT JOIN scans sc ON sc.slide_id = s.slide_id
GROUP BY c.case_id
ORDER BY c.case_id;`,
  lj1: `SELECT s.case_id, s.label,
       sc.scanner, sc.scanned_at
FROM slides s
LEFT JOIN scans sc ON sc.slide_id = s.slide_id
WHERE sc.qc = 'pass'
ORDER BY s.slide_id;`,
  lj2: `SELECT s.case_id, s.label,
       sc.scanner, sc.scanned_at
FROM slides s
LEFT JOIN scans sc ON sc.slide_id = s.slide_id
                  AND sc.qc = 'pass'
ORDER BY s.slide_id;`,
  ni1: `SELECT s.case_id, s.label
FROM slides s
WHERE s.slide_id NOT IN (SELECT slide_id
                         FROM scans);`,
  ni2: `SELECT s.case_id, s.label
FROM slides s
WHERE NOT EXISTS (
  SELECT 1 FROM scans sc
  WHERE sc.slide_id = s.slide_id);`,
  rn1: `SELECT slide_id, scanner, scanned_at, qc
FROM scans
WHERE ROW_NUMBER() OVER (
        PARTITION BY slide_id
        ORDER BY scanned_at DESC) = 1;`,
  rn2: `WITH ranked AS (
  SELECT slide_id, scanner, scanned_at, qc,
         ROW_NUMBER() OVER (
           PARTITION BY slide_id
           ORDER BY scanned_at DESC) AS rn
  FROM scans
  WHERE slide_id IS NOT NULL
)
SELECT slide_id, scanner, scanned_at, qc
FROM ranked
WHERE rn = 1
ORDER BY slide_id;`,
  lag: (part) => `SELECT scanner, scan_id, scanned_at,
       LAG(scanned_at) OVER (
         ${part}ORDER BY scanned_at
       ) AS prev_scan_at
FROM scans
ORDER BY scanner, scanned_at;`,
  grp1: `SELECT scanner,
       COUNT(*) AS scans,
       SUM(CASE WHEN qc IN ('blur', 'clipped')
                THEN 1 ELSE 0 END) AS failed
FROM scans
GROUP BY scanner
ORDER BY scanner;`,
  grp2: `SELECT scan_id, scanner, qc,
       COUNT(*) OVER (PARTITION BY scanner)
         AS scanner_scans
FROM scans
ORDER BY scanner, scan_id;`,
};
SQL.fan2 = SQL.fan1.replace("COUNT(s.slide_id)", "COUNT(DISTINCT s.slide_id)");

const caseJoin = (r) => eq(r["s.case_id"], r["c.case_id"]);
const scanJoin = (r) => eq(r["sc.slide_id"], r["s.slide_id"]);
const countNotNull = (col) => (rows) => rows.filter((r) => !isNull(r[col])).length;
const countDistinct = (col) => (rows) => new Set(rows.map((r) => r[col]).filter((v) => !isNull(v))).size;

function fanSteps(distinct) {
  return [
    from("cases", "c", "FROM cases c"),
    join("slides", "s", caseJoin, "inner", "JOIN slides s ON s.case_id = c.case_id",
      "Each case card is copied once for each of its slides. That is expected: the question is about slides."),
    join("scans", "sc", scanJoin, "left", "LEFT JOIN scans sc ON sc.slide_id = s.slide_id",
      "Rescanned slides now appear twice, once per scan."),
    groupBy(["c.case_id"], [
      { name: "slides", fn: distinct ? countDistinct("s.slide_id") : countNotNull("s.slide_id") },
      { name: "scans", fn: countNotNull("sc.scan_id") },
    ], "GROUP BY c.case_id",
    distinct
      ? "COUNT(DISTINCT s.slide_id) counts each slide number once per pile, however many times it was copied."
      : "COUNT(s.slide_id) counts cards, not slides. A slide copied by a rescan is counted twice."),
    select([["case_id", "c.case_id"], ["slides", "slides"], ["scans", "scans"]], "SELECT c.case_id,\n       COUNT"),
    orderBy(by("case_id"), "ORDER BY c.case_id",
      distinct
        ? "S26-101 has 3 slides and S26-102 has 2, matching the slides drawer."
        : "S26-101 shows 4 slides and S26-102 shows 3. The slides drawer holds 3 and 2."),
  ];
}

function ljSteps(inOn) {
  const passOn = (r) => and(scanJoin(r), eq(r["sc.qc"], "pass"));
  const steps = [from("slides", "s", "FROM slides s")];
  if (inOn) {
    steps.push(join("scans", "sc", passOn, "left", "LEFT JOIN scans sc ON sc.slide_id = s.slide_id\n                  AND sc.qc = 'pass'",
      "The qc test is part of the match, so a slide with no passing scan still keeps its card, filled with NULLs."));
  } else {
    steps.push(join("scans", "sc", scanJoin, "left", "LEFT JOIN scans sc ON sc.slide_id = s.slide_id",
      "So far so good: slide 7 (never scanned) kept a card of NULLs."));
    steps.push(where((r) => {
      const t = eq(r["sc.qc"], "pass");
      return { t, why: `sc.qc = 'pass' → ${show(r["sc.qc"])} = 'pass' → ${t === null ? "UNKNOWN" : t ? "TRUE" : "FALSE"}` };
    }, "WHERE sc.qc = 'pass'",
    "The NULL cards the LEFT JOIN kept are thrown out here, so the LEFT JOIN now behaves like a plain JOIN."));
  }
  steps.push(select([["case_id", "s.case_id"], ["label", "s.label"], ["scanner", "sc.scanner"], ["scanned_at", "sc.scanned_at"]],
    "SELECT s.case_id, s.label,"));
  steps.push(orderBy((a, b) => cmp(+a.src.slice(1), +b.src.slice(1)), "ORDER BY s.slide_id",
    inOn ? "All 8 slides are listed. The two with no passing scan show NULLs."
      : "Only 6 of the 8 slides are listed. S26-103 A1-2 (never scanned) and S26-104 A1-1 (QC pending) are gone."));
  return steps;
}

function niSteps(exists) {
  const sub = TABLES.scans.rows.map((r) => r[1]);
  if (!exists) {
    return [
      from("slides", "s", "FROM slides s"),
      aside("subquery", "(SELECT slide_id\n                         FROM scans)", "slide_id values from scans",
        () => sub,
        "The subquery returns every scan's slide_id, including the NULL from scan 7, whose barcode did not read."),
      where((r) => {
        const id = r["s.slide_id"];
        if (sub.includes(id)) return { t: false, why: `${id} is in the list → NOT IN is FALSE` };
        return { t: null, why: `${id} ≠ every number, but ${id} ≠ NULL is UNKNOWN → NOT IN is UNKNOWN` };
      }, "WHERE s.slide_id NOT IN",
      "NOT IN means 'not equal to every value in the list'. One NULL in the list makes that unknowable."),
      select([["case_id", "s.case_id"], ["label", "s.label"]], "SELECT s.case_id, s.label"),
      finish("No rows. The query ran without an error and says every slide has been scanned, which is wrong."),
    ];
  }
  return [
    from("slides", "s", "FROM slides s"),
    where((r) => {
      const id = r["s.slide_id"];
      const hits = TABLES.scans.rows.filter((x) => x[1] === id).map((x) => "scan " + x[0]);
      return hits.length
        ? { t: false, why: `a scan exists (${hits.join(", ")}) → NOT EXISTS is FALSE` }
        : { t: true, why: `no scan has slide_id = ${id} → NOT EXISTS is TRUE` };
    }, "WHERE NOT EXISTS (\n  SELECT 1 FROM scans sc\n  WHERE sc.slide_id = s.slide_id)",
    "NOT EXISTS asks a yes-or-no question per card. The NULL scan never equals anything, so it never matches and never gets in the way."),
    select([["case_id", "s.case_id"], ["label", "s.label"]], "SELECT s.case_id, s.label"),
    finish("One row: S26-103 A1-2 has no scan yet."),
  ];
}

function rnSteps(cte) {
  const latest = (a, b) => cmp(b["scanned_at"], a["scanned_at"]);
  const rowNumber = (_rows, i) => i + 1;
  if (!cte) {
    return [
      from("scans", null, "FROM scans"),
      fail("WHERE", "WHERE ROW_NUMBER() OVER", "SQLite: misuse of window function ROW_NUMBER()",
        "WHERE runs before window functions are worked out, so at this point there is no row number to test. SQLite refuses the query, and so does PostgreSQL."),
    ];
  }
  return [
    from("scans", null, "FROM scans"),
    where((r) => {
      const t = !isNull(r.slide_id);
      return { t, why: `slide_id IS NOT NULL → ${show(r.slide_id)} → ${t ? "TRUE" : "FALSE"}` };
    }, "WHERE slide_id IS NOT NULL", "Scan 7 has no slide to belong to, so it is set aside before ranking."),
    windowFn(["slide_id"], latest, "rn", rowNumber,
      "ROW_NUMBER() OVER (\n           PARTITION BY slide_id\n           ORDER BY scanned_at DESC) AS rn",
      "Within each slide, the newest scan gets 1."),
    select([["slide_id", "slide_id"], ["scanner", "scanner"], ["scanned_at", "scanned_at"], ["qc", "qc"], ["rn", "rn"]],
      "SELECT slide_id, scanner, scanned_at, qc,", "The inner query ends here; its rows become the table called ranked."),
    where((r) => {
      const t = r.rn === 1;
      return { t, why: `rn = 1 → ${r.rn} = 1 → ${t ? "TRUE" : "FALSE"}` };
    }, "WHERE rn = 1", "Now rn is an ordinary column of ranked, so WHERE can test it."),
    select([["slide_id", "slide_id"], ["scanner", "scanner"], ["scanned_at", "scanned_at"], ["qc", "qc"]],
      "SELECT slide_id, scanner, scanned_at, qc\nFROM ranked"),
    orderBy(by("slide_id"), "ORDER BY slide_id",
      "One card per scanned slide. Slide 1's blurred scan and slide 5's clipped one lost to their rescans."),
  ];
}

function lagSteps(part) {
  const prev = (rows, i) => (i === 0 ? null : rows[i - 1].scanned_at);
  return [
    from("scans", null, "FROM scans"),
    windowFn(part ? ["scanner"] : [], by("scanned_at"), "prev_scan_at", prev,
      part ? "LAG(scanned_at) OVER (\n         PARTITION BY scanner ORDER BY scanned_at\n       )" : "LAG(scanned_at) OVER (\n         ORDER BY scanned_at\n       )",
      part
        ? "LAG looks back one card within the same scanner's line."
        : "LAG looks back one card in a single line of all scans, so it can reach back to the other scanner."),
    select([["scanner", "scanner"], ["scan_id", "scan_id"], ["scanned_at", "scanned_at"], ["prev_scan_at", "prev_scan_at"]],
      "SELECT scanner, scan_id, scanned_at,"),
    orderBy(by("scanner", "scanned_at"), "ORDER BY scanner, scanned_at",
      part
        ? "Each scanner's first scan of the day has no previous one, so it shows NULL. The rest point back along their own line."
        : "Scan 4, SC-2's first of the day, lists 09:07 as its previous scan, but that was SC-1. Scans 7 and 10 also borrow the other scanner's times."),
  ];
}

function grpSteps(win) {
  if (!win) {
    return [
      from("scans", null, "FROM scans"),
      groupBy(["scanner"], [
        { name: "scans", fn: (rows) => rows.length },
        { name: "failed", fn: (rows) => rows.filter((r) => r.qc === "blur" || r.qc === "clipped").length },
      ], "GROUP BY scanner", "Each pile becomes one summary card; the scans inside it are gone from the result."),
      select([["scanner", "scanner"], ["scans", "scans"], ["failed", "failed"]], "SELECT scanner,"),
      orderBy(by("scanner"), "ORDER BY scanner", "Two rows. To see which scans failed, the detail has to be joined back in."),
    ];
  }
  return [
    from("scans", null, "FROM scans"),
    windowFn(["scanner"], null, "scanner_scans", (rows) => rows.length,
      "COUNT(*) OVER (PARTITION BY scanner)",
      "Same piles as GROUP BY would make, but the count is written on every card instead of replacing them."),
    select([["scan_id", "scan_id"], ["scanner", "scanner"], ["qc", "qc"], ["scanner_scans", "scanner_scans"]], "SELECT scan_id, scanner, qc,"),
    orderBy(by("scanner", "scan_id"), "ORDER BY scanner, scan_id", "Ten rows, each with its scanner's total beside it."),
  ];
}

export const QUERIES = [
  {
    id: "fanout",
    show: ["c.case_id", "s.slide_id", "s.label", "sc.scan_id"],
    title: "The join that doubled",
    ask: "How many slides and scans does each case have?",
    variants: [
      { label: "COUNT(s.slide_id)", sql: SQL.fan1, steps: fanSteps(false) },
      { label: "COUNT(DISTINCT s.slide_id)", sql: SQL.fan2, steps: fanSteps(true) },
    ],
  },
  {
    id: "leftjoin",
    show: ["s.slide_id", "s.case_id", "s.label", "sc.scan_id", "sc.qc"],
    title: "The LEFT JOIN that went missing",
    ask: "List every slide, with its passing scan if it has one.",
    variants: [
      { label: "filter in WHERE", sql: SQL.lj1, steps: ljSteps(false) },
      { label: "filter in ON", sql: SQL.lj2, steps: ljSteps(true) },
    ],
  },
  {
    id: "notin",
    show: ["s.slide_id", "s.case_id", "s.label"],
    title: "NOT IN and the unread barcode",
    ask: "Which slides have never been scanned?",
    variants: [
      { label: "NOT IN", sql: SQL.ni1, steps: niSteps(false) },
      { label: "NOT EXISTS", sql: SQL.ni2, steps: niSteps(true) },
    ],
  },
  {
    id: "latest",
    show: ["scan_id", "slide_id", "scanned_at", "qc"],
    title: "The latest rescan",
    ask: "For each slide, which scan is the newest?",
    variants: [
      { label: "ROW_NUMBER in WHERE", sql: SQL.rn1, steps: rnSteps(false) },
      { label: "ROW_NUMBER in a CTE", sql: SQL.rn2, steps: rnSteps(true) },
    ],
  },
  {
    id: "lag",
    show: ["scan_id", "scanner", "scanned_at"],
    title: "The previous scan",
    ask: "When did the same scanner do its previous scan?",
    variants: [
      { label: "OVER (ORDER BY …)", sql: SQL.lag(""), steps: lagSteps(false) },
      { label: "OVER (PARTITION BY scanner …)", sql: SQL.lag("PARTITION BY scanner "), steps: lagSteps(true) },
    ],
  },
  {
    id: "group",
    show: ["scan_id", "scanner", "qc"],
    title: "Piles or notes in the margin",
    ask: "How many scans did each scanner do?",
    variants: [
      { label: "GROUP BY", sql: SQL.grp1, steps: grpSteps(false) },
      { label: "COUNT(*) OVER", sql: SQL.grp2, steps: grpSteps(true) },
    ],
  },
];

// Run every step of a variant, keeping each step's view.
export function runVariant(variant) {
  const out = [];
  let rows = [];
  for (const step of variant.steps) {
    const res = step.run(rows);
    out.push({ clause: step.clause, hl: step.hl, ...res });
    rows = res.rows;
    if (res.stop) break;
  }
  return out;
}
