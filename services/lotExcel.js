const Excel = require("exceljs");
const lot = require("./lots");
const muestra = require("./muestras");
const lot_anisakis = require("./anisakis");
const sizeClasses = require("./sizeClasses");

// KL is UTC+8 with no DST — offset is always fixed
function toKLParts(isoString) {
  const d = new Date(new Date(isoString).getTime() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, "0");
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  return { date, time };
}

// One row per sample of the lot, plus an Anisakis sheet when the lot was
// inspected. Returns null when the lot does not exist.
function buildLotWorkbook(lot_no) {
  const lotInfo = lot.getByLotNo(lot_no);
  if (!lotInfo) return null;

  // Una columna por defecto: 1 si presente, 0 si no
  const allDefects = muestra.getDefects();

  // Weight range of each size, for the "Weight Range" column
  const rangeLabels = sizeClasses.rangeLabels();

  // IT wants redundant measurement columns per fish type (for now WR & HGT):
  // the sample's weight/length/height land in the columns matching the lot's
  // type; the other type's columns stay blank.
  const TYPE_COLUMNS = ["WR", "HGT"];

  const baseHeaders = [
    { header: "Lot #",         key: "lot_no" },
    { header: "Fish Species",  key: "fish_species" },
    { header: "Type",          key: "type" },
    { header: "Size",          key: "size" },
    { header: "Item Code",     key: "item_code" },
    { header: "Order No",      key: "order_no" },
    { header: "Supplier",      key: "supplier" },
  ];

  const typeMeasureHeaders = [];
  TYPE_COLUMNS.forEach((t) => {
    const k = t.toLowerCase();
    typeMeasureHeaders.push(
      { header: `${t} Weight`, key: `${k}_weight` },
      { header: `${t} Length`, key: `${k}_length` },
      { header: `${t} Height`, key: `${k}_height` },
    );
  });

  const tailHeaders = [
    { header: "Weight Range",   key: "weight_range" },
    { header: "Date",           key: "sample_date" },
    { header: "Time (KL)",      key: "sample_time" },
  ];

  const defectHeaders = allDefects.map(d => ({
    header: d.name,
    key: `def_${d.id}`,
  }));

  const headers = [...baseHeaders, ...typeMeasureHeaders, ...tailHeaders, ...defectHeaders];

  const { data } = muestra.getByLotNo(lot_no);

  const enrichedData = data.map(sample => {
    const presentDefects = sample.defects
      ? sample.defects.split(",").map(s => s.trim())
      : [];

    const defectCols = {};
    allDefects.forEach(d => {
      defectCols[`def_${d.id}`] = presentDefects.includes(d.name) ? 1 : 0;
    });

    const { date: sample_date, time: sample_time } = toKLParts(sample.date);

    // Route the measurements into the column group matching the lot's type
    const lotType = (lotInfo.type || "").trim().toUpperCase();
    const typeMeasureCols = {};
    TYPE_COLUMNS.forEach((t) => {
      const k = t.toLowerCase();
      const match = lotType === t;
      typeMeasureCols[`${k}_weight`] = match ? sample.weight : "";
      typeMeasureCols[`${k}_length`] = match ? sample.length : "";
      typeMeasureCols[`${k}_height`] = match ? sample.height : "";
    });

    return {
      ...sample,
      fish_species: lotInfo.fish_species,
      type: lotInfo.type,
      // Each fish's own size, from its weight
      size: sample.size ?? "",
      item_code: lotInfo.item_code,
      order_no: lotInfo.order_no,
      supplier: lotInfo.supplier,
      ...typeMeasureCols,
      weight_range: sample.size ? rangeLabels[sample.size] ?? "" : "",
      sample_date,
      sample_time,
      ...defectCols,
    };
  });

  const workbook = new Excel.Workbook();
  const worksheet = workbook.addWorksheet("My Sheet");
  worksheet.columns = headers;
  enrichedData.forEach((row) => worksheet.addRow(row));

  // Anisakis is measured once per lot, not per sample, so it gets its own sheet
  // instead of repeating identical values on every fish row.
  const anisakis = lot_anisakis.getLatestFrom(lot_no);
  if (anisakis) addAnisakisSheet(workbook, anisakis);
  return workbook;
}

// Lays out the anisakis results in the same shape as the source analysis
// workbook: raw inputs on the left, derived metrics on the right, and a
// summary table underneath.
function addAnisakisSheet(workbook, anisakis) {
  const ws = workbook.addWorksheet("Anisakis");
  const m  = anisakis.metrics;
  const num = (v, decimals) => (v == null ? "N/A" : Number(v.toFixed(decimals)));

  ws.columns = [
    { width: 38 }, { width: 10 }, { width: 4 },
    { width: 26 }, { width: 12 }, { width: 12 },
  ];

  const bold = (cell) => { cell.font = { bold: true }; };

  bold(ws.getCell("A1"));  ws.getCell("A1").value = "User Input:";
  bold(ws.getCell("D1"));  ws.getCell("D1").value = "Calculation";
  bold(ws.getCell("E1"));  ws.getCell("E1").value = "Result";

  const inputs = [
    ["Nb of fish analyzed in Guts",                m.fish_analyzed_guts],
    ["Nb of fish analyzed in Belly",               m.fish_analyzed_belly],
    ["Nb of fish analyzed in Embedded",            m.fish_analyzed_embedded],
    ["Total Nb of fish with anisakis in Guts",     anisakis.fish_with_guts],
    ["Total Nb of fish with Anisakis in Belly",    anisakis.fish_with_belly],
    ["Total Nb of fish with Anisakis in Embedded", anisakis.fish_with_embedded],
    ["Nb of Anisakis Presence In Guts",            anisakis.presence_guts],
    ["Nb of Anisakis Presence in Belly",           anisakis.presence_belly],
    ["Nb of Anisakis Presence in Embedded",        anisakis.presence_embedded],
  ];
  inputs.forEach(([label, value], i) => {
    ws.getCell(`A${i + 2}`).value = label;
    ws.getCell(`B${i + 2}`).value = value ?? 0;
  });

  const calcs = [
    ["Prevalence in Guts (%)",     num(m.prevalence_guts, 2)],
    ["Prevalence in Belly (%)",    num(m.prevalence_belly, 2)],
    ["Prevalence in Embedded (%)", num(m.prevalence_embedded, 2)],
    ["Intensity in Guts",          num(m.intensity_guts, 4)],
    ["Intensity in Belly",         num(m.intensity_belly, 4)],
    ["Intensity in Embedded",      num(m.intensity_embedded, 4)],
  ];
  calcs.forEach(([label, value], i) => {
    ws.getCell(`D${i + 2}`).value = label;
    ws.getCell(`E${i + 2}`).value = value;
  });

  bold(ws.getCell("D12")); ws.getCell("D12").value = "Report:";
  ["Anisakis in", "Prevalence", "Intensity"].forEach((h, i) => {
    const cell = ws.getCell(13, 4 + i);
    cell.value = h;
    bold(cell);
  });

  const report = [
    ["Anisakis in Guts",     num(m.prevalence_guts, 2),     num(m.intensity_guts, 4)],
    ["Anisakis in Belly",    num(m.prevalence_belly, 2),    num(m.intensity_belly, 4)],
    ["Anisakis in Embedded", num(m.prevalence_embedded, 2), num(m.intensity_embedded, 4)],
  ];
  report.forEach((row, r) => {
    row.forEach((value, c) => { ws.getCell(14 + r, 4 + c).value = value; });
  });
}

module.exports = { buildLotWorkbook };
