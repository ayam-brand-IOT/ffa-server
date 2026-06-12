const db = require("./db");
const config = require("../config");

// Human-readable label for each load cell type
const LOAD_CELL_LABELS = {
  belly: "Belly Resistance",
  weight: "Fish Weight",
};

function normalizeLoadCell(loadCell) {
  return LOAD_CELL_LABELS[loadCell] || loadCell;
}

function create(data) {
  const { load_cell, notes } = data;
  const calibrated_at = new Date().toISOString();
  const result = db.run(
    `INSERT INTO CALIBRATION_HISTORY (load_cell, calibrated_at, notes)
     VALUES (@load_cell, @calibrated_at, @notes)`,
    { load_cell, calibrated_at, notes: notes ?? null }
  );
  return {
    message: result.changes ? "Calibration recorded" : "Error recording calibration",
    id: result.lastInsertRowid,
  };
}

function getAll() {
  const data = db.query(
    `SELECT * FROM CALIBRATION_HISTORY ORDER BY calibrated_at DESC`,
    []
  );
  return { data: data.map(row => ({ ...row, load_cell_label: normalizeLoadCell(row.load_cell) })) };
}

function getMultiple(page = 1) {
  const offset = (page - 1) * config.listPerPage;
  const data = db.query(
    `SELECT * FROM CALIBRATION_HISTORY ORDER BY calibrated_at DESC LIMIT ?,?`,
    [offset, config.listPerPage]
  );
  return {
    data: data.map(row => ({ ...row, load_cell_label: normalizeLoadCell(row.load_cell) })),
    meta: { page },
  };
}

module.exports = { create, getAll, getMultiple };
