const fs = require("fs");
const path = require("path");

// Acceptable length ranges per can size, in millimetres: the same unit the
// vision analysis (ffa-app) stores in MUESTRA.length.
//
// The file lives next to the database so it survives a container rebuild
// (data/ is a mounted volume; the app folder is baked into the image).
const DATA_DIR = path.dirname(
  path.resolve(process.env.DATABASE_PATH || path.join(__dirname, "..", "fish_analysis.db"))
);
const FILE = path.resolve(process.env.SIZE_RANGES_PATH || path.join(DATA_DIR, "size_ranges.json"));
// Before 2026-10-22 the ranges were kept in centimetres inside the app folder.
const LEGACY_FILE = path.join(__dirname, "..", "size_ranges.json");

const UNIT = "mm";
// No can size is shorter than 30 mm or longer than 30 cm, so a stored value
// below this is a leftover in centimetres.
const LEGACY_CM_BELOW = 30;

const VALID_SIZES = ["TALL", "BIG_OVAL", "SMALL_OVAL", "JITNEY", "CLUB_CAN", "BUFFET", "TOWER"];
// Older lots were created with abbreviated sizes.
const SIZE_ALIASES = { "B/O": "BIG_OVAL", "S/O": "SMALL_OVAL", CLUB: "CLUB_CAN", TOW: "TOWER" };

const DEFAULTS = {
  unit: UNIT,
  sizes: {
    TALL:       { length_min: 100,  length_max: 110 },
    BIG_OVAL:   { length_min: 90,   length_max: 135 },
    SMALL_OVAL: { length_min: 82.5, length_max: 125 },
    JITNEY:     { length_min: 75,   length_max: 87.5 },
    CLUB_CAN:   { length_min: 70,   length_max: 87.5 },
    BUFFET:     { length_min: 65,   length_max: 72.5 },
    TOWER:      { length_min: 70,   length_max: 95 },
  },
};

function toNumberOrNull(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cmToMm(value) {
  return value != null && value < LEGACY_CM_BELOW ? Math.round(value * 100) / 10 : value;
}

function normalize(data, fromLegacy) {
  const incoming = (data && data.sizes) || {};
  const sizes = {};
  VALID_SIZES.forEach((size) => {
    const r = incoming[size] || {};
    let min = toNumberOrNull(r.length_min);
    let max = toNumberOrNull(r.length_max);
    if (fromLegacy) {
      min = cmToMm(min);
      max = cmToMm(max);
    }
    sizes[size] = { length_min: min, length_max: max };
  });
  return { unit: UNIT, sizes };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return null;
  }
}

function write(payload) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(payload, null, 2));
}

// Converts a centimetre file to millimetres once and stores it in FILE.
// Returns true when it did, so the caller can re-evaluate stored samples.
function migrate() {
  const current = readJson(FILE);
  if (current && current.unit === UNIT) return false;
  const legacy = current || readJson(LEGACY_FILE);
  write(legacy && typeof legacy.sizes === "object"
    ? normalize(legacy, legacy.unit !== UNIT)
    : DEFAULTS);
  return true;
}

function getRanges() {
  const parsed = readJson(FILE);
  if (!parsed || parsed.unit !== UNIT || typeof parsed.sizes !== "object") {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  return parsed;
}

function saveRanges(data) {
  const payload = normalize(data, false);
  write(payload);
  return { message: "Size ranges saved", data: payload };
}

function canonicalSize(size) {
  if (!size) return null;
  const key = String(size).trim().toUpperCase();
  return SIZE_ALIASES[key] || key;
}

function getRangeForSize(size) {
  const key = canonicalSize(size);
  return (key && getRanges().sizes[key]) || null;
}

// Returns 1 (in spec), 0 (out of spec), or null (no range / not measurable)
function evaluateLength(size, length, ranges) {
  const key = canonicalSize(size);
  const range = key && (ranges || getRanges()).sizes[key];
  if (!range) return null;

  const len = Number(length);
  if (length == null || !Number.isFinite(len) || len <= 0) return null;

  const { length_min, length_max } = range;
  if (length_min == null && length_max == null) return null;

  if (length_min != null && len < length_min) return 0;
  if (length_max != null && len > length_max) return 0;
  return 1;
}

module.exports = {
  UNIT, getRanges, saveRanges, getRangeForSize, evaluateLength, canonicalSize, migrate, VALID_SIZES,
};
