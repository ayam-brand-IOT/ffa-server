const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// ─── palette ────────────────────────────────────────────────────────────────
const C = {
  brand:    "#003087",   // Ayam Brand navy
  accent:   "#E8A020",   // Ayam Brand gold
  light:    "#F0F4FA",
  border:   "#C8D4E8",
  text:     "#1A1A2E",
  muted:    "#6B7A99",
  white:    "#FFFFFF",
  green:    "#2E7D32",
  red:      "#C62828",
};

const MARGIN  = 50;
const PAGE_W  = 595.28;  // A4
const PAGE_H  = 841.89;
const CONTENT = PAGE_W - MARGIN * 2;

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmt(val, decimals = 1) {
  const n = parseFloat(val);
  return isNaN(n) ? "—" : n.toFixed(decimals);
}

function dateStr(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function sectionTitle(doc, title) {
  const y = doc.y;
  doc.rect(MARGIN, y, CONTENT, 22).fill(C.brand);
  doc
    .fillColor(C.white)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(title.toUpperCase(), MARGIN + 8, y + 7, { width: CONTENT - 16 });
  doc.moveDown(0.1);
  doc.fillColor(C.text);
}

function keyValueGrid(doc, items, cols = 2) {
  const startY = doc.y + 8;
  const colW   = CONTENT / cols;
  let col = 0;
  let rowY = startY;
  let maxRowH = 0;

  items.forEach((item, i) => {
    const x = MARGIN + col * colW;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(C.muted).text(item.label.toUpperCase(), x, rowY);
    doc.font("Helvetica").fontSize(9).fillColor(C.text).text(item.value ?? "—", x, rowY + 10, { width: colW - 10 });
    const h = doc.y - rowY;
    if (h > maxRowH) maxRowH = h;

    col++;
    if (col >= cols || i === items.length - 1) {
      col = 0;
      rowY += maxRowH + 6;
      maxRowH = 0;
    }
  });

  doc.y = rowY + 6;
}

function statBox(doc, x, y, w, h, label, value, unit = "") {
  doc.rect(x, y, w, h).fill(C.light).stroke(C.border);
  doc
    .font("Helvetica-Bold").fontSize(18).fillColor(C.brand)
    .text(value, x, y + 8, { width: w, align: "center" });
  if (unit) {
    doc.font("Helvetica").fontSize(7).fillColor(C.muted)
      .text(unit, x, y + 28, { width: w, align: "center" });
  }
  doc.font("Helvetica").fontSize(7).fillColor(C.muted)
    .text(label.toUpperCase(), x, y + h - 14, { width: w, align: "center" });
}

function horizontalBar(doc, x, y, totalW, pct, color) {
  const filled = Math.max(2, (pct / 100) * totalW);
  doc.rect(x, y, totalW, 8).fill("#E8ECF4");
  doc.rect(x, y, filled, 8).fill(color);
}

function addPageFooter(doc, reportDate, lotNo) {
  const bottom = PAGE_H - 30;
  doc
    .moveTo(MARGIN, bottom).lineTo(PAGE_W - MARGIN, bottom)
    .stroke(C.border);
  doc
    .font("Helvetica").fontSize(7).fillColor(C.muted)
    .text(
      `AYAM BRAND — Frozen Fish Analysis Report   |   Lot: ${lotNo}   |   Generated: ${reportDate}`,
      MARGIN, bottom + 6, { width: CONTENT, align: "left" }
    )
    .text(`Page ${doc.bufferedPageRange().start + doc.bufferedPageRange().count}`,
      MARGIN, bottom + 6, { width: CONTENT, align: "right" }
    );
}

// ─── main export ─────────────────────────────────────────────────────────────
function generateLotPdf(data, uploadsPath) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN, bottom: 60, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: {
      Title: `FFA Report — Lot ${data.lot.lot_no}`,
      Author: "Ayam Brand FFA System",
      Subject: "Frozen Fish Analysis",
    },
  });

  const reportDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  // ── HEADER ────────────────────────────────────────────────────────────────
  // Navy bar
  doc.rect(0, 0, PAGE_W, 70).fill(C.brand);

  // Company name
  doc.font("Helvetica-Bold").fontSize(22).fillColor(C.white)
    .text("AYAM BRAND", MARGIN, 18);
  doc.font("Helvetica").fontSize(10).fillColor(C.accent)
    .text("Frozen Fish Analysis  (FFA)  —  Quality Control Report", MARGIN, 44);

  // Date top-right
  doc.font("Helvetica").fontSize(8).fillColor(C.white)
    .text(reportDate, PAGE_W - MARGIN - 80, 28, { width: 80, align: "right" });

  // Gold accent line
  doc.rect(0, 70, PAGE_W, 4).fill(C.accent);

  doc.y = 90;

  // ── LOT INFORMATION ───────────────────────────────────────────────────────
  sectionTitle(doc, "Lot Information");

  keyValueGrid(doc, [
    { label: "Lot No",          value: data.lot.lot_no },
    { label: "Supplier",        value: data.lot.supplier },
    { label: "Fish Species",    value: data.lot.fish_species },
    { label: "Type",            value: data.lot.type },
    { label: "Size",            value: data.lot.size },
    { label: "Production Date", value: dateStr(data.lot.production_date) },
    { label: "Order No",        value: data.lot.order_no },
    { label: "WMS Code",        value: data.lot.wms_code },
  ], 4);

  doc.moveDown(0.5);

  // ── ANALYSIS SUMMARY ──────────────────────────────────────────────────────
  sectionTitle(doc, "Analysis Summary");
  doc.moveDown(0.3);

  const boxH  = 55;
  const boxW  = (CONTENT - 10) / 5;
  const bY    = doc.y;

  const gutsW = data.gutsWeight ? `${fmt(data.gutsWeight.guts_weight, 1)} g` : "—";

  statBox(doc, MARGIN,                 bY, boxW - 2, boxH, "Samples",       String(data.summary.sample_count));
  statBox(doc, MARGIN + boxW,          bY, boxW - 2, boxH, "Avg Weight",    fmt(data.summary.avg_weight),  "g");
  statBox(doc, MARGIN + boxW * 2,      bY, boxW - 2, boxH, "Avg Length",    fmt(data.summary.avg_length),  "cm");
  statBox(doc, MARGIN + boxW * 3,      bY, boxW - 2, boxH, "Avg Height",    fmt(data.summary.avg_height),  "cm");
  statBox(doc, MARGIN + boxW * 4,      bY, boxW - 2, boxH, "Guts Weight",   gutsW);

  doc.y = bY + boxH + 14;

  // ── DEFECT ANALYSIS ───────────────────────────────────────────────────────
  sectionTitle(doc, "Defect Analysis");
  doc.moveDown(0.3);

  if (data.defects.length === 0) {
    doc.font("Helvetica").fontSize(9).fillColor(C.muted)
      .text("No defects recorded for this lot.", MARGIN, doc.y);
    doc.moveDown(1);
  } else {
    const rowH   = 18;
    const barW   = 160;
    const countW = 45;
    const pctW   = 40;
    const nameW  = CONTENT - barW - countW - pctW - 10;

    // Table header
    const hY = doc.y;
    doc.rect(MARGIN, hY, CONTENT, rowH).fill(C.light).stroke(C.border);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.muted);
    doc.text("DEFECT",        MARGIN + 6,                        hY + 5);
    doc.text("DISTRIBUTION",  MARGIN + nameW + 6,                hY + 5);
    doc.text("COUNT",         MARGIN + nameW + barW + 6,         hY + 5);
    doc.text("% OF SAMPLES",  MARGIN + nameW + barW + countW + 6, hY + 5);
    doc.y = hY + rowH;

    data.defects.forEach((d, i) => {
      const rY   = doc.y;
      const pct  = parseFloat(d.pct);
      const fill = i % 2 === 0 ? C.white : "#F7F9FF";
      doc.rect(MARGIN, rY, CONTENT, rowH).fill(fill).stroke(C.border);

      doc.font("Helvetica").fontSize(8).fillColor(C.text)
        .text(d.name, MARGIN + 6, rY + 5, { width: nameW - 6, ellipsis: true });

      const barColor = pct > 30 ? C.red : pct > 10 ? C.accent : C.green;
      horizontalBar(doc, MARGIN + nameW + 6, rY + 5, barW - 12, pct, barColor);

      doc.font("Helvetica").fontSize(8).fillColor(C.text)
        .text(String(d.count), MARGIN + nameW + barW + 6, rY + 5, { width: countW - 6, align: "right" });
      doc.font("Helvetica-Bold").fontSize(8).fillColor(barColor)
        .text(`${d.pct}%`, MARGIN + nameW + barW + countW + 6, rY + 5, { width: pctW - 6, align: "right" });

      doc.y = rY + rowH;
    });
    doc.moveDown(0.8);
  }

  // ── BROKEN BELLY TEST ─────────────────────────────────────────────────────
  sectionTitle(doc, "Broken Belly Test (BRT)");
  doc.moveDown(0.3);

  const bb = data.brokenBelly;
  keyValueGrid(doc, [
    { label: "Number of Tests",        value: String(bb.test_count ?? 0) },
    { label: "Avg Break Point",        value: bb.avg_break_point ? `${fmt(bb.avg_break_point)} N` : "—" },
    { label: "Break Points",
      value: data.brokenBellyPoints.length
        ? data.brokenBellyPoints.map((v) => `${fmt(v, 0)} N`).join("  ·  ")
        : "—" },
  ], 3);
  doc.moveDown(0.8);

  // ── EXTRA IMAGES ─────────────────────────────────────────────────────────
  if (data.extraImages.length > 0) {
    sectionTitle(doc, `Extra Lot Images  (${data.extraImages.length})`);
    doc.moveDown(0.4);

    const imgPerRow  = 3;
    const imgPadding = 8;
    const imgW       = (CONTENT - imgPadding * (imgPerRow - 1)) / imgPerRow;
    const imgH       = imgW * 0.75;

    let col = 0;
    let rowStartY = doc.y;

    for (const filename of data.extraImages) {
      const imgPath = path.join(uploadsPath, path.basename(filename));
      if (!fs.existsSync(imgPath)) { col++; continue; }

      const x = MARGIN + col * (imgW + imgPadding);
      const y = rowStartY;

      // Check page break
      if (y + imgH > PAGE_H - 80) {
        addPageFooter(doc, reportDate, data.lot.lot_no);
        doc.addPage();
        rowStartY = MARGIN;
        col = 0;
      }

      try {
        doc.rect(x - 1, rowStartY - 1, imgW + 2, imgH + 2).stroke(C.border);
        doc.image(imgPath, x, rowStartY, { width: imgW, height: imgH, fit: [imgW, imgH], align: "center", valign: "center" });
      } catch (_) {
        doc.rect(x, rowStartY, imgW, imgH).fill(C.light);
        doc.font("Helvetica").fontSize(7).fillColor(C.muted)
          .text("Image unavailable", x, rowStartY + imgH / 2 - 5, { width: imgW, align: "center" });
      }

      col++;
      if (col >= imgPerRow) {
        col = 0;
        rowStartY += imgH + imgPadding;
      }
    }

    doc.y = rowStartY + (col > 0 ? imgH + 10 : 10);
    doc.moveDown(0.5);
  }

  // ── FOOTER on every page ─────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    addPageFooter(doc, reportDate, data.lot.lot_no);
  }

  doc.flushPages();
  doc.end();
  return doc;
}

module.exports = { generateLotPdf };
