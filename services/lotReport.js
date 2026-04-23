const db = require("./db");

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

  const extraImages = db.query(
    `SELECT image FROM LOT_IMAGE WHERE lot_no = ?`,
    [lot_no]
  );

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
    extraImages: extraImages.map((r) => r.image),
  };
}

module.exports = { getLotReportData };
