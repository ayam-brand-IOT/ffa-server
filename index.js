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
// const { v4: uuidv4 } = require('uuid'); // import uuid

const app = express();

app.use(cors({ origin: "*" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"))); // serve static files from the "public" directory

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "muestras")); // use path.join to ensure the correct path on all OSes
  },
  filename: function (req, file, cb) {
    // const uniqueFilename = `${uuidv4()}-${file.originalname}`
    const uniqueFilename = `${Date.now()}.jpg`;
    cb(null, uniqueFilename);
  },
});

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
  // return image that supossed to be in "muestras folder"
  const file =
    path.dirname(require.main.filename) + "/muestras/" + req.params.path;
  if (fs.existsSync(file)) res.sendFile(path.resolve(file));
  else res.status(422).json({ error: "There's no Image" });
});

app.get("/lot_image/:path", (req, res) => {
  // return image that supossed to be in "muestras folder"
  const file =
    path.dirname(require.main.filename) + "/muestras/" + req.params.path;
  if (fs.existsSync(file)) res.sendFile(path.resolve(file));
  else res.status(422).json({ error: "There's no Image" });
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
  const data = muestra.getById(id);
  if (index !== -1) {
    data.splice(index, 1);
    res.send(`Data with ID ${id} deleted successfully!`);
  } else {
    res.send(`Data with ID ${id} not found.`);
  }
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

app.get("/lots/:page", (req, res) => {
  const page = req.params.page || 1;
  const data = lot.getMultiple(page);
  res.send(data);
});

// EXCEL
app.get("/download-lot-samples/:lot_no", async (req, res) => {
  const lot_no = req.params.lot_no;

  try {
    // Fetch data from the database
    const headers = [
      { header: "id", key: "id" },
      { header: "Lot #", key: "lot_no" },
      { header: "Weight", key: "weight" },
      { header: "Length", key: "length" },
      { header: "Height", key: "height" },
      { header: "Date", key: "date" },
      { header: "Defects", key: "defects"}
    ];
    
    const {data} = muestra.getByLotNo(lot_no); // Implement this function

    // Generate Excel file
    const filePath = await generateExcelFile(data, headers); // Implement this function

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
app.listen(3002, () => console.log("Server running on port 3002"));
