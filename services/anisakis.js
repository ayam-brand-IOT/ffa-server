const db = require("./db");

const SITES = ["guts", "belly", "embedded"];

const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

// Fish analyzed at one site. Inspections saved before the per-site counts
// existed only have the overall fish_analyzed.
function analyzedAt(row, site) {
  const value = row[`fish_analyzed_${site}`];
  return value == null ? toInt(row.fish_analyzed) : toInt(value);
}

/**
 * Derived anisakis statistics, per site.
 *
 *   Prevalence (%) = fish carrying anisakis in that site / fish analyzed in that site * 100
 *   Intensity      = anisakis found in that site / fish carrying anisakis there
 *
 * Intensity is the mean parasite load among *infected* fish only, so it is
 * undefined when no fish were infected at that site. Both return null rather
 * than 0 when their denominator is 0, letting the UI/report print "—".
 */
function computeMetrics(row) {
  if (!row) return null;

  const metrics = { fish_analyzed: toInt(row.fish_analyzed) };
  SITES.forEach((site) => {
    const analyzed = analyzedAt(row, site);
    const infected = toInt(row[`fish_with_${site}`]);
    metrics[`fish_analyzed_${site}`] = analyzed;
    metrics[`prevalence_${site}`] = analyzed > 0 ? (infected / analyzed) * 100 : null;
    metrics[`intensity_${site}`] =
      infected > 0 ? toInt(row[`presence_${site}`]) / infected : null;
  });
  return metrics;
}

function create(data) {
  const { lot_no } = data;
  if (!lot_no) return { message: "Error saving anisakis test: lot_no is required" };

  // Per-site counts; a client that still sends one total applies it to all.
  const analyzed = {};
  SITES.forEach((site) => {
    const value = data[`fish_analyzed_${site}`];
    analyzed[site] = toInt(value == null || value === "" ? data.fish_analyzed : value);
  });
  const overall = Math.max(...SITES.map((site) => analyzed[site]));
  if (overall <= 0) {
    return { message: "Error saving anisakis test: fish analyzed must be greater than 0" };
  }

  const recorded_at = new Date().toISOString();
  const result = db.run(
    `INSERT INTO LOT_ANISAKIS
       (lot_no, fish_analyzed,
        fish_analyzed_guts, fish_analyzed_belly, fish_analyzed_embedded,
        fish_with_guts, fish_with_belly, fish_with_embedded,
        presence_guts, presence_belly, presence_embedded, recorded_at)
     VALUES
       (@lot_no, @fish_analyzed,
        @fish_analyzed_guts, @fish_analyzed_belly, @fish_analyzed_embedded,
        @fish_with_guts, @fish_with_belly, @fish_with_embedded,
        @presence_guts, @presence_belly, @presence_embedded, @recorded_at)`,
    {
      lot_no,
      fish_analyzed: overall,
      fish_analyzed_guts:     analyzed.guts,
      fish_analyzed_belly:    analyzed.belly,
      fish_analyzed_embedded: analyzed.embedded,
      fish_with_guts:     toInt(data.fish_with_guts),
      fish_with_belly:    toInt(data.fish_with_belly),
      fish_with_embedded: toInt(data.fish_with_embedded),
      presence_guts:      toInt(data.presence_guts),
      presence_belly:     toInt(data.presence_belly),
      presence_embedded:  toInt(data.presence_embedded),
      recorded_at,
    }
  );

  return {
    message: result.changes ? "Anisakis test saved" : "Error saving anisakis test",
  };
}

function getAllFrom(lot_no) {
  const rows = db.query(
    `SELECT * FROM LOT_ANISAKIS WHERE lot_no = ? ORDER BY recorded_at DESC`,
    [lot_no]
  );
  const data = rows.map((row) => ({ ...row, metrics: computeMetrics(row) }));
  return { data };
}

function getLatestFrom(lot_no) {
  const rows = db.query(
    `SELECT * FROM LOT_ANISAKIS WHERE lot_no = ? ORDER BY recorded_at DESC LIMIT 1`,
    [lot_no]
  );
  if (rows.length === 0) return null;
  return { ...rows[0], metrics: computeMetrics(rows[0]) };
}

module.exports = { create, getAllFrom, getLatestFrom, computeMetrics };
