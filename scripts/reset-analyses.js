// Deletes every lot and everything recorded for it (samples, defects, belly
// tests, guts weights, extra images, anisakis), keeping the defect list,
// calibration history and configuration. The image files under UPLOADS_PATH
// are left on disk; move them aside separately.
//
// Back up the database first. Usage (inside the container):
//   node scripts/reset-analyses.js --yes
const db = require("../services/db");

const TABLES = [
  "MUESTRA_DEFECT",
  "LOT_GUTS_WEIGHT",
  "LOT_ANISAKIS",
  "LOT_TENSION",
  "LOT_IMAGE",
  "MUESTRA",
  "LOT",
];

if (!process.argv.includes("--yes")) {
  console.error(`This deletes all lots and analyses from ${db.databasePath}. Re-run with --yes.`);
  process.exit(1);
}

const existing = new Set(
  db.query("SELECT name FROM sqlite_master WHERE type = 'table'", []).map((t) => t.name)
);

db.run("BEGIN", {});
try {
  TABLES.filter((t) => existing.has(t)).forEach((table) => {
    const { changes } = db.run(`DELETE FROM ${table}`, {});
    console.log(`${table}: ${changes} rows deleted`);
  });
  db.run("COMMIT", {});
} catch (error) {
  db.run("ROLLBACK", {});
  throw error;
}
