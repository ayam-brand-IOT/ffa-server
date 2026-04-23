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
const lotReport  = require("./services/lotReport");
const pdfReport  = require("./services/pdfReport");
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

async function generateExcelFile(data, headers) {
  const workbook = new Excel.Workbook();
  const worksheet = workbook.addWorksheet("My Sheet");

  worksheet.columns = headers;
  
  data.forEach((row) => worksheet.addRow(row));

  const filePath = path.join(__dirname, "data.xlsx");
  await workbook.xlsx.writeFile(filePath);
  return filePath;
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

app.get("/lot_guts_weight/:lot_no", (req, res) => {
  const data = lot_guts.getAllFrom(req.params.lot_no);
  res.json(data);
});

app.get("/lot_guts_weight_latest/:lot_no", (req, res) => {
  const data = lot_guts.getLatestFrom(req.params.lot_no);
  res.json(data ?? {});
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
    // Fetch lot information
    const lotInfo = lot.getByLotNo(lot_no);
    
    if (!lotInfo) {
      return res.status(404).send("Lot not found");
    }

    // Fetch data from the database
    const headers = [
      { header: "id", key: "id" },
      { header: "Lot #", key: "lot_no" },
      { header: "Order No", key: "order_no" },
      { header: "Supplier", key: "supplier" },
      { header: "Weight", key: "weight" },
      { header: "Length", key: "length" },
      { header: "Height", key: "height" },
      { header: "Date", key: "date" },
      { header: "Defects", key: "defects"}
    ];
    
    const {data} = muestra.getByLotNo(lot_no);

    // Add lot info to each sample
    const enrichedData = data.map(sample => ({
      ...sample,
      order_no: lotInfo.order_no,
      supplier: lotInfo.supplier
    }));

    // Generate Excel file
    const filePath = await generateExcelFile(enrichedData, headers);

    // Set filename for the download
    const filename = "data.xlsx";

    // Set the headers and send the file
    res.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.header("Content-Disposition", `attachment; filename=${filename}`);
    res.sendFile(filePath, (err) => {
      if (err) {
        // Handle error, but don't expose to the client
        console.error(err);
        res.status(500).send("Error occurred during file download");
      }

      // Optionally delete the file after sending it
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    // Handle errors
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// Start the server
app.listen(port, () => console.log(`Server running on port ${port}`));
