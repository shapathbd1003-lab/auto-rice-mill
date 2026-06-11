const PDFDocument = require('pdfkit');

const BRAND_COLOR = '#1a6b3a'; // mill green
const LIGHT_GRAY  = '#f5f5f5';
const TEXT_COLOR  = '#212121';

function mmToPt(mm) { return mm * 2.8346; }

/**
 * Creates a base PDFDocument with standard page settings and returns { doc, buffers, finalize }.
 * Caller pipes chunks; calling finalize() returns a Buffer.
 */
function createDoc(landscape = false) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: landscape ? 'landscape' : 'portrait',
    margins: { top: mmToPt(15), bottom: mmToPt(15), left: mmToPt(15), right: mmToPt(15) },
    autoFirstPage: true,
  });
  const buffers = [];
  doc.on('data', (chunk) => buffers.push(chunk));
  const finalize = () => new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
    doc.end();
  });
  return { doc, finalize };
}

function pageHeader(doc, millName, title, subtitle = '') {
  const left  = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const top   = doc.page.margins.top;

  doc.rect(left, top, right - left, mmToPt(18)).fill(BRAND_COLOR);
  doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
     .text(millName, left + 8, top + 6, { width: (right - left) * 0.6 });
  doc.fontSize(9).font('Helvetica')
     .text(title, left + 8, top + 22);
  if (subtitle) {
    doc.text(subtitle, right - 180, top + 12, { width: 172, align: 'right' });
  }
  doc.fillColor(TEXT_COLOR);
  return top + mmToPt(18) + 6;
}

function tableHeader(doc, y, columns) {
  const left  = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  doc.rect(left, y, right - left, 18).fill(LIGHT_GRAY);
  doc.fillColor(TEXT_COLOR).fontSize(8).font('Helvetica-Bold');
  let x = left + 4;
  columns.forEach(({ label, width }) => {
    doc.text(label, x, y + 5, { width: width - 4, align: 'left' });
    x += width;
  });
  doc.fillColor(TEXT_COLOR);
  return y + 18;
}

function tableRow(doc, y, columns, values, shaded = false) {
  const left  = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  if (shaded) doc.rect(left, y, right - left, 16).fill('#fafafa');
  doc.fillColor(TEXT_COLOR).fontSize(8).font('Helvetica');
  let x = left + 4;
  columns.forEach(({ width, align = 'left' }, i) => {
    doc.text(String(values[i] ?? ''), x, y + 4, { width: width - 4, align });
    x += width;
  });
  return y + 16;
}

function totalRow(doc, y, label, amount, currency = 'BDT') {
  const left  = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  doc.rect(left, y, right - left, 18).fill('#e8f5e9');
  doc.fillColor(BRAND_COLOR).fontSize(9).font('Helvetica-Bold')
     .text(label, left + 4, y + 5)
     .text(`${currency} ${Number(amount).toLocaleString('en-BD', { minimumFractionDigits: 2 })}`, left + 4, y + 5, { width: right - left - 8, align: 'right' });
  doc.fillColor(TEXT_COLOR);
  return y + 18;
}

function pageFooter(doc, pageNum) {
  const bottom = doc.page.height - doc.page.margins.bottom + 4;
  doc.fontSize(7).fillColor('#888888').font('Helvetica')
     .text(`Page ${pageNum}  •  Auto Rice Mill Management System  •  Printed ${new Date().toLocaleString('en-BD')}`,
           doc.page.margins.left, bottom, { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
}

module.exports = { createDoc, pageHeader, tableHeader, tableRow, totalRow, pageFooter, mmToPt, BRAND_COLOR, TEXT_COLOR };
