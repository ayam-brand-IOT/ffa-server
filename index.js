const fs = require("fs");
const cors = require("cors");
const path = require("path"); // import path
const multer = require("multer");
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
const lotExcel   = require("./services/lotExcel");
const lotExports = require("./services/lotExports");
const calibration = require("./services/calibrationHistory");
const sizeClasses = require("./services/sizeClasses");
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

// POST handler for adding data with image upload
app.post("/add", upload.single("image"), (req, res) => {
  const newData = req.body;
  // generate filename with datetime
  newData.defects = JSON.parse(req.body.defects);
  newData.image = req.file.filename;
  // Tell the station which size the fish was classified as
  const { id, size } = muestra.create(newData);
  res.json({ message: "New data added successfully!", id, size });
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

app.get("/size-classes", (req, res) => {
  res.json(sizeClasses.getClasses());
});

app.post("/size-classes", (req, res) => {
  try {
    res.json(sizeClasses.saveClasses(req.body));
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "Failed to save size classes" });
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
    const workbook = lotExcel.buildLotWorkbook(lot_no);
    if (!workbook) return res.status(404).send("Lot not found");
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `${datePrefix}_${lot_no}.xlsx`;

    res.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.header("Content-Disposition", `attachment; filename=${filename}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).send("Internal Server Error");
    else res.end();
  }
});

// SAVED EXPORTS
// The station asks for one when a lot's analysis is finished; the report and
// the Excel stay on this server and can be fetched later by id or stamp.
function describeExport(row) {
  const base = `/ffa-station/getdata/${row.id}`;
  return {
    id: row.id,
    lot_no: row.lot_no,
    stamp: row.stamp,
    created_at: row.created_at,
    files: { pdf: `${base}/pdf`, excel: `${base}/excel` },
  };
}

app.post("/ffa-station/exports/:lot_no", async (req, res) => {
  try {
    const row = await lotExports.create(req.params.lot_no, uploadsPath);
    if (!row) return res.status(404).json({ error: `Lot ${req.params.lot_no} not found` });
    res.status(201).json(describeExport(row));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not save the lot's report" });
  }
});

app.get("/ffa-station/getdata", (req, res) => {
  res.json(lotExports.list(req.query.lot_no).map(describeExport));
});

app.get("/ffa-station/getdata/:key", (req, res) => {
  const row = lotExports.find(req.params.key);
  if (!row) return res.status(404).json({ error: `No saved export ${req.params.key}` });
  res.json(describeExport(row));
});

app.get("/ffa-station/getdata/:key/:kind", (req, res) => {
  const row = lotExports.find(req.params.key);
  const file = row && lotExports.filePath(row, req.params.kind);
  if (!file || !fs.existsSync(file)) {
    return res.status(404).json({ error: "File not found" });
  }
  res.download(file);
});

// Start the server

app.listen(port, () => console.log(`Server running on port ${port}`));
