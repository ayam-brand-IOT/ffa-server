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

function lengthDistributionChart(doc, dist, range) {
  const chartH = 150;
  const padL = 34;   // room for y-axis labels
  const padB = 28;   // room for x-axis labels
  const plotX = MARGIN + padL;
  const plotW = CONTENT - padL;
  const topY = doc.y;
  const plotH = chartH - padB;
  const baseY = topY + plotH;

  const span = dist.domainMax - dist.domainMin || 1;
  const xPos = (v) => plotX + ((v - dist.domainMin) / span) * plotW;

  // Plot background + frame
  doc.rect(plotX, topY, plotW, plotH).fill(C.white).stroke(C.border);

  // Acceptable spec band
  if (range && (range.length_min != null || range.length_max != null)) {
    const x0 = xPos(range.length_min != null ? range.length_min : dist.domainMin);
    const x1 = xPos(range.length_max != null ? range.length_max : dist.domainMax);
    doc.save();
    doc.rect(x0, topY, x1 - x0, plotH).fillOpacity(0.12).fill(C.green);
    doc.restore();
    // Spec boundary lines
    doc.save().dash(2, { space: 2 }).lineWidth(0.8).strokeColor(C.green);
    if (range.length_min != null) doc.moveTo(x0, topY).lineTo(x0, baseY).stroke();
    if (range.length_max != null) doc.moveTo(x1, topY).lineTo(x1, baseY).stroke();
    doc.undash().restore();
  }

  // Y gridlines + labels (counts)
  const yTicks = Math.min(4, dist.maxBinCount) || 1;
  doc.font("Helvetica").fontSize(6).fillColor(C.muted);
  for (let i = 0; i <= yTicks; i++) {
    const val = Math.round((dist.maxBinCount * i) / yTicks);
    const y = baseY - (i / yTicks) * plotH;
    doc.save().lineWidth(0.4).strokeColor("#EEF1F7").moveTo(plotX, y).lineTo(plotX + plotW, y).stroke().restore();
    doc.fillColor(C.muted).text(String(val), MARGIN, y - 3, { width: padL - 6, align: "right" });
  }

  // Histogram bars
  dist.bins.forEach((b) => {
    if (!b.count) return;
    const bx = xPos(b.x0);
    const bw = Math.max(1, xPos(b.x1) - xPos(b.x0) - 1.5);
    const bh = (b.count / dist.maxBinCount) * plotH;
    doc.rect(bx + 0.75, baseY - bh, bw, bh).fillOpacity(0.85).fill("#9FB6DC");
    doc.fillOpacity(1);
  });

  // Fitted Gaussian curve (scaled so its peak reaches the top of the plot)
  if (dist.curve.length && dist.maxCurveY > 0) {
    doc.save().lineWidth(1.6).strokeColor(C.brand);
    dist.curve.forEach((pt, i) => {
      const px = xPos(pt.x);
      const py = baseY - (pt.y / dist.maxCurveY) * plotH;
      if (i === 0) doc.moveTo(px, py);
      else doc.lineTo(px, py);
    });
    doc.stroke().restore();
  }

  // Mean line
  const meanX = xPos(dist.mean);
  doc.save().dash(3, { space: 2 }).lineWidth(1).strokeColor(C.accent)
    .moveTo(meanX, topY).lineTo(meanX, baseY).stroke().undash().restore();

  // X-axis ticks/labels
  const xTicks = 6;
  doc.font("Helvetica").fontSize(6).fillColor(C.muted);
  for (let i = 0; i <= xTicks; i++) {
    const val = dist.domainMin + (i / xTicks) * span;
    const x = xPos(val);
    doc.save().lineWidth(0.4).strokeColor(C.border).moveTo(x, baseY).lineTo(x, baseY + 3).stroke().restore();
    doc.fillColor(C.muted).text(val.toFixed(0), x - 12, baseY + 5, { width: 24, align: "center" });
  }
  doc.font("Helvetica").fontSize(6.5).fillColor(C.muted)
    .text("Fish Length (cm)", plotX, baseY + 15, { width: plotW, align: "center" });

  // Legend
  const legY = topY + 4;
  let legX = plotX + 6;
  const legendItem = (color, label, line) => {
    if (line) {
      doc.save().lineWidth(1.6).strokeColor(color).moveTo(legX, legY + 4).lineTo(legX + 12, legY + 4).stroke().restore();
    } else {
      doc.rect(legX, legY, 12, 8).fillOpacity(0.85).fill(color).fillOpacity(1);
    }
    doc.font("Helvetica").fontSize(6.5).fillColor(C.text).text(label, legX + 15, legY + 1);
    legX += 15 + doc.widthOfString(label) + 14;
  };
  legendItem("#9FB6DC", "Samples", false);
  legendItem(C.brand, "Normal fit", true);
  legendItem(C.accent, `Mean ${dist.mean.toFixed(1)} cm`, true);

  doc.y = baseY + padB + 6;
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
    { label: "Length Range",    value: data.lengthSpec ? data.lengthSpec.rangeLabel : "—" },
    { label: "Production Date", value: dateStr(data.lot.production_date) },
    { label: "Order No",        value: data.lot.order_no },
    { label: "Item Code",       value: data.lot.item_code },
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

  // ── LENGTH COMPLIANCE ─────────────────────────────────────────────────────
  if (data.lengthSpec) {
    const ls = data.lengthSpec;
    sectionTitle(doc, "Length Compliance");
    doc.moveDown(0.3);

    const pctColor = parseFloat(ls.pct) >= 90 ? C.green : parseFloat(ls.pct) >= 70 ? C.accent : C.red;

    keyValueGrid(doc, [
      { label: "Acceptable Range", value: ls.rangeLabel },
      { label: "Samples Evaluated", value: String(ls.evaluated) },
      { label: "In Spec",          value: `${ls.inSpec} / ${ls.evaluated}` },
      { label: "Out of Spec",      value: String(ls.outOfSpec) },
    ], 4);

    const barY = doc.y;
    horizontalBar(doc, MARGIN, barY, CONTENT, parseFloat(ls.pct), pctColor);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(pctColor)
      .text(`${ls.pct}% within acceptable length range`, MARGIN, barY + 12);
    doc.y = barY + 28;
    doc.moveDown(0.5);
  }

  // ── LENGTH DISTRIBUTION ───────────────────────────────────────────────────
  if (data.lengthDistribution) {
    // Needs ~200pt; break to a new page if it won't fit
    if (doc.y + 210 > PAGE_H - 80) {
      addPageFooter(doc, reportDate, data.lot.lot_no);
      doc.addPage();
      doc.y = MARGIN;
    }
    sectionTitle(doc, "Fish Length Distribution");
    doc.moveDown(0.3);

    const ld = data.lengthDistribution;
    doc.font("Helvetica").fontSize(8).fillColor(C.muted)
      .text(
        `n = ${ld.count}   ·   Mean ${fmt(ld.mean)} cm   ·   Std Dev ${fmt(ld.std)} cm   ·   Range ${fmt(ld.min)}–${fmt(ld.max)} cm`,
        MARGIN, doc.y
      );
    doc.moveDown(0.5);

    lengthDistributionChart(doc, ld, data.lengthSpec ? data.lengthSpec.range : null);
    doc.moveDown(0.5);
  }

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

  // ── ANISAKIS INSPECTION ───────────────────────────────────────────────────
  if (data.anisakis) {
    const an = data.anisakis;
    const m  = an.metrics;

    // Needs ~140pt for title + summary + 4 table rows.
    if (doc.y + 140 > PAGE_H - 80) {
      addPageFooter(doc, reportDate, data.lot.lot_no);
      doc.addPage();
      doc.y = MARGIN;
    }

    sectionTitle(doc, "Anisakis Inspection");
    doc.moveDown(0.3);

    doc.font("Helvetica").fontSize(8).fillColor(C.muted)
      .text(
        `${an.fish_analyzed} fish analyzed   ·   Inspected ${dateStr(an.recorded_at)}   ·   ` +
        `Prevalence = infected fish / fish analyzed   ·   Intensity = parasites found / infected fish`,
        MARGIN, doc.y, { width: CONTENT }
      );
    doc.moveDown(0.6);

    const rowH   = 18;
    const siteW  = 120;
    const infW   = 75;
    const foundW = 75;
    const barW   = 120;
    const pctW   = 45;
    const intW   = CONTENT - siteW - infW - foundW - barW - pctW;

    const xSite  = MARGIN;
    const xInf   = xSite + siteW;
    const xFound = xInf + infW;
    const xBar   = xFound + foundW;
    const xPct   = xBar + barW;
    const xInt   = xPct + pctW;

    // Table header
    const hY = doc.y;
    doc.rect(MARGIN, hY, CONTENT, rowH).fill(C.light).stroke(C.border);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.muted);
    doc.text("ANISAKIS IN",   xSite + 6,  hY + 5);
    doc.text("FISH",          xInf + 6,   hY + 5, { width: infW - 12,   align: "right" });
    doc.text("FOUND",         xFound + 6, hY + 5, { width: foundW - 12, align: "right" });
    doc.text("PREVALENCE",    xBar + 6,   hY + 5);
    doc.text("INTENSITY",     xInt,       hY + 5, { width: intW - 6,    align: "right" });
    doc.y = hY + rowH;

    const rows = [
      { name: "Guts",     fish: an.fish_with_guts,     found: an.presence_guts,     prev: m.prevalence_guts,     int: m.intensity_guts },
      { name: "Belly",    fish: an.fish_with_belly,    found: an.presence_belly,    prev: m.prevalence_belly,    int: m.intensity_belly },
      { name: "Embedded", fish: an.fish_with_embedded, found: an.presence_embedded, prev: m.prevalence_embedded, int: m.intensity_embedded },
    ];

    rows.forEach((r, i) => {
      const rY   = doc.y;
      const pct  = r.prev == null ? 0 : r.prev;
      const fill = i % 2 === 0 ? C.white : "#F7F9FF";
      doc.rect(MARGIN, rY, CONTENT, rowH).fill(fill).stroke(C.border);

      const barColor = pct > 30 ? C.red : pct > 10 ? C.accent : C.green;

      doc.font("Helvetica").fontSize(8).fillColor(C.text)
        .text(r.name, xSite + 6, rY + 5, { width: siteW - 12 });
      doc.text(String(r.fish ?? 0),  xInf + 6,   rY + 5, { width: infW - 12,   align: "right" });
      doc.text(String(r.found ?? 0), xFound + 6, rY + 5, { width: foundW - 12, align: "right" });

      horizontalBar(doc, xBar + 6, rY + 5, barW - 12, pct, barColor);

      doc.font("Helvetica-Bold").fontSize(8).fillColor(barColor)
        .text(r.prev == null ? "—" : `${fmt(r.prev)}%`, xPct, rY + 5, { width: pctW - 6, align: "right" });
      doc.font("Helvetica").fontSize(8).fillColor(C.text)
        .text(r.int == null ? "—" : fmt(r.int, 2), xInt, rY + 5, { width: intW - 6, align: "right" });

      doc.y = rY + rowH;
    });

    doc.moveDown(0.8);
  }

  // ── EXTRA IMAGES ─────────────────────────────────────────────────────────
  if (data.extraImages.length > 0) {
    sectionTitle(doc, `Other Findings Images  (${data.extraImages.length})`);
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
