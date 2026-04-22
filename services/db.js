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

function query(sql, params) {
  return db.prepare(sql).all(params);
}

function run(sql, params) {
  return db.prepare(sql).run(params);
}

module.exports = { query, run, databasePath };
