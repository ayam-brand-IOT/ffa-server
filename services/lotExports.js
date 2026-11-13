const fs = require("fs");
const path = require("path");
const db = require("./db");
const lotReport = require("./lotReport");
const pdfReport = require("./pdfReport");
const lotExcel = require("./lotExcel");

const exportsPath = path.resolve(
  process.env.EXPORTS_PATH || path.join(__dirname, "..", "exports")
);

fs.mkdirSync(exportsPath, { recursive: true });

// KL time (UTC+8, no DST), so folder names match the time on the station.
function klStamp(date) {
  const d = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

function writePdf(data, uploadsPath, file) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(file);
    out.on("finish", resolve);
    out.on("error", reject);
    const doc = pdfReport.generateLotPdf(data, uploadsPath);
    doc.on("error", reject);
    doc.pipe(out);
  });
}

// Writes the lot's PDF report and Excel into a new folder under exportsPath
// and records it. Returns the saved row, or null when the lot does not exist.
async function create(lot_no, uploadsPath) {
  const data = lotReport.getLotReportData(lot_no);
  const workbook = lotExcel.buildLotWorkbook(lot_no);
  if (!data || !workbook) return null;

  const now = new Date();
  const stamp = klStamp(now);
  // Lot numbers are typed by the operator: keep them out of the path.
  const safeLot = String(lot_no).replace(/[^\w.-]/g, "_");
  const folder = `${stamp}_${safeLot}`;
  const pdf_file = `${stamp.slice(0, 8)}_${safeLot}.pdf`;
  const xlsx_file = `${stamp.slice(0, 8)}_${safeLot}.xlsx`;

  const dir = path.join(exportsPath, folder);
  fs.mkdirSync(dir, { recursive: true });
  try {
    await writePdf(data, uploadsPath, path.join(dir, pdf_file));
    await workbook.xlsx.writeFile(path.join(dir, xlsx_file));
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }

  const { lastInsertRowid } = db.run(
    `INSERT INTO LOT_EXPORT (lot_no, stamp, folder, pdf_file, xlsx_file, created_at)
     VALUES (@lot_no, @stamp, @folder, @pdf_file, @xlsx_file, @created_at)`,
    { lot_no: String(lot_no), stamp, folder, pdf_file, xlsx_file, created_at: now.toISOString() }
  );
  return getById(lastInsertRowid);
}

function getById(id) {
  return db.query(`SELECT * FROM LOT_EXPORT WHERE id = ?`, [id])[0] ?? null;
}

// An export is looked up by its id (e.g. 12) or its stamp (e.g. 20261113-110405).
function find(key) {
  if (/^\d+$/.test(key)) return getById(Number(key));
  return (
    db.query(`SELECT * FROM LOT_EXPORT WHERE stamp = ? ORDER BY id DESC LIMIT 1`, [key])[0] ??
    null
  );
}

function list(lot_no) {
  return lot_no == null
    ? db.query(`SELECT * FROM LOT_EXPORT ORDER BY id DESC`, [])
    : db.query(`SELECT * FROM LOT_EXPORT WHERE lot_no = ? ORDER BY id DESC`, [String(lot_no)]);
}

function filePath(row, kind) {
  const name = kind === "pdf" ? row.pdf_file : kind === "excel" ? row.xlsx_file : null;
  return name && path.join(exportsPath, row.folder, name);
}

module.exports = { create, find, list, filePath, exportsPath };
