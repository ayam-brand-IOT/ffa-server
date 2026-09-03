const db = require("./db");

const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/**
 * Derived anisakis statistics.
 *
 *   Prevalence (%) = fish carrying anisakis in that site / fish analyzed * 100
 *   Intensity      = anisakis found in that site / fish carrying anisakis there
 *
 * Intensity is the mean parasite load among *infected* fish only, so it is
 * undefined when no fish were infected at that site. Both return null rather
 * than 0 when their denominator is 0, letting the UI/report print "—".
 */
function computeMetrics(row) {
  if (!row) return null;

  const analyzed = toInt(row.fish_analyzed);
  const prevalence = (withAnisakis) =>
    analyzed > 0 ? (toInt(withAnisakis) / analyzed) * 100 : null;
  const intensity = (presence, withAnisakis) =>
    toInt(withAnisakis) > 0 ? toInt(presence) / toInt(withAnisakis) : null;

  return {
    fish_analyzed: analyzed,
    prevalence_guts:     prevalence(row.fish_with_guts),
    prevalence_belly:    prevalence(row.fish_with_belly),
    prevalence_embedded: prevalence(row.fish_with_embedded),
    intensity_guts:     intensity(row.presence_guts,     row.fish_with_guts),
    intensity_belly:    intensity(row.presence_belly,    row.fish_with_belly),
    intensity_embedded: intensity(row.presence_embedded, row.fish_with_embedded),
  };
}

function create(data) {
  const {
    lot_no,
    fish_analyzed,
    fish_with_guts,
    fish_with_belly,
    fish_with_embedded,
    presence_guts,
    presence_belly,
    presence_embedded,
  } = data;

  if (!lot_no) return { message: "Error saving anisakis test: lot_no is required" };

  const analyzed = toInt(fish_analyzed);
  if (analyzed <= 0) {
    return { message: "Error saving anisakis test: fish analyzed must be greater than 0" };
  }

  const recorded_at = new Date().toISOString();
  const result = db.run(
    `INSERT INTO LOT_ANISAKIS
       (lot_no, fish_analyzed, fish_with_guts, fish_with_belly, fish_with_embedded,
        presence_guts, presence_belly, presence_embedded, recorded_at)
     VALUES
       (@lot_no, @fish_analyzed, @fish_with_guts, @fish_with_belly, @fish_with_embedded,
        @presence_guts, @presence_belly, @presence_embedded, @recorded_at)`,
    {
      lot_no,
      fish_analyzed: analyzed,
      fish_with_guts:     toInt(fish_with_guts),
      fish_with_belly:    toInt(fish_with_belly),
      fish_with_embedded: toInt(fish_with_embedded),
      presence_guts:      toInt(presence_guts),
      presence_belly:     toInt(presence_belly),
      presence_embedded:  toInt(presence_embedded),
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
