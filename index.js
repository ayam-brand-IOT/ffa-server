const fs = require("fs");
const cors = require("cors");
const path = require("path"); // import path
const multer = require("multer");
const Excel = require("exceljs");
const express = require("express");
const { warn, log } = require("console");
const lot = require("./services/lots");
const muestra = require("./services/muestras");
const lot_image = require("./services/extraImages");
const lot_tension = require("./services/tensionTest");
const lot_guts   = require("./services/gutsWeight");
const lot_anisakis = require("./services/anisakis");
const lotReport  = require("./services/lotReport");
const pdfReport  = require("./services/pdfReport");
const calibration = require("./services/calibrationHistory");
const sizeRanges  = require("./services/sizeRanges");
// const { v4: uuidv4 } = require('uuid'); // import uuid

const app = express();
const port = Number(process.env.PORT || 3002);
const uploadsPath = path.resolve(
  process.env.UPLOADS_PATH || path.join(__dirname, "muestras")
);

fs.mkdirSync(uploadsPath, { recursive: true });

app.use(cors({ origin: "*" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"))); // serve static files from the "public" directory

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsPath);
  },
  filename: function (req, file, cb) {
    // const uniqueFilename = `${uuidv4()}-${file.originalname}`
    const uniqueFilename = `${Date.now()}.jpg`;
    cb(null, uniqueFilename);
  },
});

function sendUploadedImage(res, filename) {
  const file = path.join(uploadsPath, path.basename(filename));
  if (fs.existsSync(file)) res.sendFile(path.resolve(file));
  else res.status(422).json({ error: "There's no Image" });
}

const upload = multer({
  storage: storage,
  limits: { fieldSize: 25 * 1024 * 1024 },
});

// KL is UTC+8 with no DST — offset is always fixed
function toKLParts(isoString) {
  const d = new Date(new Date(isoString).getTime() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, "0");
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  return { date, time };
}

async function generateExcelFile(data, headers, anisakis) {
  const workbook = new Excel.Workbook();
  const worksheet = workbook.addWorksheet("My Sheet");

  worksheet.columns = headers;
  
  data.forEach((row) => worksheet.addRow(row));

  // Anisakis is measured once per lot, not per sample, so it gets its own sheet
  // instead of repeating identical values on every fish row.
  if (anisakis) addAnisakisSheet(workbook, anisakis);

  const filePath = path.join(__dirname, "data.xlsx");
  await workbook.xlsx.writeFile(filePath);
  return filePath;
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
    ["Nb fish analyzed",         anisakis.fish_analyzed],
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

  bold(ws.getCell("D11")); ws.getCell("D11").value = "Report:";
  ["Anisakis in", "Prevalence", "Intensity"].forEach((h, i) => {
    const cell = ws.getCell(12, 4 + i);
    cell.value = h;
    bold(cell);
  });

  const report = [
    ["Anisakis in Guts",     num(m.prevalence_guts, 2),     num(m.intensity_guts, 4)],
    ["Anisakis in Belly",    num(m.prevalence_belly, 2),    num(m.intensity_belly, 4)],
    ["Anisakis in Embedded", num(m.prevalence_embedded, 2), num(m.intensity_embedded, 4)],
  ];
  report.forEach((row, r) => {
    row.forEach((value, c) => { ws.getCell(13 + r, 4 + c).value = value; });
  });
}

// POST handler for adding data with image upload
app.post("/add", upload.single("image"), (req, res) => {
  const newData = req.body;
  // generate filename with datetime
  newData.defects = JSON.parse(req.body.defects);
  newData.image = req.file.filename;
  muestra.create(newData);
  res.send(`New data added successfully!`);
});

app.post("/add-lot-image", upload.single("image"), (req, res) => {
  const newData = req.body;
  // generate filename with datetime
  newData.image = req.file.filename;
  lot_image.create(newData);
  res.send(`New data added successfully!`);
});

app.post("/add-lot-tension", (req, res) => {
  const newData = req.body;
  lot_tension.create(newData);
  res.send(`New data added successfully!`);
});

app.post("/add-guts-weight", (req, res) => {
  const result = lot_guts.create(req.body);
  res.json(result);
});

app.post("/add-anisakis", (req, res) => {
  const result = lot_anisakis.create(req.body);
  res.json(result);
});

app.get("/size-ranges", (req, res) => {
  res.json(sizeRanges.getRanges());
});

app.post("/size-ranges", (req, res) => {
  try {
    res.json(sizeRanges.saveRanges(req.body));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save size ranges" });
  }
});

app.post("/add-calibration", (req, res) => {
  const result = calibration.create(req.body);
  res.json(result);
});

app.get("/calibration-history", (req, res) => {
  res.json(calibration.getAll());
});

app.get("/calibration-history/:page", (req, res) => {
  const page = req.params.page || 1;
  res.json(calibration.getMultiple(page));
});

app.get("/lot_guts_weight/:lot_no", (req, res) => {
  const data = lot_guts.getAllFrom(req.params.lot_no);
  res.json(data);
});

app.get("/lot_guts_weight_latest/:lot_no", (req, res) => {
  const data = lot_guts.getLatestFrom(req.params.lot_no);
  res.json(data ?? {});
});

app.get("/lot_anisakis/:lot_no", (req, res) => {
  res.json(lot_anisakis.getAllFrom(req.params.lot_no));
});

app.get("/lot_anisakis_latest/:lot_no", (req, res) => {
  res.json(lot_anisakis.getLatestFrom(req.params.lot_no) ?? {});
});

app.get("/history/:page", (req, res) => {
  const page = req.params.page || 1;
  const data = muestra.getMultiple(page);
  res.send(data);
});

app.get("/history", (req, res) => {
  const data = muestra.getAll();
  res.send(data);
});

app.get("/lot_samples/:lot_no", (req, res) => {
  const lot_no = req.params.lot_no;
  const data = muestra.getAllFrom(lot_no);
  res.send(data);
});

app.get("/lot_samples_full/:lot_no", (req, res) => {
  const lot_no = req.params.lot_no;
  const data = muestra.getByLotNo(lot_no);
  res.send(data);
});

app.get("/lot_images/:lot_no", (req, res) => {
  const lot_no = req.params.lot_no;
  const data = lot_image.getAllFrom(lot_no);
  res.send(data);
});

app.get("/muestra_image/:path", (req, res) => {
  sendUploadedImage(res, req.params.path);
});

app.get("/lot_image/:path", (req, res) => {
  sendUploadedImage(res, req.params.path);
});

app.get("/lot_tension/:lot_no", (req, res) => {
  const lot_no = req.params.lot_no;
  const data = lot_tension.getAllFrom(lot_no);
  res.send(data);
});

// POST handler for selecting data
app.get("/select/:id", (req, res) => {
  const id = req.params.id;
  const result = muestra.getById(id);
  if (result) {
    res.send(result);
  } else {
    warn(`Data with ID ${id} not found.`);
    res.send(`Data with ID ${id} not found.`);
  }
});

// POST handler for deleting data
app.post("/delete", (req, res) => {
  const id = req.body.id;
  const existing = muestra.getById(id);
  if (!existing || !existing.data || existing.data.length === 0) {
    return res.status(404).send(`Data with ID ${id} not found.`);
  }
  muestra.remove(id);
  res.send(`Data with ID ${id} deleted successfully!`);
});

app.post("/add_lot", (req, res) => {
  const newData = req.body;
  lot.add(newData);
  res.send(`New data added successfully!`);
});

app.post("/edit_lot", (req, res) => {
  const newData = req.body;
  lot.edit(newData);
  res.send(`Data edited successfully!`);
});

app.get("/lots", (req, res) => {
  const data = lot.getAll();
  res.send(data);
});

app.get("/lots/:page", (req, res) => {
  const page = req.params.page || 1;
  const data = lot.getMultiple(page);
  res.send(data);
});

// PDF REPORT
app.get("/download-lot-report/:lot_no", (req, res) => {
  const lot_no = req.params.lot_no;
  const data = lotReport.getLotReportData(lot_no);

  if (!data) {
    return res.status(404).json({ error: `Lot ${lot_no} not found` });
  }

  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `${datePrefix}_${lot_no}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = pdfReport.generateLotPdf(data, uploadsPath);
  doc.pipe(res);
});

// EXCEL
app.get("/download-lot-samples/:lot_no", async (req, res) => {
  const lot_no = req.params.lot_no;

  try {
    const lotInfo = lot.getByLotNo(lot_no);
    if (!lotInfo) return res.status(404).send("Lot not found");

    // Una columna por defecto: 1 si presente, 0 si no
    const allDefects = muestra.getDefects();

    // Acceptable length range for this lot's size
    const range = sizeRanges.getRangeForSize(lotInfo.size);
    const rangeLabel = range
      ? `${range.length_min ?? "—"} - ${range.length_max ?? "—"}`
      : "—";

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
      { header: "Length Range",   key: "length_range" },
      { header: "Length In Spec", key: "length_in_spec" },
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
        size: lotInfo.size,
        item_code: lotInfo.item_code,
        order_no: lotInfo.order_no,
        supplier: lotInfo.supplier,
        ...typeMeasureCols,
        length_range: rangeLabel,
        // 1 = in spec, 0 = out of spec, blank = not evaluated (legacy / no range)
        length_in_spec: sample.length_in_spec == null ? "" : sample.length_in_spec,
        sample_date,
        sample_time,
        ...defectCols,
      };
    });

    const anisakisRow = lot_anisakis.getLatestFrom(lot_no);
    const filePath = await generateExcelFile(enrichedData, headers, anisakisRow);
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `${datePrefix}_${lot_no}.xlsx`;

    res.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.header("Content-Disposition", `attachment; filename=${filename}`);
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error(err);
        res.status(500).send("Error occurred during file download");
      }
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// Start the server
app.listen(port, () => console.log(`Server running on port ${port}`));
