const sqlite = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const defaultDatabasePath = path.resolve(__dirname, "..", "fish_analysis.db");
const databasePath = path.resolve(process.env.DATABASE_PATH || defaultDatabasePath);
const databaseDirectory = path.dirname(databasePath);

fs.mkdirSync(databaseDirectory, { recursive: true });

if (!fs.existsSync(databasePath)) {
  if (fs.existsSync(defaultDatabasePath)) {
    fs.copyFileSync(defaultDatabasePath, databasePath);
  } else {
    throw new Error(`SQLite database not found at ${databasePath}`);
  }
}

const db = new sqlite(databasePath, { fileMustExist: true });

db.exec(`
  CREATE TABLE IF NOT EXISTS LOT_GUTS_WEIGHT (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_no      STRING  NOT NULL REFERENCES LOT (lot_no) ON DELETE CASCADE,
    muestra_id  INTEGER REFERENCES MUESTRA (id) ON DELETE SET NULL,
    guts_weight DECIMAL NOT NULL,
    recorded_at DATE    NOT NULL
  )
`);

// Migration: rename wms_code → item_code and remove UNIQUE constraint.
// SQLite does not support DROP CONSTRAINT so we recreate the table.
{
  const cols = db.prepare("PRAGMA table_info(LOT)").all().map(c => c.name);
  if (!cols.includes("item_code")) {
    db.exec(`
      BEGIN TRANSACTION;
      CREATE TABLE LOT_MIGRATED (
        lot_no          STRING NOT NULL PRIMARY KEY,
        supplier        STRING NOT NULL,
        production_date DATE   NOT NULL,
        fish_species    STRING NOT NULL,
        size            STRING NOT NULL,
        type            STRING NOT NULL,
        order_no        STRING NOT NULL,
        item_code       STRING NOT NULL
      );
      INSERT INTO LOT_MIGRATED
        SELECT lot_no, supplier, production_date, fish_species, size, type, order_no, wms_code
        FROM LOT;
      DROP TABLE LOT;
      ALTER TABLE LOT_MIGRATED RENAME TO LOT;
      COMMIT;
    `);
  }
}

function query(sql, params) {
  return db.prepare(sql).all(params);
}

function run(sql, params) {
  return db.prepare(sql).run(params);
}

module.exports = { query, run, databasePath };
