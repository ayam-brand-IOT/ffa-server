const fs = require("fs");
const path = require("path");

// Each fish is sized by its weight when it is captured, instead of the lot
// carrying one size chosen up front. A size starts at its minimum weight and
// runs up to the next size's minimum; the heaviest size has no upper limit.
// A fish lighter than the smallest size is rejected.
//
// The file lives next to the database so it survives a container rebuild
// (data/ is a mounted volume; the app folder is baked into the image).
const DATA_DIR = path.dirname(
  path.resolve(process.env.DATABASE_PATH || path.join(__dirname, "..", "fish_analysis.db"))
);
const FILE = path.resolve(process.env.SIZE_CLASSES_PATH || path.join(DATA_DIR, "size_classes.json"));

const UNIT = "g";
const REJECTED = "REJECTED";
// Lightest to heaviest.
const SIZES = ["JITNEY", "BUFFET", "TALL"];

const DEFAULTS = {
  unit: UNIT,
  sizes: [
    { size: "JITNEY", weight_min: 45 },
    { size: "BUFFET", weight_min: 65 },
    { size: "TALL",   weight_min: 70 },
  ],
};

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return null;
  }
}

// Returns an error message, or null when the classes are usable.
function validate(sizes) {
  if (!Array.isArray(sizes) || sizes.length !== SIZES.length) return "Expected one entry per size";
  for (let i = 0; i < SIZES.length; i++) {
    const entry = sizes[i];
    if (!entry || entry.size !== SIZES[i]) return `Expected ${SIZES[i]} in position ${i + 1}`;
    if (!Number.isInteger(entry.weight_min) || entry.weight_min <= 0) {
      return `${entry.size}: the minimum weight must be a whole number of grams above 0`;
    }
    if (i > 0 && entry.weight_min <= sizes[i - 1].weight_min) {
      return `${entry.size} must start above ${sizes[i - 1].size}`;
    }
  }
  return null;
}

function getClasses() {
  const parsed = readJson(FILE);
  if (!parsed || parsed.unit !== UNIT || validate(parsed.sizes)) {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  return parsed;
}

function saveClasses(data) {
  const incoming = (data && data.sizes) || [];
  const sizes = SIZES.map((size) => {
    const entry = incoming.find((e) => e && e.size === size) || {};
    const n = Number(entry.weight_min);
    return { size, weight_min: entry.weight_min === "" || entry.weight_min == null ? NaN : n };
  });
  const error = validate(sizes);
  if (error) {
    const err = new Error(error);
    err.statusCode = 400;
    throw err;
  }
  const payload = { unit: UNIT, sizes };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(payload, null, 2));
  return { message: "Size classes saved", data: payload };
}

// Size for a weight in grams, REJECTED below the smallest size, or null
// when there is no usable weight.
function classify(weight, classes) {
  const w = Number(weight);
  if (weight == null || weight === "" || !Number.isFinite(w) || w <= 0) return null;
  const sizes = (classes || getClasses()).sizes;
  for (let i = sizes.length - 1; i >= 0; i--) {
    if (w >= sizes[i].weight_min) return sizes[i].size;
  }
  return REJECTED;
}

// Human-readable weight range of every class, e.g. "45 – 64 g", "70+ g".
// Kept to characters the PDF's built-in Helvetica can draw (no "≥").
function rangeLabels(classes) {
  const sizes = (classes || getClasses()).sizes;
  const labels = { [REJECTED]: `< ${sizes[0].weight_min} g` };
  sizes.forEach((entry, i) => {
    const next = sizes[i + 1];
    labels[entry.size] = next
      ? `${entry.weight_min} – ${next.weight_min - 1} g`
      : `${entry.weight_min}+ g`;
  });
  return labels;
}

module.exports = { UNIT, REJECTED, SIZES, getClasses, saveClasses, classify, rangeLabels };
