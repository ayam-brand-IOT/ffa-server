const db = require("./db");
const sizeRanges = require("./sizeRanges");
const anisakisService = require("./anisakis");

// Build a histogram of fish lengths plus the fitted normal (Gaussian) curve.
// Returns null when there is not enough data to draw a meaningful chart.
function buildLengthDistribution(values, range) {
  const n = values.length;
  if (n < 2) return null;

  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  let min = Math.min(...values);
  let max = Math.max(...values);

  // Pad the domain a little (and include the spec range) so the curve tails show
  let domainMin = min;
  let domainMax = max;
  if (range) {
    if (range.length_min != null) domainMin = Math.min(domainMin, range.length_min);
    if (range.length_max != null) domainMax = Math.max(domainMax, range.length_max);
  }
  const pad = (domainMax - domainMin || 1) * 0.1;
  domainMin -= pad;
  domainMax += pad;

  // Bin count: ~sqrt(n) clamped to a readable range
  const binCount = Math.max(5, Math.min(15, Math.round(Math.sqrt(n))));
  const binWidth = (domainMax - domainMin) / binCount;

  const bins = Array.from({ length: binCount }, (_, i) => ({
    x0: domainMin + i * binWidth,
    x1: domainMin + (i + 1) * binWidth,
    count: 0,
  }));

  values.forEach((v) => {
    let idx = Math.floor((v - domainMin) / binWidth);
    if (idx < 0) idx = 0;
    if (idx >= binCount) idx = binCount - 1;
    bins[idx].count++;
  });

  // Fitted normal curve sampled across the domain (probability density)
  const SAMPLES = 80;
  const curve = [];
  if (std > 0) {
    const coeff = 1 / (std * Math.sqrt(2 * Math.PI));
    for (let i = 0; i <= SAMPLES; i++) {
      const x = domainMin + (i / SAMPLES) * (domainMax - domainMin);
      const y = coeff * Math.exp(-((x - mean) ** 2) / (2 * variance));
      curve.push({ x, y });
    }
  }

  return {
    count: n,
    mean,
    std,
    min,
    max,
    domainMin,
    domainMax,
    binWidth,
    bins,
    curve,
    maxBinCount: Math.max(...bins.map((b) => b.count)),
    maxCurveY: curve.length ? Math.max(...curve.map((c) => c.y)) : 0,
  };
}

function getLotReportData(lot_no) {
  const lot = db.query(`SELECT * FROM LOT WHERE lot_no = ?`, [lot_no]);
  if (!lot.length) return null;

  const summary = db.query(
    `SELECT
       COUNT(*)        AS sample_count,
       AVG(weight)     AS avg_weight,
       AVG(length)     AS avg_length,
       AVG(height)     AS avg_height
     FROM MUESTRA WHERE lot_no = ?`,
    [lot_no]
  );

  const defects = db.query(
    `SELECT
       d.name,
       COUNT(*) AS count
     FROM MUESTRA_DEFECT md
     JOIN DEFFECTS  d  ON md.defect_id  = d.id
     JOIN MUESTRA   m  ON md.muestra_id = m.id
     WHERE m.lot_no = ?
     GROUP BY d.id, d.name
     ORDER BY count DESC`,
    [lot_no]
  );

  const brokenBelly = db.query(
    `SELECT COUNT(*) AS test_count, AVG(break_point) AS avg_break_point
     FROM LOT_TENSION WHERE lot_no = ?`,
    [lot_no]
  );

  const brokenBellyPoints = db.query(
    `SELECT break_point FROM LOT_TENSION WHERE lot_no = ? ORDER BY rowid ASC`,
    [lot_no]
  );

  const gutsWeight = db.query(
    `SELECT guts_weight, recorded_at FROM LOT_GUTS_WEIGHT WHERE lot_no = ? ORDER BY recorded_at DESC LIMIT 1`,
    [lot_no]
  );

  // Most recent anisakis inspection, with prevalence/intensity derived from it.
  const anisakis = anisakisService.getLatestFrom(lot_no);

  const extraImages = db.query(
    `SELECT image FROM LOT_IMAGE WHERE lot_no = ?`,
    [lot_no]
  );

  const lengthSpecRow = db.query(
    `SELECT
       SUM(CASE WHEN length_in_spec IS NOT NULL THEN 1 ELSE 0 END) AS evaluated,
       SUM(CASE WHEN length_in_spec = 1         THEN 1 ELSE 0 END) AS in_spec
     FROM MUESTRA WHERE lot_no = ?`,
    [lot_no]
  );

  const range = sizeRanges.getRangeForSize(lot[0].size);
  const evaluated = lengthSpecRow[0]?.evaluated ?? 0;
  const inSpec = lengthSpecRow[0]?.in_spec ?? 0;

  const lengthRows = db.query(
    `SELECT length FROM MUESTRA WHERE lot_no = ? AND length IS NOT NULL`,
    [lot_no]
  );
  const lengthDistribution = buildLengthDistribution(
    lengthRows.map((r) => Number(r.length)).filter((n) => Number.isFinite(n)),
    range
  );

  const lengthSpec = {
    range,
    rangeLabel: range
      ? `${range.length_min ?? "—"} – ${range.length_max ?? "—"} cm`
      : "Not defined",
    evaluated,
    inSpec,
    outOfSpec: evaluated - inSpec,
    pct: evaluated > 0 ? ((inSpec / evaluated) * 100).toFixed(1) : "0.0",
  };

  const sampleCount = summary[0]?.sample_count ?? 0;

  const defectsWithPct = defects.map((d) => ({
    name: d.name,
    count: d.count,
    pct: sampleCount > 0 ? ((d.count / sampleCount) * 100).toFixed(1) : "0.0",
  }));

  return {
    lot: lot[0],
    summary: summary[0] ?? { sample_count: 0, avg_weight: 0, avg_length: 0, avg_height: 0 },
    defects: defectsWithPct,
    brokenBelly: brokenBelly[0] ?? { test_count: 0, avg_break_point: 0 },
    brokenBellyPoints: brokenBellyPoints.map((r) => r.break_point),
    gutsWeight: gutsWeight[0] ?? null,
    anisakis,
    extraImages: extraImages.map((r) => r.image),
    lengthSpec,
    lengthDistribution,
  };
}

module.exports = { getLotReportData };
