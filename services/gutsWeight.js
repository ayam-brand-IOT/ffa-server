const db = require("./db");

function create(data) {
  const { lot_no, muestra_id, weight } = data;
  const recorded_at = new Date().toISOString();
  const result = db.run(
    `INSERT INTO LOT_GUTS_WEIGHT (lot_no, muestra_id, guts_weight, recorded_at)
     VALUES (@lot_no, @muestra_id, @guts_weight, @recorded_at)`,
    { lot_no, muestra_id: muestra_id ?? null, guts_weight: weight, recorded_at }
  );
  return { message: result.changes ? "Guts weight saved" : "Error saving guts weight" };
}

function getAllFrom(lot_no) {
  const data = db.query(
    `SELECT lgw.*, m.image, m.weight AS muestra_weight
     FROM LOT_GUTS_WEIGHT lgw
     LEFT JOIN MUESTRA m ON lgw.muestra_id = m.id
     WHERE lgw.lot_no = ?
     ORDER BY lgw.recorded_at DESC`,
    [lot_no]
  );
  return { data };
}

function getLatestFrom(lot_no) {
  const data = db.query(
    `SELECT * FROM LOT_GUTS_WEIGHT WHERE lot_no = ? ORDER BY recorded_at DESC LIMIT 1`,
    [lot_no]
  );
  return data.length > 0 ? data[0] : null;
}

module.exports = { create, getAllFrom, getLatestFrom };
