const fs = require("fs");
const path = require("path");

const FILE = path.resolve(
  process.env.SIZE_RANGES_PATH || path.join(__dirname, "..", "size_ranges.json")
);

const VALID_SIZES = ["TALL", "JITNEY", "BUFFET"];

const DEFAULTS = {
  sizes: {
    TALL:   { length_min: 18, length_max: 30 },
    JITNEY: { length_min: 12, length_max: 18 },
    BUFFET: { length_min: 8,  length_max: 12 },
  },
};

function getRanges() {
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.sizes !== "object") return { ...DEFAULTS };
    return parsed;
  } catch (e) {
    return { ...DEFAULTS };
  }
}

function saveRanges(data) {
  const incoming = (data && data.sizes) || {};
  const sizes = {};

  VALID_SIZES.forEach((size) => {
    const r = incoming[size] || {};
    const min = r.length_min === "" || r.length_min == null ? null : Number(r.length_min);
    const max = r.length_max === "" || r.length_max == null ? null : Number(r.length_max);
    sizes[size] = {
      length_min: Number.isFinite(min) ? min : null,
      length_max: Number.isFinite(max) ? max : null,
    };
  });

  const payload = { sizes };
  fs.writeFileSync(FILE, JSON.stringify(payload, null, 2));
  return { message: "Size ranges saved", data: payload };
}

function getRangeForSize(size) {
  const ranges = getRanges();
  return (size && ranges.sizes[size]) || null;
}

// Returns 1 (in spec), 0 (out of spec), or null (no range / not measurable)
function evaluateLength(size, length) {
  const range = getRangeForSize(size);
  if (!range) return null;

  const len = Number(length);
  if (!Number.isFinite(len)) return null;

  const { length_min, length_max } = range;
  if (length_min == null && length_max == null) return null;

  if (length_min != null && len < length_min) return 0;
  if (length_max != null && len > length_max) return 0;
  return 1;
}

module.exports = { getRanges, saveRanges, getRangeForSize, evaluateLength, VALID_SIZES };
